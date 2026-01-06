"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, orderBy, where, startAfter, getDocs,
  addDoc, serverTimestamp, limit, deleteDoc, doc, updateDoc // Add these two
} from "firebase/firestore";
export default function CheckInPage() {
  const [activeSubTab, setActiveSubTab] = useState("Check In");
  const [queue, setQueue] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [categories, setCategories] = useState([]); 
const [finishedClients, setFinishedClients] = useState([]);
const [lastDoc, setLastDoc] = useState(null); // Tracks where to start the next fetch
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(true);
  const [waitlist, setWaitlist] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]); 
  const [activeCategory, setActiveCategory] = useState(null); 
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(true); 
  const [selectedBooking, setSelectedBooking] = useState(null); // For the Detail Popup
  const [selectedReview, setSelectedReview] = useState(null);
  const [historySearch, setHistorySearch] = useState("");
const handleDelete = async (clientId) => {
  if (window.confirm("Are you sure you want to delete this client record?")) {
    try {
      await deleteDoc(doc(db, "finished_clients", clientId));
    } catch (e) {
      alert("Error deleting record");
    }
  }
};
  const [formData, setFormData] = useState({
    name: "", phone: "", technician: "Any Technician", groupSize: "1", bookingType: "Walk-IN"
  });

  const brandColor = "rgb(190 24 93)";

useEffect(() => {
  // 1. Technicians & Services
  onSnapshot(query(collection(db, "users"), where("role", "==", "technician")), (s) => 
    setTechnicians(s.docs.map(d => ({ id: d.id, ...d.data() })))
  );
  onSnapshot(collection(db, "services"), (s) => 
    setCategories(s.docs.map(d => ({ id: d.id, ...d.data() })))
  );

  // 2. Active Queue (from 'active_queue')
  onSnapshot(query(collection(db, "active_queue"), orderBy("checkInTimestamp", "asc")), (s) => 
    setQueue(s.docs.map(d => ({ 
      id: d.id, 
      ...d.data(), 
      timestamp: d.data().checkInTimestamp 
    })))
  );


  // 4. Waitlist (Synced with script.js 'appointments')
    onSnapshot(query(collection(db, "appointments"), where("status", "==", "scheduled"), orderBy("appointmentTimestamp", "asc")), (s) => 
      setWaitlist(s.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        timestamp: d.data().appointmentTimestamp 
      })))
    );

 const q = query(
    collection(db, "finished_clients"),
    orderBy("checkOutTimestamp", "desc"),
    limit(50)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const clients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setFinishedClients(clients);
    setLastDoc(snapshot.docs[snapshot.docs.length - 1]); // Save the 50th doc
    if (snapshot.docs.length < 50) setHasMore(false);
  });

  return () => unsubscribe();
}, []);

// Function to fetch the next 50
const loadMoreClients = async () => {
  if (!lastDoc || loadingMore) return;
  setLoadingMore(true);

  const nextQuery = query(
    collection(db, "finished_clients"),
    orderBy("checkOutTimestamp", "desc"),
    startAfter(lastDoc), // Start right after the previous 50th doc
    limit(50)
  );

  try {
    const snapshot = await getDocs(nextQuery);
    if (snapshot.empty) {
      setHasMore(false);
    } else {
      const newClients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setFinishedClients(prev => [...prev, ...newClients]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
    }
  } catch (error) {
    console.error("Error loading more:", error);
  } finally {
    setLoadingMore(false);
  }
};
  const toggleService = (service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.name === service.name);
      if (exists) return prev.filter(i => i.name !== service.name);
      return [...prev, { name: service.name, price: service.price }];
    });
  };

  const getSelectedCountForCategory = (cat) => {
    if (!cat.items) return 0;
    return selectedServices.filter(selected => 
      cat.items.some(item => item.name === selected.name)
    ).length;
  };

