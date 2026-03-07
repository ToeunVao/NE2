"use client";
import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, doc, getDoc } from "firebase/firestore";
// ADD THIS LINE BELOW:
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function EarningMatrixPage() {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [viewType, setViewType] = useState("earning"); 
  const [selectedMonthFilter, setSelectedMonthFilter] = useState("All");
// Inside EarningMatrixPage component
const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
const yearOptions = useMemo(() => {
  const currentYear = new Date().getFullYear();
  const startYear = 2025;
  // This creates an array from 2025 up to the current year + 1
  return Array.from(
    { length: currentYear - startYear + 2 }, 
    (_, i) => startYear + i
  );
}, []);

useEffect(() => {
  let unsubLive = () => {};
  let unsubExcel = () => {};

  const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const profileData = userDoc.data();
setUserProfile(profileData);
    const exactName = userDoc.data()?.name?.trim() || "";
    const lowerName = exactName.toLowerCase();

    // We use objects (Maps) here because keys must be unique. 
    // This automatically prevents doubling if data exists in both collections.
    let liveMap = {};
    let excelMap = {};

    const updateCombinedLogs = () => {
      // Merge maps: Live data takes priority over Excel data for the same day
      const combinedMap = { ...excelMap, ...liveMap };
      const finalArray = Object.values(combinedMap).filter(log => log.year === selectedYear);
      
      setAllLogs(finalArray);
      setLoading(false);
    };

    // 1. EXCEL DATA (salon_earnings)
    unsubExcel = onSnapshot(collection(db, "salon_earnings"), (snap) => {
      excelMap = {}; // Reset local map to prevent accumulation
      snap.forEach(doc => {
        const dateStr = doc.id; // "2025-01-14"
        if (!dateStr.includes("-")) return;

        const [y, m, d] = dateStr.split('-').map(Number);
        const data = doc.data();
        let val = data[exactName] || data[lowerName] || 0;
        val = parseFloat(String(val).replace(/[$,]/g, "")) || 0;

        if (val > 0) {
          excelMap[dateStr] = {
            amount: val,
            tip: 0,
            day: d,
            month: m - 1,
            year: y,
            id: dateStr // Unique key
          };
        }
      });
      updateCombinedLogs();
    });

    // 2. LIVE DATA (earnings)
    unsubLive = onSnapshot(collection(db, "earnings"), (snap) => {
      liveMap = {}; // Reset local map
      snap.forEach(doc => {
        const data = doc.data();
        const docStaffName = (data.staffName || data.name || "").toLowerCase().trim();
        
        if (data.staffId === user.uid || docStaffName === lowerName) {
          let dObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
          if (isNaN(dObj.getTime())) return;

          const dateKey = dObj.toISOString().split('T')[0];
          
          // If multiple entries exist for one day in 'earnings', we sum them
          const currentAmount = liveMap[dateKey]?.amount || 0;
          const currentTip = liveMap[dateKey]?.tip || 0;

          liveMap[dateKey] = {
            amount: currentAmount + (parseFloat(data.earning || data.earnings) || 0),
            tip: currentTip + (parseFloat(data.tip || data.tips) || 0),
            day: dObj.getDate(),
            month: dObj.getMonth(),
            year: dObj.getFullYear(),
            id: dateKey
          };
        }
      });
      updateCombinedLogs();
    });
  });

  return () => { unsubLive(); unsubExcel(); unsubscribeAuth(); };
}, [selectedYear]);

const chartData = useMemo(() => {
  return MONTHS.map((name, index) => {
    const monthLogs = allLogs.filter(log => log.month === index);
    return {
      name: name.substring(0, 3), // e.g., "Jan"
      earning: monthLogs.reduce((sum, log) => sum + log.amount, 0),
      tip: monthLogs.reduce((sum, log) => sum + log.tip, 0),
    };
  });
}, [allLogs]);

