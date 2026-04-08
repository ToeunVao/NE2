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
const [staffSettings, setStaffSettings] = useState({ commission: 60, checkPayout: 70, payoutType: "Commission + Tips" });
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
// Fetch user details to get exact name and rates
const userDoc = await getDoc(doc(db, "users", user.uid));
const userData = userDoc.data();
const exactName = userData?.name?.trim() || "";
setRealName(exactName);

// Set personal rates from Firestore (fallback to defaults if missing)
setStaffSettings({
  commission: parseFloat(userData?.commission) || 60,
  checkPayout: parseFloat(userData?.checkPayout) || 70,
  payoutType: userData?.payoutType || "Commission + Tips"
});
    const lowerName = exactName.toLowerCase();

    let liveMap = {};

const updateLogs = () => {
  // Now we only pull from the liveMap we just filtered
  const liveEntries = Object.values(liveMap);

  // Sort by date: Newest at the top
  liveEntries.sort((a, b) => {
    const dateA = new Date(a.year, a.month, a.day);
    const dateB = new Date(b.year, b.month, b.day);
    return dateB - dateA;
  });

  setAllLogs(liveEntries); 
  setLoading(false);
};
// B. LIVE APP DATA LISTENER
const liveRef = collection(db, "earnings");

// We fetch earnings, but we will filter them in Javascript to handle the space issue
unsubLive = onSnapshot(liveRef, (snapshot) => {
  liveMap = {}; 
  
  // Create a "Clean" version of the name to compare against
  const cleanTargetName = exactName.trim().toLowerCase();

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const dbName = (data.staffName || "").trim().toLowerCase();

    // Check if names match, ignoring spaces and BIG/small letters
    if (dbName === cleanTargetName) {
      let dObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
      if (isNaN(dObj.getTime())) return;

      const dateKey = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
      
      liveMap[doc.id] = {
        id: doc.id,
        year: dObj.getFullYear(),
        month: dObj.getMonth(),
        day: dObj.getDate(),
        dateStr: dateKey,
        earning: Number(data.earning || data.earnings || 0),
        tip: Number(data.tip || data.tips || 0),
        clientName: data.clientName || "Walk-in",
        service: data.service || "Standard",
        source: 'live'
      };
    }
  });
  
  updateLogs(); 
});
  });

  return () => { unsubLive(); unsubExcel(); unsubscribeAuth(); };
}, []);

useEffect(() => {
  setVisibleCount(10); // Reset to 5 whenever the date filter or data changes
}, [startDate, endDate]);
// Add this before your 'filteredData' definition
const processedLogs = useMemo(() => {
  const seenIds = new Set();
  return allLogs.filter(log => {
    // 1. Skip if we've already processed this specific Firestore ID
    if (seenIds.has(log.id)) return false;
    seenIds.add(log.id);

    // 2. Original Excel vs Live logic
    if (log.service === "Excel Import" || log.source === "excel") {
      const hasLive = allLogs.some(l => l.dateStr === log.dateStr && l.source === "live");
      return !hasLive;
    }
    return true;
  });
}, [allLogs]);
  // --- FILTER LOGIC ---
const filteredData = useMemo(() => {
  // 1. Filter by date range
  const filtered = processedLogs.filter(log => {
    return log.dateStr >= startDate && log.dateStr <= endDate;
  });

  // 2. Sort by Date Descending (Newest first)
  // This ensures the record with the most recent date is at the top (index 0)
  return filtered.sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));
  
}, [processedLogs, startDate, endDate]);
const chartData = useMemo(() => {
    const currentYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
    
    const commRate = (staffSettings.commission || 60) / 100;
    const checkRate = (staffSettings.checkPayout || 70) / 100;
    const isCommPlusTips = staffSettings.payoutType === "Commission + Tips";

    return MONTHS.map((name, index) => {
      const logsInMonth = processedLogs.filter(log => log.month === index && log.year === currentYear);

      const monthlyEarning = logsInMonth.reduce((sum, log) => sum + (Number(log.earning) || 0), 0);
      const monthlyTips = logsInMonth.reduce((sum, log) => sum + (Number(log.tip) || 0), 0);

      // Monthly Commission (70% or 60%)
      const mTotalCommission = monthlyEarning * commRate;
      
      const mCheck = mTotalCommission * checkRate;
      const mCashShare = mTotalCommission * (1 - checkRate);
      
      // Tips go only to the Cash value
      const mCash = isCommPlusTips ? (mCashShare + monthlyTips) : mCashShare;

      return {
        name: name.substring(0, 3),
        total: Number(mTotalCommission.toFixed(2)), // Matches the "Total Payout" card
        check: Number(mCheck.toFixed(2)),
        cash: Number(mCash.toFixed(2)),
         tips: Number(monthlyTips.toFixed(2)),
      };
    });
  }, [processedLogs, startDate, staffSettings]);


