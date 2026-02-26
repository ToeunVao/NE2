"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase"; 
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, Timestamp } from "firebase/firestore";
import { ChevronRight } from "lucide-react";
import { useStaffAuth } from "@/hooks/useStaffAuth"; 

export default function StaffBookingsPage() {
  const { staffId, loading: authLoading } = useStaffAuth();
  const [bookings, setBookings] = useState([]);
  const [staffName, setStaffName] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("today"); 

  useEffect(() => {
    if (!staffId) return;
    setLoading(true);

    // Get Staff Name from 'users' collection
    getDoc(doc(db, "users", staffId)).then(s => s.exists() && setStaffName(s.data().name));

    const appointmentsRef = collection(db, "appointments");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    let q;
    if (filter === "today") {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      q = query(
        appointmentsRef,
        where("staffId", "==", staffId),
        where("appointmentTimestamp", ">=", Timestamp.fromDate(startOfToday)),
        where("appointmentTimestamp", "<=", Timestamp.fromDate(endOfToday)),
        orderBy("appointmentTimestamp", "asc")
      );
    } else if (filter === "all") {
      q = query(
        appointmentsRef,
        where("staffId", "==", staffId),
        orderBy("appointmentTimestamp", "desc")
      );
    } else {
      q = query(
        appointmentsRef,
        where("staffId", "==", staffId),
        where("appointmentTimestamp", ">", Timestamp.fromDate(startOfToday)),
        orderBy("appointmentTimestamp", "asc")
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Query Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [staffId, filter]);

  if (authLoading || loading) return <div className="p-10 text-center font-bold text-pink-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#fafafa] pb-24 font-sans">
     
      {/* MODERN PINK SWITCH STYLE */}
      <div className="px-4 py-6">
        <div className="bg-slate-100/80 p-1 rounded-xl flex items-center w-full max-w-md mx-auto">
          {["today", "future", "all"].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`relative flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all duration-300 ${
                filter === t ? "bg-[#db2777] text-white shadow-md scale-[1.02]" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {bookings.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-200 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">No Bookings Found</p>
          </div>
        ) : (
          bookings.map((booking) => (
            <div key={booking.id} className="bg-white p-4 rounded-xl border border-slate-50 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="bg-pink-50 w-14 h-14 rounded-xl flex flex-col items-center justify-center border border-pink-100/50">
                  <span className="text-[10px] font-black text-pink-600">
                    {booking.appointmentTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase">{booking.name || booking.clientName}</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">{booking.service || booking.serviceName}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}