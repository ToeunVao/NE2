"use client";
import { useState, useEffect, useMemo } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { 
  getFirestore,
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  serverTimestamp, 
  query, 
  orderBy, 
  where 
} from "firebase/firestore";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export default function SalonEarningPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [staffList, setStaffList] = useState([]);
const [earnings, setEarnings] = useState([]);
const [staffEntries, setStaffEntries] = useState([]); // NEW: Stores auto-feed data
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
// 1. Updated State (Line 31)
const initialFormState = {
  date: new Date().toISOString().split('T')[0],
  sellGiftCard: "", 
  returnGiftCard: "", 
  check: "", 
  no_of_credit: "",   // Matches database
  total_credit: "",  // Matches database
  venmo: "", 
  square: ""
};

// 2. Updated Input Mapping (Inside the return statement)
const fieldsToRender = [
  { l: "Gift Card Sell", k: "sellGiftCard" },
  { l: "Gift Card Return", k: "returnGiftCard" },
  { l: "Check", k: "check" },
  { l: "No. of Credit", k: "no_of_credit" }, // Matches old app
  { l: "Total Credit", k: "total_credit" },  // Matches old app
  { l: "Venmo", k: "venmo" },
  { l: "Square", k: "square" }
];

  const [formData, setFormData] = useState(initialFormState);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        signInAnonymously(auth);
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching
// Data Fetching
  useEffect(() => {
    if (!user) return;

    const qStaff = query(collection(db, "users"), where("role", "in", ["technician", "staff"])); 
    const unsubStaff = onSnapshot(qStaff, (snap) => {
      setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qEarnings = query(collection(db, "salon_earnings"), orderBy("__name__", "desc"));
    const unsubEarnings = onSnapshot(qEarnings, (snap) => {
      setEarnings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

// FIX: Match the collection name used in your Dashboard ('earnings')
const qLiveWork = query(collection(db, "earnings"));
    const unsubLiveWork = onSnapshot(qLiveWork, (snap) => {
      setStaffEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))); // You'll need to add [staffEntries, setStaffEntries] = useState([]) at the top
      setLoading(false);
    });

    return () => { unsubStaff(); unsubEarnings(); unsubLiveWork(); };
  }, [user]);
  

const dailyStaffTotals = useMemo(() => {
  const totals = {}; 
  staffEntries.forEach(entry => {
    let d = entry.date;
    if (!d) return;

    // 1. Convert Timestamp (from Dashboard) to YYYY-MM-DD
    if (d.seconds) {
      d = new Date(d.seconds * 1000).toISOString().split('T')[0];
    } else if (typeof d === 'string') {
      d = d.split('T')[0];
    }

    if (!totals[d]) totals[d] = {};
    
    // 2. MATCH FIELDS FROM DASHBOARD
    // Dashboard saves as 'staffName', we also check 'name' just in case
const rawName = entry.staffName || entry.name || "";
const cleanName = rawName.trim();
const lowerName = cleanName.toLowerCase();
    
const val = parseFloat(entry.earning) || parseFloat(entry.earnings) || 0;
    
if (cleanName) {
  if (!totals[d]) totals[d] = {};
  // Store both to guarantee the table finds it regardless of capitalization
  totals[d][cleanName] = (totals[d][cleanName] || 0) + val;
  totals[d][lowerName] = (totals[d][lowerName] || 0) + val;
}

  });

  return totals;
}, [staffEntries]);

  // --- NEW LOGIC: 2. Merge Financials + Staff Totals for the Table ---
  const mergedTableData = useMemo(() => {
    const reportDates = earnings.filter(r => r.id.startsWith(selectedMonth)).map(r => r.id);
    const liveDates = Object.keys(dailyStaffTotals).filter(d => d.startsWith(selectedMonth));
    const allDates = [...new Set([...reportDates, ...liveDates])].sort((a, b) => b.localeCompare(a));

    return allDates.map(dateKey => {
      const report = earnings.find(r => r.id === dateKey) || {};
      const liveStaffData = dailyStaffTotals[dateKey] || {};
      
      // Calculate Revenue
      let staffRevenue = 0;
      const staffMap = {};
staffList.forEach(s => {
  const exactName = s.name.trim(); 
  const lowerName = exactName.toLowerCase(); 
  
  // FIX: Look for data using exact, lowercase, AND with a trailing space
  let val = liveStaffData[exactName] || 
            liveStaffData[lowerName] || 
            liveStaffData[exactName + " "] || // Supports "Steven "
            liveStaffData[lowerName + " "] || // Supports "steven "
            0;
  
  // Fallback for manually saved data in the salon_earnings collection
  if (val === 0) {
    const reportVal = report[exactName] || report[lowerName] || report[exactName + " "];
    if (reportVal !== undefined) {
      val = parseFloat(String(reportVal).replace(/[$,]/g, "")) || 0;
    }
  }
  
  staffMap[lowerName] = val; 
  staffRevenue += val;
});

      const sellGC = parseFloat(report.sellGiftCard) || 0;
      const totalRevenue = staffRevenue + sellGC;
      
      const nonCash = (parseFloat(report.total_credit) || 0) + 
                      (parseFloat(report.check) || 0) + 
                      (parseFloat(report.venmo) || 0) + 
                      (parseFloat(report.square) || 0) + 
                      (parseFloat(report.returnGiftCard) || 0);

      return {
        id: dateKey,
        date: dateKey,
        isMissingReport: !report.id,
        staffMap,
        totalRevenue,
        totalCash: totalRevenue - nonCash,
        sellGC,
        returnGC: parseFloat(report.returnGiftCard) || 0,
        check: parseFloat(report.check) || 0,
       // Change these to check BOTH formats just in case
noCredit: report.no_of_credit || report.noOfCredit || 0,
totalCredit: parseFloat(report.total_credit) || parseFloat(report.totalCredit) || 0,
        venmo: parseFloat(report.venmo) || 0,
        square: parseFloat(report.square) || 0,
        rawReport: report
      };
    });
  }, [earnings, dailyStaffTotals, selectedMonth, staffList]);

  // --- NEW LOGIC: 3. Monthly Footer Totals ---
const monthTotals = useMemo(() => {
    const t = { revenue: 0, cash: 0, gc: 0, staff: {} };
    mergedTableData.forEach(day => {
      t.revenue += day.totalRevenue;
      t.cash += day.totalCash;
      t.gc += day.sellGC;
      staffList.forEach(s => {
        const key = s.name.toLowerCase();
        t.staff[key] = (t.staff[key] || 0) + (day.staffMap[key] || 0);
      });
    });
    return t;
  }, [mergedTableData, staffList]);

  // Helper for Input Form Display
  const currentDayStaffTotals = dailyStaffTotals[formData.date] || {};


const handleSave = async () => {
  if (!user || !formData.date) return;
  const docId = formData.date;

  try {
    const dayStaffData = dailyStaffTotals[formData.date] || {};

    // 1. Convert Staff Names/Totals for Old App Compatibility
    const legacyStaffData = {};
    Object.keys(dayStaffData).forEach(name => {
      const trimmed = name.trim();
      const amount = parseFloat(dayStaffData[name]) || 0;
      legacyStaffData[trimmed] = amount;
      legacyStaffData[trimmed + " "] = amount; // Supports "Steven "
    });

    // 2. FORCE all inputs to be NUMBERS (prevents "" empty string error)
    const dataToSave = {
      ...formData,
      ...legacyStaffData,
      sellGiftCard: parseFloat(formData.sellGiftCard) || 0,
      returnGiftCard: parseFloat(formData.returnGiftCard) || 0,
      check: parseFloat(formData.check) || 0,
      total_credit: parseFloat(formData.total_credit) || 0,
      totalCredit: parseFloat(formData.total_credit) || 0, // Legacy field
      venmo: parseFloat(formData.venmo) || 0,   // FIX: No more venmo: ""
      square: parseFloat(formData.square) || 0, // FIX: No more square: ""
      no_of_credit: parseInt(formData.no_of_credit) || 0,
      noOfCredit: parseInt(formData.no_of_credit) || 0,

      // 3. FIX: Convert String Date to real Firebase Timestamp
      // This fixes: "n.date.toDate is not a function"
      date: new Date(formData.date + "T12:00:00"), 
      
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "salon_earnings", docId), dataToSave, { merge: true });
    
    setFormData(initialFormState);
    alert("Saved! Data is now cleaned and the old app will stop crashing.");
  } catch (e) {
    console.error("Save Error:", e);
  }
};
  const handleDelete = async (id) => {
    if(window.confirm("Delete this report?")) {
      await deleteDoc(doc(db, "salon_earnings", id));
    }
  };

  const handleEdit = (report) => {
    let dateStr = report.id;
    if (report.date && report.date.seconds) {
        dateStr = new Date(report.date.seconds * 1000).toISOString().split('T')[0];
    }
    setFormData({ ...initialFormState, ...report, date: dateStr });
    window.scrollTo({top: 0, behavior: 'smooth'});
  };


