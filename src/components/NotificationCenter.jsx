"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Listen for recent notifications or system alerts
    const q = query(collection(db, "notifications"), orderBy("timestamp", "desc"), limit(5));
    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.length; // You can add a 'read' boolean to your DB later

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-pink-600 transition-colors"
      >
        <i className="fas fa-bell text-xl"></i>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-4 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Alerts</h3>
            <button className="text-xs text-pink-600 font-bold hover:underline">Clear All</button>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm italic">
                No new notifications
              </div>
            ) : (
              notifications.map((note) => (
                <div key={note.id} className="p-4 border-b border-gray-50 hover:bg-pink-50/30 transition-colors cursor-pointer">
                  <div className="flex gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      note.type === 'reminder' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                    }`}>
                      <i className={`fas ${note.type === 'reminder' ? 'fa-clock' : 'fa-exclamation-triangle'}`}></i>
                    </div>
                    <div>
                      <p className="text-sm text-gray-700 font-medium leading-tight">{note.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">
                        {note.timestamp ? format(note.timestamp.toDate(), "hh:mm a") : "Just now"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}