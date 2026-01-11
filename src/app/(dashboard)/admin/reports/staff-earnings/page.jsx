"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, deleteDoc, doc } from "firebase/firestore";

export default function StaffEarningReport() {
  const [earnings, setEarnings] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("All");
  const [dateFilter, setDateFilter] = useState("2026-01-08"); 
  const [isMounted, setIsMounted] = useState(false);
  const [status, setStatus] = useState("Checking Database...");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      try {
        await deleteDoc(doc(db, "finished_clients", id));
        alert("Record deleted");
      } catch (error) {
        console.error("Error deleting:", error);
      }
    }
  };

  useEffect(() => {
    if (!isMounted) return;

    async function performSmartScan() {
      try {
        setStatus("Fetching from finished_clients...");
        
        // 1. Get all documents from finished_clients
        const snap = await getDocs(collection(db, "finished_clients"));
        
        if (snap.empty) {
          setStatus("Collection 'finished_clients' is empty.");
          return;
        }

        const allData = [];
        const uniqueStaff = new Set();

        snap.docs.forEach(doc => {
          const data = doc.data();
          
          // Review of script.js shows date is usually 'date' or 'timestamp'
          let docDate = data.date || "";
          
          // Match the date filter
          if (docDate === dateFilter) {
            const name = data.techName || data.staffName || "Unknown";
            const price = parseFloat(data.totalPrice || 0);
            const tip = parseFloat(data.tip || 0);
            const earning = data.earning ? parseFloat(data.earning) : (price * 0.6);

            uniqueStaff.add(name);
            
            allData.push({
              id: doc.id,
              date: docDate,
              staffName: name,
              servicePrice: price,
              earning: earning,
              tip: tip
            });
          }
        });

        setStaffList(Array.from(uniqueStaff));
        setEarnings(allData);
        setStatus(allData.length > 0 ? `Found ${allData.length} records.` : `No records found for ${dateFilter}`);

      } catch (err) {
        setStatus("Firebase Error: Check Console");
        console.error("FULL ERROR:", err);
      }
    }

    performSmartScan();
  }, [dateFilter, isMounted]);

  if (!isMounted) return null;

  const displayData = earnings.filter(e => selectedStaff === "All" || e.staffName === selectedStaff);

  return (
    <div className="max-w-[1400px] mx-auto p-6 md:p-10 space-y-10">
      
      {/* HEADER */}
      <div className="bg-gray-900 rounded-xl p-8 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-pink-600">
        <div>
          <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Staff Earning</h1>
          <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mt-1">{status}</p>
        </div>
        
        <div className="flex gap-3">
          <input 
            type="date" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-gray-800 text-white p-4 rounded-xl text-xs font-black uppercase border-none outline-none"
          />
          <select 
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="bg-gray-800 text-white p-4 rounded-xl text-xs font-black uppercase border-none outline-none"
          >
            <option value="All">All Staff</option>
            {staffList.map((name, idx) => <option key={idx} value={name}>{name}</option>)}
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase border-b">
            <tr>
              <th className="px-6 py-6 text-center">NO.</th>
              <th className="px-6 py-6">Date</th>
              <th className="px-6 py-6">Staff</th>
              <th className="px-6 py-6">Service</th>
              <th className="px-6 py-6">Earning</th>
              <th className="px-6 py-6">Tip</th>
              <th className="px-6 py-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayData.map((item, idx) => (
              <tr key={item.id} className="hover:bg-gray-50/50 transition-all text-xs">
                <td className="px-6 py-6 text-center font-bold text-gray-300">{idx + 1}</td>
                <td className="px-6 py-6 font-medium text-gray-500">{item.date}</td>
                <td className="px-6 py-6">
                   <div className="font-black text-gray-800 uppercase italic">{item.staffName}</div>
                </td>
                <td className="px-6 py-6 font-bold text-gray-900">${item.servicePrice.toFixed(2)}</td>
                <td className="px-6 py-6 font-black text-pink-600">${item.earning.toFixed(2)}</td>
                <td className="px-6 py-6 font-bold text-green-600">+${item.tip.toFixed(2)}</td>
                <td className="px-6 py-6 text-right space-x-2">
                   <button className="text-blue-500 hover:scale-110 transition-transform">👁️</button>
                   <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:scale-110 transition-transform">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {displayData.length === 0 && (
          <div className="p-32 text-center text-[10px] font-black text-gray-300 uppercase italic tracking-widest">
            No Data found for {dateFilter} in finished_clients
          </div>
        )}
      </div>
    </div>
  );
}