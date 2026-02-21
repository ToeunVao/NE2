"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  getDoc, doc,
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  Timestamp, 
  orderBy, 
  where 
} from "firebase/firestore";
import { useToast } from "@/context/ToastContext"; // Your new context
// FIXED: Combined auth and db into one line
import { auth, db } from "@/lib/firebase"; 
import { signInWithEmailAndPassword } from "firebase/auth"; // Add it here!
import { useRouter } from "next/navigation";

const promotions = [
  { id: 1, category: "Special", title: "New Client Gel", description: "First time visit special for full set gel.", price: "45" },
  { id: 2, category: "Spa", title: "Luxury Pedi", description: "Organic scrub and extended massage.", price: "60" }
];

export default function HomePage() {
  const { showToast } = useToast();
  const router = useRouter();
const [showLoginModal, setShowLoginModal] = useState(false);
const [loginEmail, setLoginEmail] = useState("");
const [loginPassword, setLoginPassword] = useState("");
const [step, setStep] = useState(1);
const [staff, setStaff] = useState([]); // To store technicians
const [showPolicy, setShowPolicy] = useState(false); // Modal state

// Fetch Technicians (Users with role 'technician' or 'staff')
useEffect(() => {
  const q = query(collection(db, "users"), where("role", "==", "technician"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
  return () => unsubscribe();
}, []);


// Inside your HomePage Component:
const [categories, setCategories] = useState([]);
const [services, setServices] = useState([]); // To store all salon services
const [serviceSearch, setServiceSearch] = useState(""); // The text user types
const [showDropdown, setShowDropdown] = useState(false); // To toggle results

// Add these inside your HomePage function
const [giftAmount, setGiftAmount] = useState(0);
const [giftData, setGiftData] = useState({ toName: '', toEmail: '', message: '' });

const handleGiftPurchase = async () => {
  try {
  // Generates a random number between 1 and 999999 and pads it to 6 digits
    const randomNum = Math.floor(Math.random() * 999999) + 1;
    const digitCode = randomNum.toString().padStart(6, '0');
    const cardCode = `GC-${digitCode}`; // Result: GC-000001
    const amountNum = Number(giftAmount);

    const newGiftCard = {
      code: cardCode,
      recipientName: giftData.toName || "Customer",
      recipientEmail: giftData.toEmail,
      amount: amountNum, 
      balance: amountNum,
      status: "pending", // This ensures Admin sees it as 'Pending'
      isActivated: false, // Explicit flag for admin filtering
      message: giftData.message || "",
      createdAt: serverTimestamp(),
      lastUsed: serverTimestamp(),
      history: [{
        date: Timestamp.fromDate(new Date()), 
        type: 'Purchase Request',
        amount: amountNum,
        oldBalance: 0,
        newBalance: amountNum,
        note: 'Online Order - Waiting for Payment'
      }]
    };

    await addDoc(collection(db, "gift_cards"), newGiftCard);
    alert(`Order Submitted! Your code is: ${cardCode}. Please complete payment to activate.`);
    setStep(1);
    // Reset form
    setGiftAmount(0);
    setGiftData({ toName: '', toEmail: '', message: '' });
  } catch (error) {
    console.error("Save Error:", error);
  }
};


// SINGLE SOURCE OF TRUTH FOR SERVICES
useEffect(() => {
  const qServ = query(collection(db, "services"));
  const unsubServ = onSnapshot(qServ, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Services loaded:", data.length); // Debug check
    setServices(data);
  }, (err) => console.error("Service Fetch Error:", err.message));

  return () => unsubServ();
}, []);

// --- 1. STATE FOR REVIEWS ---
const [reviews, setReviews] = useState([]);

// --- 2. FETCH REVIEWS FROM FIREBASE ---
useEffect(() => {
  // 1. Connect to 'finished_clients'
  // We remove the 'limit' temporarily to make sure we find YOUR test data
  const q = query(collection(db, "finished_clients"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const rawData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log("RAW DATA FROM DB:", rawData); // Check this in console!

    // 2. Filter: Keep ANY entry that has a rating OR a review comment
    // We check multiple spelling variations found in your old app code
    const validReviews = rawData.filter(item => {
       const hasRating = (item.rating && Number(item.rating) > 0) || (item.stars && Number(item.stars) > 0);
       const hasText = (item.review && item.review.length > 1) || (item.feedback && item.feedback.length > 1) || (item.comment && item.comment.length > 1);
       
       return hasRating || hasText;
    });

    // 3. Sort by Date (Newest First)
    // We use 'checkOutTimestamp' which is what your script.js uses
    validReviews.sort((a, b) => {
      const dateA = a.checkOutTimestamp?.seconds || 0;
      const dateB = b.checkOutTimestamp?.seconds || 0;
      return dateB - dateA;
    });

    console.log("FINAL FILTERED REVIEWS:", validReviews);
    setReviews(validReviews);
  }, (error) => {
    console.error("Error fetching reviews:", error);
  });

  return () => unsubscribe();
}, []);

const handleLogin = async (e) => {
  e.preventDefault();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const role = userData.role?.toLowerCase(); 

      setShowLoginModal(false);
      showToast(`Welcome, ${userData.name}!`, "success");

      // REDIRECTION LOGIC
      if (role === "admin") {
        router.push("/admin"); 
      } else if (role === "staff" || role === "technician") {
        // Both roles go to the staff dashboard
        router.push("/staff/dashboard"); 
      } else {
        showToast("Access Denied: Role not recognized.", "error");
      }
    }
  } catch (error) {
    showToast("Invalid credentials.", "error");
  }
};
// Add this if it is missing or replace your old booking state
const [bookingData, setBookingData] = useState({
  name: "",
  phone: "",
  serviceId: "",
  serviceName: "",
  price: 0,
  groupSize: 1, // <--- Add this back
  staffId: "anyone",
  staffName: "Any Technician",
  date: "",
  time: ""
});

