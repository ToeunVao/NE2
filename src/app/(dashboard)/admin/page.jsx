"use client";
import { useState, useEffect, useMemo, useRef  } from "react";
import { useRouter } from "next/navigation"; // Add this line
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, orderBy, where, 
  doc, updateDoc, addDoc, setDoc, deleteDoc, Timestamp 
} from "firebase/firestore";
// ... other imports
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';

// Pastel Colors from your UI
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

// Staff Bar Chart Colors
const STAFF_BAR_COLORS = ['#FFB6C1', '#87CEEB', '#98FB98', '#FFD700', '#DDA0DD', '#FFA07A', '#F08080'];
  const parseMoney = (val) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/[^0-9.-]+/g, "")) || 0;
  };

export default function AdminDashboard() {
// 1. Move the helper function INSIDE the component at the very top
  const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now - offset).toISOString().split('T')[0];
  };

  const getMonthDefaults = () => {
    const now = new Date();
    // First day of current month (e.g., 2026-01-01)
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
      .toISOString().split('T')[0];
    const today = getLocalDate();
    return { firstDay, today };
  };

  // 2. Initialize the state using the function
  const { firstDay: initialFirstDay, today: initialToday } = getMonthDefaults();

  const [overviewStart, setOverviewStart] = useState(initialFirstDay); 
  const [overviewEnd, setOverviewEnd] = useState(initialToday);
const formRef = useRef(null);
const [showAllRows, setShowAllRows] = useState(false);
  // --- NEW STATES FOR FILTERED TABLE ---
  const [serviceLogs, setServiceLogs] = useState([]); // Raw logs from Firestore
  const [reportFilterTech, setReportFilterTech] = useState('All'); // Technician Tab

