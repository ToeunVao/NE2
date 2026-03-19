"use client";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Calendar, Clock, Plus, CheckCircle2, Timer } from "lucide-react";
import Link from "next/link";

export default function ClientBookingHistory() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // 1. Query 'appointments' instead of 'bookings'
        const q = query(
          collection(db, "appointments"),
          where("clientId", "==", currentUser.uid),
          orderBy("appointmentTimestamp", "desc") // Use the Timestamp field
        );

        const unsubSnap = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => {
            const data = doc.data();
            
            // 2. Format the Firebase Timestamp into readable strings
            let displayDate = "N/A";
            let displayTime = "N/A";
            
            if (data.appointmentTimestamp) {
              const dateObj = data.appointmentTimestamp.toDate();
              displayDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              displayTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            }

            return {
              id: doc.id,
              ...data,
              displayDate,
              displayTime
            };
          });
          
          setBookings(docs);
          setLoading(false);
        });

        return () => unsubSnap();
      }
    });

    return () => unsubAuth();
  }, []);

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'bg-green-50 text-green-600 border-green-100';
      case 'pending': return 'bg-yellow-50 text-yellow-600 border-yellow-100';
      case 'cancelled': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  if (loading) return (
    <div className="p-20 text-center animate-pulse font-black text-pink-500 uppercase tracking-widest">
      Loading your appointments...
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 pb-24">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">My Bookings</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
            Manage your salon visits
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {bookings.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-3xl p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
              <Calendar size={32} />
            </div>
            <p className="text-gray-500 font-medium">No appointments found.</p>
          </div>
       ) : (
  bookings.map((booking) => {
    // Determine if the appointment time has already passed
    const isPassed = booking.appointmentTimestamp?.toDate() < new Date();

    return (
      <div 
        key={booking.id} 
        className={`border rounded-xl p-6 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ${
          isPassed 
            ? "bg-gray-50 border-gray-200 opacity-80" // Style for PASSED bookings
            : "bg-white border-gray-100 shadow-sm hover:shadow-md" // Style for UPCOMING bookings
        }`}
      >
        
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl border ${isPassed ? 'bg-gray-200 border-gray-300 text-gray-500' : getStatusStyle(booking.status)}`}>
            {/* If passed, we show a checkmark; if upcoming, we show the status icon */}
            {isPassed ? <CheckCircle2 size={24} /> : (booking.status === 'confirmed' ? <CheckCircle2 size={24} /> : <Timer size={24} />)}
          </div>
          <div>
            <h3 className={`font-bold text-lg ${isPassed ? 'text-gray-500' : 'text-gray-900'}`}>
              {booking.service || "Nail Service"}
            </h3>
            <p className="text-xs text-gray-500 font-medium">with {booking.technician || "Any Technician"}</p>
            {/* Display Group Size badge if more than 1 person */}
            {booking.groupSize > 1 && (
              <div className="mt-1 inline-block bg-pink-100 text-pink-600 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">
                Group of {booking.groupSize}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isPassed ? 'bg-gray-200/50' : 'bg-slate-50'}`}>
            <Calendar size={14} className={isPassed ? "text-gray-400" : "text-pink-500"} />
            <span className={isPassed ? "text-gray-500" : ""}>{booking.displayDate}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isPassed ? 'bg-gray-200/50' : 'bg-slate-50'}`}>
            <Clock size={14} className={isPassed ? "text-gray-400" : "text-pink-500"} />
            <span className={isPassed ? "text-gray-500" : ""}>{booking.displayTime}</span>
          </div>
        </div>

        <div className={`flex items-center justify-between md:justify-end gap-6 border-t md:border-0 pt-4 md:pt-0 ${isPassed ? 'border-gray-200' : 'border-gray-200'}`}>
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Price</p>
            <p className={`text-xl font-black ${isPassed ? 'text-gray-400' : 'text-gray-900'}`}>
              ${Number(booking.price || 0).toFixed(2)}
            </p>
          </div>
          
          <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${
            isPassed 
              ? 'bg-gray-200 border-gray-300 text-gray-500' 
              : getStatusStyle(booking.status)
          }`}>
            {isPassed ? "Completed" : (booking.status || 'Pending')}
          </div>
        </div>
      </div>
    );
  })
)}
      </div>
    </div>
  );
}