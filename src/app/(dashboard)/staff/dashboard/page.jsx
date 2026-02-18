"use client";
import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, where, orderBy, doc, getDoc 
} from "firebase/firestore";
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
const COLORS = {
  pink: "#F9D5E5", pinkText: "#D63384",
  green: "#D5F9DE", greenText: "#198754",
  blue: "#D6E4FF", blueText: "#0D6EFD",
  purple: "#E9D5FF", purpleText: "#6F42C1",
  mint: "#D1F2EB", mintText: "#0F5132",
  periwinkle: "#E0E7FF", periwinkleText: "#4F46E5",
  orange: "#FFE5B4", orangeText: "#D97706",
  red: "#FADBD8", redText: "#DC3545"
};
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
export default function StaffPersonalDashboard() {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
const [realName, setRealName] = useState("");
const [visibleCount, setVisibleCount] = useState(5); // Start with 5 rows

  // --- DATE UTILITIES (Matches Admin Logic) ---
  const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now - offset).toISOString().split('T')[0];
  };

  const getMonthDefaults = () => {
    const now = new Date();
    // First day of current month
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
      .toISOString().split('T')[0];
    const today = getLocalDate();
    return { firstDay, today };
  };

  const { firstDay: initialStart, today: initialEnd } = getMonthDefaults();

  // --- STATE ---
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  // Defaulting to "thisMonth" behavior
  const [activeFilter, setActiveFilter] = useState("thisMonth");

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const initializeDashboard = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const staffNameInDb = userDoc.data()?.name;
          setRealName(staffNameInDb || "Staff");

          if (!staffNameInDb) {
            setLoading(false);
            return;
          }

          const q = query(
            collection(db, "earnings"),
            where("staffName", "==", staffNameInDb),
            orderBy("date", "asc")
          );

          const unsubLogs = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => {
              const docData = doc.data();
              const d = docData.date?.toDate() || new Date();
              return {
                id: doc.id,
                ...docData,
                jsDate: d,
                dateStr: d.toISOString().split('T')[0],
                dateLabel: `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
              };
            });
            setAllLogs(data);
            setLoading(false);
          });

          return unsubLogs;
        } catch (error) {
          console.error("Dashboard error:", error);
          setLoading(false);
        }
      };
      initializeDashboard();
    });

    return () => unsubscribeAuth();
  }, []);
useEffect(() => {
  setVisibleCount(5); // Reset to 5 whenever the date filter or data changes
}, [startDate, endDate]);
  // --- FILTER LOGIC ---
  const filteredData = useMemo(() => {
    return allLogs.filter(log => {
      return log.dateStr >= startDate && log.dateStr <= endDate;
    });
  }, [allLogs, startDate, endDate]);

const chartData = useMemo(() => {
  // Use the year from the selected date (or current year)
  const currentYear = new Date(startDate).getFullYear();
  const commissionRate = 0.70;

  // Map through all 12 months to build the full year trend
  return MONTHS.map((name, index) => {
    // Filter logs for THIS specific month index across the whole year
    const logsInMonth = allLogs.filter(log => {
      const d = log.date?.toDate ? log.date.toDate() : new Date(log.date);
      return d.getMonth() === index && d.getFullYear() === currentYear;
    });

    const monthlyEarning = logsInMonth.reduce((sum, log) => sum + (Number(log.earning) || 0), 0);
    const monthlyTips = logsInMonth.reduce((sum, log) => sum + (Number(log.tip) || 0), 0);

    // Apply your 70/30 card math
    const totalCommission = monthlyEarning * commissionRate;
    const checkPayout = totalCommission * 0.70; 
    const cashPayout = (totalCommission - checkPayout) + monthlyTips;

    return {
      name: name.substring(0, 3), // "Jan", "Feb", etc.
      cash: Number(cashPayout.toFixed(2)),
      check: Number(checkPayout.toFixed(2)),
      tips: Number(monthlyTips.toFixed(2)),
      total: Number((totalCommission + monthlyTips).toFixed(2)),
    };
  });
  // Removed the .filter() so all 12 months show up
}, [allLogs, startDate]);



const report = useMemo(() => {
    // 1. Basic Sums
    const totalEarning = filteredData.reduce((sum, log) => sum + (parseFloat(log.earning) || 0), 0);
    const totalTips = filteredData.reduce((sum, log) => sum + (parseFloat(log.tip) || 0), 0);
    
    // 2. NEW LOGIC: 70% Payout Calculation
    // Total Payout is only the Commission part (70% of Earnings)
    const commissionRate = 0.70; 
    const totalCommission = totalEarning * commissionRate;

    // 3. Cash vs Check Calculation
    // We assume Check Payout is 70% of the Commission (Standard Admin Logic)
    const checkPayout = totalCommission * 0.70; 
    
    // Cash Payout = (Remaining 30% of Commission) + ALL TIPS
    const cashPayout = (totalCommission - checkPayout) + totalTips;

    // Total Payout (Combined for display)
    const totalPayout = totalCommission + totalTips;
const totalAppointments = filteredData.filter(log => 
    log.bookingId || 
    log.type === "booking" || 
    log.source === "dashboard" || 
    log.source === "online"
  ).length;
    // 4. Unique Clients Count
const uniqueClients = new Set(filteredData.map(log => 
      (log.clientName || log.id).toString().toLowerCase().trim()
    )).size;


    // 5. Chart Grouping
   const chartMap = {};
    filteredData.forEach(log => {
      // Use the raw jsDate to create a unique key for sorting
      const timeKey = new Date(log.jsDate).setHours(0,0,0,0); 
      const label = log.dateLabel;
      
      if (!chartMap[timeKey]) {
        chartMap[timeKey] = { time: timeKey, name: label, amount: 0 };
      }
      chartMap[timeKey].amount += parseFloat(log.earning) || 0;
    });

    // Sort by time so the graph goes from left to right correctly
    const chartData = Object.values(chartMap).sort((a, b) => a.time - b.time);

    return { 
      totalAppointments,
      totalEarning, 
      totalTips, 
      totalPayout,
      cashPayout,
      checkPayout,
      uniqueClients,
      count: filteredData.length, 
      chartData // This is now sorted correctly
    };
  }, [filteredData]);

  if (loading) return <div className="p-20 text-center font-black text-gray-300 uppercase tracking-widest">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      {/* HEADER & DATE FILTER (IMAGE STYLE) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">My Performance</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{realName}</p>
        </div>

        {/* --- DATE FILTER BAR (MATCHES IMAGE) --- */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 px-2">
            <span className="text-[10px] font-black uppercase text-gray-400">From:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => { setStartDate(e.target.value); setActiveFilter('custom'); }} 
              className="bg-gray-50 border-none rounded-lg text-xs font-bold p-1.5 outline-none focus:ring-2 focus:ring-pink-100" 
            />
          </div>
          <div className="flex items-center gap-2 px-2 border-l border-gray-100">
            <span className="text-[10px] font-black uppercase text-gray-400">To:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => { setEndDate(e.target.value); setActiveFilter('custom'); }} 
              className="bg-gray-50 border-none rounded-lg text-xs font-bold p-1.5 outline-none focus:ring-2 focus:ring-pink-100" 
            />
          </div>
          
          {/* SHORTCUT BUTTONS */}
          <div className="flex gap-1 pl-2 border-l border-gray-100">
            <button 
              onClick={() => { 
                const today = getLocalDate();
                setStartDate(today); 
                setEndDate(today); 
                setActiveFilter('today');
              }}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                activeFilter === 'today' ? 'bg-pink-600 text-white shadow-lg shadow-pink-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              Today
            </button>
            <button 
              onClick={() => { 
                const { firstDay, today } = getMonthDefaults();
                setStartDate(firstDay); 
                setEndDate(today); 
                setActiveFilter('thisMonth');
              }}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                activeFilter === 'thisMonth' ? 'bg-pink-600 text-white shadow-lg shadow-pink-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
{/* STAT CARDS ROW 1 */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <PastelCard label="Total Earnings" value={`$${report.totalEarning.toFixed(2)}`} bg={COLORS.pink} text={COLORS.pinkText} />
  <PastelCard label="Total Payout" value={`$${report.totalPayout.toFixed(2)}`} bg={COLORS.periwinkle} text={COLORS.periwinkleText} />  
  <PastelCard label="Cash Payout" value={`$${report.cashPayout.toFixed(2)}`} bg={COLORS.mint} text={COLORS.mintText} />
</div>

{/* PAYOUT CARDS ROW 2 */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-6">

  <PastelCard label="Check Payout" value={`$${report.checkPayout.toFixed(2)}`} bg={COLORS.orange} text={COLORS.orangeText} />
  <PastelCard label="Total Tips" value={`$${report.totalTips.toFixed(2)}`} bg={COLORS.green} text={COLORS.greenText} />
  <PastelCard label="Total Appointments" value={report.totalAppointments} bg={COLORS.blue} text={COLORS.blueText} />
  <PastelCard label="Total Clients" value={report.uniqueClients} bg={COLORS.purple} text={COLORS.purpleText} />
</div>

      {/* CHART */}
<div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mt-6">
  <div className="mb-6">
    <h3 className="text-lg font-black text-gray-800 tracking-tighter uppercase">Annual Earnings Trend</h3>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
      Full 12-Month Performance for {new Date(startDate).getFullYear()}
    </p>
  </div>

  <div className="h-[400px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{fontSize: 10, fontWeight: '900', fill: '#9CA3AF'}} 
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{fontSize: 10, fontWeight: 'bold', fill: '#9CA3AF'}} 
          tickFormatter={(v) => `$${v}`} 
        />
        <Tooltip 
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          formatter={(value) => `$${Number(value).toFixed(2)}`}
        />
        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold' }} />

        {/* Stacked Bars */}
        
        {/* Total Payout Bar (Optional: if you want to see the pink bar from your earlier reference) */}
        <Bar dataKey="total" name="Total Payout" fill="#EC4899" fillOpacity={0.1} barSize={20} radius={[4, 4, 0, 0]} />
        <Bar dataKey="cash" name="Cash Payout" stackId="a" fill="#F43F5E" barSize={20} />
        <Bar dataKey="check" name="Check Payout" stackId="a" fill="#3B82F6" barSize={20} radius={[4, 4, 0, 0]} />
  
        {/* Tip Line */}
        <Line 
          type="monotone" 
          dataKey="tips" 
          name="Tips Trend" 
          stroke="#10B981" 
          strokeWidth={3} 
          dot={{ r: 3, fill: '#10B981' }} 
        />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
</div>

      {/* TABLE */}
<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
<div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
  {/* Left Side: Title and Count */}
  <h3 className="text-[11px] font-black uppercase text-gray-600 tracking-tight">
    My Earning Details <span className="ml-2 text-pink-500 font-black">({report.count} Clients)</span>
  </h3>

  {/* Right Side: Totals Summary Badge */}
  <div className="flex items-center gap-3">
    <div className="flex items-center gap-1.5 bg-pink-100 text-pink-800 px-3 py-1 rounded-xl border border-gray-100 shadow-sm">
      <span className="text-[9px] font-black text-gray-400 uppercase mr-2">Total </span>
      <span className="text-[10px] font-black text-pink-600">(${report.totalEarning.toFixed(2)})</span>
    </div>
    <div className="bg-green-100 text-green-800 text-sm font-semibold flex items-center gap-1.5  px-3 py-1 rounded-xl border border-gray-100 shadow-sm">
      <span className="text-[9px] font-black text-gray-400 uppercase mr-2">Tip </span>
      <span className="text-[10px] font-black text-green-600">(${report.totalTips.toFixed(2)})</span>
    </div>
  </div>
</div>
  <table className="w-full text-left">
    <thead className="text-[10px] font-black text-gray-400 uppercase border-b border-gray-50 bg-white">
      <tr>
        <th className="px-6 py-4">Date</th>
        <th className="px-6 py-4">Service</th>
        <th className="px-6 py-4">Amount</th>
        <th className="px-6 py-4 text-right">Tip</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-50 font-bold text-gray-600">
      {/* We slice the data here to only show the visibleCount */}
      {filteredData.slice().reverse().slice(0, visibleCount).map((log) => (
        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
          <td className="px-6 py-4 text-xs font-black">{log.dateLabel}</td>
          <td className="px-6 py-4 uppercase text-[10px] text-gray-400">{log.service || "N/A"}</td>
          <td className="px-6 py-4 text-pink-600">${parseFloat(log.earning).toFixed(2)}</td>
          <td className="px-6 py-4 text-green-600 text-right">${parseFloat(log.tip).toFixed(2)}</td>
        </tr>
      ))}
    </tbody>
  </table>

  {/* LOAD MORE BUTTON */}
  {filteredData.length > visibleCount && (
    <div className="p-4 bg-white border-t border-gray-50 flex justify-center">
      <button 
        onClick={() => setVisibleCount(prev => prev + 5)}
        className="px-8 py-2 bg-gray-50 hover:bg-pink-50 text-gray-400 hover:text-pink-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-gray-100"
      >
        Load More Records
      </button>
    </div>
  )}
</div>
    </div>
  );
}
// --- SUB COMPONENTS ---
function PastelCard({ label, value, bg, text }) {
  // Check if the label is for a count rather than money
  const isCount = label.toLowerCase().includes("appointments") || 
                  label.toLowerCase().includes("clients");

  return (
    <div style={{ backgroundColor: bg }} className="p-6 rounded-xl flex flex-col justify-center min-h-[110px] shadow-sm">
      <span style={{ color: text }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
        {label}
      </span>
      <span style={{ color: text }} className="font-black text-2xl tracking-tight">
        {/* If it's a count, show the raw number. If it's money, show the $ sign. */}
        {isCount ? value : value} 
      </span>
    </div>
  );
}