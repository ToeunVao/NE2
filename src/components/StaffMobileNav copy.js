"use client";
import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  writeBatch, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase"; // Ensure this path matches your firebase config
import { auth } from "@/lib/firebase"; 
import { signOut } from "firebase/auth";

const StaffMobileNav = ({ currentStaffId }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login"); // Redirect to login after signing out
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // 1. Listen for real-time notification badge updates
  useEffect(() => {
    if (!currentStaffId) return;

    const q = query(
      collection(db, "notifications"),
      where("assignedTo", "==", currentStaffId),
      where("status", "==", "unread")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [currentStaffId]);

  // 2. Function to navigate and clear alerts
const handleOpenAlerts = async () => {
  // 1. Force navigation first so the user sees the page immediately
  router.push("/staff/notifications");

  // 2. If there are no unread messages, stop here
  if (unreadCount === 0) return;

  // 3. Clear the badges in the background
  try {
    const q = query(
      collection(db, "notifications"),
      where("assignedTo", "==", currentStaffId),
      where("status", "==", "unread")
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.update(docSnap.ref, { 
        status: "read", 
        readAt: serverTimestamp() 
      });
    });
    await batch.commit();
  } catch (err) {
    console.error("Link working, but failed to clear badge:", err);
  }
};
  // Helper to highlight active link
  const isActive = (path) => pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 h-20 px-6 z-[100] shadow-[0_-4px_20px_-5px_rgba(30,58,138,0.1)]">
      <div className="flex items-center justify-between h-full relative">
        
        {/* HOME LINK */}
        <button 
          onClick={() => router.push("/staff/dashboard")} 
          className="flex flex-col items-center gap-1 transition-all active:scale-90"
        >
          <span className={`text-xl ${isActive("/staff/dashboard") ? "opacity-100" : "opacity-40"}`}>🏠</span>
          <span className={`text-[8px] font-black uppercase tracking-tighter ${isActive("/staff/dashboard") ? "text-blue-900" : "text-gray-400"}`}>
            Home
          </span>
        </button>

        {/* REPORTS LINK */}
        <button 
          onClick={() => router.push("/staff/matrix")} 
          className="flex flex-col items-center gap-1 transition-all active:scale-90"
        >
          <span className={`text-xl ${isActive("/staff/matrix") ? "opacity-100" : "opacity-40"}`}>📊</span>
          <span className={`text-[8px] font-black uppercase tracking-tighter ${isActive("/staff/matrix") ? "text-blue-900" : "text-gray-400"}`}>
            Report
          </span>
        </button>

        {/* --- MIDDLE SLOT FOR YOUR EXISTING QUICK APPOINTMENT BUTTON --- */}
        <div className="relative w-16 flex justify-center">
          <div className="absolute -top-12 w-16 h-16 bg-slate-50 border-[6px] border-white rounded-full flex items-center justify-center shadow-inner">
             {/* NOTE: Ensure your Global Quick Appointment Button 
                is CSS-positioned to sit exactly here 
             */}
          </div>
          <span className="text-[7px] font-black text-blue-900 absolute top-4 uppercase tracking-widest">
            Booking
          </span>
        </div>
        {/* ----------------------------------------------------------- */}

       
        {/* NOTIFICATIONS / ALERTS */}
        <button 
          onClick={handleOpenAlerts} 
          className="flex flex-col items-center gap-1 relative transition-all active:scale-90"
        >
          <span className={`text-xl ${isActive("/staff/notifications") ? "opacity-100" : "opacity-40"}`}>🔔</span>
          
          {/* THE NATIVE APP BADGE */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center px-1 shadow-sm animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}

          <span className={`text-[8px] font-black uppercase tracking-tighter ${isActive("/staff/notifications") ? "text-blue-900" : "text-gray-400"}`}>
            Alerts
          </span>
        </button>
{/* LOGOUT BUTTON (REPLACED ALERTS) 
        <button 
          onClick={handleLogout} 
          className="flex flex-col items-center gap-1 transition-all active:scale-90 group"
        >
          <span className="text-xl opacity-60 group-active:text-red-600 transition-colors">🚪</span>
          <span className="text-[8px] font-black uppercase tracking-tighter text-gray-400 group-active:text-red-600">
            Logout
          </span>
        </button>*/}
         {/* EXAM LINK */}
        <button 
          onClick={() => router.push("/theory-test/live")} 
          className="flex flex-col items-center gap-1 transition-all active:scale-90"
        >
          <span className={`text-xl ${isActive("/theory-test/live") ? "opacity-100" : "opacity-40"}`}>📝</span>
          <span className={`text-[8px] font-black uppercase tracking-tighter ${isActive("/theory-test/live") ? "text-blue-900" : "text-gray-400"}`}>
            State Exam
          </span>
        </button>

      </div>
    </nav>
  );
};

export default StaffMobileNav;