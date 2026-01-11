"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, onSnapshot, query, where, 
  serverTimestamp, Timestamp 
} from "firebase/firestore";

export default function GlobalBookingModal({ isOpen, onClose }) {
  const [allServices, setAllServices] = useState([]); // Flattened list for autocomplete
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!isOpen) return;

    // 1. Fetch Services and Flatten the 'items' array for Autocomplete & Price
    const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
      let flattened = [];
      snap.docs.forEach(doc => {
        const categoryData = doc.data();
        // Look inside the 'items' array as defined in your database
        if (categoryData.items && Array.isArray(categoryData.items)) {
          categoryData.items.forEach(item => {
            if (item.name) {
              // Clean the price: remove "$" and convert to number
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

    // 2. Fetch Technicians
    const techQuery = query(collection(db, "users"), where("role", "==", "technician"));
    const unsubTechs = onSnapshot(techQuery, (snap) => {
      setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubServices(); unsubTechs(); };
  }, [isOpen]);

  // Handle Autocomplete Lookup and Price sync
  const handleServiceChange = (val) => {
    // Exact match lookup (case-insensitive)
    const match = allServices.find(s => s.name.toLowerCase() === val.toLowerCase());
    
    setBookingForm(prev => ({
      ...prev,
      service: val,
      // If a match is found in our flattened list, update the price
      price: match ? match.price : 0 
    }));
  };

  const handleBooking = async (e) => {
    e.preventDefault();
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

      alert("Booking Added Successfully!");
      onClose();
      // Reset Form
      setBookingForm({
        name: "", phone: "", email: "", 
        dateTime: new Date().toISOString().slice(0, 16), 
        service: "", groupSize: 1, bookingType: "Calendar", 
        price: 0, technician: "Any Technician", notes: ""
      });
    } catch (err) {
      console.error("Booking Error:", err);
      alert("Error: " + err.message);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl shadow-2xl overflow-hidden rounded-xl border border-gray-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-[#db2777] p-5 text-white flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wide italic">Quick Appointment</h2>
          <button onClick={onClose} className="bg-white text-[#db2777] w-8 h-8 rounded-full flex items-center justify-center font-bold transition-transform hover:rotate-90">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleBooking} className="p-8 grid grid-cols-2 gap-x-6 gap-y-4">
          
          {/* Row 1: Name & Phone */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Client Name</label>
            <input required className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl focus:border-[#db2777]" 
              value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name: e.target.value})} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Phone Number</label>
            <input className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl focus:border-[#db2777]" 
              value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone: e.target.value})} />
          </div>

          {/* Row 2: Email & Date/Time (50% 50%) */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Email Address</label>
            <input type="email" className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl focus:border-[#db2777]" 
              value={bookingForm.email} onChange={e => setBookingForm({...bookingForm, email: e.target.value})} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#db2777] uppercase ml-1">Date & Time</label>
            <input 
              type="datetime-local" 
              required 
              className="w-full p-2.5 bg-purple-50 border border-purple-100 text-[#db2777] font-bold text-sm outline-none rounded-xl" 
              value={bookingForm.dateTime} 
              onChange={e => setBookingForm({...bookingForm, dateTime: e.target.value})} 
            />
          </div>

          {/* Row 3: Service (Autocomplete) & Booking Type */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Service</label>
            <input 
              list="booking-service-list" 
              required 
              className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl focus:border-[#db2777]" 
              placeholder="Search services..."
              value={bookingForm.service}
              onChange={e => handleServiceChange(e.target.value)} 
            />
            <datalist id="booking-service-list">
              {allServices.map((s, idx) => (
                <option key={idx} value={s.name}>
                  {`$${s.price}`}
                </option>
              ))}
            </datalist>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Booking Type</label>
            <select className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl focus:border-[#db2777]" 
              value={bookingForm.bookingType} onChange={e => setBookingForm({...bookingForm, bookingType: e.target.value})}>
              <option value="Calendar">Calendar</option>
              <option value="Online">Online</option>
              <option value="Phone">Phone</option>
            </select>
          </div>

          {/* Row 4: Tech & Group Size */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Technician</label>
            <select className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none font-bold text-[#db2777] rounded-xl" 
              value={bookingForm.technician} onChange={e => setBookingForm({...bookingForm, technician: e.target.value})}>
              <option value="Any Technician">Any Technician</option>
              {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Group Size</label>
            <input type="number" min="1" className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm outline-none rounded-xl" 
              value={bookingForm.groupSize} onChange={e => setBookingForm({...bookingForm, groupSize: parseInt(e.target.value) || 1})} />
          </div>

          {/* Row 5: Notes */}
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Notes</label>
            <textarea rows="2" className="w-full p-3 bg-gray-50 border border-gray-200 text-sm outline-none resize-none rounded-xl focus:border-[#db2777]" 
              value={bookingForm.notes} onChange={e => setBookingForm({...bookingForm, notes: e.target.value})}></textarea>
          </div>

          {/* Submit Button with Dynamic Price */}
          <div className="col-span-2 flex justify-end mt-4">
            <button 
              disabled={loading} 
              type="submit" 
              className="bg-[#db2777] text-white px-12 py-4 font-black text-sm shadow-xl uppercase tracking-widest rounded-xl hover:bg-[#9d174d] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "Saving..." : `Confirm Booking: $${bookingForm.price}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}