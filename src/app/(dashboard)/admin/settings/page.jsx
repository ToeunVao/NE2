"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, doc, setDoc, updateDoc, 
  deleteDoc, serverTimestamp, arrayUnion 
} from "firebase/firestore";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("Service Management");
  const [categories, setCategories] = useState([]); 
  const [users, setUsers] = useState([]);

  // --- UI MODAL ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add"); 
  const [selectedCat, setSelectedCat] = useState(null);
  const [editingServiceId, setEditingServiceId] = useState(null);
  
  // --- FORMS ---
  const [catName, setCatName] = useState("");
  const [serviceForm, setServiceForm] = useState({ name: "", price: "" });
  const [userForm, setUserForm] = useState({
    uid: "", name: "", phone: "", role: "Technician", payoutType: "Standard (Commission Only)", commission: "60"
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
    setUserForm({ uid: "", name: "", phone: "", role: "Technician", payoutType: "Standard (Commission Only)", commission: "60" });
  };

  const saveService = async () => {
    const catRef = doc(db, "services", selectedCat.id);
    if (modalType === "add") {
      await updateDoc(catRef, { items: arrayUnion({ ...serviceForm, id: Date.now().toString() }) });
    } else {
      const updated = selectedCat.items.map(i => i.id === editingServiceId ? { ...i, ...serviceForm } : i);
      await updateDoc(catRef, { items: updated });
    }
    setIsModalOpen(false);
    setServiceForm({ name: "", price: "" });
  };

  const tabs = ["User Management", "Service Management", "Inventory", "Inventory Report", "Color Chart", "Royalty Program"];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 font-sans">
      <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 min-h-[85vh] flex flex-col overflow-hidden">
        
        {/* PILL NAVIGATION (Exact UI) */}
        <div className="flex flex-wrap bg-gray-50/50 p-6 gap-3 border-b border-gray-100">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? "bg-pink-500 text-white shadow-lg shadow-pink-200" : "bg-white text-gray-400 border border-gray-200 hover:bg-gray-100"
              }`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="p-10 flex-1">
          {/* USER MANAGEMENT TAB */}
          {activeTab === "User Management" && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100 items-end">
                <FormItem label="Full Name" value={userForm.name} onChange={v => setUserForm({...userForm, name: v})} placeholder="Staff Name" />
                <FormItem label="Phone" value={userForm.phone} onChange={v => setUserForm({...userForm, phone: v})} placeholder="000-000-0000" />
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Role</label>
                  <select className="settings-input" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}><option>Technician</option><option>Admin</option></select>
                </div>
                <FormItem label="Commission %" value={userForm.commission} onChange={v => setUserForm({...userForm, commission: v})} placeholder="70" />
                <FormItem label="Firebase UID" value={userForm.uid} onChange={v => setUserForm({...userForm, uid: v})} placeholder="UID" isPink />
                <button onClick={saveUser} className="bg-pink-600 text-white font-black uppercase text-[10px] py-4 rounded-2xl shadow-lg shadow-pink-100 hover:scale-105 transition-all">Save Staff</button>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-[10px] font-black uppercase text-gray-400">
                      <th className="p-6">Staff Member</th><th className="p-6">Role</th><th className="p-6 text-center">Commission</th><th className="p-6 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50/20">
                        <td className="p-6 font-black text-gray-700">{u.name}</td>
                        <td className="p-6 text-[10px] font-black text-gray-400 uppercase">{u.role}</td>
                        <td className="p-6 text-center font-black text-pink-600 text-lg">{u.commission}%</td>
                        <td className="p-6 text-center">
                          <button onClick={() => setUserForm({...u, uid: u.id})} className="text-blue-500 bg-blue-50 p-3 rounded-full hover:bg-blue-500 hover:text-white transition-all"><i className="fas fa-edit"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SERVICE MANAGEMENT TAB */}
          {activeTab === "Service Management" && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Categories & Services</h2>
                <button onClick={() => { setModalType("category"); setIsModalOpen(true); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-100 hover:scale-105 transition-all">+ New Category</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {categories.map((cat) => (
                  <div key={cat.id} className="bg-white border border-gray-100 rounded-[3rem] shadow-sm flex flex-col overflow-hidden hover:shadow-xl transition-all">
                    <div className="bg-gray-50/80 px-8 py-5 border-b border-gray-100 flex justify-between items-center">
                      <span className="font-black text-gray-800 text-xs uppercase tracking-widest">{cat.id.replace(/_/g, ' ')}</span>
                      <button onClick={() => { setSelectedCat(cat); setModalType("add"); setIsModalOpen(true); }} className="text-green-500 hover:scale-110 transition-transform"><i className="fas fa-plus-circle fa-lg"></i></button>
                    </div>
                    <div className="p-6 space-y-3">
                      {cat.items?.map((s) => (
                        <div key={s.id} className="group flex justify-between items-center px-5 py-4 hover:bg-gray-50 rounded-[1.5rem] transition-all border border-transparent hover:border-gray-100">
                          <div>
                            <p className="text-sm font-black text-gray-700">{s.name}</p>
                            <p className="text-[11px] font-bold text-pink-500 tracking-widest">${s.price}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { setSelectedCat(cat); setModalType("edit"); setEditingServiceId(s.id); setServiceForm({name: s.name, price: s.price}); setIsModalOpen(true); }} className="text-blue-400"><i className="fas fa-pen text-xs"></i></button>
                            <button onClick={() => {
                                const updated = cat.items.filter(i => i.id !== s.id);
                                updateDoc(doc(db, "services", cat.id), { items: updated });
                            }} className="text-red-300"><i className="fas fa-times-circle"></i></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* POPUP MODAL (Clean UI) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-[3.5rem] shadow-2xl w-full max-w-md p-12 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-gray-800 mb-8 uppercase tracking-tighter text-center">
              {modalType === "category" ? "Add Category" : "Service Details"}
            </h3>
            <div className="space-y-6">
              {modalType === "category" ? (
                <FormItem label="Name" value={catName} onChange={setCatName} placeholder="Category Name" />
              ) : (
                <>
                  <FormItem label="Service Name" value={serviceForm.name} onChange={v => setServiceForm({...serviceForm, name: v})} placeholder="e.g. Gel Polish" />
                  <FormItem label="Price ($)" value={serviceForm.price} onChange={v => setServiceForm({...serviceForm, price: v})} placeholder="00" />
                </>
              )}
              <div className="pt-6">
                <button onClick={modalType === "category" ? () => {
                   const safeId = catName.toLowerCase().replace(/\s+/g, '_');
                   setDoc(doc(db, "services", safeId), { active: true, items: [] });
                   setCatName(""); setIsModalOpen(false);
                } : saveService} className="w-full bg-blue-600 text-white font-black uppercase py-5 rounded-[2rem] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">
                  Confirm & Save
                </button>
                <button onClick={() => setIsModalOpen(false)} className="w-full text-[11px] font-black text-gray-400 uppercase mt-4">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .settings-input { width: 100%; padding: 1rem 1.5rem; background: #f3f4f6; border: 2px solid transparent; border-radius: 1.25rem; font-size: 0.875rem; font-weight: 800; color: #1f2937; outline: none; transition: all 0.2s; }
        .settings-input:focus { background: white; border-color: #fce4ec; }
      `}</style>
    </div>
  );
}

function FormItem({ label, value, onChange, placeholder, isPink = false }) {
  return (
    <div className="space-y-1 w-full text-left">
      <label className={`text-[10px] font-black uppercase ml-2 tracking-widest ${isPink ? 'text-pink-500' : 'text-gray-400'}`}>{label}</label>
      <input className={`settings-input ${isPink ? 'bg-pink-50/50' : ''}`} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}