const summaryStats = useMemo(() => {
  // 1. Get Today's date in local YYYY-MM-DD format
  const now = new Date();
  const localYear = now.getFullYear();
  const localMonth = now.getMonth();
  const localDay = now.getDate();
  
  // Create a clean string for "Today" comparison: e.g., "2026-03-07"
  const todayDateString = `${localYear}-${String(localMonth + 1).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`;

  const stats = {
    today: { e: 0, t: 0 },
    thisMonth: { e: 0, t: 0 },
    lastMonth: { e: 0, t: 0 },
    thisYear: { e: 0, t: 0 }
  };

  allLogs.forEach(log => {
    // Construct the log's date string for comparison
    const logDateString = `${log.year}-${String(log.month + 1).padStart(2, '0')}-${String(log.day).padStart(2, '0')}`;

    // Total Year
    stats.thisYear.e += log.amount;
    stats.thisYear.t += log.tip;

    // --- FIX: TODAY CHECK ---
    if (logDateString === todayDateString) {
      stats.today.e += log.amount;
      stats.today.t += log.tip;
    }

    // This Month
    if (log.month === localMonth && log.year === localYear) {
      stats.thisMonth.e += log.amount;
      stats.thisMonth.t += log.tip;
    }

    // Last Month (simplified check)
    const lastMonthIdx = localMonth === 0 ? 11 : localMonth - 1;
    const lastMonthYear = localMonth === 0 ? localYear - 1 : localYear;
    if (log.month === lastMonthIdx && log.year === lastMonthYear) {
      stats.lastMonth.e += log.amount;
      stats.lastMonth.t += log.tip;
    }
  });

  return stats;
}, [allLogs]);

  // --- GRID LOGIC ---
  const matrixData = useMemo(() => {
    const grid = MONTHS.map(() => Array(32).fill(0)); 
    allLogs.forEach(log => {
      const val = viewType === "earning" ? log.amount : log.tip;
      grid[log.month][log.day] += val;
    });
    return grid;
  }, [allLogs, viewType]);

  //if (loading) return <div className="p-20 text-center font-black text-gray-300 uppercase tracking-widest">Loading Report...</div>;


  return (
    
    <div className="max-w-full mx-auto p-4 space-y-6">
        {/* TOP SUMMARY CARDS */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  
  {/* Today Card */}
  <div className="bg-pink-100 p-5 rounded-xl border border-pink-100 shadow-sm">
    <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Today Earning</p>
    <h3 className="text-2xl font-black text-pink-600">${summaryStats.today.e.toFixed(2)}</h3>
    <p className="text-[10px] font-bold text-green-600 mt-1">Tips: ${summaryStats.today.t.toFixed(2)}</p>
  </div>
{/* This Month Card */}
  <div className="bg-yellow-100 p-5 rounded-xl border border-gray-100 shadow-sm">
    <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">This Month</p>
    <h3 className="text-2xl font-black text-pink-600">${summaryStats.thisMonth.e.toFixed(2)}</h3>
    <p className="text-[10px] font-bold text-green-600 mt-1">Tips: ${summaryStats.thisMonth.t.toFixed(2)}</p>
  </div>
  
  {/* Last Month Card */}
  <div className="bg-green-100 p-5 rounded-xl border border-gray-100 shadow-sm">
    <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Last Month</p>
    <h3 className="text-2xl font-black text-pink-600">${summaryStats.lastMonth.e.toFixed(2)}</h3>
    <p className="text-[10px] font-bold text-green-600 mt-1">Tips: ${summaryStats.lastMonth.t.toFixed(2)}</p>
  </div>

  

  {/* This Year Card */}
  <div className="bg-blue-100 p-5 rounded-xl border border-gray-100 shadow-sm bg-gradient-to-br from-white to-pink-50/30">
    <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">This Year Performance</p>
    <h3 className="text-2xl font-black text-pink-600">${summaryStats.thisYear.e.toFixed(2)}</h3>
    <p className="text-[10px] font-bold text-green-500 mt-1">Tips: ${summaryStats.thisYear.t.toFixed(2)}</p>
  </div>

</div>

      <div id="printable-report" className="bg-white dark:bg-slate-950 dark:border-slate-800 p-6 rounded-xl shadow-sm border border-gray-100">
          {/* ONLY VISIBLE ON PRINT */}
  <div className="hidden print:block mb-8 border-b-2 border-pink-500 pb-4">
    <div className="flex justify-between items-end">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-pink-600">
          Staff Earning Report
        </h1>
       <p className="text-sm font-bold text-pink-600 uppercase tracking-widest">
  {userProfile?.name || "Staff Member"} — {selectedYear} Performance
</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black uppercase text-gray-400">Printed On</p>
        <p className="text-[10px] font-bold text-gray-800">
          {new Date().toLocaleString('en-US', { 
            dateStyle: 'medium', 
            timeStyle: 'short' 
          })}
        </p>
      </div>
    </div>
  </div>
{/* Header Section */}
<div className="flex flex-wrap items-center justify-between gap-4 mb-6 print:hidden">
  <div className="flex flex-col gap-4">
  {/* H1 takes full width on mobile */}
  <h1 className="dark:bg-slate-900/80 dark:border-slate-800 dark:text-white w-full text-2xl font-black text-pink-600 uppercase tracking-tighter">
    My Yearly Earning Report
  </h1>
  
  {/* Select dropdown moves below it */}
  <select 
    value={selectedYear}
    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
    className="dark:bg-slate-900/80 dark:border-slate-800 dark:text-white w-fit bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest outline-none shadow-sm cursor-pointer hover:border-pink-300 transition-all"
  >
    {yearOptions.map(y => (
      <option key={y} value={y}>{y} Statistics</option>
    ))}
  </select>
</div>

  <div className="flex items-center gap-3">
    {/* PRINT BUTTON */}
    {/* Button UI */}
<button 
  onClick={() => window.print()}
  className="dark:bg-slate-900/80 dark:border-slate-800 dark:text-white flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm active:scale-95 print:hidden"
>
  <i className="fas fa-print text-pink-500"></i>
  Print
</button>

    {/* Toggle Switcher */}
    <div className="dark:bg-slate-900/80 dark:border-slate-800 dark:text-white flex bg-gray-100 p-1 rounded-xl">
      <button 
        onClick={() => setViewType("earning")}
        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewType === "earning" ? 'bg-pink-600 text-white shadow-sm' : 'text-gray-400'}`}
      >
        Earnings
      </button>
      <button 
        onClick={() => setViewType("tip")}
        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewType === "tip" ? 'bg-green-600 text-white shadow-sm' : 'text-gray-400'}`}
      >
        Tips
      </button>
    </div>
  </div>
