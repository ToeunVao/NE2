"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: "", quantity: "", minLevel: 5 });

  useEffect(() => {
    const q = query(collection(db, "inventory"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const addItem = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "inventory"), {
      ...newItem,
      quantity: Number(newItem.quantity),
      minLevel: Number(newItem.minLevel)
    });
    setNewItem({ name: "", quantity: "", minLevel: 5 });
  };

  const updateQuantity = async (id, current, change) => {
    await updateDoc(doc(db, "inventory", id), {
      quantity: Math.max(0, current + change)
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-serif text-gray-800">Supply Inventory</h1>
        <div className="flex gap-2">
            <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold uppercase">
                {items.filter(i => i.quantity <= i.minLevel).length} Low Stock
            </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add New Item Form */}
        <div className="lg:col-span-1">
          <form onSubmit={addItem} className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-100 space-y-4">
            <h3 className="font-bold text-gray-700">Add New Supply</h3>
            <input 
              type="text" placeholder="Item Name (e.g. OPI Red)" required
              className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500"
              value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}
            />
            <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number" placeholder="Current Qty" required
                  className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500"
                  value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                />
                <input 
                  type="number" placeholder="Min Alert Level" required
                  className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500"
                  value={newItem.minLevel} onChange={e => setNewItem({...newItem, minLevel: e.target.value})}
                />
            </div>
            <button className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl hover:bg-black transition-all">
              Add to Shelf
            </button>
          </form>
        </div>

        {/* Inventory List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${item.quantity <= item.minLevel ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                <div>
                  <h4 className="font-bold text-gray-800">{item.name}</h4>
                  <p className="text-xs text-gray-400">Restock at {item.minLevel} units</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center bg-gray-50 rounded-xl p-1">
                    <button onClick={() => updateQuantity(item.id, item.quantity, -1)} className="w-8 h-8 hover:bg-white rounded-lg transition-all">-</button>
                    <span className="w-12 text-center font-bold text-gray-800">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity, 1)} className="w-8 h-8 hover:bg-white rounded-lg transition-all">+</button>
                </div>
                <button onClick={() => deleteDoc(doc(db, "inventory", item.id))} className="text-gray-300 hover:text-red-500">
                    <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}