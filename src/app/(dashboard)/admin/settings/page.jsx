"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, doc, setDoc, updateDoc, 
  deleteDoc, serverTimestamp, arrayUnion 
} from "firebase/firestore";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("User Management");
  const [categories, setCategories] = useState([]); 
  const [users, setUsers] = useState([]);

  // --- UI STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add"); 
  const [selectedCat, setSelectedCat] = useState(null);
  const [editingServiceId, setEditingServiceId] = useState(null);
  
  // --- FORMS ---
  const [catName, setCatName] = useState("");
// Update your userForm initialization to include the email field and empty strings
const [userForm, setUserForm] = useState({
  uid: "", 
  name: "", 
  phone: "", 
  email: "", // Ensure this is here
  role: "Technician", 
  payoutType: "Standard (Commission Only)", 
  commission: "60"
});

// Update serviceForm as well
const [serviceForm, setServiceForm] = useState({ 
  name: "", 
  price: "" 
});

  useEffect(() => {
    const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubServices(); unsubUsers(); };
  }, []);

  const saveUser = async () => {
    if (!userForm.uid) return alert("Please provide UID");
    await setDoc(doc(db, "users", userForm.uid), { ...userForm, updatedAt: serverTimestamp() }, { merge: true });
    alert("User Updated!");
    setUserForm({ uid: "", name: "", phone: "", email: "", role: "Technician", payoutType: "Standard (Commission Only)", commission: "60" });
  };

  const deleteUser = async (uid) => {
    if(window.confirm("Are you sure you want to delete this user?")) {
      await deleteDoc(doc(db, "users", uid));
    }
  };
