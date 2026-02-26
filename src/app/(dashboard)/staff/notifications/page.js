"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase"; // Adjust path to your firebase config
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, serverTimestamp, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Replace this with your actual Auth logic to get the logged-in staff ID
  const currentStaffId = "staff_123"; 

  useEffect(() => {
    if (!currentStaffId) return;

    // Listen to notifications for this staff member specifically
    const q = query(
      collection(db, "notifications"),
      where("assignedTo", "==", currentStaffId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentStaffId]);

  const markAllAsRead = async () => {
    const unreadQuery = query(
      collection(db, "notifications"),
      where("assignedTo", "==", currentStaffId),
      where("status", "==", "unread")
    );
    
    const snapshot = await getDocs(unreadQuery);
    const batch = writeBatch(db);
    
    snapshot.forEach((d) => {
      batch.update(d.ref, { status: "read", readAt: serverTimestamp() });
    });
    
    await batch.commit();
  };

  const getIcon = (type) => {
    switch(type) {
      case 'booking': return "📅";
      case 'checkin': return "📍";
      case 'review':  return "⭐";
      default:        return "🔔";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* HEADER */}
      <div className="bg-white px-6 pt-12 pb-6 border-b border-slate-100 sticky top-0 z-20">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Alerts</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Personal Activity Feed</p>
          </div>
          {notifications.some(n => n.status === 'unread') && (
            <button 
              onClick={markAllAsRead}
              className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-2 rounded-xl active:scale-95 transition-all"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* NOTIFICATION LIST */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-20 text-gray-300 font-black uppercase text-xs animate-pulse">Loading Feed...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
            <span className="text-4xl block mb-2">📭</span>
            <p className="text-[10px] font-black text-gray-400 uppercase">No new alerts today</p>
          </div>
        ) : (
          notifications.map((item) => (
            <div 
              key={item.id}
              onClick={() => item.link && router.push(item.link)}
              className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all active:scale-[0.98] ${
                item.status === 'unread' 
                ? 'bg-white border-blue-100 shadow-sm' 
                : 'bg-slate-50/50 border-transparent opacity-70'
              }`}
            >
              {/* TYPE ICON */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm ${
                item.status === 'unread' ? 'bg-blue-900 text-white' : 'bg-white text-slate-400'
              }`}>
                {getIcon(item.type)}
              </div>

              {/* TEXT CONTENT */}
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`text-[11px] font-black uppercase tracking-tight ${
                    item.status === 'unread' ? 'text-blue-900' : 'text-slate-500'
                  }`}>
                    {item.title}
                  </h3>
                  <span className="text-[8px] font-bold text-gray-400 uppercase">
                    {item.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                  "{item.message}"
                </p>
              </div>

              {/* UNREAD DOT */}
              {item.status === 'unread' && (
                <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}