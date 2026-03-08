"use client";
import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, where, orderBy, doc, getDoc 
} from "firebase/firestore";
import { DollarSign, Percent, Calendar, Users, TrendingUp, Award, Briefcase, Wallet } from "lucide-react";
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
  let unsubLive = () => {};
  let unsubExcel = () => {};

  const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
    if (!user) { setLoading(false); return; }

    // Fetch user details to get exact name for Excel matching
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const exactName = userDoc.data()?.name?.trim() || "";
    setRealName(exactName);
    const lowerName = exactName.toLowerCase();

    let liveMap = {};
    let excelMap = {};

const updateLogs = () => {
      // 1. Get arrays of all data
      const excelEntries = Object.values(excelMap);
      const liveEntries = Object.values(liveMap);

      // 2. Filter: Only keep Excel entries IF there is NO live entry for that same date
      const uniqueExcel = excelEntries.filter(excel => {
        const hasLive = liveEntries.some(live => live.dateStr === excel.dateStr);
        return !hasLive; 
      });

      // 3. Set the merged result
      setAllLogs([...uniqueExcel, ...liveEntries]); 
      setLoading(false);
    };

    // Excel Data (salon_earnings)
    unsubExcel = onSnapshot(collection(db, "salon_earnings"), (snap) => {
      excelMap = {};
      snap.forEach(doc => {
        const [y, m, d] = doc.id.split('-').map(Number);
        const data = doc.data();
        let val = parseFloat(String(data[exactName] || data[lowerName] || 0).replace(/[$,]/g, ""));
        if (val > 0) {
          excelMap[doc.id] = { 
            id: doc.id,
            earning: val, 
            tip: 0, 
            day: d, 
            month: m - 1, 
            year: y,
            dateLabel: `${m}/${d}/${y}`,
            dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            service: "Excel Import" 
          };
        }
      });
      updateLogs();
    });

    // Live Data (earnings)
// Live Data (earnings)
unsubLive = onSnapshot(query(collection(db, "earnings"), where("staffName", "==", exactName)), (snap) => {
  const newLogs = []; // Use an array instead of a map
  snap.forEach(doc => {
    const data = doc.data();
    const dObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
    
    newLogs.push({
      id: doc.id,
      earning: parseFloat(data.earning || data.earnings) || 0,
      tip: parseFloat(data.tip || data.tips) || 0,
      day: dObj.getDate(),
      month: dObj.getMonth(),
      year: dObj.getFullYear(),
      dateLabel: `${dObj.getMonth() + 1}/${dObj.getDate()}/${dObj.getFullYear()}`,
      dateStr: dObj.toISOString().split('T')[0],
      service: data.service || "Standard",
      source: "live" // Tag for filtering
    });
  });
  
  // Merge with Excel data
  setAllLogs([...Object.values(excelMap), ...newLogs]);
  setLoading(false);
});
  });

  return () => { unsubLive(); unsubExcel(); unsubscribeAuth(); };
}, []);

useEffect(() => {
  setVisibleCount(10); // Reset to 5 whenever the date filter or data changes
}, [startDate, endDate]);
// Add this before your 'filteredData' definition
const processedLogs = useMemo(() => {
  return allLogs.filter(log => {
    // If it's Excel, check if a Live entry exists for the same date
    if (log.service === "Excel Import") {
      const hasLive = allLogs.some(l => l.dateStr === log.dateStr && l.source === "live");
      return !hasLive; // Hide Excel row if Live data exists
    }
    return true;
  });
}, [allLogs]);
  // --- FILTER LOGIC ---
// --- FILTER LOGIC ---
  const filteredData = useMemo(() => {
    // CHANGE: Use processedLogs instead of allLogs here to stop double counting!
    return processedLogs.filter(log => {
      return log.dateStr >= startDate && log.dateStr <= endDate;
    });
  }, [processedLogs, startDate, endDate]); // Make sure to update the dependency array too