const saveService = async () => {
  if (!selectedCat) return alert("Category not selected");
  
  const catRef = doc(db, "services", selectedCat.id);
  
  if (modalType === "add") {
    // Logic for adding a brand new service to the array
    await updateDoc(catRef, { 
      items: arrayUnion({ 
        ...serviceForm, 
        id: Date.now().toString() 
      }) 
    });
  } else {
    // Logic for editing an existing service
    const updated = selectedCat.items.map(i => 
      i.id === editingServiceId ? { ...i, ...serviceForm } : i
    );
    await updateDoc(catRef, { items: updated });
  }
  
  // Reset and close
  setIsModalOpen(false);
  setServiceForm({ name: "", price: "" });
};
  const tabs = ["E-commerce", "User Management", "Inventory Management", "Inventory Report", "Service Management", "Color Chart", "Nail Ideas Management", "Royalty Program", "Gift Card Management", "Promot"];

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-[1600px] mx-auto bg-white min-h-[850px] rounded-3xl shadow-sm p-6 md:p-10">
        
        {/* TOP TAB NAVIGATION */}
        <div className="flex flex-wrap gap-3 border-b border-gray-100 pb-8 mb-8">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 rounded-lg text-[13px] font-bold transition-all leading-tight text-center ${
                activeTab === tab ? "bg-[#be185d] text-white shadow-md" : "bg-white text-gray-800 hover:bg-gray-50"
              }`}>
              {tab.split(" ").map((word, i) => <span key={i} className="block">{word}</span>)}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {/* USER MANAGEMENT TAB */}
          {activeTab === "User Management" && (
            <div className="animate-in fade-in duration-500">
              <h2 className="text-2xl font-playfair font-bold text-gray-800 mb-6 italic tracking-tight">Manage Users</h2>

              {/* TWO-ROW FORM CARD */}
              <div className="bg-gray-50/50 rounded-xl p-6 border border-gray-100 mb-10 shadow-sm">
                {/* Row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <FormInput label="Name" value={userForm.name} onChange={v => setUserForm({...userForm, name: v})} />
                  <FormInput label="Phone" value={userForm.phone} onChange={v => setUserForm({...userForm, phone: v})} />
                  <FormInput label="Email" value={userForm.email} onChange={v => setUserForm({...userForm, email: v})} />
                  <FormInput label="User UID" value={userForm.uid} onChange={v => setUserForm({...userForm, uid: v})} placeholder="Paste UID from Firebase Console" />
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
                    <select className="old-app-input" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                      <option>Technician</option><option>Staff</option><option>Admin</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">Payout Type</label>
                    <select className="old-app-input" value={userForm.payoutType} onChange={e => setUserForm({...userForm, payoutType: e.target.value})}>
                      <option>Standard (Commission Only)</option><option>Comm. + Tips</option>
                    </select>
                    <p className="text-[10px] text-gray-400 font-medium pt-1">Determines how staff payout is calculated.</p>
                  </div>
                  <FormInput label="Commission (%)" value={userForm.commission} onChange={v => setUserForm({...userForm, commission: v})} placeholder="e.g., 70" />
                  <div className="pt-6">
                    <button onClick={saveUser} className="w-full bg-[#be185d] text-white font-bold py-3.5 rounded-lg shadow-md hover:bg-pink-800 transition-all text-xs uppercase tracking-wider">
                      Add/Update User
                    </button>
                  </div>
                </div>
              </div>

              {/* USER LIST TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                      <th className="py-4 px-3">Name</th>
                      <th className="py-4 px-3">Email</th>
                      <th className="py-4 px-3">Phone</th>
                      <th className="py-4 px-3 text-center">Role</th>
                      <th className="py-4 px-3 text-center">Payout Type</th>
                      <th className="py-4 px-3 text-center">Action</th>
                      <th className="py-4 px-3">Schedule</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-gray-600">
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                        <td className="py-5 px-3 font-bold text-gray-800">{u.name}</td>
                        <td className="py-5 px-3 text-gray-500">{u.email || "---"}</td>
                        <td className="py-5 px-3 text-gray-500">{u.phone || "---"}</td>
                        <td className="py-5 px-3 text-center lowercase">{u.role}</td>
                        <td className="py-5 px-3 text-center">{u.payoutType?.split(' ')[0]}</td>
                        <td className="py-5 px-3">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => setUserForm({...u, uid: u.id})} className="p-1.5 bg-blue-50 text-blue-500 rounded border border-blue-100 hover:bg-blue-100 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button onClick={() => deleteUser(u.id)} className="p-1.5 bg-red-50 text-red-500 rounded border border-red-100 hover:bg-red-100 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                        </td>
                        <td className="py-5 px-3"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SERVICE MANAGEMENT TAB */}
{/* SERVICE MANAGEMENT TAB */}
{activeTab === "Service Management" && (
  <div className="space-y-8 animate-in fade-in duration-500">
    {/* Header Section */}
    <div className="flex justify-between items-center border-b border-gray-100 pb-6">
      <div>
        <h2 className="text-2xl font-playfair font-bold text-gray-800 italic tracking-tight">
          Categories & Services
        </h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
          Total Categories: {categories.length}
        </p>
      </div>
      <button 
        onClick={() => { setModalType("category"); setIsModalOpen(true); }} 
        className="bg-[#be185d] text-white px-8 py-3 rounded-lg font-bold text-xs uppercase shadow-md hover:bg-pink-800 transition-all active:scale-95 flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        New Category
      </button>
    </div>

    {/* Categories Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {categories.map((cat) => (
        <div key={cat.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col hover:shadow-md transition-all group overflow-hidden">
          
          {/* Category Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <span className="font-playfair font-black text-gray-800 text-sm uppercase italic tracking-wider">
              {cat.id.replace(/_/g, ' ')}
            </span>
            <button 
              onClick={() => { setSelectedCat(cat); setModalType("add"); setIsModalOpen(true); }} 
              className="text-pink-600 hover:scale-110 transition-transform bg-white p-1.5 rounded-full shadow-sm border border-pink-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>

          {/* Services List */}
          <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
{cat.items && cat.items.length > 0 ? (
  cat.items.map((s, index) => (
    /* Use s.id if it exists, otherwise use category ID + index as a fallback */
    <div key={s.id || `${cat.id}-service-${index}`} className="flex justify-between items-center px-4 py-3 bg-gray-50/30 rounded-xl border border-gray-100">
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-700 uppercase">{s.name}</p>
        <p className="text-[11px] font-black text-pink-600 tracking-widest">${s.price}</p>
      </div>
      
      {/* Action Icons */}
      <div className="flex gap-1">
        <button 
          onClick={() => { setSelectedCat(cat); setModalType("edit"); setEditingServiceId(s.id); setServiceForm({name: s.name, price: s.price}); setIsModalOpen(true); }} 
          className="p-2 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button 
          onClick={async () => {
            if(confirm("Delete this service?")) {
              const updated = cat.items.filter(i => i.id !== s.id);
              await updateDoc(doc(db, "services", cat.id), { items: updated });
            }
          }} 
          className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  ))
) : (
  <div className="py-10 text-center">
    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest italic">No services added</p>
  </div>
)}
          </div>

          {/* Card Footer / Category Delete */}
          <div className="mt-auto px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-end">
            <button 
              onClick={async () => {
                if(confirm(`Delete the entire ${cat.id} category?`)) {
                  await deleteDoc(doc(db, "services", cat.id));
                }
              }}
              className="text-[9px] font-black text-gray-300 hover:text-red-400 uppercase tracking-widest transition-colors"
            >
              Delete Category
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
        </div>
      </div>
{/* POPUP MODAL */}
{isModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
    <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95 duration-200">
      <h3 className="text-2xl font-playfair font-bold text-gray-800 mb-8 uppercase italic tracking-tight text-center">
        {modalType === "category" ? "Add New Category" : modalType === "add" ? "Add New Service" : "Edit Service"}
      </h3>
      
      <div className="space-y-6">
        {modalType === "category" ? (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">Category Name</label>
           <input 
  className="old-app-input" 
  value={catName || ""} 
  onChange={(e) => setCatName(e.target.value)} 
  placeholder="e.g., Pedicures" 
/>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">Service Name</label>
              <input 
                className="old-app-input" 
                value={serviceForm.name} 
                onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})} 
                placeholder="e.g., Gel Polish" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">Price ($)</label>
              <input 
                className="old-app-input" 
                value={serviceForm.price} 
                onChange={(e) => setServiceForm({...serviceForm, price: e.target.value})} 
                placeholder="00" 
              />
            </div>
          </>
        )}

        <div className="pt-6">
          <button 
            onClick={async () => {
              if (modalType === "category") {
                if (!catName) return alert("Please enter a category name");
                const safeId = catName.trim().replace(/\s+/g, '_'); // Formats name for database
                await setDoc(doc(db, "services", safeId), { active: true, items: [] });
                setCatName(""); 
              } else {
                if (!serviceForm.name || !serviceForm.price) return alert("Please fill in all fields");
                await saveService(); // Calls your existing saveService function
              }
              setIsModalOpen(false);
            }} 
            className="w-full bg-[#be185d] text-white font-bold uppercase py-4 rounded-xl shadow-lg hover:bg-pink-800 transition-all"
          >
            Confirm & Save
          </button>
          <button 
            onClick={() => {
              setIsModalOpen(false);
              setCatName("");
              setServiceForm({ name: "", price: "" });
            }} 
            className="w-full text-[11px] font-black text-gray-400 uppercase mt-4 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
)}
      <style jsx>{`
        .old-app-input { 
          width: 100%; 
          padding: 0.75rem; 
          border: 1px solid #e5e7eb; 
          border-radius: 0.5rem; 
          font-size: 0.875rem; 
          outline: none; 
          transition: all 0.2s; 
          background: white;
        }
        .old-app-input:focus { border-color: #be185d; ring: 2px; ring-color: #fce4ec; }
      `}</style>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder = "" }) {
  return (
    <div className="space-y-1.5 w-full">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</label>
      {/* Adding || "" ensures the value is never undefined */}
      <input 
        className="old-app-input" 
        value={value || ""} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} 
      />
    </div>
  );
}