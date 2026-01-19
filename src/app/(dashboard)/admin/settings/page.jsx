"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  doc, getDoc, setDoc, collection, onSnapshot, writeBatch, Timestamp, 
  query, orderBy, deleteDoc, serverTimestamp 
} from "firebase/firestore";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [closures, setClosures] = useState([]);
  const [closureMessage, setClosureMessage] = useState("The salon is closed on the selected date.");
  
  // --- ANNOUNCEMENT STATE ---
  const [announcement, setAnnouncement] = useState({
    enabled: false,
    title: "",
    text: "",
  });

  // --- NEW BOOKING & SECURITY STATE ---
  const [bookingConfigs, setBookingConfigs] = useState({
    minBookingNotice: 12,
    defaultServiceDuration: 60,
    bufferTime: 15,
    maxLoginAttempts: 3,
    lockoutDuration: 120
  });

  const [storeSettings, setStoreSettings] = useState({
    name: "Nails Express",
    address: "1560 Hustonville Rd #345, Danville, KY",
    phone: "859-123-4567",
    hours: DAYS.reduce((acc, day) => ({ 
        ...acc, 
        [day]: { open: '09:00', close: '19:00', isClosed: false } 
    }), {})
  });

  useEffect(() => {
    const fetchSettings = async () => {
        try {
            const docRef = doc(db, "settings", "store_info");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setStoreSettings(data);
                if(data.closureMessage) setClosureMessage(data.closureMessage);
                if(data.announcement) setAnnouncement(data.announcement);
                
                // --- LOAD BOOKING & SECURITY DATA ---
                if(data.bookingConfigs) setBookingConfigs(data.bookingConfigs);
            }
        } catch (error) { console.error(error); } 
        finally { setLoading(false); }
    };
    fetchSettings();

    const unsub = onSnapshot(query(collection(db, "closures"), orderBy("date", "asc")), (snap) => {
      setClosures(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleSaveSettings = async () => {
    try {
        await setDoc(doc(db, "settings", "store_info"), {
            ...storeSettings,
            closureMessage,
            announcement,
            // --- SAVE BOOKING & SECURITY ---
            bookingConfigs 
        }, { merge: true });
        alert("Settings saved!");
    } catch (err) { alert("Permission Error: Check Firebase Rules"); }
  };

  const handleHourChange = (day, field, value) => {
    setStoreSettings({
      ...storeSettings,
      hours: {
        ...storeSettings.hours,
        [day]: { ...storeSettings.hours[day], [field]: value }
      }
    });
  };

  const toggleClosure = async (dateString) => {
    const existing = closures.find(c => c.date === dateString);
    try {
        if (existing) {
            await deleteDoc(doc(db, "closures", dateString));
        } else {
            await setDoc(doc(db, "closures", dateString), {
                date: dateString,
                reason: "Scheduled Closure",
                createdAt: serverTimestamp()
            });
        }
    } catch (err) { alert("Firebase Error"); }
  };
// --- 1. ADD THESE STATES ---
  const [serviceLogs, setServiceLogs] = useState([]);
  const [earningsData, setEarningsData] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // --- 2. ADD THIS EFFECT TO FETCH DATA ---
  useEffect(() => {
    // Fetch Earnings Logs
    const unsubLogs = onSnapshot(collection(db, "earnings"), (snap) => {
      setServiceLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Daily Summaries
    const unsubSummary = onSnapshot(collection(db, "salon_earnings"), (snap) => {
      setEarningsData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Staff
    const unsubStaff = onSnapshot(collection(db, "users"), (snap) => {
      setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubLogs(); unsubSummary(); unsubStaff(); };
  }, []);
// --- BACKUP FUNCTION ---
  const handleBackup = (serviceLogs, earningsData, staffList) => {
    try {
      const backupData = {
        earnings: serviceLogs || [],
        salon_earnings: earningsData || [],
        users: staffList || [],
        backupDate: new Date().toISOString(),
        version: "2.0"
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nailsexpress_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Backup failed: " + error.message);
    }
  };

  // --- RESTORE FUNCTION ---
  const handleRestore = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!confirm("WARNING: This will merge data into your database. Continue?")) return;

        const batch = writeBatch(db);

        // Restore Earnings Collection
        if (data.earnings) {
          data.earnings.forEach((item) => {
            const ref = doc(db, "earnings", item.id);
            const restoreItem = { ...item };
            // Convert strings back to Timestamps for the old app compatibility
            if (item.dateStr) {
              restoreItem.date = Timestamp.fromDate(new Date(item.dateStr + 'T12:00:00'));
            }
            batch.set(ref, restoreItem, { merge: true });
          });
        }

        await batch.commit();
        alert("System Restored Successfully!");
        window.location.reload(); // Refresh to see changes
      } catch (err) {
        alert("Restore failed. Ensure the file is a valid salon backup JSON.");
      }
    };
    reader.readAsText(file);
  };



  if (loading) return <div className="p-10 text-center font-black uppercase text-gray-300 tracking-widest">Loading Settings...</div>;

  return (
    <div className="max-w-6xl mx-auto pb-20 pt-8 px-6 space-y-10">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-6">
        <h1 className="text-2xl font-black text-gray-800 uppercase italic">General Settings</h1>
        <button onClick={handleSaveSettings} className="bg-pink-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-pink-700 transition-all">
          Save All Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Left Side */}
        <div className="space-y-8">
            {/* Store Details */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Store Details</h3>
                <input type="text" value={storeSettings.name} onChange={e => setStoreSettings({...storeSettings, name: e.target.value})} className="old-app-input" placeholder="Name" />
                <textarea value={storeSettings.address} onChange={e => setStoreSettings({...storeSettings, address: e.target.value})} className="old-app-input h-20" placeholder="Address" />
                <input type="text" value={storeSettings.phone} onChange={e => setStoreSettings({...storeSettings, phone: e.target.value})} className="old-app-input" placeholder="Phone" />
            </div>

            {/* --- NEW BOOKING CONFIGURATION SECTION --- */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Booking Configuration</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-gray-800 uppercase ml-1">Minimum Booking Notice (hours)</label>
                        <p className="text-[9px] text-gray-400 ml-1 mb-2 italic">Set the minimum hours in advance a client can book.</p>
                        <input type="number" value={bookingConfigs.minBookingNotice} onChange={e => setBookingConfigs({...bookingConfigs, minBookingNotice: e.target.value})} className="old-app-input" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-800 uppercase ml-1">Default Service Duration (minutes)</label>
                        <p className="text-[9px] text-gray-400 ml-1 mb-2 italic">Used if a service doesn't have a specific duration set.</p>
                        <input type="number" value={bookingConfigs.defaultServiceDuration} onChange={e => setBookingConfigs({...bookingConfigs, defaultServiceDuration: e.target.value})} className="old-app-input" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-800 uppercase ml-1">Buffer Time (minutes)</label>
                        <p className="text-[9px] text-gray-400 ml-1 mb-2 italic">Adds extra blocked time after each appointment.</p>
                        <input type="number" value={bookingConfigs.bufferTime} onChange={e => setBookingConfigs({...bookingConfigs, bufferTime: e.target.value})} className="old-app-input" />
                    </div>
                </div>
            </div>

            {/* --- NEW LOGIN SECURITY SECTION --- */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
                <h3 className="text-xs font-black text-red-500 uppercase tracking-widest">Login Security</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-gray-800 uppercase ml-1">Max Attempts</label>
                        <input type="number" value={bookingConfigs.maxLoginAttempts} onChange={e => setBookingConfigs({...bookingConfigs, maxLoginAttempts: e.target.value})} className="old-app-input" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-800 uppercase ml-1">Lockout (mins)</label>
                        <input type="number" value={bookingConfigs.lockoutDuration} onChange={e => setBookingConfigs({...bookingConfigs, lockoutDuration: e.target.value})} className="old-app-input" />
                    </div>
                </div>
            </div>
        <div className="space-y-6">
  {/* SECURITY CARD */}
  <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center gap-4 mb-8">
      <div className="p-3 bg-pink-50 rounded-xl">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div>
        <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Data Security</h3>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Database Backup & Recovery</p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* EXPORT BOX */}
      <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 group hover:border-pink-200 transition-all">
        <h4 className="font-black text-gray-700 text-sm mb-2 uppercase">Create Local Backup</h4>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          Saves all client logs, technician earnings, and staff profiles to a .json file on your device.
        </p>
        <button 
          onClick={() => handleBackup(serviceLogs, earningsData, staffList)}
          className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Backup
        </button>
      </div>

      {/* IMPORT BOX */}
      <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 group hover:border-green-200 transition-all">
        <h4 className="font-black text-gray-700 text-sm mb-2 uppercase">Restore From File</h4>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          Upload a backup file to restore lost data. <span className="text-red-500 font-bold">Warning: This may overwrite existing records.</span>
        </p>
        <label className="w-full flex items-center justify-center gap-3 bg-green-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-100 cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
          </svg>
          Upload & Restore
          <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
        </label>
      </div>
    </div>
  </div>
</div>

        </div>

        {/* Right Side */}
        <div className="space-y-6">
            {/* Salon Announcement */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Salon Announcement Popup</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" className="sr-only peer" 
                            checked={announcement.enabled}
                            onChange={(e) => setAnnouncement({...announcement, enabled: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-pink-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                </div>
                <div className="space-y-4">
                    <input type="text" value={announcement.title} onChange={(e) => setAnnouncement({...announcement, title: e.target.value})} className="old-app-input" placeholder="Popup Title" />
                    <textarea value={announcement.text} onChange={(e) => setAnnouncement({...announcement, text: e.target.value})} className="old-app-input h-24 resize-none" placeholder="Popup Message..." />
                </div>
            </div>

            {/* Operating Hours */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Operating Hours</h3>
                {DAYS.map(day => (
                    <div key={day} className="flex items-center justify-between py-2 border-b last:border-0">
                        <span className="text-xs font-bold text-gray-700 w-24">{day}</span>
                        <div className="flex gap-2">
                            <input type="time" value={storeSettings.hours[day].open} onChange={e => handleHourChange(day, 'open', e.target.value)} className="text-[10px] border border-gray-100 rounded-lg px-2 py-1 bg-gray-50 font-bold" />
                            <input type="time" value={storeSettings.hours[day].close} onChange={e => handleHourChange(day, 'close', e.target.value)} className="text-[10px] border border-gray-100 rounded-lg px-2 py-1 bg-gray-50 font-bold" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Holiday & Closure */}
            <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-serif italic font-bold text-gray-700 mb-6">Holiday & Closure</h3>
                <div className="space-y-4 mb-8">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Closure Message</label>
                    <textarea value={closureMessage} onChange={(e) => setClosureMessage(e.target.value)} className="old-app-input h-24" />
                </div>
                <div className="border-t pt-6">
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-4 block">Block Dates</label>
                    <input type="date" onChange={(e) => toggleClosure(e.target.value)} className="old-app-input mb-4" />
                    <div className="space-y-2">
                        {closures.map(c => (
                            <div key={c.id} className="flex justify-between items-center bg-pink-50 p-3 rounded-xl border border-pink-100">
                                <span className="text-xs font-bold text-pink-700">{c.date}</span>
                                <button onClick={() => toggleClosure(c.date)} className="text-pink-300 hover:text-pink-600 text-[10px] font-bold uppercase">Remove</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>

      <style jsx>{`
        .old-app-input { width: 100%; padding: 0.75rem; background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 0.75rem; font-size: 0.75rem; font-weight: 700; outline: none; transition: all 0.2s; }
        .old-app-input:focus { border-color: #ec4899; background: white; }
      `}</style>
    </div>
  );
}