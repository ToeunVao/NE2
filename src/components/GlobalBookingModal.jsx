"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, onSnapshot, query, where, 
  serverTimestamp, Timestamp, doc, getDoc // <-- ADD THESE HERE 
} from "firebase/firestore";
// Import your toast function from your context file
import { useToast } from "@/context/ToastContext";

export default function GlobalBookingModal({ isOpen, onClose }) {

  const [allServices, setAllServices] = useState([]); 
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
const [clients, setClients] = useState([]);
const { showToast } = useToast();
const [storeSettings, setStoreSettings] = useState(null);
const [blockedDates, setBlockedDates] = useState([]);
  const [bookingForm, setBookingForm] = useState({
    name: "", 
    phone: "", 
    email: "",
    dateTime: new Date().toISOString().slice(0, 16), 
    service: "", 
    groupSize: 1, 
    bookingType: "Calendar", 
    price: 0, 
    technician: "Any Technician", 
    notes: ""
  });

  // Fetch hours when modal opens
useEffect(() => {
  if (!isOpen) return;

  // 1. Fetch Store Hours & Closure Message
  const fetchSettings = async () => {
    const docRef = doc(db, "settings", "store_info");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) setStoreSettings(docSnap.data());
  };
  fetchSettings();

  // 2. Fetch Holiday & Scheduled Closures
  const unsubClosures = onSnapshot(collection(db, "closures"), (snap) => {
    setBlockedDates(snap.docs.map(d => d.data().date));
  });

  return () => unsubClosures();
}, [isOpen]);

const validateBookingTime = (selectedDateTime) => {
  if (!storeSettings) return true;

  const dateObj = new Date(selectedDateTime);
  
  // Format to YYYY-MM-DD for holiday check
  const dateString = dateObj.toLocaleDateString('en-CA'); // e.g., "2023-10-28"
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Format to HH:mm for time check
  const selectedTime = dateObj.getHours().toString().padStart(2, '0') + ":" + 
                       dateObj.getMinutes().toString().padStart(2, '0');

  // --- 1. Check Holiday/Closure Dates ---
  if (blockedDates.includes(dateString)) {
    const holidayMsg = storeSettings.closureMessage || "Salon is closed today.";
    // Try passing message first if "Error" is showing up as the title
   showToast(
    `SALON CLOSED: ${holidayMsg} (Date: ${dateString}). Please select another day.`, 
    "error"
  );
    return false;
  }

  // --- 2. Check Operating Hours ---
  const daySettings = storeSettings.hours[dayName];
  if (!daySettings || daySettings.isClosed) {
  showToast(`CLOSED: We are closed on ${dayName}s.`, "error");
    return false;
  }

  // --- 3. Check Time Window ---
  if (selectedTime < daySettings.open || selectedTime > daySettings.close) {
  showToast(
  `OUTSIDE HOURS: ${dayName} hours are ${daySettings.open} - ${daySettings.close}. Please pick a different time.`, 
  "error"
);
    return false;
  }

  return true;
};

  useEffect(() => {
    if (!isOpen) return;

    const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
      let flattened = [];
      snap.docs.forEach(doc => {
        const categoryData = doc.data();
        if (categoryData.items && Array.isArray(categoryData.items)) {
          categoryData.items.forEach(item => {
            if (item.name) {
              const priceValue = parseFloat(String(item.price).replace(/[^0-9.]/g, ''));
              flattened.push({
                name: item.name,
                price: isNaN(priceValue) ? 0 : priceValue
              });
            }
          });
        }
      });
      setAllServices(flattened);
    });

    const techQuery = query(collection(db, "users"), where("role", "==", "technician"));
    const unsubTechs = onSnapshot(techQuery, (snap) => {
      setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

// Add this new fetch for clients
  const unsubClients = onSnapshot(collection(db, "clients"), (snap) => {
    setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });

  return () => { 
    unsubServices(); 
    unsubTechs(); 
    unsubClients(); // Cleanup
  };
}, [isOpen]);

  const handleServiceChange = (val) => {
    const match = allServices.find(s => s.name.toLowerCase() === val.toLowerCase());
    setBookingForm(prev => ({
      ...prev,
      service: val,
      price: match ? match.price : 0 
    }));
  };