const handleCheckIn = async () => {
  if (!formData.name || selectedServices.length === 0) return alert("Please enter name and select at least one service");
  if (!policyAgreed) return alert("Please agree to the Salon Policy");

  try {
    // We target 'active_queue' and 'checkInTimestamp' to match your script.js logic
    await addDoc(collection(db, "active_queue"), {
      name: formData.name,
      phone: formData.phone,
      technician: formData.technician,
      groupSize: formData.groupSize,
      bookingType: formData.bookingType,
      services: selectedServices.map(s => s.name),
      checkInTimestamp: serverTimestamp(), // Matches your old script
      status: "waiting"
    });

    // Reset Form
    setFormData({ 
      name: "", 
      phone: "", 
      technician: "Any Technician", 
      groupSize: "1", 
      bookingType: "Walk-IN" 
    });
    setSelectedServices([]);
    alert("Check-in Successful!");
  } catch (error) {
    console.error("Error adding document: ", error);
    alert("Error during check-in. Please try again.");
  }
};
const startService = async (clientId) => {
  try {
    const clientRef = doc(db, "active_queue", clientId);
    await updateDoc(clientRef, {
      status: "processing",
      startServiceTimestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to start service");
  }
};

const finishClient = async (client) => {
  if (!window.confirm(`Move ${client.name} to history?`)) return;

  try {
    // 1. Prepare data for history
    const finishedData = {
      name: client.name,
      phone: client.phone || "",
      technician: client.technician,
      groupSize: client.groupSize || "1",
      services: client.services || [],
      checkInTimestamp: client.checkInTimestamp,
      checkOutTimestamp: serverTimestamp(), // Record when they finished
      status: "completed"
    };

    // 2. Add to finished_clients
    await addDoc(collection(db, "finished_clients"), finishedData);

    // 3. Remove from active_queue
    await deleteDoc(doc(db, "active_queue", client.id));
    
    alert("Client moved to history.");
  } catch (error) {
    console.error("Error finishing client:", error);
    alert("Failed to move client to history.");
  }
};

const handleCheckInFromWaitlist = async (appt) => {
  try {
    const queueData = {
      name: appt.name,
      phone: appt.phone || "",
      services: Array.isArray(appt.services) ? appt.services : [appt.services],
      technician: appt.technician || "Any Technician",
      groupSize: appt.groupSize || "1",
      bookingType: "Appointment",
      status: "waiting",
      checkInTimestamp: serverTimestamp() // Current time they walked in
    };

    await addDoc(collection(db, "active_queue"), queueData);
    await deleteDoc(doc(db, "appointments", appt.id));
    
    alert(`${appt.name} has been checked in!`);
  } catch (error) {
    console.error("Error checking in from waitlist:", error);
  }
};

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 font-sans">
      <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
        
{/* INNER NAV */}
<div className="flex bg-gray-50/50 p-3 gap-2 border-b border-gray-100">
  {["Check In", "Active Queue", "Processing", "Finished Clients", "Waitlist"].map((tab) => {
    // Calculate counts based on status
    const waitingCount = queue.filter(i => i.status === "waiting").length;
    const processingCount = queue.filter(i => i.status === "processing").length;
    
    return (
      <button 
        key={tab} 
        onClick={() => setActiveSubTab(tab)} 
        className={`px-6 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
          activeSubTab === tab ? "bg-white shadow-sm" : "text-gray-400 hover:text-gray-600"
        }`}
        style={{ color: activeSubTab === tab ? brandColor : "" }}
      >
        {tab} 
        {/* Dynamic Counting Logic */}
        {tab === "Active Queue" && waitingCount > 0 && ` (${waitingCount})`}
        {tab === "Processing" && processingCount > 0 && ` (${processingCount})`}
        {tab === "Finished Clients" && ` (${finishedClients.length})`}
      </button>
    );
  })}
</div>

        <div className="p-8">
          {activeSubTab === "Check In" ? (
            <div className="space-y-10">
              
              {/* SECTION 1: USER INFO */}
              <div className="space-y-6">
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Your Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <InputItem label="Full Name" value={formData.name} onChange={v => setFormData({...formData, name: v})} placeholder="Jane Doe" />
                  <InputItem label="Phone" value={formData.phone} onChange={v => setFormData({...formData, phone: v})} placeholder="(555) 000-0000" />
                  <SelectItem label="Technician" value={formData.technician} onChange={v => setFormData({...formData, technician: v})} options={["Any Technician", ...technicians.map(t => t.name)]} />
                  <SelectItem label="Group Size" value={formData.groupSize} onChange={v => setFormData({...formData, groupSize: v})} options={["1", "2", "3", "4+"]} />
                  <SelectItem label="Booking Type" value={formData.bookingType} onChange={v => setFormData({...formData, bookingType: v})} options={["Walk-IN", "Phone", "Online"]} />
                </div>
              </div>

              {/* SECTION 2: CATEGORIES */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                  <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Select Your Services</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedServices.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 border text-[9px] font-black rounded uppercase" style={{ backgroundColor: "rgb(190 24 93 / 0.1)", borderColor: "rgb(190 24 93 / 0.3)", color: brandColor }}>{s.name}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {categories.map((cat) => (
                    <div 
                      key={cat.id} 
                      onClick={() => setActiveCategory(cat)} 
                      className="relative p-5 border border-gray-100 rounded-lg text-center cursor-pointer transition-all hover:bg-gray-50 active:scale-95"
                    >
                        {getSelectedCountForCategory(cat) > 0 && (
                          <div className="absolute top-2 right-2 w-5 h-5 text-white rounded-lg flex items-center justify-center text-[9px] font-black shadow-md" style={{ backgroundColor: brandColor }}>
                            {getSelectedCountForCategory(cat)}
                          </div>
                        )}
                        <p className="font-black text-xs uppercase tracking-widest" style={{ color: brandColor }}>{cat.id.replace(/_/g, ' ')}</p>
                        <p className="text-[8px] font-bold text-gray-300 uppercase mt-1">Click to select</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 3: POLICY & CHECK IN */}
              <div className="flex flex-col items-center gap-6 pt-6 border-t border-gray-50">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={policyAgreed} 
                    onChange={(e) => setPolicyAgreed(e.target.checked)} 
                    style={{ accentColor: brandColor }} 
                    className="w-5 h-5 rounded cursor-pointer"
                  />
                  <span className="text-sm text-gray-500 font-bold tracking-tight">
                    I agree to the <button onClick={() => setShowPolicyModal(true)} className="underline font-black" style={{ color: brandColor }}>Salon Policy</button>
                  </span>
                </div>
                <button 
                  onClick={handleCheckIn} 
                  disabled={!policyAgreed} 
                  className="px-20 py-5 rounded-lg font-black uppercase text-xs tracking-widest text-white shadow-xl transition-all active:scale-95" 
                  style={{ backgroundColor: policyAgreed ? brandColor : "#ccc" }}
                >
                  ✓ Confirm Check In
                </button>
              </div>
            </div>

) : activeSubTab === "Finished Clients" ? (
<div className="space-y-6 animate-in fade-in duration-500">
    {/* Header & Search Section */}
    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
      <div>
        <h3 className="text-xl font-black uppercase italic tracking-tighter text-gray-800">History Log</h3>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Showing last {finishedClients.length} records
        </p>
      </div>
      
      <div className="relative w-full md:w-72">
        <input 
          type="text"
          placeholder="SEARCH CLIENT NAME..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-pink-100 transition-all"
          value={historySearch || ""}
          onChange={(e) => setHistorySearch(e.target.value)}
        />
        <svg className="absolute left-3 top-3 text-gray-300" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      </div>
    </div>

    {/* History Table */}
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
            <th className="p-4 text-center w-12">No.</th>
            <th className="p-4">Name</th>
            <th className="p-4 text-center">Group</th>
            <th className="p-4">Services</th>
            <th className="p-4">Time Out</th>
            <th className="p-4 text-center">Rating</th>
            <th className="p-4 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {finishedClients.length > 0 ? (
            finishedClients
              .filter(c => c.name?.toLowerCase().includes((historySearch || "").toLowerCase()))
              .map((client, idx) => (
              <tr key={client.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors group">
                {/* No. */}
                <td className="p-4 text-[10px] font-black text-center bg-gray-50/30 border-r border-gray-50 text-gray-300">
                  {idx + 1}
                </td>

                {/* Name */}
                <td className="p-4 border-r border-gray-50">
                  <p className="font-black text-gray-800 text-sm uppercase">{client.name}</p>
                  <p className="text-[10px] font-bold text-pink-600">{client.phone || "---"}</p>
                </td>

                {/* Group */}
                <td className="p-4 border-r border-gray-50 text-center font-bold text-gray-600">
                  {client.groupSize || "1"}
                </td>

                {/* Services */}
                <td className="p-4 border-r border-gray-50">
                  <div className="flex flex-wrap gap-1">
                    {client.services?.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-[9px] font-black border border-gray-100 text-gray-500 bg-white uppercase italic">
                        {s}
                      </span>
                    ))}
                  </div>
                </td>

                {/* Time Out */}
                <td className="p-4 border-r border-gray-50">
                  <p className="text-[11px] font-black text-gray-800">
                    {client.checkOutTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "---"}
                  </p>
                  <p className="text-[9px] font-bold text-gray-400">
                    {client.checkOutTimestamp?.toDate().toLocaleDateString()}
                  </p>
                </td>

                {/* Rating */}
                <td className="p-4 border-r border-gray-50 text-center">
                  <div 
                    className="flex justify-center items-center gap-0.5 cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => setSelectedReview(client)}
                  >
                    {client.rating && client.rating > 0 ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-sm ${i < client.rating ? "text-yellow-400" : "text-gray-200"}`}>
                          ★
                        </span>
                      ))
                    ) : (
                      <span className="text-[8px] font-black text-gray-300 uppercase italic">No Rating</span>
                    )}
                  </div>
                </td>

                {/* Action Column */}
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2 group-hover:opacity-100 transition-opacity">
                    {/* View Details */}
                    <button 
                      onClick={() => setSelectedBooking(client)}
                      className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors"
                      title="View Details"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    </button>

                    {/* Delete Permanent Record */}
                    <button 
                      onClick={() => handleDelete(client.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                      title="Delete Record"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="p-20 text-center text-gray-300 font-black uppercase text-xs tracking-widest">
                History is currently empty
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {hasMore && (
  <div className="p-6 border-t border-gray-50 flex justify-center bg-gray-50/30">
    <button 
      onClick={loadMoreClients}
      disabled={loadingMore}
      className="px-8 py-3 bg-white border border-gray-200 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-pink-600 hover:border-pink-200 transition-all shadow-sm active:scale-95 flex items-center gap-2"
    >
      {loadingMore ? (
        <>
          <span className="w-3 h-3 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></span>
          Loading...
        </>
      ) : (
        "Load More Clients"
      )}
    </button>
  </div>
)}

    </div>
  </div>
) : activeSubTab === "Waitlist" ? (
<div className="space-y-6 animate-in fade-in duration-500">
    {/* Header Section */}
    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex justify-between items-center">
      <div>
        <h3 className="text-xl font-black uppercase italic tracking-tighter text-gray-800">Upcoming Appointments</h3>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Confirmed Bookings: {waitlist.length}
        </p>
      </div>
      <div className="hidden md:block">
        <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest bg-pink-50 px-3 py-1 rounded-full">
          Calendar Sync Active
        </span>
      </div>
    </div>

    {/* Waitlist Table */}
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
            <th className="p-4 text-center w-12">No.</th>
            <th className="p-4">Client</th>
            <th className="p-4 text-center">Group</th>
            <th className="p-4">Requested Tech</th>
            <th className="p-4">Services</th>
            <th className="p-4">Scheduled Time</th>
            <th className="p-4 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {waitlist.length > 0 ? (
            waitlist.map((appt, idx) => (
              <tr key={appt.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors group">
                {/* No. */}
                <td className="p-4 text-[10px] font-black text-center bg-gray-50/30 border-r border-gray-50 text-gray-300">
                  {idx + 1}
                </td>

                {/* Name & Phone */}
                <td className="p-4 border-r border-gray-50">
                  <p className="font-black text-gray-800 text-sm uppercase">{appt.name}</p>
                  <p className="text-[10px] font-bold text-pink-600">{appt.phone || "NO PHONE"}</p>
                </td>

                {/* Group Size */}
                <td className="p-4 border-r border-gray-50 text-center font-bold text-gray-600">
                  {appt.groupSize || "1"}
                </td>

                {/* Requested Tech */}
                <td className="p-4 border-r border-gray-50 font-bold text-xs text-gray-700 uppercase">
                  {appt.technician || "ANY"}
                </td>

                {/* Services */}
                <td className="p-4 border-r border-gray-50">
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(appt.services) ? (
                      appt.services.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[9px] font-black border border-gray-100 text-gray-500 bg-white uppercase italic">
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black border border-gray-100 text-gray-500 bg-white uppercase italic">
                        {appt.services || "General"}
                      </span>
                    )}
                  </div>
                </td>

                {/* Scheduled Time */}
                <td className="p-4 border-r border-gray-50">
                  <p className="text-[11px] font-black text-gray-800">
                    {appt.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">
                    {appt.timestamp?.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </td>

                {/* Action Column */}
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    {/* Check In Button - Matches your logic to move to Active Queue */}
                    <button 
                      onClick={() => handleCheckInFromWaitlist(appt)}
                      className="px-3 py-1.5 bg-gray-800 text-white text-[9px] font-black uppercase rounded-lg hover:bg-black transition-all shadow-sm"
                    >
                      Check In
                    </button>
                    
                    {/* View/Detail Icon */}
                    <button 
                      onClick={() => setSelectedBooking(appt)}
                      className="p-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-500 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="p-20 text-center text-gray-300 font-black uppercase text-xs tracking-widest">
                No upcoming appointments for today
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
          ) : (
            /* ACTIVE QUEUE / PROCESSING / WAITLIST */
<div className="rounded-lg border border-gray-100 overflow-hidden shadow-sm">
  <table className="w-full text-left border-collapse">
    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
      <tr>
        <th className="p-4 text-center w-12">No.</th>
        <th className="p-4">Name</th>
        <th className="p-4 text-center">Group</th>
        <th className="p-4">Technician</th>
        <th className="p-4">Services</th>
        <th className="p-4">Check-in Time</th>
        <th className="p-4 text-center">Action</th>
      </tr>
    </thead>
    <tbody>
      {queue
        .filter(item => activeSubTab === "Active Queue" ? item.status === "waiting" : item.status === "processing")
        .map((item, idx) => (
          <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
            {/* No. */}
            <td className="p-4 text-xs font-black text-gray-300 text-center border-r border-gray-50">
              {idx + 1}
            </td>
            
            {/* Name */}
            <td className="p-4">
              <p className="font-black text-gray-800 text-sm uppercase">{item.name}</p>
              <p className="text-[9px] font-bold text-pink-500 uppercase">{item.bookingType || "Walk-In"}</p>
            </td>

            {/* Group */}
            <td className="p-4 text-center font-bold text-gray-600 text-xs">
              {item.groupSize || "1"}
            </td>

            {/* Technician */}
            <td className="p-4 font-bold text-xs text-gray-700 uppercase">
              {item.technician}
            </td>

            {/* Services */}
            <td className="p-4">
              <div className="flex flex-wrap gap-1">
                {item.services?.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[9px] font-black border border-gray-100 text-gray-500 bg-white uppercase italic">
                    {s}
                  </span>
                ))}
              </div>
            </td>

            {/* Check-in Time */}
            <td className="p-4">
              <p className="text-[11px] font-black text-gray-800">
                {item.checkInTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "---"}
              </p>
            </td>

            {/* Action */}
<td className="p-4 text-center">
  <div className="flex items-center justify-center gap-3">
    {item.status === "waiting" ? (
      <button 
        onClick={() => startService(item.id)}
        className="px-4 py-2 bg-gray-800 text-white text-[10px] font-black uppercase rounded-lg hover:bg-black transition-all shadow-sm"
      >
        Start
      </button>
    ) : (
      <span className="text-[9px] font-black uppercase text-green-500 bg-green-50 px-2 py-1 rounded">
        In Progress
      </span>
    )}

    {/* Quick Finish Icon Button */}
    <button 
      onClick={() => finishClient(item)}
      title="Quick Move to Finished"
      className="p-2 hover:bg-green-50 text-green-600 rounded-full transition-colors border border-transparent hover:border-green-100"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </button>
  </div>
</td>
          </tr>
        ))}

      {/* Empty State */}
      {queue.filter(item => activeSubTab === "Active Queue" ? item.status === "waiting" : item.status === "processing").length === 0 && (
        <tr>
          <td colSpan="7" className="p-20 text-center text-gray-300 font-black uppercase text-xs tracking-widest">
            No clients currently {activeSubTab === "Active Queue" ? "waiting" : "being processed"}
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>
          )}
        </div>
      </div>

      {/* POPUP: SUB-CATEGORIES */}
      {activeCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-50 backdrop-blur-sm" onClick={() => setActiveCategory(null)}></div>
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-black uppercase text-sm tracking-widest" style={{ color: brandColor }}>{activeCategory.id.replace(/_/g, ' ')}</h3>
              <button onClick={() => setActiveCategory(null)} className="text-gray-400 hover:text-gray-800 text-xl font-bold">×</button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
              {activeCategory.items?.map((item, index) => {
                const isSelected = selectedServices.some(s => s.name === item.name);
                return (
                  <div 
                    key={index}
                    onClick={() => toggleService(item)}
                    className="p-4 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-center"
                    style={{ 
                      borderColor: isSelected ? brandColor : "#f3f4f6",
                      backgroundColor: isSelected ? "rgb(190 24 93 / 0.05)" : "white"
                    }}
                  >
                    <span className="text-sm font-black" style={{ color: isSelected ? brandColor : "#374151" }}>{item.name}</span>
                    <span className="text-xs font-black opacity-70" style={{ color: brandColor }}>${item.price}</span>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => setActiveCategory(null)} className="w-full bg-gray-800 text-white py-3 rounded-lg font-black uppercase text-[10px] tracking-widest">Done Selection</button>
            </div>
          </div>
        </div>
      )}
{selectedReview && (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-gray-50 backdrop-blur-sm" onClick={() => setSelectedReview(null)}></div>
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
      
      {/* Header with Background Accent */}
      <div className="bg-pink-50 p-6 text-center border-b border-pink-100">
        <div className="flex justify-center mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`text-2xl ${i < selectedReview.rating ? "text-yellow-400" : "text-gray-200"}`}>
              ★
            </span>
          ))}
        </div>
        <h3 className="font-black uppercase text-gray-800 tracking-tight">{selectedReview.name}</h3>
        <p className="text-[10px] font-bold text-pink-500 uppercase">Client Review</p>
      </div>

      {/* Review Content */}
      <div className="p-8">
        <div className="relative">
          <span className="absolute -top-4 -left-2 text-4xl text-pink-100 font-serif">“</span>
          <p className="text-gray-600 text-sm leading-relaxed italic relative z-10 text-center">
            {selectedReview.reviewText || selectedReview.comment || "The client provided a star rating but did not leave a written comment."}
          </p>
          <span className="absolute -bottom-6 -right-2 text-4xl text-pink-100 font-serif">”</span>
        </div>
      </div>

      {/* Close Button */}
      <div className="p-4 bg-gray-50 flex justify-center">
        <button 
          onClick={() => setSelectedReview(null)}
          className="px-10 py-2 bg-gray-800 text-white rounded-full font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all"
        >
          Close Review
        </button>
      </div>
    </div>
  </div>
)}
{selectedBooking && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-gray-50 backdrop-blur-sm" onClick={() => setSelectedBooking(null)}></div>
    <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden border-t-4" style={{ borderColor: brandColor }}>
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h3 className="font-black uppercase text-sm tracking-widest text-gray-800">Booking Detail</h3>
        <button onClick={() => setSelectedBooking(null)} className="text-gray-400 hover:text-black text-2xl">&times;</button>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Client Details */}
        <div>
          <h4 className="text-[10px] font-black text-pink-600 uppercase mb-2 border-b pb-1">Client Details</h4>
          <p className="text-sm font-bold text-gray-700">Name: <span className="font-normal">{selectedBooking.name}</span></p>
          <p className="text-sm font-bold text-gray-700">Phone: <span className="font-normal">{selectedBooking.phone || "N/A"}</span></p>
          <p className="text-sm font-bold text-gray-700">Group Size: <span className="font-normal">{selectedBooking.groupSize || "1"}</span></p>
        </div>

        {/* Appointment Details */}
        <div>
          <h4 className="text-[10px] font-black text-pink-600 uppercase mb-2 border-b pb-1">Appointment Details</h4>
          <p className="text-sm font-bold text-gray-700">Date: <span className="font-normal">{selectedBooking.timestamp?.toDate().toLocaleString()}</span></p>
          <p className="text-sm font-bold text-gray-700">Services: <span className="font-normal">{selectedBooking.services?.join(", ")}</span></p>
          <p className="text-sm font-bold text-gray-700">Technician: <span className="font-normal">{selectedBooking.technician}</span></p>
          <p className="text-sm font-bold text-gray-700">Booking Type: <span className="font-normal">{selectedBooking.bookingType || "Walk-In"}</span></p>
        </div>

        {/* Next Appointment */}
        <div>
          <h4 className="text-[10px] font-black text-pink-600 uppercase mb-2 border-b pb-1">Next Appointment</h4>
          <p className="text-sm italic text-gray-400">Not scheduled</p>
        </div>
      </div>

      <div className="p-4 bg-gray-50 text-right">
        <button 
          onClick={() => setSelectedBooking(null)} 
          className="px-6 py-2 bg-gray-800 text-white font-black uppercase text-[10px] rounded"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}
      {/* POPUP: SALON POLICY */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-50 backdrop-blur-sm" onClick={() => setShowPolicyModal(false)}></div>
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-black uppercase text-lg tracking-tight" style={{ color: brandColor }}>Salon Policy</h3>
              <button onClick={() => setShowPolicyModal(false)} className="text-gray-400 hover:text-gray-800 text-2xl">×</button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto text-sm text-gray-600 space-y-4 leading-relaxed">
              <p className="font-bold text-gray-800">To ensure a pleasant experience for all our clients, we kindly request your observance of the following policies:</p>
              <PolicySection num="1" title="Appointments" text="We encourage booking appointments in advance via phone or our online system to secure your preferred time and technician. Walk-ins are welcome but are subject to availability." color={brandColor} />
              <PolicySection num="2" title="Cancellations & No-Shows" text="We understand that schedules can change. Please provide at least 24 hours' notice for any cancellations. Cancellations with less than 24 hours' notice or no-shows may be subject to a fee on your next visit." color={brandColor} />
              <PolicySection num="3" title="Late Arrivals" text="To ensure our technicians have enough time to provide high-quality service, we may need to shorten your service or reschedule your appointment if you arrive more than 15 minutes late." color={brandColor} />
              <PolicySection num="4" title="Technician Requests" text="You may request a specific technician when booking your appointment. We will do our best to accommodate your request, but we cannot guarantee availability." color={brandColor} />
              <PolicySection num="5" title="Pricing and Service Adjustments" text="Prices for services are based on standard nail length and condition. Prices may be adjusted for extra-long nails, complex designs, or additional preparation work required." color={brandColor} />
              <PolicySection num="6" title="Refunds & Service Guarantee" text="If you are not satisfied, please let us know before you leave. We offer a 7-day guarantee for gel polish and acrylic services. No monetary refunds." color={brandColor} />
              <PolicySection num="7" title="Right to Refuse Service" text="We reserve the right to refuse service to anyone with a nail condition we suspect may be contagious, or for any behavior we deem inappropriate." color={brandColor} />
              <p className="text-center font-black pt-4 border-t border-gray-100" style={{ color: brandColor }}>Thank you for your understanding!</p>
            </div>
            <div className="p-4 bg-gray-50 text-right">
              <button onClick={() => setShowPolicyModal(false)} className="px-8 py-3 rounded-lg text-white font-black uppercase text-[10px] tracking-widest shadow-md transition-all hover:scale-105 active:scale-95" style={{ backgroundColor: brandColor }}>Close Policy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
function PolicySection({ num, title, text, color }) {
  return (
    <div>
      <p className="font-black uppercase text-[11px] mb-1" style={{ color }}>{num}. {title}</p>
      <p>{text}</p>
    </div>
  );
}

function InputItem({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
      <input 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-4 bg-gray-50 border border-transparent rounded-lg text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100" 
        placeholder={placeholder} 
      />
    </div>
  );
}

function SelectItem({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-4 bg-gray-50 border border-transparent rounded-lg text-sm font-bold text-gray-700 outline-none cursor-pointer"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}