const chartData = useMemo(() => {
  // Use the year from the selected start date (fallback to current year if empty)
  const currentYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
  const commissionRate = 0.70;

  // Map through all 12 months to build the full year trend
  return MONTHS.map((name, index) => {
    // Filter logs for THIS specific month index and year
    // Now using the clean 'month' and 'year' properties from our unified allLogs
    const logsInMonth = allLogs.filter(log => log.month === index && log.year === currentYear);

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
  // No filter at the end, guaranteeing all 12 months show up
}, [allLogs, startDate]);


const report = useMemo(() => {
  // 1. Basic Sums (Handles both Excel 'amount' and Live 'earning' keys safely)
  const totalEarning = filteredData.reduce((sum, log) => sum + (parseFloat(log.amount || log.earning) || 0), 0);
  const totalTips = filteredData.reduce((sum, log) => sum + (parseFloat(log.tip) || 0), 0);
  
  // Commission Math (70% total commission -> 70% check / 30% cash + tips)
  const commissionRate = 0.70; 
  const totalCommission = totalEarning * commissionRate;
  const checkPayout = totalCommission * 0.70; 
  const cashPayout = (totalCommission - checkPayout) + totalTips;
  const totalPayout = totalCommission + totalTips;

  // Appointment & Client Counts
  const totalAppointments = filteredData.filter(log => 
    log.bookingId || log.type === "booking" || log.source === "dashboard" || log.source === "online"
  ).length;

  const uniqueClients = new Set(filteredData.map(log => 
    (log.clientName || log.id).toString().toLowerCase().trim()
  )).size;

  // 2. CALCULATE TOP DAY EARNING (Uses filteredData)
  const dailyEarnings = {};
  filteredData.forEach(log => {
    // Robust fallback: Uses dateLabel if it exists, otherwise creates it safely to prevent NaN/undefined
    const dateKey = log.dateLabel || `${log.month + 1}/${log.day}/${log.year}`;
    
    // Sum the daily earnings
    dailyEarnings[dateKey] = (dailyEarnings[dateKey] || 0) + (parseFloat(log.amount || log.earning) || 0);
  });

  // Find the date with the highest earning
  const dates = Object.keys(dailyEarnings);
  const bestDate = dates.length > 0 
    ? dates.reduce((a, b) => dailyEarnings[a] > dailyEarnings[b] ? a : b)
    : "No Data";

  return { 
    totalAppointments,
    totalEarning, 
    totalTips, 
    totalPayout,
    cashPayout,
    checkPayout,
    uniqueClients,
    count: filteredData.length,
    topDay: { 
      date: bestDate, 
      amount: dailyEarnings[bestDate] || 0 
    }
  };
}, [filteredData]);

const [topDay, setTopDay] = useState({ date: "N/A", amount: 0 });

useEffect(() => {
  if (allLogs.length === 0) return;

  const dailyEarnings = {};

  allLogs.forEach(log => {
    const dateKey = log.dateLabel; // Using your existing formatted date
    const earning = parseFloat(log.earning) || 0;
    dailyEarnings[dateKey] = (dailyEarnings[dateKey] || 0) + earning;
  });

  const dates = Object.keys(dailyEarnings);
  if (dates.length > 0) {
    const bestDate = dates.reduce((a, b) => dailyEarnings[a] > dailyEarnings[b] ? a : b);
    setTopDay({ date: bestDate, amount: dailyEarnings[bestDate] });
  }
}, [allLogs]);
  //if (loading) return <div className="p-20 text-center font-black text-gray-300 uppercase tracking-widest">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      
      {/* HEADER & DATE FILTER (IMAGE STYLE) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter dark:text-white">My Performance</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Welcome {realName} !</p>
        </div>

        {/* --- DATE FILTER BAR (MATCHES IMAGE) --- */}
        <div className="flex flex-wrap items-center gap-3 dark:bg-slate-900/80 dark:text-white dark:border-slate-800 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 px-2">
            <span className="text-[10px] font-black uppercase text-gray-400">From:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => { setStartDate(e.target.value); setActiveFilter('custom'); }} 
              className="bg-gray-50 dark:bg-slate-950 dark:text-white dark:border-slate-800 border-none rounded-lg text-xs font-bold p-1.5 outline-none focus:ring-2 focus:ring-pink-100" 
            />
          </div>
          <div className="flex items-center gap-2 px-2 border-l border-gray-100 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase text-gray-400">To:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => { setEndDate(e.target.value); setActiveFilter('custom'); }} 
              className="bg-gray-50 dark:bg-slate-950 dark:text-white dark:border-slate-800 border-none rounded-lg text-xs font-bold p-1.5 outline-none focus:ring-2 focus:ring-pink-100" 
            />
          </div>
          
          {/* SHORTCUT BUTTONS */}
          <div className="flex gap-1 pl-2 border-l border-gray-100 dark:border-slate-800">
            <button 
              onClick={() => { 
                const today = getLocalDate();
                setStartDate(today); 
                setEndDate(today); 
                setActiveFilter('today');
              }}
              className={`px-4 py-1.5 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all ${
                activeFilter === 'today' ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30 dark:bg-pink-500' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
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
              className={`px-4 py-1.5 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all ${
                activeFilter === 'thisMonth' ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30 dark:bg-pink-500' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
{/* STAT CARDS ROW 1 */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Row 1: Top Day + 3 Pastel Cards */}
<div 
  style={{ backgroundColor: COLORS.orange }} 
  className="relative p-6 rounded-xl border border-transparent shadow-sm transition-all hover:border-orange-300 overflow-hidden group"
>
  {/* Abstract Gradient Glow Effect */}
  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent -z-0" />
  
  {/* Award Icon positioned Top-Right */}
  <div className="absolute top-0 right-0 opacity-50">
    <Award size={60} style={{ color: COLORS.orangeText }} />
  </div>
  
  {/* Content Layer */}
  <div className="relative z-10">
    <div className="flex items-center gap-2 mb-3">
      <div className="p-1.5 rounded-md bg-white/50">
        <TrendingUp size={14} style={{ color: COLORS.orangeText }} />
      </div>
      <p style={{ color: COLORS.orangeText }} className="text-[10px] font-black uppercase tracking-widest">
        Top Day Earning
      </p>
    </div>
    
    <h3 style={{ color: COLORS.orangeText }} className="text-2xl font-black">
      ${typeof report.topDay.amount === 'number' 
        ? report.topDay.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) 
        : "0.00"}
    </h3>
    
    <div className="flex items-center gap-2 mt-1">
      <div className="p-1 rounded-full bg-white/50">
        <Calendar size={10} style={{ color: COLORS.orangeText }} />
      </div>
      <p style={{ color: COLORS.orangeText }} className="text-[10px] font-bold uppercase tracking-tight">
        {report.topDay.date}
      </p>
    </div>
  </div>
</div>
  <PastelCard label="Total Earnings" value={`$${report.totalEarning.toFixed(2)}`} bg={COLORS.pink} text={COLORS.pinkText} />
  <PastelCard label="Total Payout" value={`$${report.totalPayout.toFixed(2)}`} bg={COLORS.periwinkle} text={COLORS.periwinkleText} />   
  <PastelCard label="Cash Payout" value={`$${report.cashPayout.toFixed(2)}`} bg={COLORS.mint} text={COLORS.mintText} />

  {/* Row 2: Add your remaining 4 cards here */}
  <PastelCard label="Total Tips" value={`$${report.totalTips.toFixed(2)}`} bg={COLORS.green} text={COLORS.greenText} />
  <PastelCard label="Check Payout" value={`$${report.checkPayout.toFixed(2)}`} bg={COLORS.blue} text={COLORS.blueText} />
  <PastelCard label="Appointments" value={report.totalAppointments} bg={COLORS.purple} text={COLORS.purpleText} />
  <PastelCard label="Total Clients" value={report.uniqueClients} bg={COLORS.red} text={COLORS.redText} />
</div>



      {/* CHART */}
<div className="dark:bg-slate-900/80 dark:border-slate-800 bg-white p-6 rounded-xl border border-gray-100 shadow-sm mt-6">
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
<div className="dark:bg-slate-900/80 dark:border-slate-800 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
<div className="p-4 bg-gray-50/50 border-b dark:bg-slate-900/80 dark:border-slate-800 border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
  {/* Left Side: Title and Count */}
  <h3 className="text-[11px] font-black uppercase text-gray-600 tracking-tight">
    My Earning Details <span className="ml-2 text-pink-500 font-black">({report.count} Clients)</span>
  </h3>

  {/* Right Side: Totals Summary Badge */}
  <div className="flex items-center gap-3">
    <div className="flex items-center gap-1.5 dark:bg-slate-950 dark:border-slate-800 bg-pink-100 text-pink-800 px-3 py-1 rounded-xl border border-gray-100 shadow-sm">
      <span className="text-[9px] font-black text-gray-400 uppercase mr-2">Total </span>
      <span className="text-[10px] font-black text-pink-600">(${report.totalEarning.toFixed(2)})</span>
    </div>
    <div className="dark:bg-slate-950 dark:border-slate-800 bg-green-100 text-green-800 text-sm font-semibold flex items-center gap-1.5  px-3 py-1 rounded-xl border border-gray-100 shadow-sm">
      <span className="text-[9px] font-black text-gray-400 uppercase mr-2">Tip </span>
      <span className="text-[10px] font-black text-green-600">(${report.totalTips.toFixed(2)})</span>
    </div>
  </div>
</div>
<table className="w-full text-left">
  <thead className="text-[10px] font-black text-gray-400 uppercase border-b border-gray-50 bg-gray-50/50">
    <tr>
      <th className="px-6 py-4">No.</th>
      <th className="px-6 py-4">Date</th>
      <th className="px-6 py-4">Staff Name</th>
      <th className="px-6 py-4">Service</th>
      <th className="px-6 py-4">Earning</th>
      <th className="px-6 py-4 text-right">Tip</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-gray-50 font-bold text-gray-600">
    {processedLogs.slice().reverse().slice(0, visibleCount).map((log, index) => (
      <tr key={log.id} className="hover:bg-pink-50/30 transition-colors">
        <td className="px-6 py-4 text-[10px] text-gray-400">{index + 1}</td>
        <td className="px-6 py-4 text-xs font-black">{log.dateLabel}</td>
        <td className="px-6 py-4 uppercase text-[10px] text-pink-600">{realName}</td>
        <td className="px-6 py-4 uppercase text-[10px] text-gray-400">{log.service}</td>
        <td className="px-6 py-4 font-black text-pink-600">${parseFloat(log.earning || 0).toFixed(2)}</td>
        <td className="px-6 py-4 font-black text-emerald-600 text-right">${parseFloat(log.tip || 0).toFixed(2)}</td>
      </tr>
    ))}
  </tbody>
</table>

  {/* LOAD MORE BUTTON */}
  {filteredData.length > visibleCount && (
    <div className="p-4 bg-white dark:bg-slate-950 border-t border-gray-50 flex justify-center dark:border-slate-800">
      <button 
        onClick={() => setVisibleCount(prev => prev + 5)}
        className="px-8 py-2 bg-gray-50 dark:bg-slate-900/80 dark:border-slate-800 hover:bg-pink-50 text-gray-400 hover:text-pink-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-gray-100"
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
const ICON_MAP = {
  "Total Earnings": DollarSign,
  "Total Payout": Wallet,
  "Cash Payout": TrendingUp,
  "Total Tips": Award,
  "Check Payout": Percent,
  "Appointments": Briefcase,
  "Total Clients": Users
};

function PastelCard({ label, value, bg, text }) {
  const IconComponent = ICON_MAP[label] || TrendingUp;
  
  return (
    <div style={{ backgroundColor: bg }} className="p-6 rounded-xl shadow-sm relative overflow-hidden">
      <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
        <IconComponent size={80} style={{ color: text }} />
      </div>
      <div className="relative z-10">
        <span style={{ color: text }} className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        <h3 className="text-2xl font-black mt-1" style={{ color: text }}>{value}</h3>
      </div>
    </div>
  );
}