const filteredServices = services.filter(s => 
  s.name?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
  s.category?.toLowerCase().includes(serviceSearch.toLowerCase())
);
const handleBookingSubmit = async () => {
  try {
    if (!bookingData.name || !bookingData.phone || !bookingData.serviceName || !bookingData.date || !bookingData.time) {
      showToast("Please fill in all fields", "error");
      return;
    }

    // Combine Date and Time for the Calendar
    const [hours, mins] = bookingData.time.split(":");
    const appointmentDate = new Date(bookingData.date);
    appointmentDate.setHours(parseInt(hours), parseInt(mins));

    await addDoc(collection(db, "appointments"), {
      name: bookingData.name,
      phone: bookingData.phone,
      service: bookingData.serviceName, // Uses exactly what's in the box
      price: Number(bookingData.price || 0),
      technician: bookingData.staffName || "Any Technician",
      appointmentTimestamp: Timestamp.fromDate(appointmentDate), // Calendar needs this
      bookingType: "Online",
      status: "confirmed",
      createdAt: serverTimestamp(),
      isRead: false
    });

    showToast("Booking Confirmed!", "success");
    
    // CLEAR FORM
    setBookingData({ name: "", phone: "", serviceId: "", serviceName: "", price: 0, staffId: "anyone", staffName: "Any Technician", date: "", time: "" });
    setServiceSearch("");
    
  } catch (err) {
    console.error(err);
    showToast("Error booking. Try again.", "error");
  }
};
  return (
    <main className="min-h-screen bg-white">
      {/* 1. ELEGANT NAVIGATION */}
      <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-pink-100 px-6 py-4 flex justify-between items-center">
        <div className="text-2xl font-serif font-bold text-pink-600 tracking-tighter">
          Nails Express
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium text-gray-600 uppercase tracking-widest">
          <Link href="#services" className="hover:text-pink-600 transition-colors">Services</Link>
          <Link href="#book" className="hover:text-pink-600 transition-colors">Booking</Link>
          <Link href="/admin/gift-cards" className="hover:text-pink-600 transition-colors">Gift Cards</Link>
        </div>
        {/* In your Header or Footer */}
<button 
  onClick={() => setShowLoginModal(true)}
  className="text-gray-500 hover:text-pink-500 transition-colors font-bold text-sm"
>
<i className="fas fa-user"></i> Login
</button>
      </nav>

      {/* 2. REFINED HERO SECTION */}
      <section className="relative h-[80vh] flex items-center px-6 md:px-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image 
            src="https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80"
            alt="Luxury Manicure Art"
            fill
            priority
            className="object-cover object-center scale-105 brightness-[0.9]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/50 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-xl">
          <span className="text-pink-600 font-bold tracking-[0.2em] uppercase text-xs mb-3 block">
            Welcome to Nails Express
          </span>
          <h1 className="text-4xl md:text-6xl font-serif text-gray-900 mb-6 leading-tight">
            Elevate Your <br/>
            <span className="italic text-pink-500">Natural Beauty</span>
          </h1>
          <p className="text-base md:text-lg text-gray-700 mb-8 leading-relaxed max-w-md">
            Experience the finest nail artistry and spa treatments in a serene, sophisticated environment.
          </p>
          <div className="flex gap-4">
            <Link href="#book" className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg">
              Book Now
            </Link>
            <Link href="#services" className="bg-white/50 backdrop-blur-sm text-gray-900 border border-gray-200 px-8 py-3 rounded-xl font-bold hover:bg-white transition-all">
              Services
            </Link>
          </div>
        </div>
      </section>

{/* --- GIFT CARD SECTION --- */}
<section className="py-20 bg-pink-50">
  <div className="max-w-6xl mx-auto px-6">
    <div className="bg-white rounded-xl overflow-hidden shadow-xl border border-indigo-100 flex flex-col md:flex-row items-center">
      
      {/* Visual Side */}
      <div className="w-full md:w-1/2 p-12 bg-indigo-600 flex flex-col justify-center items-center text-center text-white space-y-4">
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        </div>
        <h3 className="text-3xl font-black uppercase tracking-tighter">NailsXpress</h3>
        <p className="text-indigo-100 font-bold tracking-[0.2em] uppercase text-xs">Digital Gift Card</p>
      </div>

      {/* Content Side */}
      <div className="w-full md:w-1/2 p-12">
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-6 leading-tight">
          Give the Gift of Glamour
        </h2>
        <p className="text-gray-600 text-lg leading-relaxed mb-8">
          Treat your loved ones to a relaxing and beautifying experience with a 
          <span className="font-bold text-indigo-600"> NailsXpress digital gift card</span>. 
          Perfect for birthdays, holidays, or just because!
        </p>
        
        <button 
  onClick={() => setStep('giftcard')}
          className="inline-block bg-gray-900 text-white px-10 py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-indigo-600 hover:scale-105 transition-all shadow-lg shadow-gray-200"
        >
          Buy a Gift Card
       </button>
      </div>
      
    </div>
  </div>
</section>

{/* GIFT CARD MODAL */}
{step === 'giftcard' && (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-100">
      <div className="bg-[#d63384] p-6 text-center">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Purchase Gift Card</h2>
        <p className="text-pink-100 text-[10px] font-bold uppercase tracking-widest mt-1">Order Online • Pay to Activate</p>
      </div>

      <div className="p-6 space-y-5">
     <div>
  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Select Amount</label>
  <div className="grid grid-cols-5 gap-2">
    {[25, 50, 100, 200].map((amt) => (
      <button key={amt} onClick={() => setGiftAmount(amt)}
        className={`py-3 rounded-xl border-2 font-black text-sm transition-all ${
          giftAmount === amt ? 'border-[#d63384] bg-pink-50 text-[#d63384]' : 'border-gray-50 bg-gray-50 text-gray-400'
        }`}>${amt}</button>
    ))}
    {/* CUSTOM BUTTON */}
    <button 
      onClick={() => setGiftAmount('custom')}
      className={`py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${
        giftAmount === 'custom' || (![25, 50, 100, 200].includes(giftAmount) && giftAmount > 0)
          ? 'border-[#d63384] bg-pink-50 text-[#d63384]' 
          : 'border-gray-50 bg-gray-50 text-gray-400'
      }`}>Custom</button>
  </div>

  {/* CUSTOM INPUT FIELD - Shows up if Custom is selected */}
  {(giftAmount === 'custom' || (![25, 50, 100, 200].includes(giftAmount) && giftAmount > 0)) && (
    <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
      <input 
        type="number"
        placeholder="Enter custom amount ($)"
        onChange={(e) => setGiftAmount(Number(e.target.value))}
        className="w-full p-4 bg-pink-50 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-[#d63384] font-bold text-[#d63384]"
      />
    </div>
  )}
</div>

        <InputItem label="Recipient Name" value={giftData.toName} onChange={(val) => setGiftData({...giftData, toName: val})} />
        <InputItem label="Recipient Email" value={giftData.toEmail} onChange={(val) => setGiftData({...giftData, toEmail: val})} />

        {/* --- ADDED PAYMENT GUIDE BLOCK --- */}
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-xl space-y-2">
          <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest">How to Pay</h4>
          <p className="text-[11px] text-blue-700 leading-tight font-medium">
            1. Submit this order to generate your code.<br/>
            2. Please send payment to our Venmo <br/>
            <span className="font-black text-blue-900 underline">@nailsexpress or Call us (859) 236-2873</span><br/>
            3. Your card will be activated once payment is confirmed.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <button onClick={handleGiftPurchase} disabled={!giftAmount || !giftData.toEmail}
            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all ${
              giftAmount && giftData.toEmail ? 'bg-[#d63384] text-white hover:bg-pink-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}>Confirm & Submit Order</button>
          <button onClick={() => setStep(1)} className="w-full text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-gray-600">Cancel</button>
        </div>
      </div>
    </div>
  </div>
)}

{/* BOOKING SECTION */}


<div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 max-w-4xl mt-10 mb-20 mx-auto">
  <div className="text-center mb-10">
  <h2 className="text-3xl font-bold text-[#d63384] mb-2 font-serif tracking-tight">Book a New Appointment</h2>
              <p className="text-gray-500 italic">Your moment of relaxation is just a few clicks away.</p>
              </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
    
    {/* LEFT COLUMN: WHO & WHAT */}
    <div className="space-y-8">
      <section>
        <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">1</span>
          Your Information
        </h4>
       {/* CHANGE grid-cols-1 TO grid-cols-2 */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <InputItem 
      label="Full Name" 
      value={bookingData.name} 
      onChange={v => setBookingData({...bookingData, name: v})} 
      placeholder="Enter your name" 
    />
    <InputItem 
      label="Phone Number" 
      value={bookingData.phone} 
      onChange={v => setBookingData({...bookingData, phone: v})} 
      placeholder="(000) 000-0000" 
    />
  </div>
      </section>

{/* ROW 2: SERVICE AND GROUP SIZE */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  
  {/* SELECT SERVICE (Autocomplete) */}
  <section className="relative">
    <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">2</span>
      Select Service
    </h4>
    <div className="relative">
      <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
      <input 
        type="text"
        placeholder="Type any service..."
        className="w-full p-4 pl-12 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm"
        value={serviceSearch}
        onChange={(e) => { 
            const val = e.target.value;
            setServiceSearch(val);
            setShowDropdown(true);
            setBookingData(prev => ({ ...prev, serviceName: val, serviceId: "custom", price: 0 }));
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
      />
      {/* ... keep your dropdown code here ... */}
    </div>
  </section>

  {/* GROUP SIZE DROPDOWN */}
  <section>
    <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">3</span>
      Group Size
    </h4>
    <select 
      value={bookingData.groupSize}
      onChange={(e) => setBookingData({...bookingData, groupSize: Number(e.target.value)})}
      className="w-full text-gray-400 p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm uppercase h-[54px]"
    >
      {[1, 2, 3, 4, 5, 6].map(num => (
        <option key={num} value={num}>{num} {num === 1 ? 'Person' : 'People'}</option>
      ))}
    </select>
  </section>

</div>
    </div>

    {/* RIGHT COLUMN: WHEN & WHO */}
 <div className="   space-y-8">
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
  
  {/* PREFERRED STAFF */}
  <section>
    <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">4</span>
      Preferred Staff
    </h4>
    <select 
      className="w-full text-gray-400  p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm uppercase h-[54px]"
      value={bookingData.staffId}
      onChange={(e) => {
        const s = staff.find(x => x.id === e.target.value);
        setBookingData({...bookingData, staffId: e.target.value, staffName: s ? s.name : "Any Technician"});
      }}
    >
      <option value="anyone">Any Technician</option>
      {staff.map(member => (
        <option key={member.id} value={member.id}>{member.name}</option>
      ))}
    </select>
  </section>

  {/* APPOINTMENT DATE */}
  <section>
    <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">5</span>
      Appointment Date
    </h4>
    <input 
      type="date" 
      className="w-full text-gray-400 p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm h-[54px]"
      value={bookingData.date}
      onChange={(e) => setBookingData({...bookingData, date: e.target.value})}
    />
  </section>
</div>
<section className="mt-4">
  <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
    <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">6</span>
    Available Time
  </h4>
  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
    {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00','15:30', '16:00', '17:00'].map(t => (
      <button 
        key={t}
        type="button"
        onClick={() => setBookingData({...bookingData, time: t})}
        className={`p-3 text-[10px] font-black rounded-xl border-2 transition-all ${
          bookingData.time === t 
            ? 'bg-pink-500 border-pink-500 text-white shadow-md' 
            : 'bg-white border-gray-100 text-gray-400 hover:border-pink-200'
        }`}
      >
        {t}
      </button>
    ))}
  </div>
</section>
</div>

  </div>
  {/* 2. PLACE THE BUTTON HERE (OUTSIDE THE GRID) */}
  <div className="mt-12 flex justify-center">
    <button 
      disabled={!bookingData.name || !bookingData.phone || !bookingData.serviceName || !bookingData.time || !bookingData.date}
      onClick={handleBookingSubmit}
      className="w-full md:w-2/3 py-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-pink-600 disabled:bg-gray-100 disabled:text-gray-300 transition-all shadow-l shadow-gray-200"
    >
      Confirm Appointment
    </button>
  </div>
</div>



{showPolicy && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-white rounded-xl max-w-lg w-full p-8 shadow-2xl animate-in zoom-in-95 duration-200">
      <h2 className="text-2xl font-bold mb-4 text-[#d63384]">Salon Policy</h2>
      <div className="text-gray-600 space-y-4 text-sm leading-relaxed overflow-y-auto max-h-[60vh]">
        <p>1. Please arrive 5 minutes before your appointment.</p>
        <p>2. Cancellations must be made 24 hours in advance.</p>
        <p>3. We reserve the right to refuse service to anyone.</p>
      </div>
      <button 
        onClick={() => setShowPolicy(false)}
        className="w-full mt-8 bg-gray-900 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs"
      >
        Close & Accept
      </button>
    </div>
  </div>
)}
{/* WHAT OUR CLIENTS SAY SECTION */}
<section className="py-20 bg-white">
  <div className="max-w-6xl mx-auto px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 tracking-tight">
        What Our Clients Say
      </h2>
      <p className="text-gray-500 font-medium">Real stories from our recent visits</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {reviews.length > 0 ? reviews.slice(0, 6).map((client) => (
        <div key={client.id} className="bg-gray-50 p-8 rounded-xl border border-gray-100 hover:shadow-xl transition-all">
          {/* Star Rating */}
          <div className="flex text-yellow-400 mb-4">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className={`h-4 w-4 fill-current ${i < (client.rating || 5) ? 'text-yellow-400' : 'text-gray-200'}`} viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
            ))}
          </div>

          <p className="text-gray-700 leading-relaxed mb-6 italic text-sm">
            "{client.review || "Great service and friendly staff!"}"
          </p>

          <div className="flex items-center">
            <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold mr-3 uppercase">
              {(client.name || "G").substring(0, 1)}
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm">{client.name || "Valued Customer"}</p>
              {/* Show date of visit if available */}
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {client.checkOutTimestamp ? new Date(client.checkOutTimestamp.seconds * 1000).toLocaleDateString() : "Verified Visit"}
              </p>
            </div>
          </div>
        </div>
      )) : (
        <div className="col-span-3 text-center py-10 text-gray-400 italic font-bold">
          Waiting for new feedback...
        </div>
      )}
    </div>
  </div>