const todayStr = getLocalDate(); // This will correctly return 2026-01-16
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${month}/${day}/${year}`;
};

const [startDate, setStartDate] = useState(todayStr);
const [endDate, setEndDate] = useState(todayStr);

const [newEarning, setNewEarning] = useState({
  date: getLocalDate(),
  staffName: "",
  service: "",
  earning: "",
  tip: ""
});

// 2. Database Path Config (Matches your script.js nested structure)
const APP_ID = "nailexpress-10f2f";
const BASE_PATH = `artifacts/${APP_ID}/public/data`;

  const [finishedCount, setFinishedCount] = useState(0);
  const router = useRouter(); // Add this lin
  const [loading, setLoading] = useState(true);
  // Default to current month, e.g., "2026-01"
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  
  const [earningsData, setEarningsData] = useState([]);
  const [staffList, setStaffList] = useState([]);
const [appointments, setAppointments] = useState([]); // Add this line
const [selectedTechFilter, setSelectedTechFilter] = useState('All'); // Add this!
  // --- 1. SYNC DATABASE ---
const overviewStats = useMemo(() => {
  const dateFilteredLogs = serviceLogs.filter(log => 
    log.dateStr >= overviewStart && log.dateStr <= overviewEnd
  );
  const filteredReports = earningsData.filter(r => r.id >= overviewStart && r.id <= overviewEnd);
  const filteredLogs = serviceLogs.filter(log => log.dateStr >= overviewStart && log.dateStr <= overviewEnd);

  let totalEarnings = 0;
  let totalCash = 0;
  let totalGiftCard = 0;
  let totalExpense = 0;
  const staffStats = {};
  const dailyDataMap = {}; // Helper for the graph

  // 2. ADD THIS: Filter appointments by the same overview dates
  const liveAppointments = appointments.filter(appt => {
    if (!appt.dateObj) return false;
    const apptDateStr = appt.dateObj.toISOString().split('T')[0];
    return apptDateStr >= overviewStart && apptDateStr <= overviewEnd;
  });

  // 1. Calculate Revenue & Staff Stats from individual logs
  filteredLogs.forEach(log => {
    const money = parseMoney(log.earning);
    totalEarnings += money;
    
    // Grouping for the Graph (Trend Section)
    if (!dailyDataMap[log.dateStr]) {
      dailyDataMap[log.dateStr] = { 
        name: formatDisplayDate(log.dateStr), // MM/DD/YYYY
        revenue: 0,
        cash: 0 
      };
    }
    dailyDataMap[log.dateStr].revenue += money;

    if (!staffStats[log.staffName]) {
      staffStats[log.staffName] = { name: log.staffName, revenue: 0, bookings: 0 };
    }
    staffStats[log.staffName].revenue += money;
    staffStats[log.staffName].bookings += 1;
  });

  // 2. Calculate Cash/Expenses from daily reports
  filteredReports.forEach(report => {
    totalGiftCard += parseMoney(report.sellGiftCard);
    totalExpense += (parseMoney(report.product) + parseMoney(report.supply));
    
    let dailyTechSum = 0;
    staffList.forEach(s => dailyTechSum += parseMoney(report[s.name.toLowerCase()]));
    const dailyTotal = dailyTechSum + parseMoney(report.sellGiftCard);
    const nonCash = parseMoney(report.totalCredit) + parseMoney(report.check) + 
                    parseMoney(report.venmo) + parseMoney(report.square);
    const dailyCashValue = (dailyTotal - nonCash);
    totalCash += dailyCashValue;

    // Add Cash to the Trend Graph if the date exists
    if (dailyDataMap[report.id]) {
      dailyDataMap[report.id].cash = dailyCashValue;
    }
  });

  // 3. Convert Map to Sorted Array for Recharts
  const trendData = Object.keys(dailyDataMap)
    .sort()
    .map(dateKey => dailyDataMap[dateKey]);

  // 4. Staff Performance & Tops
  const staffPerformance = Object.values(staffStats).map((staff, index) => {
    const payout = staff.revenue * 0.60;
    return {
      ...staff,
      payout,
      checkPayout: payout * 0.70,
      cashPayout: payout * 0.30,
      color: STAFF_BAR_COLORS[index % STAFF_BAR_COLORS.length]
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return { 
    totalEarnings, totalCash, totalGiftCard, totalExpense, 
    topEarnerName: staffPerformance[0]?.name || "N/A", 
    topBookingName: [...staffPerformance].sort((a, b) => b.bookings - a.bookings)[0]?.name || "N/A",
    staffPerformance, 
    trendData, // <--- This is for your graph
    clientCount: filteredLogs.length,
    liveAppointmentCount: liveAppointments.length
  };
}, [serviceLogs, earningsData, staffList, overviewStart, overviewEnd]);

useEffect(() => {
  console.log("--- STARTING FIREBASE SYNC ---");
  setLoading(true);

// 1. Point directly to the "users" collection
  const unsubStaff = onSnapshot(collection(db, "users"), (snap) => {
    setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role === "technician" || u.role === "staff"));
  });

  // 2. Point directly to "salon_earnings"
  const unsubEarnings = onSnapshot(collection(db, "salon_earnings"), (snap) => {
    setEarningsData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  });

  // 3. Point directly to "earnings"
const unsubLogs = onSnapshot(collection(db, "earnings"), (snap) => {
  const logs = snap.docs.map(doc => {
    const data = doc.data();
    let dStr = "";
    if (data.date?.toDate) dStr = data.date.toDate().toISOString().split('T')[0];
    else if (typeof data.date === 'string') dStr = data.date.split('T')[0];
    return { id: doc.id, ...data, dateStr: dStr };
  });
  setServiceLogs(logs);
});

  const qAppts = query(collection(db, "appointments"), orderBy("appointmentTimestamp", "asc"));
  const unsubAppts = onSnapshot(qAppts, (snap) => {
    const appts = snap.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      // Convert Firestore timestamp to JS Date
      dateObj: doc.data().appointmentTimestamp?.toDate() 
    }));
    setAppointments(appts);
  });

  // 2. FINISHED CLIENTS LISTENER
    const qFinished = query(collection(db, "finished_clients"));
    const unsubFinished = onSnapshot(qFinished, (snap) => {
      setFinishedCount(snap.size); // This is allowed here
    });

    
  setLoading(false);

  return () => { unsubEarnings(); unsubStaff(); unsubAppts(); unsubFinished(); unsubLogs();};
}, []);
// --- SUBMISSION LOGIC ---
const handleAddEarning = async () => {
  if (!newEarning.staffName || !newEarning.earning) return alert("Select staff and amount");
  
  try {
    // 1. Create a Javascript Date object from the input string
    // We add 'T12:00:00' to ensure it doesn't shift days due to timezones
    const dateObject = new Date(newEarning.date + 'T12:00:00');

    // 2. Add individual log to root /earnings
    await addDoc(collection(db, "earnings"), {
      staffName: newEarning.staffName,
      service: newEarning.service,
      earning: parseMoney(newEarning.earning),
      tip: parseMoney(newEarning.tip),
      // SAVE AS TIMESTAMP SO OLD APP DOESN'T CRASH
      date: Timestamp.fromDate(dateObject) 
    });

    // 3. Update the day's summary in root /salon_earnings
    const [y, m, d] = newEarning.date.split('-');
    const docId = `${y}-${parseInt(m)}-${parseInt(d)}`; 
    const staffKey = newEarning.staffName.toLowerCase().trim();
    
    const currentReport = earningsData.find(r => r.id === docId);
    const prevVal = parseMoney(currentReport?.[staffKey]);

    const reportRef = doc(db, "salon_earnings", docId);
    await setDoc(reportRef, { 
      [staffKey]: prevVal + parseMoney(newEarning.earning) 
    }, { merge: true });

    setNewEarning({...newEarning, earning: "", tip: "", service: ""});
    alert("Saved Successfully! Old app is safe.");
  } catch (e) {
    console.error("Firebase Error:", e);
    alert("Error: " + e.message);
  }
};
  
const dashboardData = useMemo(() => {
  if (!staffList) return null;




  // 1. FILTERING DATA
  const monthReports = earningsData.filter(r => {
    const [year, month] = selectedMonth.split('-');
    const m = parseInt(month).toString(); 
    return r.id.startsWith(`${year}-${m}-`) || r.id.startsWith(`${selectedMonth}-`);
  });

  // 2. CALCULATING TOTALS
  let totalRevenue = 0;
  let totalCash = 0;
  let totalClients = 0;
  let totalGiftCard = 0;
  let totalExpense = 0;

  monthReports.forEach(report => {
    let dailyTechSum = 0;
    staffList.forEach(staff => {
      const key = staff.name.toLowerCase();
      dailyTechSum += parseMoney(report[key]);
    });
    
    const gc = parseMoney(report.sellGiftCard);
    const dailyTotal = dailyTechSum + gc;

    totalRevenue += dailyTotal;
    totalGiftCard += gc;
 // This checks for totalClients, clients, or customerCount
const clientValue = report.totalClients || report.clients || report.customerCount || 0;
totalClients += parseMoney(clientValue);
    totalExpense += (parseMoney(report.product) + parseMoney(report.supply));

    const nonCash = parseMoney(report.totalCredit) + parseMoney(report.check) + 
                    parseMoney(report.venmo) + parseMoney(report.square);
    totalCash += (dailyTotal - nonCash);
  });

  // 3. STAFF PERFORMANCE
  const staffPerformance = staffList
    .filter(staff => staff.role === "technician" || staff.role === "staff")
    .map((staff, index) => {
      const staffNameKey = staff.name.toLowerCase(); 
      let staffRevenue = 0;
      monthReports.forEach(report => {
        staffRevenue += parseMoney(report[staffNameKey]);
      });
      const totalPayout = staffRevenue * 0.60; 
      return {
        name: staff.name,
        revenue: staffRevenue,
        payout: totalPayout,
        checkPayout: totalPayout * 0.70,
        cashPayout: totalPayout * 0.30,
        color: STAFF_BAR_COLORS[index % STAFF_BAR_COLORS.length]
      };
    }).sort((a, b) => b.revenue - a.revenue);

  // 4. TREND DATA (The missing piece that was causing your error)
  const [year, month] = selectedMonth.split('-');
  const daysInMonth = new Date(year, month, 0).getDate();
  
const trendData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const mInt = parseInt(month);
    const idA = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    const idB = `${year}-${mInt}-${day}`;

    const report = monthReports.find(r => r.id === idA || r.id === idB);
    let dailyRev = 0;
    let dailyCash = 0;

    if (report) {
      staffList.forEach(s => dailyRev += parseMoney(report[s.name.toLowerCase()]));
      dailyRev += parseMoney(report.sellGiftCard);

      const nonCash = parseMoney(report.totalCredit) + parseMoney(report.check) + 
                      parseMoney(report.venmo) + parseMoney(report.square);
      dailyCash = dailyRev - nonCash;
    }
    return { day, "Total Revenue": dailyRev, "Cash Revenue": dailyCash };
});

  // 5. APPOINTMENT LOGIC
const monthAppts = (appointments || []).filter(appt => {
    // FIX: Change 'appt.date' to 'appt.dateObj' to match your fetcher
    if (!appt.dateObj) return false;
    const apptYear = appt.dateObj.getFullYear();
    // getMonth is 0-indexed, so we add 1 and pad with "0"
    const apptMonth = (appt.dateObj.getMonth() + 1).toString().padStart(2, '0');
    return `${apptYear}-${apptMonth}` === selectedMonth;
  });

// 5. APPOINTMENT LOGIC (Fixed)
  // A. For the "Total Appointments" Card -> Count everything in the system
  const totalSystemAppointments = appointments.length;
// B. For the "Upcoming" List -> Show anything in the future
  const now = new Date();
  const upcomingAppts = appointments.filter(appt => {
    // 1. Check Date
    if (!appt.dateObj) return false;
// 1. Must be in the future
// 2. Must NOT be already checked-in or completed
const isFuture = appt.dateObj >= now;
// ADD THIS LINE: Only show if the status is NOT checked-in or completed
  const isPending = appt.status !== "checked-in" && appt.status !== "completed";

  const rawTech = appt.technician || appt.tech || appt.staff || "";
  const apptTech = rawTech.toString().toLowerCase().trim();
  const filterTech = selectedTechFilter.toLowerCase().trim();

  if (selectedTechFilter === 'All') return isFuture && isPending; // Updated

  if (selectedTechFilter === 'Any Technician') {
     return isFuture && isPending && (apptTech === "" || apptTech === "any technician"); // Updated
  }
  
  return isFuture && isPending && apptTech.includes(filterTech); // Updated
}).sort((a, b) => a.dateObj - b.dateObj);

  // 6. DAILY REPORT DATA (For the Table)
  const dailyReports = monthReports.map(report => {
    let dailyTechTotal = 0;
    
    // Calculate sum of all technicians for this day
    staffList.forEach(staff => {
      dailyTechTotal += parseMoney(report[staff.name.toLowerCase()]);
    });

    const gc = parseMoney(report.sellGiftCard);
    const totalRev = dailyTechTotal + gc;
    const expenses = parseMoney(report.product) + parseMoney(report.supply);
    
    // Calculate Cash (Total - NonCash)
    const nonCash = parseMoney(report.totalCredit) + parseMoney(report.check) + 
                    parseMoney(report.venmo) + parseMoney(report.square);
    const cash = totalRev - nonCash;

    return {
      id: report.id,
      date: report.id, // Or format if needed
      totalRevenue: totalRev,
      totalCash: cash,
      expenses: expenses,
      giftCard: gc,
      raw: report // Keep raw data to access individual tech columns
    };
  }).sort((a, b) => a.id.localeCompare(b.id)); // Sort by Date Ascending
  // --- FINAL RETURN (Everything is now defined before this line) ---

// 1. Get unique names from future appointments
  const uniqueBookings = new Set(appointments.map(appt => appt.phone || appt.name?.toLowerCase().trim()));
  
  // 2. Add the count of finished clients from the other collection
  // Note: We use finishedCount (from state) + uniqueBookings.size
  const systemTotalClients = finishedCount + uniqueBookings.size;
  // --- Calculate Top Booking Technician ---
  const bookingCounts = {};
  
  monthAppts.forEach(appt => {
    // Use the same fallback logic as your table
    const rawTech = appt.technician || appt.tech || appt.staff || "Any Technician";
    const techName = rawTech.trim();
    
    if (techName && techName.toLowerCase() !== "any technician") {
      bookingCounts[techName] = (bookingCounts[techName] || 0) + 1;
    }
  });

  let topBookedName = "-";
  let maxBookings = 0;

  Object.entries(bookingCounts).forEach(([name, count]) => {
    if (count > maxBookings) {
      maxBookings = count;
      topBookedName = name;
    }
  });

  return {
    totals: { 
      totalRevenue, 
      totalCash, 
      totalClients: systemTotalClients,
      totalGiftCard, 
      totalExpense, 
      topEarnerName: staffPerformance[0]?.name || "-",
      topBookingName: topBookedName
    },
    staffPerformance,
    trendData,
    upcomingAppts,
    totalSystemAppointments, // Added this
    dailyReports             // Added this
  };
}, [selectedMonth, earningsData, staffList, appointments, selectedTechFilter, finishedCount]);
const filteredStats = useMemo(() => {
  const filtered = serviceLogs.filter(log => {
    // Range check: Is the log date between start and end?
    const isWithinRange = log.dateStr >= startDate && log.dateStr <= endDate;
    const isTechMatch = reportFilterTech === 'All' || log.staffName === reportFilterTech;
    return isWithinRange && isTechMatch;
  });

  return {
    totalEarnings: filtered.reduce((sum, log) => sum + parseMoney(log.earning), 0),
    totalTips: filtered.reduce((sum, log) => sum + parseMoney(log.tip), 0),
    clientCount: filtered.length,
    rows: filtered
  };
}, [serviceLogs, startDate, endDate, reportFilterTech]); // Update dependencies here too!


  if (loading || !dashboardData) return <div className="p-20 text-center font-black text-gray-300 tracking-widest uppercase">Loading Data...</div>;

const { 
  totals = {}, 
  staffPerformance = [], 
  trendData = [], 
  upcomingAppts = [], 
  totalSystemAppointments = 0, 
  dailyReports = [],
} = dashboardData || {};


  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8 font-sans pb-20">
      
      {/* HEADER */}
 
        {/* --- OVERVIEW FILTER SECTION --- */}
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
  <div>
    <h2 className="text-lg font-black text-gray-800">Business Overview</h2>
    <p className="text-xs text-gray-400 font-bold uppercase">Performance Metrics</p>
  </div>

  {/* DATE PICKER FOR CARDS/GRAPH */}
  <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
    <div className="flex items-center gap-2 px-2">
      <span className="text-[10px] font-black uppercase text-gray-400">From:</span>
      <input 
        type="date" 
        value={overviewStart} 
        onChange={e => setOverviewStart(e.target.value)} 
        className="bg-gray-50 border-none rounded-lg text-xs font-bold p-1.5 outline-none focus:ring-2 focus:ring-pink-100" 
      />
    </div>
    <div className="flex items-center gap-2 px-2 border-l border-gray-100">
      <span className="text-[10px] font-black uppercase text-gray-400">To:</span>
      <input 
        type="date" 
        value={overviewEnd} 
        onChange={e => setOverviewEnd(e.target.value)} 
        className="bg-gray-50 border-none rounded-lg text-xs font-bold p-1.5 outline-none focus:ring-2 focus:ring-pink-100" 
      />
    </div>
    
    {/* SHORTCUT BUTTONS */}
    <div className="flex gap-1 pl-2 border-l border-gray-100">
     <button 
      onClick={() => { setOverviewStart(getLocalDate()); setOverviewEnd(getLocalDate()); }}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${
        overviewStart === overviewEnd ? 'bg-pink-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
      }`}
    >
      Today
    </button>
    <button 
  onClick={() => { 
    const { firstDay, today } = getMonthDefaults();
    setOverviewStart(firstDay); 
    setOverviewEnd(today); 
  }}
  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
    overviewStart === initialFirstDay ? 'bg-pink-600 text-white shadow-lg shadow-pink-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
  }`}
>
  This Month
</button>
    </div>
  </div>
</div>

{/* ROW 1: PRIMARY BUSINESS STATS */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
  
  {/* TOTAL REVENUE - PINK */}
  <div style={{ backgroundColor: COLORS.pink }} className="p-6 rounded-xl flex justify-between items-center group transition-all">
    <div>
      <p style={{ color: COLORS.pinkText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Total Revenue</p>
      <h3 style={{ color: COLORS.pinkText }} className="font-black text-3xl tracking-tight">${overviewStats.totalEarnings.toFixed(2)}</h3>
    </div>
    <div className="p-3 rounded-full bg-white/30 text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  </div>

  {/* TOTAL CASH - GREEN */}
  <div style={{ backgroundColor: COLORS.green }} className="p-6 rounded-xl flex justify-between items-center group transition-all">
    <div>
      <p style={{ color: COLORS.greenText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Total Cash</p>
      <h3 style={{ color: COLORS.greenText }} className="font-black text-3xl tracking-tight">${overviewStats.totalCash.toFixed(2)}</h3>
    </div>
    <div className="p-3 rounded-full bg-white/30 text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </div>
  </div>

  {/* TOP EARNER - BLUE */}
  <div style={{ backgroundColor: COLORS.blue }} className="p-6 rounded-xl flex justify-between items-center group transition-all">
    <div>
      <p style={{ color: COLORS.blueText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Top Earner</p>
      <h3 style={{ color: COLORS.blueText }} className="text-xl font-black tracking-tight truncate max-w-[120px]">{overviewStats.topEarnerName}</h3>
    </div>
    <div className="p-3 rounded-full bg-white/30 text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    </div>
  </div>

  {/* TOP BOOKING - PURPLE */}
  <div style={{ backgroundColor: COLORS.purple }} className="p-6 rounded-xl flex justify-between items-center group transition-all">
    <div>
      <p style={{ color: COLORS.purpleText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Top Booking</p>
      <h3 style={{ color: COLORS.purpleText }} className="text-xl font-black tracking-tight truncate max-w-[120px]">{overviewStats.topBookingName}</h3>
    </div>
    <div className="p-3 rounded-full bg-white/30 text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  </div>
</div>

{/* ROW 2: OPERATIONAL STATS */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
  
{/* APPOINTMENTS - PERIWINKLE CARD */}
<div style={{ backgroundColor: COLORS.periwinkle }} className="p-6 rounded-xl flex justify-between items-center group transition-all">
  <div>
    <p style={{ color: COLORS.periwinkleText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
      Live Appointments
    </p>
    <h3 style={{ color: COLORS.periwinkleText }} className="text-3xl font-black tracking-tight">
      {/* Updated to use the new calculated count */}
      {overviewStats.liveAppointmentCount}
    </h3>
  </div>
  <div className="p-3 rounded-full bg-white/30 text-gray-400">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  </div>
</div>

{/* CLIENTS - MINT CARD */}
<div style={{ backgroundColor: COLORS.mint }} className="p-6 rounded-xl flex justify-between items-center group transition-all">
  <div>
    <p style={{ color: COLORS.mintText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
      Total Clients
    </p>
    <h3 style={{ color: COLORS.mintText }} className="text-3xl font-black tracking-tight">
      {/* CHANGE THIS LINE FROM filteredStats.rows.length TO overviewStats.clientCount */}
      {overviewStats.clientCount}
    </h3>
  </div>
  <div className="p-3 rounded-full bg-white/30 text-white">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  </div>
</div>
  {/* GIFT CARDS - ORANGE */}
  <div style={{ backgroundColor: COLORS.orange }} className="p-6 rounded-xl flex justify-between items-center">
    <div>
      <p style={{ color: COLORS.orangeText }} className="text-[10px] font-black uppercase tracking-widest opacity-80">Gift Cards</p>
      <h3 style={{ color: COLORS.orangeText }} className="text-2xl font-black">${overviewStats.totalGiftCard.toFixed(2)}</h3>
    </div>
    <div className="p-3 rounded-full bg-white/30 text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    </div>
  </div>

  {/* EXPENSES - RED */}
  <div style={{ backgroundColor: COLORS.red }} className="p-6 rounded-xl flex justify-between items-center">
    <div>
      <p style={{ color: COLORS.redText }} className="text-[10px] font-black uppercase tracking-widest opacity-80">Expenses</p>
      <h3 style={{ color: COLORS.redText }} className="text-2xl font-black">${overviewStats.totalExpense.toFixed(2)}</h3>
    </div>
    <div className="p-3 rounded-full bg-white/30 text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  </div>
</div>

      {/* SECTION 3: STAFF EARNINGS SUMMARY (Cards + Chart) */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-black text-gray-700 italic mb-6 bg-gray-100 inline-block px-4 py-1 rounded-lg">Staff Earnings Summary</h3>
        
        {/* Staff Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-10">
            {/* Change staffPerformance.map to overviewStats.staffPerformance.map */}
{overviewStats.staffPerformance.map((staff, idx) => (
    <div key={idx} className="p-5 rounded-xl border border-gray-50 hover:shadow-md transition-all" style={{backgroundColor: `${staff.color}15`}}>
        <h4 className="text-sm font-black mb-1" style={{color: staff.color}}>{staff.name}</h4>
        <p className="text-2xl font-black text-gray-800 mb-4">${staff.revenue.toFixed(2)}</p>
        
        <div className="space-y-1">
            <PayoutRow label="Total Payout" value={staff.payout} />
            <PayoutRow label="Check Payout" value={staff.checkPayout} />
            <PayoutRow label="Cash Payout" value={staff.cashPayout} />
        </div>
    </div>
))}
        </div>

        {/* Bar Chart */}
        <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={overviewStats.staffPerformance} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#6b7280'}} dy={10} />
                    <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                        {staffPerformance.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 4: REVENUE TREND */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
         <h3 className="text-xl font-black text-gray-700 italic mb-6">Salon Revenue Trend</h3>
         <div className="h-[300px] w-full">
           {/* Change dashboardData.trendData to overviewStats.trendData */}
<ResponsiveContainer width="100%" height="100%">
  <LineChart data={overviewStats.trendData}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
    <XAxis 
      dataKey="name" 
      axisLine={false} 
      tickLine={false} 
      tick={{fontSize: 10, fill: '#9ca3af'}} 
    />
    <YAxis 
      axisLine={false} 
      tickLine={false} 
      tick={{fontSize: 10, fill: '#9ca3af'}} 
      tickFormatter={(val) => `$${val}`}
    />
    <Tooltip 
      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
    />
    <Legend />
    <Line 
      type="monotone" 
      dataKey="revenue" 
      name="Total Revenue"
      stroke={COLORS.pinkText} 
      strokeWidth={3} 
      dot={{ r: 4, fill: COLORS.pinkText }}
      activeDot={{ r: 6 }} 
    />
    <Line 
      type="monotone" 
      dataKey="cash" 
      name="Cash Revenue"
      stroke={COLORS.greenText} 
      strokeWidth={3} 
      dot={{ r: 4, fill: COLORS.greenText }}
    />
  </LineChart>
</ResponsiveContainer>
         </div>
      </div>

      {/* SECTION 5: UPCOMING APPOINTMENTS */}
{/* SECTION 5: UPCOMING APPOINTMENTS */}
<div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
  <div className="flex justify-between items-center mb-6">
    <h3 className="text-2xl font-serif text-slate-700 font-bold">Upcoming Appointments</h3>
    <div className="flex gap-4 overflow-x-auto pb-2">
      {['All', 'Any Technician', 'Linda', 'TJ', 'Sokleng'].map((tech) => (
        <button 
          key={tech} 
           onClick={() => setSelectedTechFilter(tech)} // <--- CRITICAL LINE
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${selectedTechFilter === tech ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {tech}
        </button>
      ))}
     
    </div>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full text-left">
      <thead>
        <tr className="bg-gray-50 text-[10px] uppercase font-black text-gray-400 tracking-wider">
          <th className="px-6 py-4">Name</th>
          <th className="px-6 py-4">Services</th>
          <th className="px-6 py-4">Technician</th>
          <th className="px-6 py-4">Group</th>
          <th className="px-6 py-4">Date & Time</th>
          <th className="px-6 py-4 text-right">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {dashboardData?.upcomingAppts?.length > 0 ? (
          dashboardData.upcomingAppts.map((appt) => (
            <tr key={appt.id} className="hover:bg-gray-50/50 transition-colors group">
              <td className="px-6 py-5 font-bold text-indigo-600">{appt.name || "Phone Call"}</td>
              <td className="px-6 py-5 text-gray-500 text-sm">{appt.services || "N/A"}</td>
              <td className="px-6 py-5 text-gray-500 text-sm">{appt.technician || "Any Technician"}</td>
              <td className="px-6 py-5 text-gray-500 text-sm">{appt.group || "1"}</td>
              <td className="px-6 py-5 text-gray-500 text-sm">
                {appt.dateObj ? appt.dateObj.toLocaleString('en-US', {
                  month: 'numeric',
                  day: 'numeric',
                  year: '2-digit',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                }) : "N/A"}
              </td>
              <td className="px-6 py-5 text-right">
                <div className="flex items-center justify-end gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </div>
<button 
onClick={async () => {
  try {
    // 1. Prepare the data exactly how your Check-In page expects it
    const queueData = {
      name: appt.name,
      phone: appt.phone || "",
      // Ensure services is an array
      services: Array.isArray(appt.services) ? appt.services : [appt.services || "General Service"],
      technician: appt.technician || "Any Technician",
      groupSize: appt.groupSize || "1",
      bookingType: "Appointment",
      status: "waiting",
      checkInTimestamp: new Date() // Use a standard Date or serverTimestamp()
    };

    // 2. Add the client to the 'active_queue' collection
    // This is what makes them appear in the "Active Queue" tab
    await addDoc(collection(db, "active_queue"), queueData);

    // 3. Update the original appointment status to 'checked-in' 
    // This removes them from your "Upcoming Appointments" list on the Dashboard
    const apptRef = doc(db, "appointments", appt.id);
    await updateDoc(apptRef, { 
      status: "checked-in" 
    });
    
    // 4. Navigate to the Active Queue tab
    router.push('/admin/check-in'); 
  } catch (error) {
    console.error("Error during check-in flow:", error);
    alert("Check-in failed. Please try again.");
  }
}}
  className="text-blue-500 font-bold text-sm hover:underline"
>
  Check In
</button>
                </div>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="6" className="py-20 text-center text-gray-400 italic font-bold">
              No upcoming appointments found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>
{/* SECTION: FILTERED STAFF REPORT TABLE */}
  <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-8">
  <div ref={formRef} className="flex flex-col md:flex-row justify-between items-start mb-2 md:items-centergap-4">
  <h3 className="text-2xl font-black text-gray-800 tracking-tight">
        Staff Earning Report <span className="text-pink-500 ml-2">({filteredStats.clientCount} Clients)</span>
      </h3>
      
    {/* TOTALS ON THE RIGHT */}
    <div className="flex gap-6">
      <div className="text-right">
        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Total Earnings</p>
        <p className="text-2xl font-black text-gray-800">${filteredStats.totalEarnings.toFixed(2)}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black uppercase text-green-600 tracking-widest">Total Tips</p>
        <p className="text-2xl font-black text-green-600">${filteredStats.totalTips.toFixed(2)}</p>
      </div>
    </div>
    </div>
  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end bg-gray-50/50 p-6 rounded-xl border border-gray-100">
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Date</label>
      <input type="date" value={newEarning.date} onChange={e => setNewEarning({...newEarning, date: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none" />
    </div>
    
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Staff Name</label>
      <select value={newEarning.staffName} onChange={e => setNewEarning({...newEarning, staffName: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none">
        <option value="">Select Staff</option>
        {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
      </select>
    </div>

    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Service</label>
      <input placeholder="Service..." value={newEarning.service} onChange={e => setNewEarning({...newEarning, service: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none" />
    </div>

    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Earning ($)</label>
      <input placeholder="0.00" type="number" value={newEarning.earning} onChange={e => setNewEarning({...newEarning, earning: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none" />
    </div>

    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Tip ($)</label>
      <input placeholder="0.00" type="number" value={newEarning.tip} onChange={e => setNewEarning({...newEarning, tip: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none" />
    </div>

    <button onClick={handleAddEarning} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-3.5 rounded-xl transition-all shadow-lg shadow-pink-100 uppercase text-xs tracking-widest">
      Add Report
    </button>
  </div>
  {/* Header & Filters */}
  <div className="pt-5 flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
    {/* Technician Tabs (Left) */}
    <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
      {['All', ...staffList.map(s => s.name)].map(name => (
        <button 
          key={name} 
          onClick={() => setReportFilterTech(name)}
          className={`px-4 py-1.5 rounded-full text-xs font-black uppercase transition-all ${
            reportFilterTech === name ? 'bg-pink-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {name}
        </button>
      ))}
    </div>

    {/* Date Filter (Right) */}
