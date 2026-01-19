"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  writeBatch 
} from "firebase/firestore";
import { format } from "date-fns";

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [allNotifs, setAllNotifs] = useState({});
  const pathname = usePathname();
  const menuRef = useRef(null);

  // Close dropdown when changing pages
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateNotifications = (key, data) => {
    setAllNotifs(prev => {
      const updated = { ...prev, [key]: data };
      const flattened = Object.values(updated).flat();
      setNotifications(flattened.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
      return updated;
    });
  };

  useEffect(() => {
    const unsubscribers = [];

    // 1. Listen for UNREAD Bookings
    const qAppts = query(collection(db, "appointments"), where("isRead", "==", false));
    unsubscribers.push(onSnapshot(qAppts, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id, col: "appointments", type: 'booking',
        message: `New booking: ${doc.data().name || 'Client'}`,
        icon: 'fa-calendar-plus', color: 'bg-blue-100 text-blue-600',
        timestamp: doc.data().createdAt
      }));
      updateNotifications('bookings', data);
    }));

    // 2. Listen for Low Stock
    unsubscribers.push(onSnapshot(collection(db, "inventory"), (snap) => {
      const data = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => item.stock <= (item.minStock || 5))
        .map(item => ({
          id: item.id, type: 'inventory',
          message: `Low Stock: ${item.name}`,
          icon: 'fa-box-open', color: 'bg-red-100 text-red-600'
        }));
      updateNotifications('inventory', data);
    }));

    // 3. Listen for UNREAD Gift Cards
    const qGift = query(collection(db, "gift_cards"), where("isRead", "==", false));
    unsubscribers.push(onSnapshot(qGift, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id, col: "gift_cards",
        message: `New Online Gift Card Sale`,
        icon: 'fa-gift', color: 'bg-pink-100 text-pink-600',
        timestamp: doc.data().purchaseDate
      }));
      updateNotifications('giftcard', data);
    }));

    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  const markAsRead = async (note) => {
    if (note.col && note.id) {
      await updateDoc(doc(db, note.col, note.id), { isRead: true });
    }
  };

  const markAllRead = async () => {
    const batch = writeBatch(db);
    notifications.forEach(note => {
      if (note.col && note.id) {
        batch.update(doc(db, note.col, note.id), { isRead: true });
      }
    });
    await batch.commit();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 text-gray-400 hover:text-pink-600 transition-colors">
        <i className="fas fa-bell text-xl"></i>
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white font-bold animate-bounce">
            {notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-800 text-sm">Notifications</h3>
            {notifications.length > 0 && (
              <button onClick={markAllRead} className="text-[10px] font-black text-pink-600 uppercase tracking-widest hover:underline">
                Mark All Read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm italic">No new alerts</div>
            ) : (
              notifications.map((note) => (
                <div key={note.id} onClick={() => markAsRead(note)} className="p-4 border-b border-gray-50 hover:bg-pink-50/30 transition-colors cursor-pointer group">
                  <div className="flex gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${note.color}`}>
                      <i className={`fas ${note.icon}`}></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 font-bold leading-tight group-hover:text-pink-700">{note.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">
                        {note.timestamp ? format(note.timestamp.toDate(), "hh:mm a") : "Action Required"}
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