const handleClientSelect = (name) => {
  const selectedClient = clients.find(c => c.name === name);
  
  setBookingForm(prev => ({
    ...prev,
    name: name,
    phone: selectedClient ? (selectedClient.phone || "") : prev.phone,
    email: selectedClient ? (selectedClient.email || "") : prev.email
  }));
};
  const handleBooking = async (e) => {
    e.preventDefault();

    // TRIGGER VALIDATION
  if (!validateBookingTime(bookingForm.dateTime)) {
    return; // STOP EXECUTION
  }

    setLoading(true);

    try {
      const finalDate = new Date(bookingForm.dateTime);
      await addDoc(collection(db, "appointments"), {
        ...bookingForm,
        groupSize: Number(bookingForm.groupSize),
        appointmentTimestamp: Timestamp.fromDate(finalDate),
        status: "confirmed",
        createdAt: serverTimestamp()
      });

      showToast("Success", "Booking created successfully!", "success");
      onClose();
      setBookingForm({
        name: "", phone: "", email: "", 
        dateTime: new Date().toISOString().slice(0, 16), 
        service: "", groupSize: 1, bookingType: "Calendar", 
        price: 0, technician: "Any Technician", notes: ""
      });
    } catch (err) {
      console.error("Booking Error:", err);
      showToast("Error", "Error creating booking.", "error");
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col md:items-center md:justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose} 
      />

      {/* Main Container: Full screen on mobile, max-w-2xl on desktop */}
      <div className="relative w-full h-full md:h-auto md:max-w-2xl bg-white shadow-2xl flex flex-col md:rounded-xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Header - Sticky */}
        <div className="bg-[#db2777] dark:bg-slate-950 dark:border-slate-800 dark:text-white p-5 text-white flex justify-between items-center sticky top-0 z-10">
          <div className="flex flex-col">
            <h2 className="font-bold text-sm uppercase tracking-wide italic">Quick Appointment</h2>
            <p className="text-[10px] opacity-80 font-bold uppercase">Manual Entry Mode</p>
          </div>
          <button onClick={onClose} className="bg-white text-[#db2777] w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg transition-transform active:scale-90">
             ✕
          </button>
        </div>

        {/* Form Content - Scrollable on mobile */}
        <form onSubmit={handleBooking} className="dark:bg-slate-900/80 dark:border-slate-800 dark:text-white flex-1 overflow-y-auto p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pb-24 md:pb-0">
            
            {/* Name & Phone */}
           <div className="space-y-1">
  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Client Name</label>
  <input 
    required 
    list="client-list" // Connects to the datalist below
    className="dark:bg-slate-950 dark:text-white w-full p-4 md:p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl focus:border-[#db2777] font-bold" 
    value={bookingForm.name} 
    onChange={e => handleClientSelect(e.target.value)} // Trigger auto-fill
  />
  
  {/* The Autocomplete Data List */}
  <datalist id="client-list">
    {clients.map(c => (
      <option key={c.id} value={c.name} />
    ))}
  </datalist>
</div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Phone Number</label>
              <input className="dark:bg-slate-950 dark:text-white w-full p-4 md:p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl focus:border-[#db2777] font-bold" 
                value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone: e.target.value})} />
            </div>

            {/* Email & Date/Time */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Email Address</label>
              <input type="email" className="dark:bg-slate-950 dark:text-white w-full p-4 md:p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl focus:border-[#db2777] font-bold" 
                value={bookingForm.email} onChange={e => setBookingForm({...bookingForm, email: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-[#db2777] uppercase ml-1">Date & Time</label>
              <input 
                type="datetime-local" 
                required 
                className="dark:bg-slate-950 dark:text-white w-full p-4 md:p-2.5 bg-purple-50 border border-purple-100 text-[#db2777] font-black text-sm outline-none rounded-xl shadow-inner" 
                value={bookingForm.dateTime} 
                onChange={e => setBookingForm({...bookingForm, dateTime: e.target.value})} 
              />
            </div>

            {/* Service & Booking Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Service Selection</label>
              <input 
                list="booking-service-list" 
                required 
                className="dark:bg-slate-950 dark:text-white w-full p-4 md:p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl focus:border-[#db2777] font-bold" 
                placeholder="Search services..."
                value={bookingForm.service}
                onChange={e => handleServiceChange(e.target.value)} 
              />
              <datalist id="booking-service-list">
                {allServices.map((s, idx) => (
                  <option key={idx} value={s.name}>{`$${s.price}`}</option>
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Booking Type</label>
              <select className="dark:bg-slate-950 dark:text-white w-full p-4 md:p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl focus:border-[#db2777] font-bold appearance-none" 
                value={bookingForm.bookingType} onChange={e => setBookingForm({...bookingForm, bookingType: e.target.value})}>
                <option value="Calendar">Calendar</option>
                <option value="Online">Online</option>
                <option value="Phone">Phone</option>
              </select>
            </div>

            {/* Tech & Group Size */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Assign Technician</label>
              <select className="dark:bg-slate-950 dark:text-white w-full p-4 md:p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none font-black text-[#db2777] rounded-xl appearance-none" 
                value={bookingForm.technician} onChange={e => setBookingForm({...bookingForm, technician: e.target.value})}>
                <option value="Any Technician">Any Technician</option>
                {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Group Size</label>
              <input type="number" min="1" className="dark:bg-slate-950 dark:text-white w-full p-4 md:p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl font-bold" 
                value={bookingForm.groupSize} onChange={e => setBookingForm({...bookingForm, groupSize: parseInt(e.target.value) || 1})} />
            </div>

            {/* Notes */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Notes / Special Requests</label>
              <textarea rows="3" className="dark:bg-slate-950 dark:text-white w-full p-4 bg-gray-50 border border-gray-200 text-sm outline-none resize-none rounded-xl focus:border-[#db2777] font-bold" 
                value={bookingForm.notes} onChange={e => setBookingForm({...bookingForm, notes: e.target.value})}></textarea>
            </div>
          </div>

          {/* Fixed Bottom Submit Area for Mobile */}
          <div className="fixed bottom-0 dark:border-slate-800 dark:bg-slate-950 dark:text-white left-0 right-0 p-4 bg-white border-t border-gray-100 md:relative md:border-0 md:p-0 md:mt-6 md:flex md:justify-end">
            <button 
              disabled={loading} 
              type="submit" 
              className="w-full md:w-auto bg-[#db2777] text-white px-12 py-5 md:py-4 font-black text-xs shadow-xl uppercase tracking-widest rounded-xl hover:bg-[#9d174d] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "Processing..." : `Confirm: $${bookingForm.price}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}