</section>


{/* --- BRAND SANCTUARY SECTION --- */}
<section className="py-20 bg-gray-50">
  <div className="max-w-4xl mx-auto px-6 text-center">
    {/* Decorative element */}
    <div className="flex justify-center mb-6">
      <div className="h-1 w-12 bg-indigo-600 rounded-full"></div>
    </div>
    
    <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-6 tracking-tight">
      Your Sanctuary for Beauty & Relaxation
    </h2>
    
    <div className="space-y-6">
      <p className="text-lg text-gray-600 leading-relaxed">
        Welcome to <span className="font-bold text-indigo-600">Nail Express</span>, 
        your personal retreat for beauty and wellness in Danville. Our passionate team 
        is dedicated to providing exceptional service in a clean, serene, and friendly environment.
      </p>
      
      <p className="text-lg text-gray-600 leading-relaxed">
        From classic manicures to luxurious spa pedicures, we use only high-quality 
        products to ensure lasting results. Treat yourself to our signature pedicure 
        experience that will leave you walking on air.
      </p>
    </div>

    {/* Optional: Add a small button or link to your booking page here */}
    <div className="mt-10">
      <button 
        onClick={() => router.push('/bookings')} 
        className="text-sm font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-600 pb-1 hover:text-indigo-800 hover:border-indigo-800 transition-all"
      >
        Book Your Experience
      </button>
    </div>
  </div>