const report = useMemo(() => {
const totalEarning = filteredData.reduce((sum, log) => sum + (Number(log.earning) || 0), 0);
    const totalTips = filteredData.reduce((sum, log) => sum + (Number(log.tip) || 0), 0);

    // --- FINAL STAFF-OWNED TIPS LOGIC ---
    const commRate = (staffSettings.commission || 60) / 100;
    const checkRate = (staffSettings.checkPayout || 70) / 100;
    
    // Total Payout = Commission ONLY (The Salon's deal with the staff)
    const totalCommission = totalEarning * commRate; 
    
    // Check Payout = 70% of that Commission
    const checkAmount = totalCommission * checkRate;
    
    // Cash Payout = 30% Share of Commission + 100% of Tips (No salon share)
    const commissionCashShare = totalCommission * (1 - checkRate);
    const finalCashPayout = (staffSettings.payoutType === "Commission + Tips") 
      ? (commissionCashShare + totalTips) 
      : commissionCashShare;
    // -------------------------------------

  // Appointment & Client Counts
  const totalAppointments = filteredData.filter(log => 
    log.bookingId || log.type === "booking" || log.source === "dashboard" || log.source === "online"
  ).length;

// This counts every individual service/row as a client
const uniqueClients = filteredData.length;

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
 cashPayout: finalCashPayout,    // This card is now HIGHER due to tips
      checkPayout: checkAmount,       // This card stays at 70% of commission
      totalPayout: totalCommission,   // This card stays at the pure Commission %
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
<div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
  <PastelCard label="Check Payout" value={`$${report.checkPayout.toFixed(2)}`} bg={COLORS.blue} text={COLORS.blueText} />
  
 
  {/* Row 2: Add your remaining 4 cards here */}
  <PastelCard label="Cash Payout" value={`$${report.cashPayout.toFixed(2)}`} bg={COLORS.mint} text={COLORS.mintText} />
 <PastelCard label="Total Tips" value={`$${report.totalTips.toFixed(2)}`} bg={COLORS.green} text={COLORS.greenText} />
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

{/* --- CHART SECTION --- */}
{/* --- CHART SECTION --- */}
<div className="w-full overflow-x-auto">
  <div className="h-[350px] md:h-[400px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart 
        data={chartData}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }} // Pull left margin in for mobile
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 10, fontWeight: 'bold' }}
          interval={0} // Forces all month names to show
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 10 }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
        
        {/* Adjusted Bar sizes: barSize={12} is perfect for mobile spacing */}
        <Bar dataKey="total" name="Total Payout" fill={COLORS.purple} radius={[4, 4, 0, 0]} barSize={12} />
        <Bar dataKey="check" name="Check Payout" fill={COLORS.blue} radius={[4, 4, 0, 0]} barSize={12} />
        <Bar dataKey="cash" name="Cash Payout" fill={COLORS.green} radius={[4, 4, 0, 0]} barSize={12} />
        
        <Line 
          type="monotone" 
          dataKey="tips" 
          name="Total Tips" 
          stroke={COLORS.orangeText} 
          strokeWidth={3} 
          dot={{ r: 3 }} 
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  </div>

  {/* --- SUMMARY TEXT BELOW CHART --- */}
  {/* Added 'grid-cols-2' for mobile and 'md:grid-cols-4' for desktop */}
  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 border-t border-gray-50 pt-6 dark:border-slate-800">
    <div className="p-2 text-center bg-purple-50/30 dark:bg-purple-900/10 rounded-xl">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Payout</p>
      <p className="text-base md:text-lg font-black text-purple-600">${report.totalPayout.toFixed(2)}</p>
    </div>
    <div className="p-2 text-center bg-blue-50/30 dark:bg-blue-900/10 rounded-xl">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Check Payout</p>
      <p className="text-base md:text-lg font-black text-blue-600">${report.checkPayout.toFixed(2)}</p>
    </div>
    <div className="p-2 text-center bg-green-50/30 dark:bg-green-900/10 rounded-xl">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Cash Payout</p>
      <p className="text-base md:text-lg font-black text-green-600">${report.cashPayout.toFixed(2)}</p>
    </div>
    <div className="p-2 text-center bg-orange-50/30 dark:bg-orange-900/10 rounded-xl">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Tips</p>
      <p className="text-base md:text-lg font-black text-orange-500">${report.totalTips.toFixed(2)}</p>
    </div>
  </div>
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
<div className="overflow-x-auto">
    <table className="w-full text-left text-xs min-w-[500px]">
      <thead className="bg-gray-50 text-gray-400 uppercase font-bold">
        <tr>
          <th className="px-6 py-4 w-12">No.</th>
          <th className="px-6 py-4">Date</th>
          <th className="px-6 py-4">Client</th>
          <th className="px-6 py-4">Service</th>
          <th className="px-6 py-4 text-right">Earning</th>
          <th className="px-6 py-4 text-right">Tip</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
    {filteredData.slice(0, visibleCount).map((log, index) => {
  const d = log.dateStr ? log.dateStr.split('-') : [];
  const formattedDate = d.length === 3 ? `${d[1]}/${d[2]}/${d[0]}` : "N/A";

  return (
    <tr key={log.id || index} className="hover:bg-pink-50/50 transition-colors">
      <td className="px-6 py-4 text-gray-400 font-bold">{index + 1}</td>
      <td className="px-6 py-4 text-gray-500 font-medium">{formattedDate}</td>
      {/* Use the specific clientName from the log entry */}
      <td className="px-6 py-4 font-black text-gray-800">{log.clientName || "Walk-in"}</td>
      <td className="px-6 py-4 text-gray-600 truncate max-w-[120px]">{log.service || "Service"}</td>
      <td className="px-6 py-4 text-right font-black text-purple-600">
        ${Number(log.earning || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
      <td className="px-6 py-4 text-right font-black text-orange-500">
        ${Number(log.tip || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
    </tr>
  );
})}
      </tbody>
    </table>
  </div>

  {/* LOAD MORE BUTTON */}
  {filteredData.length > visibleCount && (
    <div className="p-4 bg-white dark:bg-slate-950 border-t border-gray-50 flex justify-center dark:border-slate-800">
      <button 
        onClick={() => setVisibleCount(prev => prev +20)}
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
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const labelMap = {
      total: { name: "Total Payout", color: "#6F42C1" },
      check: { name: "Check Payout", color: "#0D6EFD" },
      cash: { name: "Cash Payout", color: "#198754" },
      tips: { name: "Total Tips", color: "#D97706" }
    };

    const order = ['total', 'check', 'cash', 'tips'];
    const sortedData = [...payload].sort((a, b) => 
      order.indexOf(a.dataKey) - order.indexOf(b.dataKey)
    );

    return (
      <div className="bg-white p-4 border-2 border-gray-200 rounded-xl shadow-2xl min-w-[220px]">
        <p className="font-black text-gray-900 border-b border-gray-100 pb-2 mb-2 text-sm uppercase">
          {label} Stats
        </p>
        <div className="space-y-2">
          {sortedData.map((entry, index) => {
            const config = labelMap[entry.dataKey] || { name: entry.name, color: "#000" };
            return (
              <div key={index} className={`flex justify-between items-center ${entry.dataKey === 'total' ? "mb-2 pb-2 border-b border-gray-50" : ""}`}>
                <span className="font-bold text-gray-500 text-[10px] uppercase">{config.name}</span>
                <span className="font-black text-sm" style={{ color: config.color }}>
                  ${Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};