"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  Timestamp, // <--- Add this
  orderBy, // Add this
  where 
} from "firebase/firestore";
import { db } from "@/lib/firebase"; // Ensure this path matches your project
const promotions = [
  { id: 1, category: "Special", title: "New Client Gel", description: "First time visit special for full set gel.", price: "45" },
  { id: 2, category: "Spa", title: "Luxury Pedi", description: "Organic scrub and extended massage.", price: "60" }
];

export default function HomePage() {

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
const [services, setServices] = useState([]);
const [activeCategory, setActiveCategory] = useState(null);
const [selectedServices, setSelectedServices] = useState([]);

// Add these inside your HomePage function
const [giftAmount, setGiftAmount] = useState(0);
const [giftData, setGiftData] = useState({ toName: '', toEmail: '', message: '' });

const handleGiftPurchase = async () => {
  try {
    const cardCode = "G-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    const amountNum = Number(giftAmount); // Force to Number

    const newGiftCard = {
      code: cardCode,
      recipientName: giftData.toName || "Customer",
      recipientEmail: giftData.toEmail,
      amount: amountNum, 
      balance: amountNum,
      status: "pending", 
      message: giftData.message || "",
      createdAt: serverTimestamp(),
      lastUsed: serverTimestamp(),
      // EXACT STRUCTURE required by script.js line 11196
      history: [{
        date: Timestamp.fromDate(new Date()), 
        type: 'Purchase',
        amount: amountNum,
        oldBalance: 0,         // MUST be number 0
        newBalance: amountNum, // MUST be number
        note: 'Online Order'
      }]
    };

    await addDoc(collection(db, "gift_cards"), newGiftCard);
    alert(`Order Submitted! Code: ${cardCode}`);
    setStep(1);
  } catch (error) {
    console.error("Save Error:", error);
  }
};

useEffect(() => {
  console.log("Starting Firebase Sync...");

  // Try fetching "Categories" (Capital C) as per your old app structure
  const qCat = query(collection(db, "Categories")); 
  
  const unsubCat = onSnapshot(qCat, (snapshot) => {
    console.log("Categories snapshot size:", snapshot.size);
    if (snapshot.size === 0) {
      console.warn("Categories is empty. Check if collection name is 'categories' (lowercase) instead.");
    }
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort manually in the browser to avoid Index Permission errors
    setCategories(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, (err) => {
    console.error("Category Permission Error:", err.message);
  });

  const qServ = query(collection(db, "services"));
  const unsubServ = onSnapshot(qServ, (snapshot) => {
    setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (err) => console.error("Service Error:", err.message));

  return () => { unsubCat(); unsubServ(); };
}, []);
// Function to handle the accordion toggle
const handleCategoryClick = (id) => {
  setActiveCategory(activeCategory === id ? null : id);
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
        <Link href="/login" className="bg-pink-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-pink-700 transition-all shadow-md shadow-pink-200">
          Staff Portal
        </Link>
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

      {/* 3. ELEGANT SERVICES SECTION */}
      <section id="services" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-pink-500 font-bold tracking-widest uppercase text-xs">Our Menu</span>
          <h2 className="text-3xl md:text-4xl font-serif text-gray-900 mt-2">Signature Services</h2>
          <div className="w-12 h-0.5 bg-pink-200 mx-auto mt-4"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { title: "Manicures", desc: "Precision shaping and premium gel finishes for elegant hands.", img: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?q=80" },
            { title: "Pedicures", desc: "Relaxing spa rituals with organic scrubs and soothing massage.", img: "https://images.unsplash.com/photo-1519415510236-85592ac59c97?q=80" },
            { title: "Custom Art", desc: "Bespoke designs from minimalist accents to luxury artistry.", img: "https://images.unsplash.com/photo-1604902396830-aca29e19b067?q=80" }
          ].map((service, i) => (
            <div key={i} className="group text-center">
              <div className="relative h-[450px] w-full mb-6 overflow-hidden rounded-xl shadow-sm">
                <Image src={service.img} alt={service.title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div>
              </div>
              <h3 className="text-xl font-serif text-gray-900 mb-2">{service.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed max-w-[250px] mx-auto uppercase tracking-tighter">
                {service.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
      <button 
  onClick={() => setStep('giftcard')}
  className="w-full mt-4 p-4 border-2 border-pink-100 rounded-xl flex items-center justify-between hover:bg-pink-50 transition-all"
>
  <div className="flex items-center gap-3">
    <div className="p-2 bg-pink-100 rounded-lg text-[#d63384]">🎁</div>
    <span className="font-black uppercase text-xs tracking-widest text-gray-700">Buy Gift Card Online</span>
  </div>
  <span className="text-[#d63384]">→</span>
</button>
{/* GIFT CARD MODAL */}
{step === 'giftcard' && (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-100">
      <div className="bg-[#d63384] p-6 text-center">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Purchase Gift Card</h2>
        <p className="text-pink-100 text-[10px] font-bold uppercase tracking-widest mt-1">Pending Admin Activation</p>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Amount</label>
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 100, 200].map((amt) => (
              <button key={amt} onClick={() => setGiftAmount(amt)}
                className={`py-3 rounded-xl border-2 font-black text-sm transition-all ${
                  giftAmount === amt ? 'border-[#d63384] bg-pink-50 text-[#d63384]' : 'border-gray-50 bg-gray-50 text-gray-400'
                }`}>${amt}</button>
            ))}
          </div>
        </div>

        <InputItem label="Recipient Name" value={giftData.toName} onChange={(val) => setGiftData({...giftData, toName: val})} />
        <InputItem label="Recipient Email" value={giftData.toEmail} onChange={(val) => setGiftData({...giftData, toEmail: val})} />

        <div className="pt-4 space-y-3">
          <button onClick={handleGiftPurchase} disabled={!giftAmount || !giftData.toEmail}
            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg ${
              giftAmount && giftData.toEmail ? 'bg-[#d63384] text-white' : 'bg-gray-200 text-gray-400'
            }`}>Submit Order</button>
          <button onClick={() => setStep(1)} className="w-full text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">Cancel</button>
        </div>
      </div>
    </div>
  </div>
)}

{/* BOOKING SECTION */}
      <section id="book" className="py-20 px-4">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="p-8 md:p-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-[#d63384] mb-2 font-serif tracking-tight">Book a New Appointment</h2>
              <p className="text-gray-500 italic">Your moment of relaxation is just a few clicks away.</p>
            </div>

{step === 1 && (
  <div className="space-y-6 animate-in fade-in duration-500">
    <h3 className="text-xl font-bold text-gray-800 border-b pb-4 mb-6 text-[#d63384]">Step 1: Your Information</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Client Name</label>
        <input type="text" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-pink-500" placeholder="Full Name" />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Phone</label>
        <input type="tel" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-pink-500" placeholder="(555) 000-0000" />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Email (Optional)</label>
        <input type="email" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-pink-500" placeholder="email@example.com" />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Group Size</label>
        <select className="w-full p-3 border border-gray-200 rounded-xl bg-white outline-none">
          {[1, 2, 3, 4, 5, 6].map(num => <option key={num} value={num}>{num} Person(s)</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Technician Request</label>
        <select className="w-full p-3 border border-gray-200 rounded-xl bg-white outline-none">
          <option value="any">Any Technician</option>
          {staff.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Date & Time</label>
        <input type="datetime-local" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-pink-500" />
      </div>
    </div>
    <div>
      <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Notes (Optional)</label>
      <textarea className="w-full p-3 border border-gray-200 rounded-xl outline-none h-24" placeholder="Share any special requests..."></textarea>
    </div>
    <div className="text-center pt-6">
      <button onClick={() => setStep(2)} className="bg-[#d63384] text-white px-12 py-4 rounded-xl font-bold shadow-lg hover:opacity-90">
        Next: Select Services
      </button>
    </div>
  </div>
)}
{step === 2 && (
  <div className="space-y-4 animate-in fade-in duration-500">
    <h2 className="text-2xl font-black text-[#d63384] mb-8 text-center uppercase tracking-widest">
      Select Services
    </h2>
    
    {categories.length === 0 && (
      <div className="text-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d63384] mx-auto mb-4"></div>
        <p className="text-gray-400 text-xs font-bold uppercase">Syncing with Salon...</p>
      </div>
    )}

    {categories.map((cat) => {
      // Matches services where categoryId equals the Category's Document ID
      const catServices = services.filter(s => s.categoryId === cat.id);

      return (
        <div key={cat.id} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white">
          <button 
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className={`w-full p-5 text-left font-black flex justify-between items-center transition-all ${
              activeCategory === cat.id ? 'bg-pink-50 text-[#d63384]' : 'bg-gray-50 text-gray-500'
            }`}
          >
            <span className="uppercase tracking-widest text-[11px]">{cat.name}</span>
            <span className="text-xl">{activeCategory === cat.id ? "−" : "+"}</span>
          </button>
          
          {activeCategory === cat.id && (
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 bg-white border-t border-pink-50 animate-in slide-in-from-top-2">
              {catServices.length > 0 ? catServices.map(service => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                return (
                  <div 
                    key={service.id} 
                    onClick={() => setSelectedServices(isSelected 
                      ? selectedServices.filter(s => s.id !== service.id) 
                      : [...selectedServices, service]
                    )}
                    className={`p-4 border rounded-xl cursor-pointer transition-all flex flex-col justify-between min-h-[100px] ${
                      isSelected ? 'border-[#d63384] bg-pink-50 ring-2 ring-[#d63384]' : 'border-gray-100 hover:border-pink-200 shadow-sm'
                    }`}
                  >
                    <p className={`font-black text-[11px] leading-tight uppercase ${isSelected ? 'text-[#d63384]' : 'text-gray-700'}`}>
                      {service.name}
                    </p>
                    <p className="text-[#d63384] font-black mt-2 text-sm">${service.price}</p>
                  </div>
                );
              }) : (
                <p className="col-span-full text-center text-gray-300 text-[10px] py-4 uppercase font-bold">No services in this category</p>
              )}
            </div>
          )}
        </div>
      );
    })}

    {/* Price Summary Panel */}
    {selectedServices.length > 0 && (
      <div className="mt-8 p-6 bg-gray-900 rounded-xl text-white flex justify-between items-center animate-in slide-in-from-bottom-4">
        <div>
          <p className="text-[10px] font-black uppercase text-pink-400 tracking-widest">Selected</p>
          <p className="text-sm font-bold">{selectedServices.length} Item(s)</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase text-pink-400 tracking-widest">Estimated Total</p>
          <p className="text-2xl font-black">${selectedServices.reduce((acc, s) => acc + Number(s.price || 0), 0)}</p>
        </div>
      </div>
    )}

    {/* Navigation */}
    <div className="flex gap-4 mt-10">
      <button onClick={() => setStep(1)} className="flex-1 bg-gray-100 py-4 rounded-xl font-bold text-gray-400 uppercase text-xs">Back</button>
      <button 
        disabled={selectedServices.length === 0}
        onClick={() => setStep(3)}
        className={`flex-[2] py-4 rounded-xl font-bold shadow-lg uppercase text-xs transition-all ${
          selectedServices.length > 0 ? 'bg-[#d63384] text-white' : 'bg-gray-200 text-gray-400'
        }`}
      >
        Next: Booking Details
      </button>
    </div>
  </div>
)}
          </div>
        </div>
      </section>

      {/* 5. PROMOTIONS SECTION */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-serif text-gray-900">Current Promotions</h2>
            <p className="text-gray-500 mt-2 uppercase tracking-widest text-xs">Limited time offers</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {promotions.map((promo) => (
              <div key={promo.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-pink-100">
                <div className="p-8">
                  <span className="text-pink-600 font-bold text-xs uppercase tracking-[0.2em]">{promo.category}</span>
                  <h3 className="text-2xl font-bold text-gray-800 mt-4">{promo.title}</h3>
                  <p className="text-gray-600 mt-3 text-sm leading-relaxed">{promo.description}</p>
                  <div className="mt-8 pt-6 border-t border-pink-50 flex justify-between items-center">
                    <span className="text-3xl font-serif font-bold text-pink-600">${promo.price}</span>
                    <button className="text-gray-900 font-bold text-sm hover:text-pink-600 transition-colors uppercase tracking-widest">Details →</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
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
// Add this at the bottom of your file, outside of the HomePage function
function InputItem({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
      <input 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm" 
        placeholder={placeholder} 
      />
    </div>
  );
}