// HELPER: Calculate Live Totals for Input Area
const currentInputTotals = () => {
  const dayStaffData = dailyStaffTotals[formData.date] || {};
  
  // We need to be careful not to double-count if we stored "Steven" and "Steven "
  // We filter for unique values based on a trimmed version of the names
  const uniqueNames = {};
  Object.keys(dayStaffData).forEach(name => {
    uniqueNames[name.trim().toLowerCase()] = dayStaffData[name];
  });

  const staffSum = Object.values(uniqueNames).reduce((a, b) => a + b, 0);
  
  const revenue = staffSum + (parseFloat(formData.sellGiftCard) || 0);
  const nonCash = (parseFloat(formData.total_credit) || 0) + 
                  (parseFloat(formData.check) || 0) + 
                  (parseFloat(formData.returnGiftCard) || 0) + 
                  (parseFloat(formData.venmo) || 0) + 
                  (parseFloat(formData.square) || 0);
                  
  return { revenue, cash: revenue - nonCash };
};

  if (loading) return <div className="p-10 text-center font-black text-gray-300 uppercase tracking-widest">Loading Records...</div>;

  
  return (
    <div className="max-w-[98%] mx-auto space-y-6 pb-20 mt-6 font-sans">
      
      {/* HEADER SECTION */}
{/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-800 uppercase italic">Salon Earning</h1>
          {/* FIX: Removed 'monthlySummary.clients' and replaced with static text or monthTotals if available */}
          <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mt-1">Auto-Sync Active</p>
        </div>
        <div className="flex gap-4">
           <div className="text-right">
              <p className="text-[9px] font-bold text-gray-400 uppercase">Monthly Revenue</p>
              {/* FIX: Use monthTotals.revenue instead of monthlySummary.revenue */}
             <p className="text-xl font-black text-green-600">
  ${(monthTotals?.revenue || 0).toFixed(2)}
</p>
           </div>
           <div className="px-3">
             <p className="text-[9px] font-bold text-gray-400 uppercase">Entry Date</p>
             <input 
              type="date" 
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
              className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer text-xs"
            />
          </div>
        </div>
      </div>

      {/* INPUT FORM */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
{staffList.map(staff => (
    <div key={staff.id} className="opacity-70">
        <label className="text-[9px] font-bold text-gray-400 uppercase flex justify-between">
            {staff.name} <i className="fas fa-lock text-[8px]"></i>
        </label>
        <div className="w-full p-2 bg-gray-100 rounded-lg text-xs font-bold text-gray-500 border border-transparent">
            {/* Auto-Feed Value Display */}
         ${(
  currentDayStaffTotals[staff.name.trim()] || 
  currentDayStaffTotals[staff.name.trim().toLowerCase()] || 
  currentDayStaffTotals[staff.name.trim() + " "] || 
  0
).toFixed(2)}
        </div>
    </div>
))}
         </div>
        {/* INPUT FIELDS SECTION */}
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
  {(() => {
    // Define the list of fields here
const inputFields = [
  { l: "Gift Card Sell", k: "sellGiftCard" },
  { l: "Gift Card Return", k: "returnGiftCard" },
  { l: "Check", k: "check" },
  { l: "No. of Credit", k: "no_of_credit" }, // Fixed to underscore
  { l: "Total Credit", k: "total_credit" },  // Fixed to underscore
  { l: "Venmo", k: "venmo" },
  { l: "Square", k: "square" }
];

    return inputFields.map((f) => (
      <div key={f.k}>
        <label className="text-[9px] font-bold text-pink-400 uppercase">{f.l}</label>
        <input 
          type="number" 
          value={formData[f.k] || ""} 
          onChange={e => setFormData({...formData, [f.k]: e.target.value})}
          className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold outline-none border border-transparent focus:border-pink-200"
          placeholder="0.00"
        />
      </div>
    ));
  })()}
</div>
         <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex gap-10">
               <div>
   <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-wider">Day Revenue</p>
   {/* FIX: Use currentInputTotals().revenue instead of currentResults */}
   <p className="text-xl font-black text-gray-800">${currentInputTotals().revenue.toFixed(2)}</p>
</div>
<div className="border-l border-gray-100 pl-10">
   <p className="text-[9px] font-black text-pink-500 uppercase mb-1 tracking-wider">Day Cash</p>
   {/* FIX: Use currentInputTotals().cash instead of currentResults */}
   <p className="text-xl font-black text-green-600">${currentInputTotals().cash.toFixed(2)}</p>
</div>
            </div>
            <button onClick={handleSave} className="bg-gray-900 text-white px-10 py-3 rounded-xl font-bold uppercase text-[10px] shadow-xl hover:bg-black transition-all tracking-widest">Save Daily Report</button>
         </div>
      </div>

      {/* DETAILED TABLE */}
 {/* TABLE SECTION - UPDATED TO OLD UI STYLE */}
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
    {/* Map through filtered staff */}
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
  {mergedTableData.map((day) => (
    <tr key={day.id} className={day.isMissingReport ? "bg-orange-50/40" : "hover:bg-gray-50"}>
      {/* Date Column */}
      <td className="px-4 py-4 sticky left-0 bg-white border-r border-gray-100 text-gray-800">
        {(() => {
           if(!day.date) return "";
           const [y, m, d] = day.date.split('-'); 
           return `${m}/${d}/${y}`;
        })()}
        {day.isMissingReport && <span className="block text-[8px] text-orange-400 mt-1 uppercase">⚠️ Not Saved</span>}
      </td>
{/* Staff Columns (Auto-Fed) */}
{/* Staff Columns (Auto-Fed) */}
{staffList.map(s => {
  const exactName = s.name.trim();
  const lowerName = exactName.toLowerCase();
  
  // Check exact, lowercase, and the trailing space version
  const val = day.staffMap[exactName] || 
              day.staffMap[lowerName] || 
              day.staffMap[exactName + " "] || 
              0;

  return (
    <td key={s.id} className={`px-3 py-4 text-center ${val > 0 ? 'text-gray-900 font-bold' : 'text-gray-300'}`}>
      {val > 0 ? `$${val.toFixed(2)}` : '—'}
    </td>
  );
})}

      {/* Financial Columns */}
      <td className="px-3 py-4 text-center text-pink-500">${day.sellGC.toFixed(2)}</td>
      <td className="px-3 py-4 text-center text-red-400">${day.returnGC.toFixed(2)}</td>
      <td className="px-3 py-4 text-center text-gray-500">${day.check.toFixed(2)}</td>
      <td className="px-3 py-4 text-center text-blue-500">{day.noCredit}</td>
      <td className="px-3 py-4 text-center text-gray-500">${day.totalCredit.toFixed(2)}</td>
      
      <td className="px-3 py-4 text-center bg-green-50/30 text-green-700 font-black">${day.totalCash.toFixed(2)}</td>
      <td className="px-3 py-4 text-center font-black text-gray-800">${day.totalRevenue.toFixed(2)}</td>

      {/* Actions */}
      <td className="px-4 py-4 text-center sticky right-0 bg-white border-l border-gray-100">
        <button 
  onClick={() => { 
    // This ensures the date is set exactly as the dailyStaffTotals key (YYYY-MM-DD)
    setFormData({
      ...initialFormState, // Start with a clean state
      ...day.rawReport, 
      date: day.date 
    }); 
    window.scrollTo({top: 0, behavior: 'smooth'}); 
  }} 
  className="text-blue-500 mr-3 hover:scale-110"
>
  <i className="fas fa-edit"></i>
</button>
        {!day.isMissingReport && <button onClick={() => handleDelete(day.id)} className="text-red-400 hover:scale-110"><i className="fas fa-trash"></i></button>}
      </td>
    </tr>
  ))}
</tbody>
<tfoot className="bg-slate-900 text-white text-[10px] font-black uppercase">
  {/* ROW 1: MONTHLY TOTAL remains the same */}
 {/* ROW 1: MONTHLY TOTAL PER STAFF */}
<tr className="bg-slate-900 text-white text-[10px] font-black uppercase">
    <td className="px-4 py-4 border-r border-slate-700">Monthly Total</td>
{staffList.map(s => {
  const exactName = s.name.trim();
  const lowerName = exactName.toLowerCase();
  
  // Sum up all possible variations for the monthly total
  const total = (monthTotals.staff[exactName] || 0) + 
                (monthTotals.staff[lowerName] || 0) + 
                (monthTotals.staff[exactName + " "] || 0);

  return (
    <td key={s.id} className="px-3 py-4 text-center text-slate-400 font-bold">
      ${total.toFixed(2)}
    </td>
  );
})}
    <td className="px-3 py-4 text-center text-pink-400">${monthTotals.gc.toFixed(2)}</td>
    <td colSpan={4}></td>
    <td className="px-3 py-4 text-center text-green-400 font-black">${monthTotals.cash.toFixed(2)}</td>
    <td className="px-3 py-4 text-center text-white font-black">${monthTotals.revenue.toFixed(2)}</td>
    <td></td>
</tr>

  {/* ROW 2: DYNAMIC TOTAL PAYOUT (Shows 60% or 70% per column) */}
{/* ROW 2: TOTAL PAYOUT */}
  <tr className="bg-indigo-900/20 border-b border-slate-700">
    <td className="px-4 py-3 border-r border-slate-700 text-indigo-300 italic">Total Payout</td>
    {staffList.map(s => {
      // Use the new monthTotals object
      const totalEarning = monthTotals.staff[s.name.toLowerCase()] || 0;
      const rate = 0.6; // Default 60% rate
      
      return (
        <td key={s.id} className="px-3 py-3 text-center text-indigo-200">
          <span className="block text-[8px] opacity-50 text-white">60% Rate</span>
          ${(totalEarning * rate).toFixed(2)}
        </td>
      );
    })}
    <td colSpan={8}></td>
  </tr>

  {/* ROW 3: CHECK PAYOUT (70%) */}
  <tr className="bg-slate-800/20 border-b border-slate-700">
    <td className="px-4 py-3 border-r border-slate-700 text-slate-400 font-normal">Check Payout (70%)</td>
    {staffList.map(s => {
      // Calculate 70% of the month total for the check amount
      const val = (monthTotals.staff[s.name.toLowerCase()] || 0) * 0.7;
      return (
        <td key={s.id} className="px-3 py-3 text-center text-slate-300 font-normal">
          ${val.toFixed(2)}
        </td>
      );
    })}
    <td colSpan={8}></td>
  </tr>
  {/* ROW 4: CASH PAYOUT */}
 {/* ROW 4: CASH PAYOUT (30%) */}
<tr className="bg-slate-800/10 border-b border-slate-700">
  <td className="px-4 py-3 border-r border-slate-700 text-slate-400 font-normal">Cash Payout (30%)</td>
  {staffList.map(s => {
    // FIX: Use monthTotals.staff and calculate 30% on the fly
    const totalMonthEarning = monthTotals.staff[s.name.toLowerCase()] || 0;
    const val = totalMonthEarning * 0.3; // 30% calculation
    return (
      <td key={s.id} className="px-3 py-3 text-center text-slate-300 font-normal">
        ${val.toFixed(2)}
      </td>
    );
  })}
  <td colSpan={8}></td>
</tr>
</tfoot>

          </table>
        </div>
      </div>
    </div>
  );
}