</section>
{/* STAFF LOGIN MODAL */}
{showLoginModal && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Staff Portal</h2>
          <button 
            onClick={() => setShowLoginModal(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

<form className="space-y-4" onSubmit={handleLogin}>
  <div className="space-y-1">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
    <input 
      type="email"
      required
      value={loginEmail}
      onChange={(e) => setLoginEmail(e.target.value)}
      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
      placeholder="name@nailexpress.com"
    />
  </div>

  <div className="space-y-1">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
    <input 
      type="password"
      required
      value={loginPassword}
      onChange={(e) => setLoginPassword(e.target.value)}
      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
      placeholder="••••••••"
    />
  </div>

  <button 
    type="submit"
    className="w-full bg-gray-900 text-white font-black py-4 rounded-xl hover:bg-pink-600 transition-all shadow-lg shadow-gray-200 mt-4 uppercase tracking-widest text-sm"
  >
    Sign In
  </button>
</form>
        
        <p className="text-center text-xs text-gray-400 mt-6 font-medium">
          Authorized personnel only. Access is monitored.
        </p>
      </div>
    </div>
  </div>
)}

      {/* 6. FOOTER */}
      <footer className="bg-gray-900 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h3 className="text-2xl font-serif mb-6 text-pink-400">Nails Express</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Your neighborhood luxury nail sanctuary. Providing high-quality nail care services since 2010.
            </p>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs mb-6">Hours</h4>
            <ul className="text-gray-400 text-sm space-y-2">
              <li>Mon - Sat: 9:00 AM - 7:00 PM</li>
              <li>Sun: 11:00 AM - 5:00 PM</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs mb-6">Location</h4>
            <p className="text-gray-400 text-sm">
              Visit our Salon Page at <br/>
              <Link href="http://nailsexpressky.com" className="text-pink-400 hover:underline">nailsexpressky.com</Link>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
// Ensure your InputItem looks like this in page.js
function InputItem({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
      <input 
        value={value || ""} // This ensures it becomes empty when state is reset
        onChange={e => onChange(e.target.value)} 
        className="w-full p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm" 
        placeholder={placeholder} 
      />
    </div>
  );
}
