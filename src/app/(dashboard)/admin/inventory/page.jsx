"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, orderBy, 
  doc, updateDoc, deleteDoc, addDoc, serverTimestamp 
} from "firebase/firestore";

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New Product Form State
  const [form, setForm] = useState({
    name: "", quantity: "", minStock: 5, category: "Polish", supplier: ""
  });

  useEffect(() => {
    const q = query(collection(db, "inventory"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleAdjustStock = async (id, change) => {
    const item = inventory.find(i => i.id === id);
    const newQty = Math.max(0, Number(item.quantity || 0) + change);
    await updateDoc(doc(db, "inventory", id), { quantity: newQty });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "inventory"), {
      ...form,
      quantity: Number(form.quantity),
      minStock: Number(form.minStock),
      updatedAt: serverTimestamp()
    });
    setIsModalOpen(false);
    setForm({ name: "", quantity: "", minStock: 5, category: "Polish", supplier: "" });
  };

  const lowStockItems = inventory.filter(i => Number(i.quantity) <= Number(i.minStock));

  return (
    <div className="max-w-[1400px] mx-auto p-6 md:p-10 space-y-10 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end border-b border-gray-100 pb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-800 italic uppercase">Inventory Management</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
            Real-time stock tracking & supply alerts
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-gray-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center gap-3"
        >
          <i className="fas fa-plus text-pink-500"></i> Add New Product
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        
        {/* SIDEBAR: SEARCH & LOW STOCK */}
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Search Inventory</h3>
            <input 
              type="text" 
              placeholder="Search product name..." 
              className="old-app-input"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {lowStockItems.length > 0 && (
            <div className="bg-pink-50 p-6 rounded-xl border border-pink-100 shadow-sm">
              <h3 className="text-[10px] font-black text-pink-600 uppercase tracking-widest mb-5 flex items-center gap-2">
                <i className="fas fa-exclamation-triangle"></i> Low Stock Alerts
              </h3>
              <div className="space-y-3">
                {lowStockItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-pink-50">
                    <span className="text-[10px] font-black text-gray-700 uppercase">{item.name}</span>
                    <span className="text-[10px] font-black text-white bg-pink-600 px-2 py-0.5 rounded-full">{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MAIN TABLE */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5">Product Info</th>
                  <th className="px-8 py-5 text-center">Status</th>
                  <th className="px-8 py-5">Supplier</th>
                  <th className="px-8 py-5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inventory
                  .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
                  .map((item) => {
                    const isLow = Number(item.quantity) <= Number(item.minStock);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <p className="text-[11px] font-black text-gray-800 uppercase tracking-tight">{item.name}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase italic mt-0.5">{item.category}</p>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className={`inline-block px-4 py-1.5 rounded-xl text-[10px] font-black uppercase ${isLow ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                            {item.quantity} In Stock
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{item.supplier || "—"}</p>
                        </td>
                        <td className="px-8 py-5 text-right space-x-2">
                          <button 
                            onClick={() => handleAdjustStock(item.id, 1)}
                            className="w-9 h-9 rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-900 hover:text-white transition-all text-[10px]"
                          >
                            <i className="fas fa-plus"></i>
                          </button>
                          <button 
                            onClick={() => handleAdjustStock(item.id, -1)}
                            className="w-9 h-9 rounded-xl bg-gray-50 text-gray-400 hover:bg-orange-500 hover:text-white transition-all text-[10px]"
                          >
                            <i className="fas fa-minus"></i>
                          </button>
                          <button 
                            onClick={() => confirm("Remove Product?") && deleteDoc(doc(db, "inventory", item.id))}
                            className="w-9 h-9 rounded-xl bg-gray-50 text-gray-200 hover:bg-red-600 hover:text-white transition-all text-[10px]"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL (Add Product) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
            <h3 className="text-sm font-black text-gray-800 mb-8 uppercase italic text-center border-b border-gray-100 pb-5">
              Add To Inventory
            </h3>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <input required className="old-app-input" placeholder="Product Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input required type="number" className="old-app-input" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({...form, quantity: e.target.value})} />
                <input required type="number" className="old-app-input" placeholder="Alert Qty" value={form.minStock} onChange={(e) => setForm({...form, minStock: e.target.value})} />
              </div>
              <input className="old-app-input" placeholder="Supplier" value={form.supplier} onChange={(e) => setForm({...form, supplier: e.target.value})} />
              <button type="submit" className="w-full bg-[#be185d] text-white font-black uppercase py-4 rounded-xl shadow-lg text-[10px] tracking-widest mt-6 hover:bg-pink-700 transition-all">
                Save Product
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .old-app-input {
          width: 100%;
          padding: 1rem;
          background: #f9fafb;
          border: 1px solid #f3f4f6;
          border-radius: 0.75rem; /* rounded-xl */
          font-size: 0.75rem;
          font-weight: 700;
          outline: none;
          transition: all 0.2s;
        }
        .old-app-input:focus {
          border-color: #fbcfe8;
          background: white;
          box-shadow: 0 0 0 4px #fdf2f8;
        }
      `}</style>
    </div>
  );
}