<div className="flex flex-wrap items-end gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
  {/* START DATE */}
  <div className="flex flex-col gap-1">
    <input 
      type="date" 
      value={startDate} 
      onChange={e => setStartDate(e.target.value)} 
      className="bg-white border border-gray-200 rounded-lg text-xs font-bold px-3 py-2 outline-none focus:ring-2 focus:ring-pink-100" 
    />
  </div>

  {/* END DATE */}
  <div className="flex flex-col gap-1">
    <input 
      type="date" 
      value={endDate} 
      onChange={e => setEndDate(e.target.value)} 
      className="bg-white border border-gray-200 rounded-lg text-xs font-bold px-3 py-2 outline-none focus:ring-2 focus:ring-pink-100" 
    />
  </div>

  {/* QUICK FILTERS */}
 <div className="flex gap-2 h-[38px]">
  {/* TODAY BUTTON */}
  <button 
    onClick={() => {
      const localToday = getLocalDate();
      setStartDate(localToday);
      setEndDate(localToday);
    }}
    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
      startDate === getLocalDate() && endDate === getLocalDate()
        ? 'bg-pink-600 text-white shadow-lg shadow-pink-100' // Active Style
        : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50' // Inactive Style
    }`}
  >
    Today
  </button>

  {/* THIS MONTH BUTTON */}
  <button 
    onClick={() => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
      const firstDayStr = firstDay.toISOString().split('T')[0];
      
      setStartDate(firstDayStr);
      setEndDate(getLocalDate());
    }}
    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
      startDate !== getLocalDate() 
        ? 'bg-pink-600 text-white shadow-lg shadow-pink-100' // Active Style
        : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50' // Inactive Style
    }`}
  >
    This Month
  </button>
