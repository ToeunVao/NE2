"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, orderBy, where, getDocs, 
  doc, updateDoc, addDoc, serverTimestamp, arrayUnion // Add arrayUnion here
} from "firebase/firestore";
import { format } from "date-fns";

export default function ClientsPage() {
  const [finishedClients, setFinishedClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [newClient, setNewClient] = useState({
    name: "", phone: "", email: "", dob: ""
  });
const [selectedClient, setSelectedClient] = useState(null);
const [isDetailOpen, setIsDetailOpen] = useState(false);
const [clientNotes, setClientNotes] = useState("");
const [isEditing, setIsEditing] = useState(false);
const [editData, setEditData] = useState(null);
  useEffect(() => {
    // 1. Get Finished Clients
    const unsubFinished = onSnapshot(collection(db, "finished_clients"), (snap) => {
      setFinishedClients(snap.docs.map(doc => doc.data()));
    });

    // 2. Get All Bookings (Online & Calendar)
    const unsubAppts = onSnapshot(collection(db, "appointments"), (snap) => {
      setAppointments(snap.docs.map(doc => doc.data()));
    });

    return () => { unsubFinished(); unsubAppts(); };
  }, []);

  // MERGE LOGIC: Remove duplicates by Phone Number
  const uniqueClients = useMemo(() => {
    const allData = [...finishedClients, ...appointments];
    const clientMap = new Map();

    allData.forEach(person => {
      if (!person.phone) return;
      const phoneKey = person.phone.replace(/\D/g, ""); // Standardize phone format
      
      if (!clientMap.has(phoneKey)) {
        clientMap.set(phoneKey, {
          name: person.name,
          phone: person.phone,
          email: person.email || "N/A",
          dob: person.dob || "",
          lastVisit: person.checkOutTimestamp || person.appointmentTimestamp || null
        });
      }
    });

    return Array.from(clientMap.values()).filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    );
  }, [finishedClients, appointments, searchTerm]);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "finished_clients"), {
      ...newClient,
      createdAt: serverTimestamp(),
      manualEntry: true
    });
    setIsModalOpen(false);
    setNewClient({ name: "", phone: "", email: "", dob: "" });
  };

  const handleDeleteClient = async (phone) => {
  if (window.confirm("Are you sure you want to delete this client? This will remove their history.")) {
    // Logic: Delete from finished_clients where phone matches
    // Note: Since you merge data, you'd usually delete the records associated with this phone
    alert("Delete logic triggered for: " + phone);
  }
};
const handleUpdateClient = async () => {
  try {
    const q = query(
      collection(db, "finished_clients"), 
      where("phone", "==", selectedClient.phone)
    );
    
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("No matching record found to update.");
      return;
    }

    const updatePromises = querySnapshot.docs.map((docSnap) => {
      return updateDoc(docSnap.ref, {
        name: selectedClient.name,
        email: selectedClient.email || "",
        dob: selectedClient.dob || "",
        // This ensures the notes array exists if it was empty
        notes: selectedClient.notes || [] 
      });
    });

    await Promise.all(updatePromises);
    setIsEditing(false);
    alert("Profile updated!");
  } catch (error) {
    console.error("Update Error:", error);
    alert("Error: " + error.message);
  }
};

