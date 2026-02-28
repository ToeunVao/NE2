"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, Timestamp, query, where } from "firebase/firestore";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
// ADD THIS LINE AT THE TOP
import { ChevronRight } from "lucide-react";
export default function CompleteAdminCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [techFilter, setTechFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
// ADD this near your other useState hooks
const [viewMode, setViewMode] = useState("calendar"); // calendar or list



  const [bookingForm, setBookingForm] = useState({
    name: "", phone: "", email: "", time: "09:00", service: "",
    groupSize: 1, bookingType: "Calendar", price: 0, 
    technician: "Any Technician", 
    notes: ""
  });
// ADD this useEffect
useEffect(() => {
  // Check if screen width is mobile (less than 768px)
  if (window.innerWidth < 768) {
    setViewMode("list");
  }
}, []);

  useEffect(() => {

    onSnapshot(collection(db, "services"), (snap) => {
      setServices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const techQuery = query(collection(db, "users"), where("role", "==", "technician"));
    onSnapshot(techQuery, (snap) => {
      setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    onSnapshot(collection(db, "appointments"), (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

  // 2. Fetch Appointments
  const q = query(
    collection(db, "appointments"), 
    // If your old app only shows "scheduled", uncomment the line below:
    // where("status", "==", "scheduled") 
  );

  const unsubscribe = onSnapshot(q, (snap) => {
   setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });

  return () => unsubscribe();
}, []);

const filteredAppointments = useMemo(() => {
  if (techFilter === "all") return appointments;
  return appointments.filter(a => a.technician === techFilter);
}, [appointments, techFilter]);

  const futureBookingsCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredAppointments.filter(a => a.appointmentTimestamp?.toDate() >= today).length;
  }, [filteredAppointments]);

  const monthlyCount = useMemo(() => {
    return filteredAppointments.filter(a => {
      const d = a.appointmentTimestamp?.toDate();
      return d && d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    }).length;
  }, [filteredAppointments, viewDate]);

  const changeMonth = (offset) => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    setViewDate(next);
  };

const handleBooking = async (e) => {
  e.preventDefault();
  const [hours, mins] = bookingForm.time.split(":");
  const finalDate = new Date(selectedDate);
  finalDate.setHours(parseInt(hours), parseInt(mins));

  await addDoc(collection(db, "appointments"), {
    ...bookingForm,
    groupSize: Number(bookingForm.groupSize),
    appointmentTimestamp: Timestamp.fromDate(finalDate),
    status: "confirmed",
    createdAt: serverTimestamp(), // Already have this
    isRead: false                 // ADD THIS LINE
  });
  
  setIsModalOpen(false);
    setBookingForm({ name: "", phone: "", email: "", time: "09:00", service: "", groupSize: 1, bookingType: "Calendar", price: 0, technician: "Any Technician", notes: "" });
  };

  const br = { borderRadius: '0.5rem' };
// Helper to find appointments for a specific calendar day
const getDailyAppointments = (date) => {
  return appointments.filter(app => {
    // 1. Get the Firebase date
    const appDate = app.appointmentTimestamp?.toDate();
    if (!appDate) return false;

    // 2. Check if it matches the calendar tile's Year, Month, and Day
    return (
      appDate.getDate() === date.getDate() &&
      appDate.getMonth() === date.getMonth() &&
      appDate.getFullYear() === date.getFullYear()
    );
  });
};

const handleNoShow = async () => {
  if (!selectedBooking?.id) {
    alert("No booking selected.");
    return;
  }
  
  const confirmNoShow = window.confirm("Mark this client as No-Show?");
  if (!confirmNoShow) return;

  try {
    console.log("Starting No-Show for:", selectedBooking.id);

    // 1. Prepare data (Safely handle any missing values)
    const historyData = {
      name: selectedBooking.name || "Unknown",
      phone: selectedBooking.phone || "No Phone",
      email: selectedBooking.email || "",
      service: selectedBooking.service || selectedBooking.id || "Unknown Service",
      technician: selectedBooking.technician || "Unassigned",
      status: "no-show",
      // Keep original appointment time if it exists
      appointmentDate: selectedBooking.appointmentTimestamp || null,
      completedAt: serverTimestamp() // Uses Firebase server time
    };

    // 2. Add to finished_clients collection
    console.log("Moving to finished_clients...");
    await addDoc(collection(db, "finished_clients"), historyData);

    // 3. Delete from original appointments collection
    console.log("Deleting original appointment...");
    await deleteDoc(doc(db, "appointments", selectedBooking.id));
    
    // 4. Update UI
    setIsDetailModalOpen(false);
    setSelectedBooking(null);
    alert("Successfully processed No-Show.");
  } catch (error) {
    // THIS WILL TELL YOU EXACTLY WHY IT FAILED in the F12 Console
    console.error("DETAILED ERROR:", error);
    alert("Failed: " + error.message);
  }
};
const handleCheckIn = async () => {
  if (!selectedBooking?.id) return;
  
  try {
    const queueData = {
      name: selectedBooking.name || "Unknown",
      phone: selectedBooking.phone || "",
      // Important: Use 'services' as an array to match your Check-In page table
      services: [selectedBooking.service || selectedBooking.id], 
      technician: selectedBooking.technician || "Any Technician",
      groupSize: selectedBooking.groupSize || "1",
      bookingType: "Appointment", // Or whatever type you prefer
      
      // CRITICAL: This must be 'checkInTimestamp' to match your useEffect query
      checkInTimestamp: serverTimestamp(), 
      
      status: "waiting"
    };

    // 1. Add to the collection your Check-In page is listening to
    await addDoc(collection(db, "active_queue"), queueData);

    // 2. Remove from calendar
    await deleteDoc(doc(db, "appointments", selectedBooking.id));
    
    setIsDetailModalOpen(false);
    setSelectedBooking(null);
    alert("Checked in successfully!");
  } catch (error) {
    console.error("Check-in error:", error);
    alert("Failed to check in: " + error.message);
  }
};

const triggerBookingNotification = async (bookingData) => {
  await addDoc(collection(db, "notifications"), {
    assignedTo: bookingData.staffId, // The specific Technician's ID
    type: "booking",
    title: "New Booking Assigned",
    message: `You have a new ${bookingData.serviceName} at ${bookingData.time}`,
    status: "unread",
    link: "/staff/appointments/book", // Where the staff clicks to see details
    createdAt: serverTimestamp()
  });
};
const now = Date.now();

// Upcoming: Sort soonest first (ascending)
const upcomingAppointments = filteredAppointments
  .filter(appt => appt.appointmentTimestamp?.toMillis() >= now)
  .sort((a, b) => a.appointmentTimestamp?.toMillis() - b.appointmentTimestamp?.toMillis());

// Past: Sort most recent first (descending)
const pastAppointments = filteredAppointments
  .filter(appt => appt.appointmentTimestamp?.toMillis() < now)
  .sort((a, b) => b.appointmentTimestamp?.toMillis() - a.appointmentTimestamp?.toMillis());

  return (
    <div className="dark:bg-slate-950 p-4 max-w-[1400px] mx-auto min-h-screen relative bg-[#f9fafb]">
      
      {/* UNIFIED CALENDAR BOX */}
      <div className="bg-white dark:bg-slate-950 shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={br}>
        <div className="p-4 flex flex-wrap items-center justify-between border-b border-gray-100 gap-4">
          <div className="flex items-center gap-3 flex-wrap">
         
{/* REPLACE the div with this button */}
<button 
  onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
  className="bg-[#db2777] text-white px-4 py-2 text-[11px] font-bold flex items-center gap-2 rounded-lg active:scale-95 transition-transform hover:bg-[#9d174d]"
>
  {viewMode === 'calendar' ? 'List all Booking' : 'Show Calendar'}
  <span className="bg-[#9d174d] px-2 py-0.5 rounded-md">{futureBookingsCount}</span>
</button>
            <div className="dark:bg-slate-950 flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
              <button onClick={() => setTechFilter("all")} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${techFilter === "all" ? 'bg-[#db2777] text-white' : 'text-gray-400'}`}>All</button>
              <button onClick={() => setTechFilter("Any Technician")} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${techFilter === "Any Technician" ? 'bg-[#db2777] text-white' : 'text-gray-400'}`}>Any Tech</button>
              {technicians.map(t => (
                <button key={t.id} onClick={() => setTechFilter(t.name)} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${techFilter === t.name ? 'bg-[#db2777] text-white' : 'text-gray-400'}`}>{t.name}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button onClick={() => changeMonth(-1)} className="bg-[#db2777] text-white w-8 h-8 flex items-center justify-center rounded-md"><i className="fas fa-chevron-left text-[10px]"></i></button>
              <span className="font-bold text-base text-gray-800 w-36 text-center">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => changeMonth(1)} className="bg-[#db2777] text-white w-8 h-8 flex items-center justify-center rounded-md"><i className="fas fa-chevron-right text-[10px]"></i></button>
            </div>
            <div className="bg-gray-100 px-3 py-2 rounded-md text-[10px] font-black text-gray-500 uppercase">Month Total: <span className="text-pink-600 ml-1">{monthlyCount}</span></div>
          </div>
        </div>
{/* REPLACE the <div className="w-full"> containing the Calendar with this: */}
<div className="w-full dark:bg-slate-950">
  {viewMode === "calendar" ? (
   <Calendar 
  onChange={(d) => { setSelectedDate(d); setIsModalOpen(true); }} 
  value={selectedDate} 
  activeStartDate={viewDate} 
  onActiveStartDateChange={({ activeStartDate }) => setViewDate(activeStartDate)} 
  showNavigation={false} 
  className="unified-salon-calendar"
  
// ... inside your Calendar component
tileContent={({ date, view }) => {
  if (view === 'month') {
    // 1. Get daily appointments and SORT by time (12:00 PM before 5:00 PM)
const dailyAppts = filteredAppointments.filter(app => {
        const appDate = app.appointmentTimestamp?.toDate();
        return appDate && 
               appDate.getDate() === date.getDate() && 
               appDate.getMonth() === date.getMonth() && 
               appDate.getFullYear() === date.getFullYear();
      })
      .sort((a, b) => a.appointmentTimestamp.toMillis() - b.appointmentTimestamp.toMillis());

    if (dailyAppts.length > 0) {
      return (
        <div className="flex flex-col gap-1 mt-1 w-full px-1">
          {dailyAppts.map((appt) => (
            <div 
              key={appt.id} 
              onClick={(e) => {
                e.stopPropagation(); 
                setSelectedBooking(appt);
                setIsDetailModalOpen(true);
              }}
              className="bg-blue-50 text-blue-700 border border-blue-100 p-1 rounded text-[9px] font-bold cursor-pointer hover:bg-blue-100"
            >
              {/* Line 1: Time and Name */}
              <div className="truncate">
                {appt.appointmentTimestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {appt.name}
              </div>
              
              {/* Line 2: SERVICE NAME (This is what was missing) */}
              <div className="text-[8px] font-normal text-gray-500 italic truncate mt-0.5">
                {appt.service || appt.services} 
              </div>
            </div>
          ))}
        </div>
      );
    }
  }
  return null;
}}
/>
  ) : (
    /* LIST VIEW FOR MOBILE */
   <div className="dark:bg-slate-950 p-4 space-y-6 bg-gray-50 min-h-[500px] pb-32">
    {filteredAppointments.length === 0 ? (
      <div className="p-20 text-center">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Bookings Found</p>
      </div>
    ) : (
      <>
        {/* ==========================================
            1. UPCOMING SECTION
           ========================================== */}
        {upcomingAppointments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upcoming Appointments</h2>
            </div>
            {upcomingAppointments.map((appt) => (
              <div 
                key={appt.id} 
                onClick={() => { setSelectedBooking(appt); setIsDetailModalOpen(true); }}
                className="bg-white p-4 rounded-xl border border-pink-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-pink-600 uppercase">
                    {appt.appointmentTimestamp?.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' })} @ {appt.appointmentTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">{appt.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 italic">
                    {appt.service || "No service specified"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="bg-pink-50 px-2 py-1 rounded-lg text-[8px] font-black text-pink-600 uppercase border border-pink-100">
                    {appt.technician}
                  </span>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ==========================================
            2. PAST SECTION
           ========================================== */}
        {pastAppointments.length > 0 && (
          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-2 px-1 opacity-50">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Past History</h2>
            </div>
            {pastAppointments.map((appt) => (
              <div 
                key={appt.id} 
                onClick={() => { setSelectedBooking(appt); setIsDetailModalOpen(true); }}
                className="bg-white/60 p-4 rounded-xl border border-slate-100 shadow-none flex items-center justify-between active:scale-[0.98] transition-transform opacity-70"
              >
                <div className="flex flex-col gap-1 text-slate-500">
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    {appt.appointmentTimestamp?.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                  <h3 className="font-bold text-slate-600 text-sm uppercase tracking-tight">{appt.name}</h3>
                  <p className="text-[9px] font-medium italic">
                    {appt.service}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="bg-slate-50 px-2 py-1 rounded text-[8px] font-black text-slate-400 uppercase border border-slate-200">
                    {appt.technician}
                  </span>
                  <ChevronRight size={14} className="text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
  )}
</div>
      </div>

      {/* FULL RESTORED BOOKING MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white w-full max-w-2xl shadow-2xl overflow-hidden" style={br}>
            <div className="bg-[#db2777] p-5 text-white flex justify-between items-center">
              <h2 className="font-bold text-sm uppercase tracking-wide">Book: {selectedDate.toDateString()}</h2>
              <button onClick={() => setIsModalOpen(false)} className="bg-white text-[#db2777] w-8 h-8 rounded-full flex items-center justify-center font-bold">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleBooking} className="p-8 grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Client Name</label>
                <input required className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none" style={br} value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Phone Number</label>
                <input className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none" style={br} value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Email</label>
                <input type="email" className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none" style={br} value={bookingForm.email} onChange={e => setBookingForm({...bookingForm, email: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Time</label>
                <input type="time" required className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none" style={br} value={bookingForm.time} onChange={e => setBookingForm({...bookingForm, time: e.target.value})} />
              </div>
<div className="space-y-1">
  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Service</label>
  <input 
    list="services-suggestion-list" 
    required 
    className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none focus:border-[#db2777]" 
    style={br}
    placeholder="Type or select service..."
    value={bookingForm.service}
    onChange={e => {
      const val = e.target.value;
      
      // Match against s.id because your Firebase uses IDs for names
      const matched = services.find(s => 
        s.id && val && s.id.toLowerCase() === val.toLowerCase()
      );

      setBookingForm({
        ...bookingForm, 
        service: val, 
        // If matched, use price from database; otherwise keep existing or 0
        price: matched ? (matched.price || 0) : bookingForm.price 
      });
    }}
  />
  <datalist id="services-suggestion-list">
    {services.map(s => (
      /* Using s.id here because that is where your 'Gel Polish', etc. lives */
      <option key={s.id} value={s.id}>
        {s.price ? `$${s.price}` : ""}
      </option>
    ))}
  </datalist>
</div>
<div className="space-y-1">
  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Group Size</label>
  <input 
    type="number" 
    min="1" 
    className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none" 
    style={br} 
    value={bookingForm.groupSize} 
    onChange={e => setBookingForm({...bookingForm, groupSize: parseInt(e.target.value) || 1})} 
  />
</div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Booking Type</label>
                <select className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none" style={br} value={bookingForm.bookingType} onChange={e => setBookingForm({...bookingForm, bookingType: e.target.value})}>
                  <option value="Calendar">Calendar</option>
                  <option value="Online">Online</option>
                  <option value="Phone">Phone</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Technician</label>
                <select required className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none font-bold text-[#db2777]" style={br} value={bookingForm.technician} onChange={e => setBookingForm({...bookingForm, technician: e.target.value})}>
                  <option value="Any Technician">Any Technician</option>
                  {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Notes</label>
                <textarea rows="2" className="w-full p-3 bg-gray-50 border border-gray-200 text-sm outline-none resize-none" style={br} value={bookingForm.notes} onChange={e => setBookingForm({...bookingForm, notes: e.target.value})}></textarea>
              </div>
              <div className="col-span-2 flex justify-end mt-4">
                <button type="submit" className="bg-[#db2777] text-white px-12 py-4 font-black text-sm shadow-xl uppercase tracking-widest" style={br}>
                  Confirm ${bookingForm.price}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

{/* BOOKING DETAIL MODAL */}
{isDetailModalOpen && selectedBooking && (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-white w-full max-w-md shadow-2xl overflow-hidden" style={{ borderRadius: '1.5rem' }}>
      <div className="p-6">
        <h2 className="text-[#db2777] text-2xl font-serif mb-4">Booking Detail</h2>
        
        <div className="space-y-4">
          <section>
            <h3 className="text-gray-800 font-bold border-b border-gray-100 pb-1 mb-2">Client Details</h3>
            <p className="text-sm"><strong>Name:</strong> {selectedBooking.name}</p>
            <p className="text-sm"><strong>Phone:</strong> {selectedBooking.phone}</p>
            <p className="text-sm"><strong>Group Size:</strong> {selectedBooking.groupSize || "1"}</p>
          </section>

          <section>
            <h3 className="text-gray-800 font-bold border-b border-gray-100 pb-1 mb-2">Appointment Details</h3>
            <p className="text-sm"><strong>Date:</strong> {selectedBooking.appointmentTimestamp?.toDate().toLocaleString()}</p>
            <p className="text-sm"><strong>Services:</strong> {selectedBooking.service || selectedBooking.services || "No service selected"}</p>
            <p className="text-sm"><strong>Technician:</strong> {selectedBooking.technician}</p>
            <p className="text-sm"><strong>Booking Type:</strong> {selectedBooking.bookingType}</p>
          </section>

          <section>
            <h3 className="text-gray-800 font-bold border-b border-gray-100 pb-1 mb-2">Next Appointment</h3>
            <p className="text-pink-500 font-bold">Not scheduled</p>
          </section>
        </div>

        <div className="flex gap-2 mt-6">
          <button className="flex-1 bg-yellow-500 text-white py-2 rounded-lg font-bold">Edit</button>
          <button onClick={handleCheckIn} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">Check In</button>
          <button onClick={handleNoShow} className="flex-1 bg-red-500 text-white py-2 rounded-lg font-bold">No Show</button>
          <button onClick={() => setIsDetailModalOpen(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold">Close</button>
        </div>
      </div>
    </div>
  </div>
)}


      <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');
        .unified-salon-calendar { width: 100% !important; border: none !important; }
        .unified-salon-calendar .react-calendar__month-view__days__day { height: 120px !important; border: 0.5px solid #f1f5f9 !important; display: flex !important; flex-direction: column !important; align-items: flex-start !important; padding: 10px !important; font-weight: 700 !important; }
        .unified-salon-calendar .react-calendar__month-view__weekdays { background: #f8fafc !important; border-bottom: 1px solid #e2e8f0 !important; }
        .unified-salon-calendar .react-calendar__month-view__weekdays__weekday { padding: 12px !important; text-transform: uppercase !important; font-size: 10px !important; font-weight: 900 !important; color: #94a3b8 !important; }
        .unified-salon-calendar .react-calendar__tile--now { background: #fff1f2 !important; color: #db2777 !important; }
        .unified-salon-calendar .react-calendar__tile--active {     background-color: #fef3c7 !important; z-index: 5; }
        abbr[title] { text-decoration: none !important; }
/* Change this line in your global styles */
.unified-salon-calendar .react-calendar__month-view__days__day { 
  min-height: 140px !important; 
  height: auto !important; /* This allows the box to grow */
  border: 0.5px solid #f1f5f9 !important; 
  display: flex !important; 
  flex-direction: column !important; 
  align-items: flex-start !important; 
  padding: 6px !important; 
  font-weight: 700 !important; 
}
  h1, h2, h3, .clock {
    font-family: 'Playfair Display', serif !important;
  }
    /* Global body font and layout */
  html, body {
    line-height: 1.5;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
      `}</style>
    </div>
  );
}