"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

export default function ServiceMenu() {
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState({ name: "", price: "", duration: "" });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "services"), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "services"), {
      ...newService,
      price: Number(newService.price),
      active: true
    });
    setNewService({ name: "", price: "", duration: "" });
  };

  const toggleStatus = async (service) => {
    await updateDoc(doc(db, "services", service.id), {
      active: !service.active
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-serif text-gray-800">Service Menu</h1>
          <p className="text-gray-500">Manage your offerings and pricing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form to Add Service */}
        <div className="lg:col-span-1">
          <form onSubmit={handleAdd} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4 sticky top-24">
            <h3 className="font-bold text-gray-800 mb-2">Add New Service</h3>
            <input 
              type="text" placeholder="Service Name" required
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500"
              value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})}
            />
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="number" placeholder="Price ($)" required
                className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500"
                value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})}
              />
              <input 
                type="text" placeholder="Duration (min)" required
                className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500"
                value={newService.duration} onChange={e => setNewService({...newService, duration: e.target.value})}
              />
            </div>
            <button className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all shadow-lg">
              Create Service
            </button>
          </form>
        </div>

        {/* List of Services */}
        <div className="lg:col-span-2 space-y-4">
          {services.map(service => (
            <div key={service.id} className={`bg-white p-6 rounded-[2rem] border transition-all flex items-center justify-between ${!service.active ? 'opacity-50 grayscale' : 'border-gray-50 shadow-sm'}`}>
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center font-bold">
                  ${service.price}
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">{service.name}</h4>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">{service.duration} Minutes</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => toggleStatus(service)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${service.active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                >
                  {service.active ? 'Active' : 'Hidden'}
                </button>
                <button 
                  onClick={() => deleteDoc(doc(db, "services", service.id))}
                  className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}