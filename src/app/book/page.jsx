"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";

export default function PublicBookingPage() {
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    service: "",
    technician: "",
    date: "",
    time: ""
  });

  // Load live Services and Staff from Firebase
  useEffect(() => {
    const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
      setServices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubStaff = onSnapshot(collection(db, "staff"), (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubServices(); unsubStaff(); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Combine date and time into a single JS Date object for easier sorting in Admin
      const appointmentDate = new Date(`${formData.date}T${formData.time}`);

      await addDoc(collection(db, "appointments"), {
        ...formData,
        appointmentTimestamp: appointmentDate,
        status: "pending",
        createdAt: serverTimestamp(),
        source: "website_booking"
      });

      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting booking:", error);
      alert("Something went wrong. Please try again or call us.");
    } finally {
      setLoading(false);
    }
  };

  // Success View
  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50/30 px-6">
        <div className="text-center p-12 bg-white rounded-[3rem] shadow-xl max-w-md border border-white">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
            <i className="fas fa-check"></i>
          </div>
          <h2 className="text-3xl font-serif font-bold text-gray-800">Booking Received!</h2>
          <p className="text-gray-500 mt-4 leading-relaxed">
            Thank you, <span className="font-bold text-pink-600">{formData.name}</span>. 
            We've received your request for your session on <span className="font-bold">{formData.date}</span>. 
            We will text you shortly to confirm your spot!
          </p>
          <Link 
            href="/"
            className="inline-block mt-8 bg-pink-600 text-white px-8 py-3 rounded-full font-bold hover:bg-pink-700 transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Form View
  return (
    <div className="min-h-screen bg-pink-50/30 pt-32 pb-20 px-6">
      <div className="max-w-xl mx-auto bg-white rounded-[3rem] shadow-xl shadow-pink-100/50 p-10 border border-white">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-gray-800">Book Your Session</h1>
          <p className="text-gray-500 mt-2 italic">Select your preferred time and service</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-2">Full Name</label>
              <input 
                type="text" placeholder="Jane Doe" required
                className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 border-none transition-all"
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-2">Phone Number</label>
              <input 
                type="tel" placeholder="(555) 000-0000" required
                className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 border-none transition-all"
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>

          {/* Service Selection */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase ml-2">Select Service</label>
            <select 
              required className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 border-none appearance-none cursor-pointer"
              value={formData.service} onChange={e => setFormData({...formData, service: e.target.value})}
            >
              <option value="">Choose a treatment...</option>
              {services.map(s => (
                <option key={s.id} value={s.name}>{s.name} — ${s.price}</option>
              ))}
            </select>
          </div>

          {/* Technician Selection */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase ml-2">Technician (Optional)</label>
            <select 
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 border-none appearance-none cursor-pointer"
              value={formData.technician} onChange={e => setFormData({...formData, technician: e.target.value})}
            >
              <option value="Any Available">Any Available Technician</option>
              {staff.map(member => (
                <option key={member.id} value={member.name}>{member.name}</option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-2">Date</label>
              <input 
                type="date" required
                className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 border-none transition-all"
                value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-2">Time</label>
              <input 
                type="time" required
                className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 border-none transition-all"
                value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-pink-600 text-white font-bold py-5 rounded-2xl hover:bg-pink-700 transition-all shadow-lg shadow-pink-200 uppercase tracking-widest mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner animate-spin"></i> Processing...
              </>
            ) : (
              "Confirm Booking"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}