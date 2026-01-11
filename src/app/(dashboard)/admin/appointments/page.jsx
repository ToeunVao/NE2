"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc,
  query, where, orderBy, serverTimestamp, Timestamp 
} from "firebase/firestore";

export default function AppointmentPage() {
  const [appointments, setAppointments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Date Filter (Default to Today, matching your script.js)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    serviceId: "",
    staffId: "",
    time: "09:00",
    duration: 30, // Default duration
    note: ""
  });

  // --- 1. LOAD DATA ---
  useEffect(() => {
    // Load Staff
    const unsubStaff = onSnapshot(collection(db, "staff"), (snap) => {
      setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    // Load Services (Assuming a collection, or we can hardcode if old app did)
    const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Load Appointments for selected date
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23,59,59,999);

    const q = query(
      collection(db, "appointments"),
      where("appointmentTimestamp", ">=", Timestamp.fromDate(startOfDay)),
      where("appointmentTimestamp", "<=", Timestamp.fromDate(endOfDay)),
      orderBy("appointmentTimestamp", "asc")
    );

    const unsubAppt = onSnapshot(q, (snap) => {
      setAppointments(snap.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          // Convert timestamp to JS Date for easier usage
          dateObj: data.appointmentTimestamp?.toDate() 
        };
      }));
      setLoading(false);
    });

    return () => { unsubStaff(); unsubServices(); unsubAppt(); };
  }, [selectedDate]);

  // --- 2. LOGIC: CHECK AVAILABILITY (Ported from script.js) ---
  const checkAvailability = (newTime, newDuration, staffId) => {
    const newStart = new Date(`${selectedDate}T${newTime}`);
    const newEnd = new Date(newStart.getTime() + newDuration * 60000);

    // Filter appointments for the SAME staff member
    const staffAppts = appointments.filter(a => a.staffId === staffId);

    for (let appt of staffAppts) {
      const existingStart = appt.dateObj;
      const existingEnd = new Date(existingStart.getTime() + (appt.duration || 30) * 60000);

      // Check Overlap
      if (newStart < existingEnd && newEnd > existingStart) {
        return false; // CONFLICT DETECTED
      }
    }
    return true; // Available
  };

  // --- 3. HANDLERS ---
  const handleSave = async () => {
    // Validation
    if (!formData.customerName || !formData.staffId || !formData.serviceId) {
      return alert("Please fill all required fields");
    }

    // Check Conflict
    const isAvailable = checkAvailability(formData.time, formData.duration, formData.staffId);
    if (!isAvailable) {
      return alert("⚠️ This staff member is already booked at this time! Please choose another slot.");
    }

    try {
      // Create Timestamp
      const appointmentTimestamp = Timestamp.fromDate(new Date(`${selectedDate}T${formData.time}`));
      
      // Get Service Name for display
      const selectedService = services.find(s => s.id === formData.serviceId);

      await addDoc(collection(db, "appointments"), {
        ...formData,
        serviceName: selectedService?.name || "Service",
        appointmentTimestamp,
        status: "booked",
        createdAt: serverTimestamp()
      });

      setIsModalOpen(false);
      setFormData({ customerName: "", customerPhone: "", serviceId: "", staffId: "", time: "09:00", duration: 30, note: "" });
      alert("Appointment Booked!");
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    await updateDoc(doc(db, "appointments", id), { status: newStatus });
  };

  return (
    <div className="max-w-[95%] mx-auto space-y-6 pb-20">
      
      {/* TOP BAR: DATE PICKER & STATS */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 uppercase italic">Daily Schedule</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-4">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="p-3 bg-white border border-gray-200 rounded-xl font-bold shadow-sm outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-black transition-all flex items-center gap-2"
          >
            <i className="fas fa-plus"></i> New Booking
          </button>
        </div>
      </div>

      {/* APPOINTMENT BOARD (TIMELINE VIEW) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? <div className="text-gray-400 font-bold col-span-full text-center py-20">Loading Schedule...</div> : 
         appointments.length === 0 ? (
           <div className="col-span-full bg-gray-50 rounded-xl p-10 text-center border-2 border-dashed border-gray-200">
             <p className="text-gray-400 font-black uppercase tracking-widest">No appointments for this date</p>
             <button onClick={() => setIsModalOpen(true)} className="mt-4 text-purple-600 font-bold underline">Add First Booking</button>
           </div>
         ) : (
           appointments.map(appt => (
             <div key={appt.id} className={`relative p-5 rounded-xl border-l-4 shadow-sm bg-white hover:shadow-md transition-all ${
               appt.status === 'cancelled' ? 'border-red-400 opacity-60' : 
               appt.status === 'completed' ? 'border-green-500' : 'border-purple-500'
             }`}>
                {/* Time Badge */}
                <div className="flex justify-between items-start mb-3">
                    <span className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-black text-gray-700">
                        {appt.dateObj?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex gap-1">
                        {appt.status === 'booked' && (
                            <button onClick={() => handleStatusUpdate(appt.id, 'completed')} className="w-6 h-6 rounded bg-green-50 text-green-600 hover:bg-green-500 hover:text-white transition-colors flex items-center justify-center" title="Complete"><i className="fas fa-check text-[10px]"></i></button>
                        )}
                        <button onClick={() => deleteDoc(doc(db, "appointments", appt.id))} className="w-6 h-6 rounded bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center" title="Cancel"><i className="fas fa-times text-[10px]"></i></button>
                    </div>
                </div>

                {/* Details */}
                <h3 className="font-black text-gray-800 uppercase text-sm truncate">{appt.customerName}</h3>
                <p className="text-xs text-purple-600 font-bold uppercase mb-1">{appt.serviceName || "Service"}</p>
                <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                    <i className="fas fa-user-circle"></i>
                    <span>{staffList.find(s => s.id === appt.staffId)?.name || "Unknown Staff"}</span>
                </div>
                
                {/* Note tooltip */}
                {appt.note && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-100 text-[10px] text-yellow-700 italic">
                        "{appt.note}"
                    </div>
                )}
             </div>
           ))
         )
        }
      </div>

      {/* --- MODAL (Floating Overlay) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gray-900 p-4 flex justify-between items-center text-white">
                    <h2 className="text-sm font-black uppercase tracking-widest">New Appointment</h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
                </div>
                <div className="p-6 space-y-4">
                    
                    {/* Customer Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase">Client Name</label>
                            <input type="text" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none" placeholder="Jane Doe" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase">Phone</label>
                            <input type="tel" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none" placeholder="555-0123" />
                        </div>
                    </div>

                    {/* Service & Staff */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase">Service</label>
                            <select value={formData.serviceId} onChange={e => setFormData({...formData, serviceId: e.target.value})} className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none outline-none">
                                <option value="">Select...</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration}m)</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase">Staff</label>
                            <select value={formData.staffId} onChange={e => setFormData({...formData, staffId: e.target.value})} className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none outline-none">
                                <option value="">Select...</option>
                                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Time & Duration */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase">Time</label>
                            <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase">Duration (Min)</label>
                            <input type="number" value={formData.duration} onChange={e => setFormData({...formData, duration: parseInt(e.target.value)})} className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none" />
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase">Notes</label>
                        <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none h-20" placeholder="Optional preferences..." />
                    </div>

                    <button onClick={handleSave} className="w-full py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-xs shadow-lg hover:bg-purple-700 transition-all">Confirm Booking</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}