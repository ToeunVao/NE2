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
  const [viewType, setViewType] = useState("earning"); 
  const [selectedMonthFilter, setSelectedMonthFilter] = useState("All");

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const initializeMatrix = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const staffNameInDb = userDoc.data()?.name;

          if (!staffNameInDb) {
            setLoading(false);
            return;
          }

          const currentYear = new Date().getFullYear();
          const q = query(
            collection(db, "earnings"),
            where("staffName", "==", staffNameInDb),
            orderBy("date", "asc")
          );

          const unsubLogs = onSnapshot(q, (snap) => {
            const logs = snap.docs.map(doc => {
              const docData = doc.data();
              const d = docData.date?.toDate() || new Date();
              return {
                amount: parseFloat(docData.earning) || 0,
                tip: parseFloat(docData.tip) || 0,
                day: d.getDate(),
                month: d.getMonth(), 
                year: d.getFullYear()
              };
            }).filter(log => log.year === currentYear);

            setAllLogs(logs);
            setLoading(false);
          });

          return unsubLogs;
        } catch (error) {
          console.error("Matrix Error:", error);
          setLoading(false);
        }
      };

      initializeMatrix();
    });

    return () => unsubscribeAuth();
  }, []);
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
  const now = new Date();
  
  // 1. Get Today's date in LOCAL format (YYYY-MM-DD) without UTC shift
  const todayStr = now.toLocaleDateString('sv'); // 'sv' (Sweden) locale gives YYYY-MM-DD
  
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // 2. Calculate Last Month correctly (handles January -> December shift)
  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastMonthYear = lastMonthDate.getFullYear();

  const stats = {
    today: { e: 0, t: 0 },
    thisMonth: { e: 0, t: 0 },
    lastMonth: { e: 0, t: 0 },
    thisYear: { e: 0, t: 0 }
  };

  allLogs.forEach(log => {
    // 3. Construct the log's date string using its stored components
    // This assumes your log has { year, month, day } already extracted in allLogs
    const logDate = new Date(log.year, log.month, log.day).toLocaleDateString('sv');
    
    // Today
    if (logDate === todayStr) {
      stats.today.e += log.amount;
      stats.today.t += log.tip;
    }
    // This Month
    if (log.month === currentMonth && log.year === currentYear) {
      stats.thisMonth.e += log.amount;
      stats.thisMonth.t += log.tip;
    }
    // Last Month
    if (log.month === lastMonth && log.year === lastMonthYear) {
      stats.lastMonth.e += log.amount;
      stats.lastMonth.t += log.tip;
    }
    // This Year
    if (log.year === currentYear) {
      stats.thisYear.e += log.amount;
      stats.thisYear.t += log.tip;
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

  if (loading) return <div className="p-20 text-center font-black text-gray-300 uppercase tracking-widest">Loading Matrix...</div>;

  return (
    <div className="max-w-full mx-auto p-4 space-y-6">
        {/* TOP SUMMARY CARDS */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  
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

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h1 className="text-2xl font-black text-pink-600 tracking-tighter uppercase">
            Individual Earning Matrix
          </h1>

          <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-2 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg shadow-sm">
              <span className="text-[10px] font-black uppercase text-gray-400 px-2">Show:</span>
              <button
                onClick={() => setViewType("earning")}
                className={`px-6 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${
                  viewType === "earning" ? "bg-pink-600 text-white shadow-md" : "text-gray-400 hover:bg-gray-50"
                }`}
              >
                Earning
              </button>
              <button
                onClick={() => setViewType("tip")}
                className={`px-6 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${
                  viewType === "tip" ? "bg-green-600 text-white shadow-md" : "text-gray-400 hover:bg-gray-50"
                }`}
              >
                Tip
              </button>
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
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
                  <tr key={monthName} className="border-b border-gray-50">
                    <td className="p-3 font-black text-gray-700 bg-white sticky left-0 border-r border-gray-100 shadow-sm z-10 uppercase">
                      {monthName}
                    </td>
                    
                    {DAYS.map(dayNum => {
                      const val = matrixData[monthIdx][dayNum];
                      
                      // Base classes for every td
                      let tdClass = "p-1 border-r border-gray-50 text-center ";
                      
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
                    <td className="p-1 text-center bg-gray-50 font-black text-gray-800 border-l-2 border-gray-200">
  {monthlyTotal > 0 ? `$${monthlyTotal.toFixed(2)}` : "$0.00"}
</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        

      </div>
      {/* YEARLY TREND GRAPH */}
<div className="mt-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
  <div className="flex items-center justify-between mb-8">
    <div>
      <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Yearly Performance Trend</h2>
      <p className="text-lg font-black text-gray-800 tracking-tighter">Earnings vs Tips</p>
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

  <div className="h-[350px] w-full">
    <ResponsiveContainer width="100%" height="100%">
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