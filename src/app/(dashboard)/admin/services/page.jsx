"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, doc, setDoc, updateDoc, 
  deleteDoc, arrayUnion 
} from "firebase/firestore";

export default function ServiceManagementPage() {
  const [categories, setCategories] = useState([]); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add"); 
  const [selectedCat, setSelectedCat] = useState(null);
  const [editingServiceId, setEditingServiceId] = useState(null);
  
  const [catName, setCatName] = useState("");
  const [serviceForm, setServiceForm] = useState({ name: "", price: "" });

  // --- LISTEN FOR DATA (Using your exact "services" collection logic) ---
  useEffect(() => {
    const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubServices();
  }, []);

  // --- ACTIONS ---
  const saveService = async () => {
    if (!selectedCat) return alert("Category not selected");
    const catRef = doc(db, "services", selectedCat.id);
    
    if (modalType === "add") {
      await updateDoc(catRef, { 
        items: arrayUnion({ 
          ...serviceForm, 
          id: Date.now().toString() 
        }) 
      });
    } else {
      const updated = selectedCat.items.map(i => 
        i.id === editingServiceId ? { ...i, ...serviceForm } : i
      );
      await updateDoc(catRef, { items: updated });
    }
    
    setIsModalOpen(false);
    setServiceForm({ name: "", price: "" });
  };

  const deleteService = async (cat, serviceId) => {
    if(confirm("Delete this service?")) {
      const updated = cat.items.filter(i => i.id !== serviceId);
      await updateDoc(doc(db, "services", cat.id), { items: updated });
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex justify-between items-center border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800 italic uppercase">Categories & Services</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
            Total Groups: {categories.length}
          </p>
        </div>
        <button 
          onClick={() => { setModalType("category"); setIsModalOpen(true); }} 
          className="bg-[#be185d] text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-pink-800 transition-all flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> New Category
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white border border-gray-100 rounded-xl shadow-sm flex flex-col h-[550px] hover:shadow-md transition-all group overflow-hidden">
            
            {/* Category Header */}
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <span className="font-black text-gray-800 text-xs uppercase italic tracking-tight">
                {cat.id.replace(/_/g, ' ')}
              </span>
              <button 
                onClick={() => { setSelectedCat(cat); setModalType("add"); setIsModalOpen(true); }} 
                className="text-pink-600 bg-white w-7 h-7 flex items-center justify-center rounded-full shadow-sm border border-pink-100 hover:bg-pink-600 hover:text-white transition-all"
              >
                <i className="fas fa-plus text-[10px]"></i>
              </button>
            </div>

            {/* Services List */}
            <div className="flex-1 p-4 space-y-2 overflow-y-auto bg-gray-50/20">
              {cat.items && cat.items.length > 0 ? (
                cat.items.map((s, index) => (
                  <div key={s.id || index} className="flex justify-between items-center px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-pink-200 transition-all group/item">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-gray-800 uppercase mb-0.5">{s.name}</p>
                      <p className="text-[10px] font-black text-pink-600 tracking-widest">${s.price}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setSelectedCat(cat); setModalType("edit"); setEditingServiceId(s.id); setServiceForm({name: s.name, price: s.price}); setIsModalOpen(true); }} 
                        className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <i className="fas fa-edit text-[10px]"></i>
                      </button>
                      <button 
                        onClick={() => deleteService(cat, s.id)} 
                        className="p-2 text-red-300 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <i className="fas fa-trash text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <i className="fas fa-box-open text-2xl mb-2"></i>
                  <p className="text-[8px] font-black uppercase">No Services</p>
                </div>
              )}
            </div>

            {/* Footer / Delete Category */}
            <div className="px-6 py-3 bg-white border-t border-gray-50 flex justify-end">
              <button 
                onClick={async () => {
                  if(confirm(`Delete ${cat.id}?`)) await deleteDoc(doc(db, "services", cat.id));
                }}
                className="text-[8px] font-black text-gray-300 hover:text-red-400 uppercase transition-colors"
              >
                Remove Group
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* POPUP MODAL (Matching your styling) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
            <h3 className="text-sm font-black text-gray-800 mb-6 uppercase italic text-center">
              {modalType === "category" ? "Add New Category" : modalType === "add" ? "Add New Service" : "Edit Service"}
            </h3>
            
            <div className="space-y-4">
              {modalType === "category" ? (
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Category Name</label>
                  <input 
                    className="w-full p-3.5 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none focus:border-pink-300 transition-all" 
                    value={catName} 
                    onChange={(e) => setCatName(e.target.value)} 
                    placeholder="e.g. Pedicures" 
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Service Name</label>
                    <input 
                      className="w-full p-3.5 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none focus:border-pink-300 transition-all" 
                      value={serviceForm.name} 
                      onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})} 
                      placeholder="e.g. Gel Polish" 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Price ($)</label>
                    <input 
                      className="w-full p-3.5 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none focus:border-pink-300 transition-all" 
                      value={serviceForm.price} 
                      onChange={(e) => setServiceForm({...serviceForm, price: e.target.value})} 
                      placeholder="0.00" 
                    />
                  </div>
                </>
              )}

              <div className="pt-4 flex flex-col gap-2">
                <button 
                  onClick={async () => {
                    if (modalType === "category") {
                      if (!catName) return alert("Enter name");
                      const safeId = catName.trim().replace(/\s+/g, '_');
                      await setDoc(doc(db, "services", safeId), { active: true, items: [] });
                      setCatName(""); 
                    } else {
                      if (!serviceForm.name || !serviceForm.price) return alert("Fill all fields");
                      await saveService();
                    }
                    setIsModalOpen(false);
                  }} 
                  className="w-full bg-[#be185d] text-white font-black uppercase py-4 rounded-xl shadow-lg hover:bg-pink-800 transition-all text-[10px] tracking-widest"
                >
                  Confirm & Save
                </button>
                <button onClick={() => setIsModalOpen(false)} className="text-[9px] font-black text-gray-400 uppercase py-2">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}