"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import Link from "next/link";

export default function ClientDatabase() {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Ordering by points (loyalty) just like your old script's leaderboards
    const q = query(collection(db, "clients"), orderBy("points", "desc"));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, []);

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-gray-800">Client Directory</h1>
          <p className="text-gray-500 italic">Syncing with your legacy salon data</p>
        </div>
        
        <input 
          type="text" 
          placeholder="Search name or phone..." 
          className="pl-6 pr-6 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 w-full md:w-80 shadow-sm"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <Link href={`/admin/clients/${client.id}`} key={client.id}>
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-50 shadow-sm hover:shadow-md transition-all group cursor-pointer h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center text-pink-600 font-bold text-xl group-hover:bg-pink-600 group-hover:text-white transition-colors">
                  {client.name?.charAt(0)}
                </div>
                {/* Membership Badge from your script */}
                <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase ${
                  client.membership === 'Platinum' ? 'bg-purple-100 text-purple-700' :
                  client.membership === 'Gold' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {client.membership || 'Standard'}
                </span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-800">{client.name}</h3>
              <p className="text-sm text-gray-400 mb-4">{client.phone || "No phone"}</p>
              
              {/* Loyalty Stamps logic from script.js */}
              <div className="mb-6 p-4 bg-pink-50/50 rounded-2xl border border-pink-100/50">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">Visit Stamps</p>
                  <p className="text-xs font-bold text-pink-600">{client.visits || 0} / 10</p>
                </div>
                {/* Progress bar for free service */}
                <div className="w-full bg-pink-100 h-2 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="bg-pink-500 h-full transition-all" 
                    style={{ width: `${Math.min(((client.visits || 0) % 10) * 10, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fav Tech</p>
                  <p className="text-sm font-bold text-gray-800 truncate">{client.lastTechnician || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Visit</p>
                  <p className="text-sm font-bold text-gray-800">
                    {client.lastVisit ? new Date(client.lastVisit.seconds * 1000).toLocaleDateString() : 'New'}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}