</div>

        {/* Matrix Table */}
        <div className="overflow-x-auto border border-gray-100  dark:border-slate-800 rounded-xl">
      
          <table className="min-w-full text-xs text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-pink-600 text-white text-[10px] font-black uppercase">
                <th className="p-1 border-r border-pink-500 sticky left-0 bg-pink-600 z-10 w-20">Month</th>
                {DAYS.map(d => (
                  <th key={d} className="p-1 text-center border-r border-pink-500 w-8">{d}</th>
                ))}
                {/* 32nd Column for Total */}
                <th className="p-1 text-center bg-gray-800 text-white w-[80px]">Total</th>
              </tr>
            </thead>
            <tbody className="text-[10px] font-bold">
              {MONTHS.map((monthName, monthIdx) => {
                if (selectedMonthFilter !== "All" && selectedMonthFilter !== monthName) return null;

                // Calculate Monthly Total
                const monthlyTotal = matrixData[monthIdx].reduce((acc, curr) => acc + curr, 0);

                return (
                  <tr key={monthName} className="border-b  border-gray-50 dark:border-slate-800">
                    <td className="p-3 font-black text-gray-700 dark:bg-slate-900/80 dark:border-slate-800 dark:text-white bg-white sticky left-0 border-r border-gray-100 shadow-sm z-10 uppercase">
                      {monthName}
                    </td>
                    
                    {DAYS.map(dayNum => {
                      const val = matrixData[monthIdx][dayNum];
                      
                      // Base classes for every td
                      let tdClass = "p-1 border-r dark:border-slate-800 border-gray-50 text-center dark:bg-slate-900/80 ";
                      
                      // Add specific classes to TD if value exists
                      if (val > 0) {
                        tdClass += viewType === "earning" 
                          ? " text-pink-600 font-bold bg-pink-50" 
                          : "text-green-600 font-bold bg-green-50";
                      }

                      return (
                        <td key={dayNum} className={tdClass}>
                          {val > 0 ? val.toFixed(0) : "-"}
                        </td>
                      );
                    })}

                    {/* Total Column Cell */}
                    <td className="p-1 text-center bg-gray-50 font-black text-gray-800 border-l-2 border-gray-200 dark:bg-slate-900/80 dark:text-white dark:border-slate-800">
  {monthlyTotal > 0 ? `$${monthlyTotal.toFixed(2)}` : "$0.00"}
</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
{/* FOOTER - ONLY VISIBLE ON PRINT */}
<div className="hidden print:block mt-12 pt-8 border-t border-gray-300">
  
    <div className="w-full text-center">
      <p className="text-[10px] font-bold text-gray-500 italic">
        "Thank you for your hard work and dedication to our clients. 
        Please review this report for accuracy. If you have any questions, contact management."
      </p>
      <p className="text-[9px] font-black text-gray-400 mt-4 uppercase">
       © {new Date().getFullYear()} NailsExpress | Official Staff Records
      </p>
    </div>
</div>
        

      </div>
      {/* YEARLY TREND GRAPH */}
<div className="mt-8 bg-white dark:bg-slate-900/80 dark:border-slate-800 dark:text-white
 p-6 rounded-xl border border-gray-100 shadow-sm">
  <div className="flex items-center justify-between mb-8">
    <div>
      <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Yearly Performance Trend</h2>
      <p className="text-lg font-black text-gray-800 dark:text-white tracking-tighter">Earnings vs Tips</p>
    </div>
    <div className="flex gap-4">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-pink-500"></div>
        <span className="text-[10px] font-black uppercase text-gray-400">Earnings</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="text-[10px] font-black uppercase text-gray-400">Tips</span>
      </div>
    </div>
  </div>

  <div className="h-[350px] w-full min-h-[350px]">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{fontSize: 10, fontWeight: 900, fill: '#9CA3AF'}} 
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{fontSize: 10, fontWeight: 900, fill: '#9CA3AF'}} 
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip 
          cursor={{fill: '#F9FAFB'}} 
          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} 
        />
        <Bar dataKey="earning" fill="#D63384" radius={[4, 4, 0, 0]} barSize={20} name="Earning" />
        <Bar dataKey="tip" fill="#198754" radius={[4, 4, 0, 0]} barSize={20} name="Tip" />
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>

    </div>
    
  );
}