const handleSaveNote = async () => {
  if (!clientNotes.trim()) return;

  try {
    // Search for all documents with this phone number
    const q = query(collection(db, "finished_clients"), where("phone", "==", selectedClient.phone));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("Error: Client record not found in database.");
      return;
    }

    const newNoteObj = {
      text: clientNotes,
      date: new Date().toLocaleDateString(),
      author: "Admin"
    };

    // Update the database
    const batchPromises = querySnapshot.docs.map(docSnap => {
      return updateDoc(docSnap.ref, {
        notes: arrayUnion(newNoteObj)
      });
    });

    await Promise.all(batchPromises);
    
    // Update the local UI state so it shows up immediately
    setSelectedClient(prev => ({
      ...prev,
      notes: [...(prev.notes || []), newNoteObj]
    }));
    
    setClientNotes(""); // Clear input
    alert("Note saved successfully!");

  } catch (error) {
    console.error("Save Note Error:", error);
    alert("Database Error: Could not save note.");
  }
};

  return (
    <div className="p-10 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-4xl font-black text-gray-800 uppercase tracking-tighter">Clients</h1>
          <p className="text-gray-400 font-bold text-sm">Total Unique Clients: {uniqueClients.length}</p>
        </div>
        
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Search name or phone..."
            className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm text-sm outline-none focus:ring-2 focus:ring-pink-500 w-64"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-pink-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-pink-700 transition-all shadow-lg shadow-pink-100 flex items-center gap-2"
          >
            <i className="fas fa-user-plus"></i> Create New Client
          </button>
        </div>
      </div>

      {/* CLIENT TABLE */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-50 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-5 text-[10px] font-black uppercase text-gray-400">Client Name</th>
              <th className="p-5 text-[10px] font-black uppercase text-gray-400">Phone</th>
              <th className="p-5 text-[10px] font-black uppercase text-gray-400">Email</th>
              <th className="p-5 text-[10px] font-black uppercase text-gray-400">Birthday (DOB)</th>
              <th className="p-5 text-[10px] font-black uppercase text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
  {uniqueClients.map((client, idx) => (
    <tr key={idx} className="hover:bg-pink-50/30 transition-colors group">
      <td className="p-5 font-bold text-gray-800">{client.name}</td>
      <td className="p-5 text-sm text-gray-500">{client.phone}</td>
      <td className="p-5 text-sm text-gray-400">{client.email}</td>
      <td className="p-5 text-sm font-black text-pink-600">{client.dob || "-"}</td>
      <td className="p-5 text-right space-x-2">
        {/* VIEW DETAILS BUTTON */}
        <button 
          onClick={() => {
            setSelectedClient(client);
            setIsDetailOpen(true);
          }}
          className="text-blue-500 hover:bg-blue-100 p-2 rounded-lg transition-all"
        >
          <i className="fas fa-info-circle text-lg"></i>
        </button>
        
        {/* DELETE BUTTON */}
        <button 
          onClick={() => handleDeleteClient(client.phone)}
          className="text-gray-300 hover:text-red-600 p-2 rounded-lg transition-all"
        >
          <i className="fas fa-trash text-lg"></i>
        </button>
      </td>
    </tr>
  ))}
</tbody>
        </table>
      </div>

      {/* CREATE CLIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <form onSubmit={handleCreateClient} className="relative bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black uppercase mb-6 text-gray-800">Add New Client</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400">Full Name</label>
                <input required type="text" className="w-full p-3 bg-gray-50 rounded-xl border-none mt-1" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400">Phone</label>
                <input required type="tel" className="w-full p-3 bg-gray-50 rounded-xl border-none mt-1" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400">Email (Optional)</label>
                <input type="email" className="w-full p-3 bg-gray-50 rounded-xl border-none mt-1" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400">Date of Birth (Optional)</label>
                <input type="date" className="w-full p-3 bg-gray-50 rounded-xl border-none mt-1" value={newClient.dob} onChange={e => setNewClient({...newClient, dob: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-pink-600 text-white p-4 rounded-xl font-black uppercase mt-4 shadow-lg shadow-pink-100">Save Client</button>
            </div>
          </form>
        </div>
      )}
    
{isDetailOpen && selectedClient && (
  <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
      
      {/* 1. HEADER NAVIGATION */}
      <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
        <button 
          onClick={() => {
            setIsDetailOpen(false);
            setIsEditing(false);
          }} 
          className="flex items-center gap-2 text-gray-400 hover:text-pink-600 font-black uppercase text-[10px] tracking-widest transition-all group"
        >
          <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i> 
          Back to List
        </button>

        <div className="flex items-center gap-3">
           <button 
             onClick={() => {
               if(isEditing) handleUpdateClient(); // Save if currently editing
               setIsEditing(!isEditing);
             }}
             className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
               isEditing 
               ? 'bg-green-600 text-white shadow-green-100' 
               : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
             }`}
           >
             {isEditing ? (
               <><i className="fas fa-save mr-2"></i> Save Changes</>
             ) : (
               <><i className="fas fa-pencil-alt mr-2"></i> Edit Profile</>
             )}
           </button>
           
           <button 
            onClick={() => setIsDetailOpen(false)} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-red-500 transition-colors"
           >
             <i className="fas fa-times text-xl"></i>
           </button>
        </div>
      </div>

      <div className="p-10 overflow-y-auto custom-scrollbar">
        {isEditing ? (
          /* ======================== EDIT MODE ======================== */
          <div className="max-w-2xl mx-auto space-y-8 py-10">
             <div className="text-center">
               <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <i className="fas fa-user-edit text-3xl"></i>
               </div>
               <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Edit Client Information</h2>
               <p className="text-gray-400 text-xs font-bold uppercase mt-1">Updating records for {selectedClient.phone}</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
               <InputItem 
                 label="Full Name" 
                 value={selectedClient.name} 
                 onChange={(v) => setSelectedClient({...selectedClient, name: v})} 
               />
               <InputItem 
                 label="Email Address" 
                 value={selectedClient.email || ""} 
                 onChange={(v) => setSelectedClient({...selectedClient, email: v})} 
                 placeholder="client@example.com"
               />
               <InputItem 
                 label="Phone Number" 
                 value={selectedClient.phone} 
                 onChange={(v) => setSelectedClient({...selectedClient, phone: v})} 
               />
               <InputItem 
                 label="Birthday (DOB)" 
                 value={selectedClient.dob || ""} 
                 onChange={(v) => setSelectedClient({...selectedClient, dob: v})} 
                 placeholder="YYYY-MM-DD"
               />
             </div>
             
             <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
               <p className="text-[10px] font-black text-blue-600 uppercase mb-2">Marketing Preference</p>
               <p className="text-xs text-blue-400 leading-relaxed">Collecting the Birthday and Email allows you to send automated promotion discounts to this client in the future.</p>
             </div>
          </div>
        ) : (
          /* ======================== VIEW DETAILS MODE ======================== */
          <>
            {/* HEADER INFO */}
            <div className="text-center mb-10">
              <h2 className="text-4xl font-black text-gray-800 uppercase tracking-tighter leading-none mb-2">{selectedClient.name}</h2>
              <div className="flex items-center justify-center gap-3">
                <span className="bg-pink-100 text-pink-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {selectedClient.phone}
                </span>
                {selectedClient.email && (
                  <span className="text-gray-400 text-xs font-bold">{selectedClient.email}</span>
                )}
              </div>
            </div>

            {/* STATS CARDS (Exactly like your picture) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <div className="bg-pink-50/50 border border-pink-100 p-5 rounded-3xl text-center">
                <p className="text-[10px] font-black uppercase text-pink-400 tracking-widest mb-1">Total Visits</p>
                <p className="text-3xl font-black text-pink-600">
                  {[...finishedClients, ...appointments].filter(i => i.phone === selectedClient.phone).length}
                </p>
              </div>
              <div className="bg-green-50/50 border border-green-100 p-5 rounded-3xl text-center">
                <p className="text-[10px] font-black uppercase text-green-400 tracking-widest mb-1">Total Spent</p>
                <p className="text-3xl font-black text-green-600">$0.00</p>
              </div>
              <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-3xl text-center">
                <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">Favorite Tech</p>
                <p className="text-sm font-black text-blue-600 uppercase mt-2 truncate px-2">Any Technician</p>
              </div>
              <div className="bg-orange-50/50 border border-orange-100 p-5 rounded-3xl text-center">
                <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest mb-1">Favorite Color</p>
                <p className="text-sm font-black text-orange-600 uppercase mt-2">N/A</p>
              </div>
            </div>
<div className="mt-10 space-y-4">
  <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Upcoming Appointments</h3>
  <div className="border border-dashed border-gray-200 rounded-2xl p-6 bg-gray-50/30 text-center">
    {/* Filter appointments where date is in the future */}
    {appointments.filter(a => a.phone === selectedClient.phone && a.status !== 'completed').length > 0 ? (
       <div className="space-y-3 text-left">
          {appointments
            .filter(a => a.phone === selectedClient.phone && a.status !== 'completed')
            .map((appt, i) => (
              <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                <div>
                  <p className="font-bold text-gray-800">{appt.date} @ {appt.time}</p>
                  <p className="text-[10px] text-pink-600 font-black uppercase">{appt.service}</p>
                </div>
                <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Confirmed</span>
              </div>
          ))}
       </div>
    ) : (
      <p className="text-gray-400 text-sm italic">No upcoming appointments.</p>
    )}
</div>
</div>
            {/* VISIT HISTORY SECTION */}
            <div className="space-y-4">
              <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                <i className="fas fa-history text-pink-500"></i> Visit History
              </h3>
              <div className="border border-gray-100 rounded-[1.5rem] overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="p-5 font-black uppercase text-[10px] text-gray-400 tracking-widest">Date</th>
                      <th className="p-5 font-black uppercase text-[10px] text-gray-400 tracking-widest">Services</th>
                      <th className="p-5 font-black uppercase text-[10px] text-gray-400 tracking-widest">Technician</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...finishedClients, ...appointments]
                      .filter(item => item.phone === selectedClient.phone)
                      .sort((a,b) => (b.checkOutTimestamp?.toMillis() || 0) - (a.checkOutTimestamp?.toMillis() || 0))
                      .map((visit, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-5 font-bold text-gray-700 text-sm">
                          {visit.checkOutTimestamp ? format(visit.checkOutTimestamp.toDate(), "MM/dd/yyyy") : "Upcoming"}
                        </td>
                        <td className="p-5">
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(visit.services) 
                              ? visit.services.map((s, si) => (
                                  <span key={si} className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded font-bold">{s}</span>
                                ))
                              : <span className="text-sm text-gray-500">{visit.service || "Standard Service"}</span>
                            }
                          </div>
                        </td>
                        <td className="p-5 text-sm text-gray-500 font-medium">
                          {visit.technician || "Any Technician"}
                        </td>
                      </tr>
                    ))}
                    {/* Empty State */}
                    {[...finishedClients, ...appointments].filter(i => i.phone === selectedClient.phone).length === 0 && (
                      <tr>
                        <td colSpan="3" className="p-10 text-center text-gray-400 italic text-sm">No recorded history found for this client.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

           {/* ======================== STAFF NOTES SECTION ======================== */}
<div className="mt-12 pt-10 border-t border-gray-100">
  <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight mb-4">Staff Notes</h3>
  
  {/* LIST OF EXISTING NOTES */}
 {/* STAFF NOTES LIST */}
<div className="space-y-3 mb-6">
  {/* 1. Check for the NEW Array Format */}
  {selectedClient.notes && Array.isArray(selectedClient.notes) && selectedClient.notes.map((note, idx) => (
    <div key={idx} className="bg-orange-50/50 border-l-4 border-orange-300 p-4 rounded-r-xl">
      <p className="text-sm text-gray-700 font-medium">{note.text}</p>
      <p className="text-[9px] text-orange-400 font-black uppercase mt-2">{note.date} — Staff</p>
    </div>
  ))}

  {/* 2. Check for OLD String Format (Sync Fix) */}
  {selectedClient.note && typeof selectedClient.note === "string" && (
    <div className="bg-blue-50/50 border-l-4 border-blue-300 p-4 rounded-r-xl">
      <p className="text-[9px] text-blue-400 font-black uppercase mb-1">Imported Note</p>
      <p className="text-sm text-gray-700 font-medium">{selectedClient.note}</p>
    </div>
  )}

  {(!selectedClient.notes && !selectedClient.note) && (
    <p className="text-gray-400 text-xs italic text-center py-4">No notes for this client yet.</p>
  )}
</div>

  {/* NEW NOTE INPUT */}
  <div className="relative">
    <textarea 
      className="w-full p-6 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-pink-100 transition-all font-medium text-gray-600 text-sm"
      rows="3"
      placeholder="e.g. Prefers gel, sensitive to filing..."
      value={clientNotes}
      onChange={(e) => setClientNotes(e.target.value)}
    ></textarea>
    <div className="flex justify-end mt-4">
      <button 
        onClick={handleSaveNote}
        className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
      >
        Save Note
      </button>
    </div>
  </div>
</div>
          </>
        )}
      </div>
    </div>
  </div>
)}
</div>
  );
}
// Add this at the very bottom of src/app/(dashboard)/admin/clients/page.jsx

function InputItem({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
        {label}
      </label>
      <input 
        type={type}
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100" 
        placeholder={placeholder} 
      />
    </div>
  );
}