</div>
</div>
  </div>

  {/* Table */}
  <div className="overflow-x-auto rounded-xl border border-gray-50 bg-white">
    <table className="w-full text-left">
      <thead>
        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
          <th className="px-6 py-4 w-16">No.</th>
          <th className="px-6 py-4">Date</th>
          <th className="px-6 py-4">Staff Name</th>
          <th className="px-6 py-4">Service</th>
          <th className="px-6 py-4">Earning</th>
          <th className="px-6 py-4">Tip</th>
          <th className="px-6 py-4 text-right">Action</th>
        </tr>
      </thead>
<tbody className="divide-y divide-gray-50">
 {(showAllRows ? filteredStats.rows : filteredStats.rows.slice(0, 5)).map((log, index) => (
    <tr key={log.id} className="text-sm font-bold text-gray-600 hover:bg-gray-50/50 transition-colors group">
       <td className="px-6 py-4 text-gray-400">{index + 1}</td>
        <td className="px-6 py-4">{formatDisplayDate(log.dateStr)}</td>
        <td className="px-6 py-4 text-pink-600">{log.staffName}</td>
        <td className="px-6 py-4 text-gray-400 font-normal">{log.service || "N/A"}</td>
        <td className="px-6 py-4">${parseMoney(log.earning).toFixed(2)}</td>
        <td className="px-6 py-4 text-green-600">${parseMoney(log.tip).toFixed(2)}</td>
        <td className="px-6 py-4 text-right">
          <div className="flex justify-end gap-3  group-hover:opacity-100 transition-opacity">
            {/* EDIT ICON */}
            <button 
              onClick={() => {
                setNewEarning({
                  date: log.dateStr,
                  staffName: log.staffName,
                  service: log.service || "",
                  earning: log.earning,
                  tip: log.tip
                });
                formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
              title="Edit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>

            {/* DELETE ICON */}
            <button 
              onClick={async () => {
                if (confirm(`Delete entry for ${log.staffName}?`)) {
                  try {
                    await deleteDoc(doc(db, "earnings", log.id));
                    // Optional: You may want to subtract the amount from salon_earnings summary here
                  } catch (e) {
                    alert("Error deleting: " + e.message);
                  }
                }
              }}
              className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    ))}
</tbody>

      {/* Table Footer with Totals */}
      <tfoot className="bg-gray-50/50 font-black text-gray-700">
        <tr>
          <td colSpan={4} className="px-6 py-4 text-right uppercase text-[10px] text-gray-400">Filtered Total:</td>
          <td className="px-6 py-4 text-pink-600">
            {/* SUM EARNINGS */}
   ${serviceLogs
  .filter(log => 
    log.dateStr >= startDate && 
    log.dateStr <= endDate && 
    (reportFilterTech === 'All' || log.staffName === reportFilterTech)
  )
  .reduce((sum, log) => sum + parseMoney(log.earning), 0)
  .toFixed(2)}
             </td>
          <td className="px-6 py-4 text-green-600">
           {/* SUM TIPS */}
   ${serviceLogs
  .filter(log => 
    log.dateStr >= startDate && 
    log.dateStr <= endDate && 
    (reportFilterTech === 'All' || log.staffName === reportFilterTech)
  )
  .reduce((sum, log) => sum + parseMoney(log.tip), 0)
  .toFixed(2)}
          </td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>
  {filteredStats.rows.length > 5 && (
        <div className="p-4 border-t border-gray-50 bg-gray-50/30 flex justify-center rounded-b-xl">
          <button 
            onClick={() => setShowAllRows(!showAllRows)}
            className="text-[10px] font-black uppercase text-pink-600 hover:text-pink-700 tracking-widest flex items-center gap-2"
          >
            {showAllRows ? (
              <>
                <span>Show Less</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                <span>View All ({filteredStats.rows.length} Records)</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
</div>
    </div>
  );
}

// --- SUB COMPONENTS ---

function PastelCard({ label, value, bg, text, isText = false }) {
    return (
        <div style={{ backgroundColor: bg }} className="p-6 rounded-xl flex flex-col justify-center min-h-[120px]">
            <span style={{ color: text }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">{label}</span>
            <span style={{ color: text }} className={`font-black ${isText ? 'text-xl' : 'text-3xl'} tracking-tight`}>{value}</span>
        </div>
    );
}

function PayoutRow({ label, value }) {
    return (
        <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 border-b border-gray-100 last:border-0 py-1">
            <span>{label}:</span>
            <span className="font-black text-gray-700">${value.toFixed(2)}</span>
        </div>
    );
}