"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, orderBy, where, 
  doc, updateDoc, addDoc, deleteDoc, setDoc, Timestamp 
} from "firebase/firestore";

// Helper function for money math
const parseMoney = (val) => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString().replace(/[^0-9.-]+/g, "")) || 0;
};

export default function StaffEarningsPage() {
  const formRef = useRef(null);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [earningsData, setEarningsData] = useState([]); // Daily summaries
  const [staffList, setStaffList] = useState([]);      // Technicians
  const [serviceLogs, setServiceLogs] = useState([]);  // Individual logs

  // Filter States
  const [reportFilterTech, setReportFilterTech] = useState('All');
  const [reportFilterDate, setReportFilterDate] = useState(new Date().toISOString().split('T')[0]);

  // Form State
  const [newEarning, setNewEarning] = useState({
    date: new Date().toISOString().split('T')[0],
    staffName: "",
    service: "",
    earning: "",
    tip: ""
  });

  // --- 1. DATABASE SYNC ---
  useEffect(() => {
    // Staff List
    const unsubStaff = onSnapshot(collection(db, "users"), (snap) => {
      setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role === "technician" || u.role === "staff"));
    });

    // Daily Summaries
    const unsubEarnings = onSnapshot(collection(db, "salon_earnings"), (snap) => {
      setEarningsData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // Individual Logs (Standardizing the Date for the Table)
    const unsubLogs = onSnapshot(collection(db, "earnings"), (snap) => {
      const logs = snap.docs.map(doc => {
        const data = doc.data();
        let dateStr = "";
        if (data.date?.toDate) dateStr = data.date.toDate().toISOString().split('T')[0];
        else if (typeof data.date === 'string') dateStr = data.date.split('T')[0];
        return { id: doc.id, ...data, dateStr };
      });
      setServiceLogs(logs.sort((a,b) => b.dateStr.localeCompare(a.dateStr)));
    });

    return () => { unsubStaff(); unsubEarnings(); unsubLogs(); };
  }, []);

  // --- 2. LIVE CALCULATIONS (Filtered Stats) ---
  const filteredStats = useMemo(() => {
    const filtered = serviceLogs.filter(log => {
      const isDateMatch = log.dateStr === reportFilterDate;
      const isTechMatch = reportFilterTech === 'All' || log.staffName === reportFilterTech;
      return isDateMatch && isTechMatch;
    });

    return {
      totalEarnings: filtered.reduce((sum, log) => sum + parseMoney(log.earning), 0),
      totalTips: filtered.reduce((sum, log) => sum + parseMoney(log.tip), 0),
      clientCount: filtered.length,
      rows: filtered
    };
  }, [serviceLogs, reportFilterDate, reportFilterTech]);

  // --- 3. ACTIONS ---
  const handleAddEarning = async () => {
    if (!newEarning.staffName || !newEarning.earning) return alert("Select staff and amount");
    try {
      // Date logic to keep old script.js from crashing
      const dateObject = new Date(newEarning.date + 'T12:00:00');

      // 1. Add Log (Saved as Timestamp for old app)
      await addDoc(collection(db, "earnings"), {
        ...newEarning,
        earning: parseMoney(newEarning.earning),
        tip: parseMoney(newEarning.tip),
        date: Timestamp.fromDate(dateObject) 
      });

      // 2. Update Summary
      const [y, m, d] = newEarning.date.split('-');
      const docId = `${y}-${parseInt(m)}-${parseInt(d)}`;
      const staffKey = newEarning.staffName.toLowerCase().trim();
      const reportRef = doc(db, "salon_earnings", docId);
      
      const currentReport = earningsData.find(r => r.id === docId);
      const prevVal = parseMoney(currentReport?.[staffKey]);
      
      await setDoc(reportRef, { [staffKey]: prevVal + parseMoney(newEarning.earning) }, { merge: true });

      setNewEarning({...newEarning, earning: "", tip: "", service: ""});
      alert("Added successfully!");
    } catch (e) { console.error(e); alert("Permission Error: Check if you are logged in."); }
  };

  if (loading) return <div className="p-20 text-center font-black text-gray-400 uppercase">Loading...</div>;

  return (
    <div className="max-w-[1200px] mx-auto p-6 space-y-10 bg-gray-50/50 min-h-screen">
      
      {/* HEADER SECTION: LIVE TOTALS */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">
            Staff Earning Report <span className="text-pink-500">({filteredStats.clientCount} Clients)</span>
          </h1>
          <p className="text-gray-400 font-bold text-sm uppercase mt-1 tracking-widest">Live Daily Dashboard</p>
        </div>
        
        <div className="flex gap-10">
          <div className="text-right">
            <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Total Earnings</span>
            <span className="text-3xl font-black text-gray-800">${filteredStats.totalEarnings.toFixed(2)}</span>
          </div>
          <div className="text-right border-l pl-10 border-gray-100">
            <span className="text-[10px] font-black uppercase text-green-600 block mb-1">Total Tips</span>
            <span className="text-3xl font-black text-green-600">${filteredStats.totalTips.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* FORM SECTION */}
      <div ref={formRef} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-xs font-black uppercase text-gray-400 mb-6 tracking-widest">Entry Form</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end bg-gray-50 p-6 rounded-xl border border-gray-100">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Date</label>
            <input type="date" value={newEarning.date} onChange={e => setNewEarning({...newEarning, date: e.target.value})} className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Staff</label>
            <select value={newEarning.staffName} onChange={e => setNewEarning({...newEarning, staffName: e.target.value})} className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none">
              <option value="">Select Staff</option>
              {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Service</label>
            <input placeholder="Service..." value={newEarning.service} onChange={e => setNewEarning({...newEarning, service: e.target.value})} className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Amount</label>
            <input type="number" placeholder="0.00" value={newEarning.earning} onChange={e => setNewEarning({...newEarning, earning: e.target.value})} className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Tip</label>
            <input type="number" placeholder="0.00" value={newEarning.tip} onChange={e => setNewEarning({...newEarning, tip: e.target.value})} className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-sm outline-none" />
          </div>
          <button onClick={handleAddEarning} className="w-full bg-[#D63384] text-white font-black py-3.5 rounded-xl uppercase text-xs tracking-widest shadow-lg shadow-pink-100 transition-transform active:scale-95">Add Record</button>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">Earning Logs</h3>
          <div className="flex gap-4 items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
            <input type="date" value={reportFilterDate} onChange={e => setReportFilterDate(e.target.value)} className="bg-transparent font-bold text-sm outline-none px-2" />
            <select value={reportFilterTech} onChange={e => setReportFilterTech(e.target.value)} className="bg-transparent font-bold text-sm outline-none border-l pl-4 border-gray-200">
               <option value="All">All Staff</option>
               {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-50">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase text-gray-400 border-b  border-gray-100 bg-gray-50/30">
                <th className="px-6 py-4">Technician</th>
                <th className="px-6 py-4">Service Description</th>
                <th className="px-6 py-4">Earning</th>
                <th className="px-6 py-4 text-green-600">Tip</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredStats.rows.map((log) => (
                <tr key={log.id} className="text-sm font-bold text-gray-600 hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 text-pink-600 uppercase">{log.staffName}</td>
                  <td className="px-6 py-4 text-gray-400 font-normal italic">{log.service || "General Service"}</td>
                  <td className="px-6 py-4 font-black">${parseMoney(log.earning).toFixed(2)}</td>
                  <td className="px-6 py-4 text-green-600 font-black">${parseMoney(log.tip).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2  group-hover:opacity-100 transition-opacity">
                      <button onClick={() => {
                        setNewEarning({ date: log.dateStr, staffName: log.staffName, service: log.service || "", earning: log.earning, tip: log.tip });
                        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl">Edit</button>
                      <button onClick={async () => {
                        if(confirm("Delete this entry?")) await deleteDoc(doc(db, "earnings", log.id));
                      }} className="p-2 text-red-400 hover:bg-red-50 rounded-xl">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStats.rows.length === 0 && (
                <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-black uppercase text-xs">No records found for this selection</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}