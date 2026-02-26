"use client";
import { useState, useEffect } from "react"; // <--- Add this line
import { useRouter, usePathname } from "next/navigation";
// Import icons from lucide-react (or your preferred icon library)
import { Home, BarChart3, Bell, Calendar, BookOpen, Plus } from "lucide-react";
// Add these Firebase imports
import { db } from "@/lib/firebase"; 
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function StaffMobileNav({ unreadCount }) {
  const router = useRouter();
  const pathname = usePathname();
const [bookingCount, setBookingCount] = useState(0);
// Replace this with your actual logic to get the logged-in staff ID
  const currentStaffId = "tech_01";
  const isActive = (path) => pathname === path;
useEffect(() => {
  const today = new Date().toISOString().split('T')[0];
  const q = query(
    collection(db, "bookings"),
    where("staffId", "==", currentStaffId),
    where("date", "==", today),
    where("status", "in", ["pending", "checked-in"]) // Only count active ones
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    setBookingCount(snapshot.size);
  });
  return () => unsubscribe();
}, [currentStaffId]);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100]">
      {/* THE NAV CONTAINER */}
      <div className="relative bg-white/90 backdrop-blur-lg h-20 flex justify-around items-center px-2 shadow-[0_-5px_25px_rgba(0,0,0,0.05)] border-t border-slate-100">
        
        {/* Left Side: Home & Reports */}
        <div className="flex w-1/2 justify-around pr-4">
          <button onClick={() => router.push('/staff/dashboard')} className="flex flex-col items-center gap-1 group">
            <div className={`p-2 rounded-xl transition-all ${isActive('/staff/dashboard') ? 'bg-pink-50 text-pink-600' : 'text-slate-400'}`}>
              <Home size={22} strokeWidth={isActive('/staff/dashboard') ? 2.5 : 2} />
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest ${isActive('/staff/dashboard') ? 'text-pink-600' : 'text-slate-400'}`}>Home</span>
          </button>

          <button onClick={() => router.push('/staff/matrix')} className="flex flex-col items-center gap-1">
            <div className={`p-2 rounded-xl transition-all ${isActive('/staff/matrix') ? 'bg-pink-50 text-pink-600' : 'text-slate-400'}`}>
              <BarChart3 size={22} strokeWidth={isActive('/staff/matrix') ? 2.5 : 2} />
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest ${isActive('/staff/matrix') ? 'text-pink-600' : 'text-slate-400'}`}>Matrix</span>
          </button>
        </div>

        {/* THE CENTER PINK BUTTON (Quick Appointment) */}
        

        {/* Right Side: Exams & Alerts */}
        <div className="flex w-1/2 justify-around pl-4">
         
<button onClick={() => router.push('/staff/bookings')} className="flex flex-col items-center gap-1 relative">
  <div className={`p-2 rounded-xl transition-all ${isActive('/staff/bookings') ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
    <Calendar size={22} strokeWidth={isActive('/staff/bookings') ? 2.5 : 2} />
  </div>
  
  {/* LIVE BOOKING COUNT BADGE */}
  {bookingCount > 0 && (
    <span className="absolute top-2 right-2 min-w-[16px] h-4 bg-red-600 text-white text-[9px] font-black rounded-full border-2 border-white flex items-center justify-center px-1">
      {bookingCount}
    </span>
  )}
  
  <span className={`text-[8px] font-black uppercase tracking-widest ${isActive('/staff/bookings') ? 'text-blue-600' : 'text-slate-400'}`}>My Booking</span>
</button>
 {/* Right Side: Exams & Alerts
          <button onClick={() => router.push('/staff/notifications')} className="flex flex-col items-center gap-1">
            <div className={`p-2 rounded-xl transition-all ${isActive('/staff/notifications') ? 'bg-pink-50 text-pink-600' : 'text-slate-400'}`}>
              <Bell size={22} strokeWidth={isActive('/staff/notifications') ? 2.5 : 2} />
            </div>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            )}
            <span className={`text-[8px] font-black uppercase tracking-widest ${isActive('/staff/notifications') ? 'text-pink-600' : 'text-slate-400'}`}>Notification</span>
          </button>
           */}
           <button onClick={() => router.push('/staff/board-exam')} className="flex flex-col items-center gap-1  relative">
            <div className={`p-2 rounded-xl transition-all ${isActive('/staff/board-exam') ? 'bg-pink-50 text-pink-600' : 'text-slate-400'}`}>
              <BookOpen size={22} strokeWidth={isActive('/staff/board-exam') ? 2.5 : 2} />
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest ${isActive('/staff/board-exam') ? 'text-pink-600' : 'text-slate-400'}`}>Exams</span>
          </button>

        </div>

      </div>
    </div>
  );
}