"use client";
import { useState, useEffect, useMemo } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, 
  serverTimestamp, query, orderBy, where 
} from "firebase/firestore";

// --- FIREBASE INIT ---
const firebaseConfig = {
  // ... your config here ...
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export default function SalonEarningPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [staffList, setStaffList] = useState([]);
  
  // 1. Data Sources
  const [earnings, setEarnings] = useState([]); // Saved Manual Reports (salon_earnings)
  const [staffEarnings, setStaffEarnings] = useState([]); // Live Staff Entries (staff_earnings)
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const initialFormState = {
    date: new Date().toISOString().split('T')[0],
    sellGiftCard: "", returnGiftCard: "", check: "", noOfCredit: "", 
    totalCredit: "", venmo: "", square: ""
  };
  const [formData, setFormData] = useState(initialFormState);

  // --- AUTH ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      u ? setUser(u) : signInAnonymously(auth);
    });
    return () => unsubscribe();
  }, []);

  // --- DATA FETCHING (Consolidated) ---
  useEffect(() => {
    if (!user) return;

    // A. Fetch Staff List
    const qStaff = query(collection(db, "users"), where("role", "in", ["technician", "staff"]));
    const unsubStaff = onSnapshot(qStaff, (snap) => {
      setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // B. Fetch Saved Salon Reports
    const qEarnings = query(collection(db, "salon_earnings"), orderBy("date", "desc"));
    const unsubEarnings = onSnapshot(qEarnings, (snap) => {
      setEarnings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // C. Fetch Live Staff Earnings
    const qStaffEntries = query(collection(db, "staff_earnings")); 
    const unsubStaffEntries = onSnapshot(qStaffEntries, (snap) => {
      setStaffEarnings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubStaff(); unsubEarnings(); unsubStaffEntries(); };
  }, [user]);

// --- CALCULATIONS: 1. Smart Merge of Staff Data ---
const dailyTotals = useMemo(() => {
    const totals = {};
    
    staffEarnings.forEach(entry => {
      let rawDate = entry.date; 
      if (!rawDate) return;

      // Normalize any date format to YYYY-MM-DD for internal matching
      let normalizedKey = String(rawDate).trim();
      
      // Convert MM/DD/YYYY (Staff Report) to YYYY-MM-DD (Salon Table)
      if (normalizedKey.includes('/')) {
        const [m, d, y] = normalizedKey.split('/');
        normalizedKey = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      if (!totals[normalizedKey]) totals[normalizedKey] = {};
      
      // Match staff names exactly (trimming extra spaces like in "Steven ")
      const staffKey = (entry.staffName || entry.name || entry.technician || "").trim().toUpperCase();
      
      if (staffKey) {
        totals[normalizedKey][staffKey] = (totals[normalizedKey][staffKey] || 0) + (parseFloat(entry.earning) || 0);
      }
    });
    
    return totals;
  }, [staffEarnings]);

  // --- CALCULATIONS: 2. Master Merge (The Single Source of Truth) ---
  const mergedMonthData = useMemo(() => {
    // A. Get dates from Saved Reports
    const reportDates = earnings
      .filter(r => r.id.startsWith(selectedMonth))
      .map(r => r.id);
    
    // B. Get dates from Live Staff Data (using normalized keys)
    const staffDates = Object.keys(dailyTotals)
      .filter(d => d.startsWith(selectedMonth));

    // C. Combine unique dates
    const allDates = [...new Set([...reportDates, ...staffDates])].sort((a, b) => b.localeCompare(a));

    return allDates.map(dateKey => {
      const report = earnings.find(r => r.id === dateKey) || {};
      const liveStaffData = dailyTotals[dateKey] || {};

      let dailyStaffRevenue = 0;
      const staffRevenueMap = {};

      staffList.forEach(s => {
        const nameUpper = s.name.toUpperCase();
        const nameLower = s.name.toLowerCase();
        
        // LOGIC: Use Live Data if > 0, otherwise fallback to Saved Report
        const liveVal = liveStaffData[nameUpper] || 0;
        const manualVal = parseFloat(report[nameLower]) || 0;
        const val = liveVal > 0 ? liveVal : manualVal;
        
        staffRevenueMap[nameLower] = val;
        dailyStaffRevenue += val;
      });

      const sellGC = parseFloat(report.sellGiftCard) || 0;
      const totalRevenue = dailyStaffRevenue + sellGC;
      
      const nonCash = (parseFloat(report.totalCredit) || 0) + 
                      (parseFloat(report.check) || 0) + 
                      (parseFloat(report.venmo) || 0) + 
                      (parseFloat(report.square) || 0) + 
                      (parseFloat(report.returnGiftCard) || 0);

      return {
        date: dateKey,
        isMissingReport: !report.id, 
        reportRaw: report,
        staffRevenueMap, 
        sellGC,
        totalRevenue,
        totalCash: totalRevenue - nonCash,
        // Pass through other values for display
        returnGC: parseFloat(report.returnGiftCard) || 0,
        check: parseFloat(report.check) || 0,
        noOfCredit: report.noOfCredit || 0,
        totalCredit: parseFloat(report.totalCredit) || 0,
        venmo: parseFloat(report.venmo) || 0,
        square: parseFloat(report.square) || 0,
      };
    });
  }, [earnings, dailyTotals, selectedMonth, staffList]);

  // --- CALCULATIONS: 3. Summaries & Footers ---
  const monthlySummary = useMemo(() => {
    return mergedMonthData.reduce((acc, day) => {
      acc.revenue += day.totalRevenue;
      acc.cash += day.totalCash;
      acc.clients += (parseInt(day.noOfCredit) || 0);
      acc.gc += day.sellGC;
      return acc;
    }, { revenue: 0, cash: 0, clients: 0, gc: 0 });
  }, [mergedMonthData]);

  const staffFooterTotals = useMemo(() => {
    const totals = {};
    staffList.forEach(s => {
      const key = s.name.toLowerCase();
      // Sum from MERGED data
      const sum = mergedMonthData.reduce((acc, day) => acc + (day.staffRevenueMap[key] || 0), 0);
      
      const rawRate = parseFloat(s.commission) || 0.6;
      const rate = rawRate > 1 ? rawRate / 100 : rawRate; // handle 60 vs 0.6
      
      const payout = sum * rate;
      const check = payout * 0.70;
      const cash = payout - check;
      
      totals[key] = { sum, payout, check, cash, rate };
    });
    return totals;
  }, [mergedMonthData, staffList]);

  // --- ACTIONS ---
  const handleSave = async () => {
    if (!user || !formData.date) return;
    try {
      // Calculate preview totals for saving
      let calcRevenue = 0;
      staffList.forEach(s => calcRevenue += parseFloat(formData[s.name.toLowerCase()] || 0));
      calcRevenue += parseFloat(formData.sellGiftCard || 0);
      const calcNonCash = (parseFloat(formData.totalCredit)||0) + (parseFloat(formData.check)||0) + 
                          (parseFloat(formData.returnGiftCard)||0) + (parseFloat(formData.venmo)||0) + 
                          (parseFloat(formData.square)||0);

      const timestampDate = new Date(formData.date + 'T12:00:00');
      
      await setDoc(doc(db, "salon_earnings", formData.date), {
        ...formData, 
        totalRevenue: calcRevenue,
        totalCash: calcRevenue - calcNonCash,
        date: timestampDate, 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      
      setFormData(initialFormState);
      alert("Report Saved!");
    } catch (e) { console.error(e); alert("Error saving"); }
  };

  const handleDelete = async (id) => {
    if(window.confirm("Delete this report?")) await deleteDoc(doc(db, "salon_earnings", id));
  };

  const handleEdit = (rawReport) => {
    if(!rawReport.id) return; 
    setFormData({ ...initialFormState, ...rawReport, date: rawReport.id });
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  // Logic for Top Form Preview
  const currentFormResults = useMemo(() => {
    let rev = 0;
    staffList.forEach(s => rev += parseFloat(formData[s.name.toLowerCase()] || 0));
    rev += parseFloat(formData.sellGiftCard || 0);
    const nonCash = (parseFloat(formData.totalCredit)||0) + (parseFloat(formData.check)||0) + 
                    (parseFloat(formData.returnGiftCard)||0) + (parseFloat(formData.venmo)||0) + 
                    (parseFloat(formData.square)||0);
    return { revenue: rev, cash: rev - nonCash };
  }, [formData, staffList]);

  const formatDisplayDate = (dateStr) => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
};

  if (loading) return <div className="p-10 text-center font-bold text-gray-400">LOADING...</div>;

  return (
    <div className="max-w-[98%] mx-auto space-y-6 pb-20 mt-6 font-sans">
      
      {/* 1. HEADER SUMMARY */}
      <div className="flex flex-col md:flex-row justify-between items-end bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 uppercase italic">Salon Earning</h1>
          <p className="text-[10px] font-black text-pink-500 uppercase tracking-[4px] mt-2">
            Monthly Overview: {monthlySummary.clients} Clients
          </p>
        </div>
        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl border border-gray-100">
          <div className="px-3 border-r border-gray-200">
             <p className="text-[9px] font-bold text-gray-400 uppercase">Monthly Revenue</p>
             <p className="text-sm font-black text-green-600">${monthlySummary.revenue.toFixed(2)}</p>
          </div>
          <div className="px-3">
             <p className="text-[9px] font-bold text-gray-400 uppercase">Entry Date</p>
             <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="bg-transparent font-bold text-gray-700 outline-none text-xs"/>
          </div>
        </div>
      </div>

      {/* 2. INPUT FORM */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {staffList.map(staff => (
                <div key={staff.id}>
                    <label className="text-[9px] font-bold text-gray-400 uppercase">{staff.name}</label>
                    <input type="number" placeholder="0.00" value={formData[staff.name.toLowerCase()] || ""} onChange={e => setFormData({...formData, [staff.name.toLowerCase()]: e.target.value})} className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none focus:ring-1 focus:ring-pink-200 outline-none" />
                </div>
            ))}
         </div>
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 border-t border-dashed border-gray-100 pt-6">
            {[
                {k:'sellGiftCard', l:'Sell GC'}, {k:'returnGiftCard', l:'Return GC'}, 
                {k:'check', l:'Check'}, {k:'noOfCredit', l:'No Credit'}, 
                {k:'totalCredit', l:'Total Credit'}, {k:'venmo', l:'Venmo'}, {k:'square', l:'Square'}
            ].map(f => (
                <div key={f.k}>
                    <label className="text-[9px] font-bold text-pink-400 uppercase">{f.l}</label>
                    <input type="number" value={formData[f.k]} placeholder="0" onChange={e => setFormData({...formData, [f.k]: e.target.value})} className="w-full p-2 bg-pink-50/30 rounded-lg text-xs font-bold border-none focus:ring-1 focus:ring-pink-200 outline-none" />
                </div>
            ))}
         </div>
         <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex gap-10">
               <div><p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-wider">Day Revenue</p><p className="text-xl font-black text-gray-800">${currentFormResults.revenue.toFixed(2)}</p></div>
               <div className="border-l border-gray-100 pl-10"><p className="text-[9px] font-black text-pink-500 uppercase mb-1 tracking-wider">Day Cash</p><p className="text-xl font-black text-green-600">${currentFormResults.cash.toFixed(2)}</p></div>
            </div>
            <button onClick={handleSave} className="bg-gray-900 text-white px-10 py-3 rounded-xl font-bold uppercase text-[10px] shadow-xl hover:bg-black transition-all tracking-widest">Save Daily Report</button>
         </div>
      </div>

      {/* 3. TABLE SECTION */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-gray-50/50 border-b flex justify-between items-center border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-black text-gray-800 uppercase tracking-widest">Financial History</h2>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-white px-3 py-1 rounded-lg border text-xs font-bold" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-4 py-4 sticky left-0 bg-gray-50 z-10">Date</th>
                {staffList.map(s => <th key={s.id} className="px-3 py-4 text-center">{s.name}</th>)}
                <th className="px-3 py-4 text-center">Sell GC</th>
                <th className="px-3 py-4 text-center">Rtn GC</th>
                <th className="px-3 py-4 text-center">Check</th>
                <th className="px-3 py-4 text-center">No Credit</th>
                <th className="px-3 py-4 text-center">Total Credit</th>
                <th className="px-3 py-4 text-center font-black text-green-600">Total Cash</th>
                <th className="px-3 py-4 text-center font-black text-gray-800">Total Revenue</th>
                <th className="px-4 py-4 text-center sticky right-0 bg-gray-50 z-10">Action</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-gray-100 text-[11px] font-bold text-gray-600">
              {mergedMonthData.map((day) => (
                <tr key={day.date} className={day.isMissingReport ? "bg-orange-50/50" : "hover:bg-gray-50"}>
                  <td className="px-4 py-4 sticky left-0 bg-white z-10 font-black text-gray-800 border-r border-gray-100">
           {(() => {
    const parts = day.date.split('-');
    return parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0]}` : day.date;
  })()}
  
  {day.isMissingReport && (
    <span className="block text-[8px] text-orange-500 uppercase mt-1">
      ⚠️ Missing Save
    </span>
  )}
  </td>
                  
                  {/* STAFF COLUMNS (Uses Merged Data) */}
                 {/* STAFF COLUMNS */}
{staffList.map(s => {
  // Normalize the staff name from the USER list
  const nameKey = s.name.trim().toUpperCase();
  const nameLower = s.name.toLowerCase();
  
  // 1. Check Live Data (using normalized key)
  const liveVal = day.staffRevenueMap[s.name.toLowerCase()] || 
                  (dailyTotals[day.date] && dailyTotals[day.date][nameKey]) || 0;

  // 2. Check Manual Report
  const manualVal = parseFloat(day.reportRaw[nameLower]) || 0;
  
  // 3. Winner takes all
  const val = liveVal > 0 ? liveVal : manualVal;

  return (
    <td key={s.id} className={`px-3 py-4 text-center ${val>0?'text-gray-900':'text-gray-300'}`}>
      {val > 0 ? `$${val.toFixed(2)}` : '—'}
    </td>
  )
})}

                  <td className="px-3 py-4 text-center text-pink-500">${day.sellGC.toFixed(2)}</td>
                  <td className="px-3 py-4 text-center text-red-400">${day.returnGC.toFixed(2)}</td>
                  <td className="px-3 py-4 text-center text-gray-500">${day.check.toFixed(2)}</td>
                  <td className="px-3 py-4 text-center text-blue-500">{day.noOfCredit}</td>
                  <td className="px-3 py-4 text-center text-gray-500">${day.totalCredit.toFixed(2)}</td>
                  <td className="px-3 py-4 text-center bg-green-50/30 text-green-700 font-black">${day.totalCash.toFixed(2)}</td>
                  <td className="px-3 py-4 text-center font-black text-gray-800">${day.totalRevenue.toFixed(2)}</td>
                  
                  <td className="px-4 py-4 text-center sticky right-0 bg-white z-10">
                    <button onClick={() => handleEdit(day.reportRaw)} className="text-blue-500 hover:scale-110"><i className="fas fa-edit"></i></button>
                    {!day.isMissingReport && (
                        <button onClick={() => handleDelete(day.date)} className="ml-3 text-red-400 hover:scale-110"><i className="fas fa-trash"></i></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* FOOTER */}
            <tfoot className="bg-slate-900 text-white text-[10px] font-black uppercase">
              {/* TOTAL ROW */}
              <tr className="border-b border-slate-800">
                <td className="px-4 py-4 border-r border-slate-700">Monthly Total</td>
                {staffList.map(s => (
                  <td key={s.id} className="px-3 py-4 text-center text-slate-400 font-bold">
                    ${staffFooterTotals[s.name.toLowerCase()]?.sum.toFixed(2)}
                  </td>
                ))}
                <td className="px-3 py-4 text-center text-pink-400">${monthlySummary.gc.toFixed(2)}</td>
                <td colSpan={3}></td>
                <td className="px-3 py-4 text-center text-green-400 font-black">${monthlySummary.cash.toFixed(2)}</td>
                <td className="px-3 py-4 text-center text-white border-l border-slate-700 text-xs font-black">${monthlySummary.revenue.toFixed(2)}</td>
                <td></td>
              </tr>
              
              {/* PAYOUT ROWS */}
              <tr className="bg-slate-800/40 border-b border-slate-700">
                <td className="px-4 py-3 border-r border-slate-700 text-indigo-300 italic">Total Payout</td>
                {staffList.map(s => {
                    const d = staffFooterTotals[s.name.toLowerCase()];
                    return (
                        <td key={s.id} className="px-3 py-3 text-center text-indigo-200">
                            <span className="block text-[8px] opacity-50">{Math.round(d.rate*100)}% Rate</span>
                            ${d?.payout.toFixed(2)}
                        </td>
                    )
                })}
                <td colSpan={8}></td>
              </tr>
               <tr className="bg-slate-800/20 border-b border-slate-700">
                <td className="px-4 py-3 border-r border-slate-700 text-slate-400 font-normal">Check Payout (70%)</td>
                {staffList.map(s => <td key={s.id} className="px-3 py-3 text-center text-slate-300 font-normal">${staffFooterTotals[s.name.toLowerCase()]?.check.toFixed(2)}</td>)}
                <td colSpan={8}></td>
              </tr>
              <tr className="bg-slate-800/10">
                <td className="px-4 py-3 border-r border-slate-700 text-slate-400 font-normal">Cash Payout (30%)</td>
                {staffList.map(s => <td key={s.id} className="px-3 py-3 text-center text-slate-300 font-normal">${staffFooterTotals[s.name.toLowerCase()]?.cash.toFixed(2)}</td>)}
                <td colSpan={8}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}