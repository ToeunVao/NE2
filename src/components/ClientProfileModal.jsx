"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/context/ToastContext";
export default function ClientProfileModal({ client, onClose, finishedClients = [], appointments = [] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [clientNotes, setClientNotes] = useState("");
  const [localClient, setLocalClient] = useState(client);
const { showToast } = useToast();
  // Keep local state in sync if the clicked client changes
  useEffect(() => {
    setLocalClient(client);
  }, [client]);

  const handleUpdateClient = async () => {
    try {
      const q = query(collection(db, "finished_clients"), where("phone", "==", localClient.phone));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        showToast("No matching record found to update.", "error");
        return;
      }

      const updatePromises = querySnapshot.docs.map((docSnap) => {
        return updateDoc(docSnap.ref, {
          name: localClient.name,
          email: localClient.email || "",
          dob: localClient.dob || "",
          notes: localClient.notes || [] 
        });
      });

      await Promise.all(updatePromises);
      setIsEditing(false);
      showToast("Profile updated successfully!", "success"); // Changed alert to Toast
    } catch (error) {
      showToast("Update failed: " + error.message, "error"); // Changed alert to Toast
    }
  };

const handleSaveNote = async () => {
  if (!clientNotes.trim()) return;

  // 1. Clean the phone number (removes spaces, dashes, parentheses)
  // This ensures "123-456-7890" matches "1234567890"
  const cleanPhone = localClient.phone.replace(/\D/g, "");

  try {
    const collectionsToSearch = ["finished_clients", "appointments"];
    let docRef = null;
    let targetDocId = null;
    let targetCollection = "";

    // 2. Search through both collections to find the REAL document ID
    for (const colName of collectionsToSearch) {
      const q = query(collection(db, colName));
      const querySnapshot = await getDocs(q);
      
      const match = querySnapshot.docs.find(d => {
        const dbPhone = (d.data().phone || "").replace(/\D/g, "");
        return dbPhone === cleanPhone;
      });

      if (match) {
        targetDocId = match.id;
        targetCollection = colName;
        break; 
      }
    }

    if (!targetDocId) {
      showToast("Could not find client in database. Check phone number.", "error");
      return;
    }

    // 3. Prepare the note object
    const newNoteObj = { 
      text: clientNotes, 
      date: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      }), 
      author: "Admin" 
    };

    // 4. Save to Firestore using the actual Document ID
    await updateDoc(doc(db, targetCollection, targetDocId), { 
      notes: arrayUnion(newNoteObj) 
    });

    // 5. Update the UI screen immediately so you see it
    setLocalClient(prev => ({ 
      ...prev, 
      notes: [...(prev.notes || []), newNoteObj] 
    }));

    setClientNotes(""); 
    showToast("Note permanently saved", "success");

  } catch (error) {
    console.error("Critical Save Error:", error);
    showToast("Database Error: Save failed", "error");
  }
};

  if (!localClient) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
          <button onClick={onClose} className="flex items-center gap-2 text-gray-400 hover:text-pink-600 font-black uppercase text-[10px] tracking-widest transition-all group">
            <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i> Close Profile
          </button>
          <div className="flex items-center gap-3">
             <button onClick={() => { if(isEditing) handleUpdateClient(); setIsEditing(!isEditing); }} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${isEditing ? 'bg-green-600 text-white shadow-green-100' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'}`}>
               {isEditing ? <><i className="fas fa-save mr-2"></i> Save Changes</> : <><i className="fas fa-pencil-alt mr-2"></i> Edit Profile</>}
             </button>
             <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-red-500 transition-colors">
               <i className="fas fa-times text-xl"></i>
             </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-10 overflow-y-auto custom-scrollbar">
          {isEditing ? (
            <div className="max-w-2xl mx-auto space-y-8 py-10">
               <div className="text-center">
                 <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                   <i className="fas fa-user-edit text-3xl"></i>
                 </div>
                 <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Edit Client Information</h2>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                 <InputItem label="Full Name" value={localClient.name} onChange={(v) => setLocalClient({...localClient, name: v})} />
                 <InputItem label="Phone Number" value={localClient.phone} onChange={(v) => setLocalClient({...localClient, phone: v})} />
                 <InputItem label="Email Address" value={localClient.email || ""} onChange={(v) => setLocalClient({...localClient, email: v})} placeholder="client@example.com" />
                 <InputItem label="Birthday (DOB)" value={localClient.dob || ""} onChange={(v) => setLocalClient({...localClient, dob: v})} placeholder="YYYY-MM-DD" />
               </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-10">
                <h2 className="text-4xl font-black text-gray-800 uppercase tracking-tighter mb-2">{localClient.name}</h2>
                <div className="flex items-center justify-center gap-3">
                  <span className="bg-pink-100 text-pink-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{localClient.phone}</span>
                  {localClient.email && <span className="text-gray-400 text-xs font-bold">{localClient.email}</span>}
                </div>
              </div>

              {/* STATS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                <div className="bg-pink-50/50 border border-pink-100 p-5 rounded-xl text-center">
                  <p className="text-[10px] font-black uppercase text-pink-400 tracking-widest mb-1">Total Visits</p>
                  <p className="text-3xl font-black text-pink-600">{[...finishedClients, ...appointments].filter(i => i.phone === localClient.phone).length}</p>
                </div>
                <div className="bg-green-50/50 border border-green-100 p-5 rounded-xl text-center">
                  <p className="text-[10px] font-black uppercase text-green-400 tracking-widest mb-1">Total Spent</p>
                  <p className="text-3xl font-black text-green-600">$0.00</p>
                </div>
                <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-xl text-center">
                  <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">Favorite Tech</p>
                  <p className="text-sm font-black text-blue-600 uppercase mt-2">Any Technician</p>
                </div>
              </div>

              {/* HISTORY */}
              <div className="space-y-4">
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                  <i className="fas fa-history text-pink-500"></i> Visit History
                </h3>
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="p-3 font-black uppercase text-[10px] text-gray-400 tracking-widest">Date</th>
                        <th className="p-3 font-black uppercase text-[10px] text-gray-400 tracking-widest">Services</th>
                        <th className="p-3 font-black uppercase text-[10px] text-gray-400 tracking-widest">Technician</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...finishedClients, ...appointments]
                        .filter(item => item.phone === localClient.phone)
                        .sort((a,b) => (b.checkOutTimestamp?.toMillis() || 0) - (a.checkOutTimestamp?.toMillis() || 0))
                        .map((visit, i) => (
                        <tr key={i}>
                          <td className="p-3 font-bold text-gray-700 text-sm">
                            {visit.checkOutTimestamp ? format(visit.checkOutTimestamp.toDate(), "MM/dd/yyyy") : "Upcoming"}
                          </td>
                          <td className="p-3">
                            {Array.isArray(visit.services) ? visit.services.map((s, si) => <span key={si} className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded font-bold mr-1">{s}</span>) : <span className="text-sm text-gray-500">{visit.service}</span>}
                          </td>
                          <td className="p-3 text-sm text-gray-500 font-medium">{visit.technician || "Any Technician"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* NOTES */}
              <div className="mt-12 pt-10 border-t border-gray-100">
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight mb-4">Staff Notes</h3>
                <div className="space-y-3 mb-6">
                  {localClient.notes && Array.isArray(localClient.notes) && localClient.notes.map((note, idx) => (
                    <div key={idx} className="bg-orange-50/50 border-l-4 border-orange-300 p-4 rounded-r-xl">
                      <p className="text-sm text-gray-700 font-medium">{note.text}</p>
                      <p className="text-[9px] text-orange-400 font-black uppercase mt-2">{note.date} — Staff</p>
                    </div>
                  ))}
                </div>
                <div className="relative">
                  <textarea className="w-full p-6 bg-gray-50 rounded-2xl outline-none" rows="3" placeholder="Add note..." value={clientNotes} onChange={(e) => setClientNotes(e.target.value)}></textarea>
                  <div className="flex justify-end mt-4">
                    <button onClick={handleSaveNote} className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-blue-700">Save Note</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InputItem({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none focus:ring-2 focus:ring-pink-100" placeholder={placeholder} />
    </div>
  );
}