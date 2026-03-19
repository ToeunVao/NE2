"use client";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, addDoc, onSnapshot, query, where, 
  serverTimestamp, doc, getDoc, Timestamp 
} from "firebase/firestore";
import { useToast } from "@/context/ToastContext";
import { X, Calendar, Sparkles, Users, Clock } from "lucide-react";

export default function ClientBookingModal({ isOpen, onClose }) {
  const { showToast } = useToast();
  
  // FIXED: Correct local time calculation for "Now + 12 Hours"
  const getMinDateTimeString = () => {
    const now = new Date();
    now.setHours(now.getHours() + 12);
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [allServices, setAllServices] = useState([]); 
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [storeSettings, setStoreSettings] = useState(null);
  const [blockedDates, setBlockedDates] = useState([]);
  const [clientPhone, setClientPhone] = useState(""); // State for phone number

  const [bookingForm, setBookingForm] = useState({
    dateTime: getMinDateTimeString(), 
    service: "", 
    price: 0, 
    technician: "Any Technician", 
    groupSize: 1, // Added Group Size
    notes: ""
  });

  useEffect(() => {
    if (!isOpen) return;

    setBookingForm(prev => ({
      ...prev,
      dateTime: getMinDateTimeString(),
      technician: "Any Technician",
      groupSize: 1
    }));

    // Fetch user profile to get phone number
    const fetchUserPhone = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          setClientPhone(userDoc.data().phone || "");
        }
      }
    };
    fetchUserPhone();

    const fetchSettings = async () => {
      const docRef = doc(db, "settings", "store_info");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setStoreSettings(docSnap.data());
    };
    fetchSettings();

    const unsubClosures = onSnapshot(collection(db, "closures"), (snap) => {
      setBlockedDates(snap.docs.map(d => d.data().date));
    });

    const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
      let flattened = [];
      snap.docs.forEach(doc => {
        const items = doc.data().items || [];
        items.forEach(item => {
          const p = parseFloat(String(item.price).replace(/[^0-9.]/g, ''));
          flattened.push({ name: item.name, price: isNaN(p) ? 0 : p });
        });
      });
      setAllServices(flattened);
    });

    const techQuery = query(collection(db, "users"), where("role", "==", "technician"));
    const unsubTechs = onSnapshot(techQuery, (snap) => {
      setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubClosures(); unsubServices(); unsubTechs(); };
  }, [isOpen]);

  const validateBooking = (selectedDateTime) => {
    const selected = new Date(selectedDateTime);
    const now = new Date();

    const diffInHours = (selected - now) / (1000 * 60 * 60);
    if (diffInHours < 11.9) { // Using 11.9 to avoid strict millisecond rounding issues
      showToast("Online booking requires at least 12 hours notice.", "error");
      return false;
    }

    const dateString = selected.toLocaleDateString('en-CA'); 
    const dayName = selected.toLocaleDateString('en-US', { weekday: 'long' });
    const timeString = selected.getHours().toString().padStart(2, '0') + ":" + 
                       selected.getMinutes().toString().padStart(2, '0');

    if (blockedDates.includes(dateString)) {
      showToast("The salon is closed on this holiday/date.", "error");
      return false;
    }

    if (storeSettings?.hours) {
      const dayConfig = storeSettings.hours[dayName];
      if (!dayConfig || dayConfig.isClosed) {
        showToast(`Closed on ${dayName}s.`, "error");
        return false;
      }
      if (timeString < dayConfig.open || timeString > dayConfig.close) {
        showToast(`Salon Hours: ${dayConfig.open} - ${dayConfig.close}`, "error");
        return false;
      }
    }
    return true;
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!validateBooking(bookingForm.dateTime)) return;
    if (!bookingForm.service) return showToast("Please select a service", "error");

    setLoading(true);
    try {
      const user = auth.currentUser;
      const appointmentDate = new Date(bookingForm.dateTime);

      await addDoc(collection(db, "appointments"), {
        clientId: user.uid,
        name: user.displayName || "Client",
        phone: clientPhone || "", // FIXED: Now pulls from user state
        email: user.email,
        service: bookingForm.service, 
        price: Number(bookingForm.price || 0),
        groupSize: Number(bookingForm.groupSize || 1), // ADDED
        technicianId: bookingForm.technician === "Any Technician" ? "anyone" : bookingForm.technician,
        technician: bookingForm.technician, 
        appointmentTimestamp: Timestamp.fromDate(appointmentDate), 
        notes: bookingForm.notes || "",
        bookingType: "Online",
        status: "confirmed",
        createdAt: serverTimestamp(),
        isRead: false
      });

      showToast("Appointment confirmed!", "success");
      onClose();
    } catch (err) {
      showToast("Booking failed.", "error");
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="p-6 bg-pink-600 text-white flex justify-between items-center">
          <h2 className="text-xl font-serif font-bold">New Appointment</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full"><X size={20}/></button>
        </div>

        <form onSubmit={handleBooking} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto pb-10">
          
          {/* Service */}
          <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Service</label>
            <input 
              list="client-services"
              required
              className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl font-bold focus:ring-2 focus:ring-pink-500 outline-none"
              value={bookingForm.service}
              onChange={(e) => {
                const val = e.target.value;
                const match = allServices.find(s => s.name === val);
                setBookingForm({...bookingForm, service: val, price: match ? match.price : 0});
              }}
            />
            <datalist id="client-services">
              {allServices.map((s, i) => <option key={i} value={s.name}>{s.price > 0 ? `$${s.price}` : ''}</option>)}
            </datalist>
          </div>
          
            {/* Group Size */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Group Size</label>
              <div className="relative">
                <input 
                  type="number"
                  min="1"
                  max="10"
                  className="w-full p-4 pl-10 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl font-bold focus:ring-2 focus:ring-pink-500 outline-none"
                  value={bookingForm.groupSize}
                  onChange={(e) => setBookingForm({...bookingForm, groupSize: e.target.value})}
                />
                <Users className="absolute left-3 top-4 text-gray-400" size={18} />
              </div>
            </div>
          </div>
            {/* Arrival Date & Time */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Date & Time</label>
              <input 
                type="datetime-local"
                required
                min={getMinDateTimeString()}
                className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl font-bold focus:ring-2 focus:ring-pink-500 outline-none"
                value={bookingForm.dateTime}
                onChange={(e) => setBookingForm({...bookingForm, dateTime: e.target.value})}
              />
            </div>


          {/* Technician */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Preferred Technician</label>
            <select 
              className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl font-bold focus:ring-2 focus:ring-pink-500 outline-none"
              value={bookingForm.technician}
              onChange={(e) => setBookingForm({...bookingForm, technician: e.target.value})}
            >
              <option value="Any Technician">Any Technician (First Available)</option>
              {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notes</label>
            <textarea 
              rows={2}
              className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl font-bold focus:ring-2 focus:ring-pink-500 outline-none resize-none"
              value={bookingForm.notes}
              onChange={(e) => setBookingForm({...bookingForm, notes: e.target.value})}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-pink-600 transition-all disabled:opacity-50"
          >
            {loading ? "Booking..." : `Confirm for ${bookingForm.groupSize} Person(s)`}
          </button>
        </form>
      </div>
    </div>
  );
}