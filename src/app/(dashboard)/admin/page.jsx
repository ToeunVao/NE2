"use client";
import { useState, useEffect, useMemo, useRef  } from "react";
import { useRouter } from "next/navigation"; // Add this line
import { db } from "@/lib/firebase";
import ClientProfileModal from "@/components/ClientProfileModal";
import { 
  collection, onSnapshot, query, orderBy, where, 
  doc, updateDoc, addDoc, setDoc, deleteDoc, Timestamp, collectionGroup, serverTimestamp 
} from "firebase/firestore";
import { Calendar } from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  BarChart, // Keep these if you are still using BarCharts elsewhere
  Bar,
  Cell
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
  const [selectedClientProfile, setSelectedClientProfile] = useState(null);
  const [finishedClients, setFinishedClients] = useState([]);
  useEffect(() => {
  // Fetch Finished Clients so the Profile Modal can show history
  const unsubFinished = onSnapshot(collection(db, "finished_clients"), (snap) => {
    const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setFinishedClients(docs);
  });

  return () => unsubFinished();
}, []);

// 1. Move the helper function INSIDE the component at the very top
const getLocalDate = () => {
  return new Date().toLocaleDateString('en-CA');
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
  const [isOverviewMenuOpen, setIsOverviewMenuOpen] = useState(false);
const formRef = useRef(null);
const [showAllRows, setShowAllRows] = useState(false);
  // --- NEW STATES FOR FILTERED TABLE ---
  const [serviceLogs, setServiceLogs] = useState([]); // Raw logs from Firestore
  const [reportFilterTech, setReportFilterTech] = useState('All'); // Technician Tab
const [liveExpenses, setLiveExpenses] = useState([]); // NEW: Store data from expenses collection

const todayStr = getLocalDate(); // This will correctly return 2026-01-16
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${month}/${day}/${year}`;
};

const [startDate, setStartDate] = useState(todayStr);
const [endDate, setEndDate] = useState(todayStr);
// --- NEW STATES FOR DROPDOWN MENU ---
const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
const [activeFilter, setActiveFilter] = useState("today");

const getDefaultDailyDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
// ------------------------------------
const [newEarning, setNewEarning] = useState({
  id: null, // NEW: Tracks if we are editing
  date: getLocalDate(),
  staffName: "TJ",
  service: "",
  earning: "",
  oldEarningAmount: 0, // NEW: Tracks the old amount to fix the daily totals
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
const [giftCards, setGiftCards] = useState([]); // NEW: Store online gift cards
const [selectedTechFilter, setSelectedTechFilter] = useState('All'); // Add this!
  // --- 1. SYNC DATABASE ---
const overviewStats = useMemo(() => {
  const filteredReports = earningsData.filter(r => r.id >= overviewStart && r.id <= overviewEnd);
  const filteredLogs = serviceLogs.filter(log => log.dateStr >= overviewStart && log.dateStr <= overviewEnd);

  let totalEarnings = 0;
  let totalCash = 0;
  let totalGiftCard = 0;
  let totalExpense = 0;
  const dailyDataMap = {}; 

// 2. ADD MANUAL REPORTS (Now using 'filteredReports' which is defined above)
  filteredReports.forEach(report => {
    // This adds product + supply from the manual end-of-day entry
    totalExpense += (parseMoney(report.product) + parseMoney(report.supply));
    
    // Also check for a specific 'totalExpense' field if your manual reports use one
    if(report.totalExpense) {
       totalExpense += parseMoney(report.totalExpense);
    }
  });

  // 3. ADD LIVE EXPENSES (The $3716.70 from the expense page)
const filteredLiveEx = liveExpenses.filter(ex => {
  const d = String(ex.dateStr || "");
  return d >= overviewStart && d <= overviewEnd;
});

filteredLiveEx.forEach(ex => {
  // Use Number() to ensure it doesn't treat it as text
  totalExpense += Number(ex.amount || 0);
});

  // --- NEW: Calculate Online Gift Cards ---
  const filteredGCs = giftCards.filter(gc => gc.dateStr >= overviewStart && gc.dateStr <= overviewEnd);
  filteredGCs.forEach(gc => {
    // Uses 'amount' which matches your page.js save logic
    totalGiftCard += parseMoney(gc.amount || gc.balance); 
  });

  // 1. Calculate Revenue from individual logs
  filteredLogs.forEach(log => {
    const money = parseMoney(log.earning);
    totalEarnings += money;
    
    if (!dailyDataMap[log.dateStr]) {
      dailyDataMap[log.dateStr] = { name: formatDisplayDate(log.dateStr), revenue: 0, cash: 0 };
    }
    dailyDataMap[log.dateStr].revenue += money;
  });

  // 2. Calculate Cash/Expenses from daily reports
  filteredReports.forEach(report => {
    totalGiftCard += parseMoney(report.sellGiftCard);
    totalExpense += (parseMoney(report.product) + parseMoney(report.supply));
    
    let dailyTechSum = 0;
    staffList.forEach(s => dailyTechSum += parseMoney(report[s.name.toLowerCase().trim()]));
    const dailyTotal = dailyTechSum + parseMoney(report.sellGiftCard);
    const nonCash = parseMoney(report.totalCredit) + parseMoney(report.check) + 
                    parseMoney(report.venmo) + parseMoney(report.square);
    const dailyCashValue = (dailyTotal - nonCash);
    totalCash += dailyCashValue;

    if (dailyDataMap[report.id]) {
      dailyDataMap[report.id].cash = dailyCashValue;
    }
  });

  // 3. THE FIX: Staff Performance with Dynamic Commission
  const staffPerformance = staffList
    .filter(staff => staff.role === "technician" || staff.role === "staff")
    .map((staff, index) => {
      const staffNameKey = staff.name.toLowerCase().trim();
      let staffRevenue = 0;
      
      // Sum revenue for this specific staff within the date range
      filteredLogs
        .filter(log => (log.staffName || "").toLowerCase().trim() === staffNameKey)
        .forEach(log => staffRevenue += parseMoney(log.earning));

      // Get Commission Rate (Check multiple fields to be safe)
      const rawComm = parseFloat(staff.commission || staff.comm || 60);
      const commRate = rawComm / 100;
      
      const rawCheckSplit = parseFloat(staff.checkPayout) || 70;
      const checkRate = rawCheckSplit / 100;

      // Sum Tips from logs
      const staffTips = filteredLogs
        .filter(log => (log.staffName || "").toLowerCase().trim() === staffNameKey)
        .reduce((sum, log) => sum + parseMoney(log.tip), 0);

      const totalPayout = staffRevenue * commRate;
      const checkPayoutValue = totalPayout * checkRate;
      let cashPayoutValue = totalPayout * (1 - checkRate);

      const isCommPlusTips = staff.payoutType === "Commission + Tips";
      if (isCommPlusTips) {
        cashPayoutValue += staffTips;
      }

      return {
        name: staff.name,
        revenue: staffRevenue,
        payout: totalPayout,
        checkPayout: checkPayoutValue,
        cashPayout: cashPayoutValue,
        tips: staffTips,
        checkRate: rawCheckSplit.toFixed(0),
        commRateDisplay: rawComm.toFixed(0), // <--- This fixes the 'undefined%'
        isCommPlusTips: isCommPlusTips,
        color: STAFF_BAR_COLORS[index % STAFF_BAR_COLORS.length]
      };
    }).sort((a, b) => b.revenue - a.revenue);
// --- NEW: CALCULATE TOP BOOKING (MOST CLIENTS) ---
let clientCounts = {};
  filteredLogs.forEach(log => {
    const staff = (log.staffName || "Unknown").trim();
    clientCounts[staff] = (clientCounts[staff] || 0) + 1;
  });

  let topBookingName = "N/A";
  let topBookingCount = 0;
  
  Object.entries(clientCounts).forEach(([name, count]) => {
    if (count > topBookingCount) {
      topBookingCount = count;
      topBookingName = name; // Just the name here
    }
  });
  // ------------------------------------------------
  return { 
    totalEarnings, totalCash, totalGiftCard, totalExpense, 
    topEarnerName: staffPerformance[0]?.name || "N/A", 
    topBookingName,
    topBookingCount,
    staffPerformance, 
    trendData: Object.keys(dailyDataMap).sort().map(k => dailyDataMap[k]),
    clientCount: filteredLogs.length,
    liveAppointmentCount: appointments.filter(appt => {
      if (!appt.dateObj) return false;
      const dStr = appt.dateObj.toISOString().split('T')[0];
      return dStr >= overviewStart && dStr <= overviewEnd;
    }).length
  };
}, [serviceLogs, earningsData, staffList, overviewStart, overviewEnd, appointments]);

useEffect(() => {
  //console.log("--- STARTING FIREBASE SYNC ---");
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
// 4. Point directly to "gift_cards"
  const unsubGiftCards = onSnapshot(collection(db, "gift_cards"), (snap) => {
    const cards = snap.docs.map(doc => {
      const data = doc.data();
      let dStr = "";
      // Safely extract the date string (YYYY-MM-DD) from the createdAt timestamp
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        dStr = data.createdAt.toDate().toISOString().split('T')[0];
      } else if (data.createdAt) {
        dStr = new Date(data.createdAt).toISOString().split('T')[0];
      }
      return { id: doc.id, ...data, dateStr: dStr };
    });
    setGiftCards(cards);
  });

  // --- STEP 2: FETCH LIVE EXPENSES ---
// Change 'collectionGroup' to 'collection' to target the top-level "expenses" folder
const unsubLiveExpenses = onSnapshot(collection(db, "expenses"), (snap) => {
  const exData = snap.docs.map(doc => {
    const data = doc.data();
    // Use the same date logic as your MonthlyExpensePage
    let dStr = "";
    if (data.date) {
      dStr = typeof data.date === 'string' ? data.date : new Date(data.date.seconds * 1000).toISOString().split('T')[0];
    }
    return { id: doc.id, ...data, dateStr: dStr };
  });
  setLiveExpenses(exData);
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

 return () => { unsubEarnings(); unsubStaff(); unsubAppts(); unsubFinished(); unsubLogs(); unsubGiftCards(); unsubLiveExpenses(); };
}, []);
// --- SUBMISSION LOGIC ---
const handleAddEarning = async () => {
  if (!newEarning.staffName || !newEarning.earning) return alert("Select staff and amount");
  
  try {
    const dateObject = new Date(newEarning.date + 'T12:00:00');
    const earningVal = parseMoney(newEarning.earning);
    const tipVal = parseMoney(newEarning.tip);

    const [y, m, d] = newEarning.date.split('-');
    const docId = `${y}-${parseInt(m)}-${parseInt(d)}`; 
    const staffKey = newEarning.staffName.toLowerCase().trim();
    
    const currentReport = earningsData.find(r => r.id === docId);
    const prevVal = parseMoney(currentReport?.[staffKey]);

    if (newEarning.id) {
      // --- EDIT MODE ---
      // 1. Update the individual log
      await updateDoc(doc(db, "earnings", newEarning.id), {
        staffName: newEarning.staffName,
        service: newEarning.service,
        earning: earningVal,
        tip: tipVal,
        date: Timestamp.fromDate(dateObject)
      });

      // 2. Adjust the daily total by the *difference*
      const oldEarningVal = parseMoney(newEarning.oldEarningAmount || 0);
      const difference = earningVal - oldEarningVal;

      await setDoc(doc(db, "salon_earnings", docId), { 
        [staffKey]: prevVal + difference 
      }, { merge: true });

    } else {
      // --- ADD MODE ---
      // 1. Create new log
      await addDoc(collection(db, "earnings"), {
        staffName: newEarning.staffName,
        service: newEarning.service,
        earning: earningVal,
        tip: tipVal,
        date: Timestamp.fromDate(dateObject),
        createdAt: serverTimestamp() // NEW: Allows us to sort by latest input!
      });

      // 2. Add to daily total
      await setDoc(doc(db, "salon_earnings", docId), { 
        [staffKey]: prevVal + earningVal 
      }, { merge: true });
    }

   // Reset Form - Keep Date and Staff Name for faster entry
    setNewEarning(prev => ({
      id: null,
      date: prev.date,           // Keeps the date you just used
      staffName: prev.staffName, // Keeps the person you just picked
      service: "",               // Clears the service
      earning: "",               // Clears the money
      oldEarningAmount: 0,
      tip: ""                    // Clears the tip
    }));
  } catch (e) {
    console.error("Firebase Error:", e);
  }
};
  
const dashboardData = useMemo(() => {
  if (!staffList || !earningsData) return null;

  // 1. FILTERING REPORTS BY SELECTED MONTH
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
    
// 1. Add manual ones (Changed name to monthReports)
  monthReports.forEach(report => {
    totalExpense += (parseMoney(report.product) + parseMoney(report.supply));
    if(report.totalExpense) totalExpense += parseMoney(report.totalExpense);
  });

  // 2. Add live ones from the expense page
  const monthLiveEx = liveExpenses.filter(ex => {
    const d = String(ex.dateStr || ex.date || "");
    return d && d.startsWith(selectedMonth);
  });

  monthLiveEx.forEach(ex => {
    totalExpense += Number(ex.amount || 0);
  });

// --- NEW: Calculate Monthly Online Gift Cards ---
  const monthGCs = giftCards.filter(gc => gc.dateStr && gc.dateStr.startsWith(selectedMonth));
  monthGCs.forEach(gc => {
    totalGiftCard += parseMoney(gc.amount || gc.balance);
  });

  monthReports.forEach(report => {
    let dailyTechSum = 0;
    staffList.forEach(staff => {
      const key = staff.name.toLowerCase().trim();
      dailyTechSum += parseMoney(report[key]);
    });
    
    const gc = parseMoney(report.sellGiftCard);
    const dailyTotal = dailyTechSum + gc;
    totalRevenue += dailyTotal;
    totalGiftCard += gc;
    
    const clientValue = report.totalClients || report.clients || report.customerCount || 0;
    totalClients += parseMoney(clientValue);
    totalExpense += (parseMoney(report.product) + parseMoney(report.supply));

    const nonCash = parseMoney(report.totalCredit) + parseMoney(report.check) + 
                    parseMoney(report.venmo) + parseMoney(report.square);
    totalCash += (dailyTotal - nonCash);
  });

  // 3. STAFF PERFORMANCE (FIXED COMMISSION LOGIC)
  const staffPerformance = staffList
    .filter(staff => staff.role === "technician" || staff.role === "staff")
    .map((staff, index) => {
      const staffNameKey = staff.name.toLowerCase().trim(); 
      let staffRevenue = 0;
      
      monthReports.forEach(report => {
        staffRevenue += parseMoney(report[staffNameKey]);
      });

      // THE FIX: Correctly check for commission under any field name
      const commissionValue = staff.commission || staff.comm || staff.commissionRate || 60;
      const rawComm = parseFloat(commissionValue);
      const commRate = rawComm / 100; 
      
      const rawCheckSplit = parseFloat(staff.checkPayout) || 70;
      const checkRate = rawCheckSplit / 100;
      const cashRate = 1 - checkRate;

      // Get Tips from logs
      const staffTips = serviceLogs
        .filter(log => {
          const isNameMatch = (log.staffName || "").toLowerCase().trim() === staffNameKey;
          const isMonthMatch = (log.dateStr || "").startsWith(selectedMonth);
          return isNameMatch && isMonthMatch;
        })
        .reduce((sum, log) => sum + parseMoney(log.tip), 0);

      const totalPayout = staffRevenue * commRate;
      const checkPayoutValue = totalPayout * checkRate;
      let cashPayoutValue = totalPayout * cashRate;

      const isCommPlusTips = staff.payoutType === "Commission + Tips";
      if (isCommPlusTips) {
        cashPayoutValue += staffTips;
      }

      return {
        name: staff.name,
        revenue: staffRevenue,
        payout: totalPayout,
        checkPayout: checkPayoutValue,
        cashPayout: cashPayoutValue,
        // ENSURE THIS NAME MATCHES WHAT YOUR UI USES
        commRateDisplay: rawComm.toFixed(0), 
        isCommPlusTips: isCommPlusTips,
        color: STAFF_BAR_COLORS[index % STAFF_BAR_COLORS.length]
      };
    }).sort((a, b) => b.revenue - a.revenue);

  // 4. TREND DATA & APPOINTMENTS (Remaining logic)
  const [year, month] = selectedMonth.split('-');
  const daysInMonth = new Date(year, month, 0).getDate();
  
  const trendData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const idA = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    const report = monthReports.find(r => r.id === idA);
    let dailyRev = 0;
    let dailyCash = 0;

    if (report) {
      staffList.forEach(s => dailyRev += parseMoney(report[s.name.toLowerCase().trim()]));
      dailyRev += parseMoney(report.sellGiftCard);
      const nonCash = parseMoney(report.totalCredit) + parseMoney(report.check) + 
                      parseMoney(report.venmo) + parseMoney(report.square);
      dailyCash = dailyRev - nonCash;
    }
    return { day, "Total Revenue": dailyRev, "Cash Revenue": dailyCash };
  });

  const monthAppts = (appointments || []).filter(appt => {
      if (!appt.dateObj) return false;
      const apptYear = appt.dateObj.getFullYear();
      const apptMonth = (appt.dateObj.getMonth() + 1).toString().padStart(2, '0');
      return `${apptYear}-${apptMonth}` === selectedMonth;
  });

  const uniqueBookings = new Set(appointments.map(appt => appt.phone || appt.name?.toLowerCase().trim()));
  const systemTotalClients = finishedCount + uniqueBookings.size;

  return {
    totals: { 
      totalRevenue, totalCash, totalClients: systemTotalClients, 
      totalGiftCard, totalExpense, 
      topEarnerName: staffPerformance[0]?.name || "-",
      topBookingName: "-" // Can be calculated similar to before
    },
    staffPerformance,
    trendData, 
   // ... inside the return of dashboardData ...
upcomingAppts: (appointments || [])
  .filter(appt => {
    if (!appt.dateObj) return false;
    
    // 1. Get Today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. Filter: Future or Today AND status is not 'checked-in' or 'completed'
    const isUpcoming = appt.dateObj >= today;
    const isPending = appt.status !== "checked-in" && appt.status !== "completed";
    
    // 3. Technician Filter
    const isTechMatch = selectedTechFilter === 'All' || 
                        appt.technician === selectedTechFilter || 
                        (selectedTechFilter === 'Any Technician' && !appt.technician);

    return isUpcoming && isPending && isTechMatch;
  })
  .sort((a, b) => a.dateObj - b.dateObj) // Closest time first
  .slice(0, 10), // Limit to top 10
    dailyReports: [] 
  };
}, [selectedMonth, earningsData, staffList, appointments, selectedTechFilter, finishedCount, serviceLogs]);

const filteredStats = useMemo(() => {
  let filtered = serviceLogs.filter(log => {
    const isWithinRange = log.dateStr >= startDate && log.dateStr <= endDate;
    const isTechMatch = reportFilterTech === 'All' || log.staffName === reportFilterTech;
    return isWithinRange && isTechMatch;
  });

  // --- NEW: SORT BY LATEST FIRST ---
  filtered.sort((a, b) => {
    // 1. Sort by Date String (Newest Day First)
    if (a.dateStr > b.dateStr) return -1;
    if (a.dateStr < b.dateStr) return 1;
    
    // 2. Sort by exact input time (Latest input on top for the same day)
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return timeB - timeA;
  });

  return {
    totalEarnings: filtered.reduce((sum, log) => sum + parseMoney(log.earning), 0),
    totalTips: filtered.reduce((sum, log) => sum + parseMoney(log.tip), 0),
    clientCount: filtered.length,
    rows: filtered
  };
}, [serviceLogs, startDate, endDate, reportFilterTech]);



// if (loading || !dashboardData) return <div className="p-20 text-center font-black text-gray-300 tracking-widest uppercase">Loading Data...</div>;

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
    <h2 className="text-lg font-black text-gray-800 dark:text-white">Business Overview</h2>
    <p className="text-xs text-gray-400 font-bold uppercase">Performance Metrics</p>
  </div>

{/* DATE PICKER FOR CARDS/GRAPH - NEW DROPDOWN STYLE */}
<div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-gray-100 shadow-sm dark:bg-slate-900/80 dark:border-slate-800 dark:text-white relative">
  <div className="flex items-center gap-2">
    <div className="relative">
      <button 
        onClick={() => setIsOverviewMenuOpen(!isOverviewMenuOpen)}
        className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-black uppercase text-gray-700 dark:text-white shadow-sm"
      >
        <Calendar size={14} className="text-pink-500" />
        {overviewStart === overviewEnd 
          ? `Daily: ${formatDisplayDate(overviewStart)}` 
          : `Range: ${formatDisplayDate(overviewStart)} - ${formatDisplayDate(overviewEnd)}`}
      </button>

      {isOverviewMenuOpen && (
        <>
          {/* BACKDROP */}
          <div 
            className="fixed inset-0 z-[40]" 
            onClick={() => setIsOverviewMenuOpen(false)}
          />

          {/* MENU BOX */}
          <div className="absolute left-0 top-12 w-[300px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-2xl p-5 z-[50]">
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 tracking-widest">
              Pick a Date (Daily)
            </label>
            <input 
              type="date" 
              value={overviewStart === overviewEnd ? overviewStart : getDefaultDailyDate()}
              onChange={(e) => {
                const newDate = e.target.value;
                setOverviewStart(newDate);
                setOverviewEnd(newDate);
              }}
              className="w-full bg-gray-50 dark:bg-slate-950 dark:text-white border border-gray-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-bold mb-4 outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer"
            />

            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 tracking-widest">
              Or Custom Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase">From</span>
                <input 
                  type="date" 
                  value={overviewStart} 
                  onChange={e => setOverviewStart(e.target.value)} 
                  className="w-full text-[10px] p-2 border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white rounded-lg outline-none" 
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase">To</span>
                <input 
                  type="date" 
                  value={overviewEnd} 
                  onChange={e => setOverviewEnd(e.target.value)} 
                  className="w-full text-[10px] p-2 border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white rounded-lg outline-none" 
                />
              </div>
            </div>
            
            <button 
              onClick={() => setIsOverviewMenuOpen(false)}
              className="w-full mt-5 bg-pink-600 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl hover:bg-pink-700 transition-colors"
            >
              Apply Filter
            </button>
          </div>
        </>
      )}
    </div>
  </div>
  
  {/* SHORTCUT BUTTONS */}
  <div className="flex gap-1 pl-2 border-l border-gray-100 dark:border-slate-800">
    <button 
      onClick={() => { setOverviewStart(getLocalDate()); setOverviewEnd(getLocalDate()); }}
      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
        overviewStart === overviewEnd && overviewStart === getLocalDate() 
        ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30 dark:bg-pink-500' 
        : 'dark:bg-slate-950 dark:text-white bg-gray-100 text-gray-400 hover:bg-gray-200'
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
      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
        overviewStart === getMonthDefaults().firstDay && overviewEnd === getMonthDefaults().today
        ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30 dark:bg-pink-500' 
        : 'dark:bg-slate-950 dark:text-white bg-gray-100 text-gray-400 hover:bg-gray-200'
      }`}
    >
      This Month
    </button>
  </div>
</div>
</div>

{/* ROW 1: PRIMARY BUSINESS STATS */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
  
  {/* TOTAL REVENUE - PINK */}
  <div style={{ backgroundColor: COLORS.pink }} className="relative overflow-hidden p-6 rounded-xl flex flex-col justify-center min-h-[110px] shadow-sm transition-all group">
    <div className="relative z-10">
      <p style={{ color: COLORS.pinkText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Total Revenue</p>
      <h3 style={{ color: COLORS.pinkText }} className="font-black text-2xl tracking-tight leading-none">${overviewStats.totalEarnings.toFixed(2)}</h3>
    </div>
    {/* Background Icon */}
    <div style={{ color: COLORS.pinkText }} className="absolute -right-2 -bottom-4 opacity-15 text-6xl transform -rotate-12 pointer-events-none">
       <i className="fas fa-dollar-sign"></i>
    </div>
  </div>

  {/* TOTAL CASH - GREEN */}
  <div style={{ backgroundColor: COLORS.green }} className="relative overflow-hidden p-6 rounded-xl flex flex-col justify-center min-h-[110px] shadow-sm transition-all group">
    <div className="relative z-10">
      <p style={{ color: COLORS.greenText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Total Cash</p>
      <h3 style={{ color: COLORS.greenText }} className="font-black text-2xl tracking-tight leading-none">${overviewStats.totalCash.toFixed(2)}</h3>
    </div>
    {/* Background Icon */}
    <div style={{ color: COLORS.greenText }} className="absolute -right-2 -bottom-4 opacity-15 text-6xl transform -rotate-12 pointer-events-none">
       <i className="fas fa-money-bill-wave"></i>
    </div>
  </div>

  {/* TOP EARNER - BLUE */}
  <div style={{ backgroundColor: COLORS.blue }} className="relative overflow-hidden p-6 rounded-xl flex flex-col justify-center min-h-[110px] shadow-sm transition-all group">
    <div className="relative z-10">
      <p style={{ color: COLORS.blueText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Top Earner</p>
      <h3 style={{ color: COLORS.blueText }} className="text-xl font-black tracking-tight leading-none truncate max-w-[140px]">{overviewStats.topEarnerName}</h3>
    </div>
    {/* Background Icon */}
    <div style={{ color: COLORS.blueText }} className="absolute -right-1 -bottom-3 opacity-15 text-5xl transform -rotate-12 pointer-events-none">
       <i className="fas fa-trophy"></i>
    </div>
  </div>

  {/* TOP BOOKING - PURPLE */}
  <div style={{ backgroundColor: COLORS.purple }} className="relative overflow-hidden p-6 rounded-xl flex flex-col justify-center min-h-[110px] shadow-sm transition-all group">
    <div className="relative z-10">
      <p style={{ color: COLORS.purpleText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Top Clients</p>
      <div className="flex items-baseline gap-2">
        <h3 style={{ color: COLORS.purpleText }} className="text-xl font-black tracking-tight leading-none truncate">{overviewStats.topBookingName}</h3>
        <span className="text-purple-500 text-[10px] font-bold uppercase whitespace-nowrap">
          ({overviewStats.topBookingCount} clients)
        </span>
      </div>
    </div>
    {/* Background Icon */}
    <div style={{ color: COLORS.purpleText }} className="absolute -right-2 -bottom-4 opacity-15 text-6xl transform -rotate-12 pointer-events-none">
       <i className="fas fa-user-check"></i>
    </div>
  </div>
</div>

{/* ROW 2: OPERATIONAL STATS */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
  
  {/* APPOINTMENTS - PERIWINKLE */}
  <div style={{ backgroundColor: COLORS.periwinkle }} className="relative overflow-hidden p-6 rounded-xl flex flex-col justify-center min-h-[110px] shadow-sm transition-all group">
    <div className="relative z-10">
      <p style={{ color: COLORS.periwinkleText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
        Live Appointments
      </p>
      <h3 style={{ color: COLORS.periwinkleText }} className="text-2xl font-black tracking-tight leading-none">
        {overviewStats.liveAppointmentCount}
      </h3>
    </div>
    {/* Background Icon */}
    <div style={{ color: COLORS.periwinkleText }} className="absolute -right-2 -bottom-4 opacity-15 text-6xl transform -rotate-12 pointer-events-none">
      <i className="fas fa-calendar-check"></i>
    </div>
  </div>

  {/* CLIENTS - MINT */}
  <div style={{ backgroundColor: COLORS.mint }} className="relative overflow-hidden p-6 rounded-xl flex flex-col justify-center min-h-[110px] shadow-sm transition-all group">
    <div className="relative z-10">
      <p style={{ color: COLORS.mintText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
        Total Clients
      </p>
      <h3 style={{ color: COLORS.mintText }} className="text-2xl font-black tracking-tight leading-none">
        {overviewStats.clientCount}
      </h3>
    </div>
    {/* Background Icon */}
    <div style={{ color: COLORS.mintText }} className="absolute -right-2 -bottom-4 opacity-15 text-6xl transform -rotate-12 pointer-events-none">
      <i className="fas fa-users"></i>
    </div>
  </div>

  {/* GIFT CARDS - ORANGE */}
  <div style={{ backgroundColor: COLORS.orange }} className="relative overflow-hidden p-6 rounded-xl flex flex-col justify-center min-h-[110px] shadow-sm transition-all group">
    <div className="relative z-10">
      <p style={{ color: COLORS.orangeText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
        Gift Cards
      </p>
      <h3 style={{ color: COLORS.orangeText }} className="text-2xl font-black tracking-tight leading-none">
        ${overviewStats.totalGiftCard.toFixed(2)}
      </h3>
    </div>
    {/* Background Icon */}
    <div style={{ color: COLORS.orangeText }} className="absolute -right-2 -bottom-4 opacity-15 text-6xl transform -rotate-12 pointer-events-none">
      <i className="fas fa-ticket-alt"></i>
    </div>
  </div>

  {/* EXPENSES - RED */}
  <div style={{ backgroundColor: COLORS.red }} className="relative overflow-hidden p-6 rounded-xl flex flex-col justify-center min-h-[110px] shadow-sm transition-all group">
    <div className="relative z-10">
      <p style={{ color: COLORS.redText }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
        Expenses
      </p>
      <h3 style={{ color: COLORS.redText }} className="text-2xl font-black tracking-tight leading-none">
        ${overviewStats.totalExpense.toFixed(2)}
      </h3>
    </div>
    {/* Background Icon */}
    <div style={{ color: COLORS.redText }} className="absolute -right-2 -bottom-4 opacity-15 text-6xl transform -rotate-12 pointer-events-none">
      <i className="fas fa-file-invoice-dollar"></i>
    </div>
  </div>

</div>

      {/* SECTION 3: STAFF EARNINGS SUMMARY (Cards + Chart) */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
        <h3 className="dark:bg-slate-950 dark:text-white text-xl font-black text-gray-700 italic mb-6 bg-gray-100 inline-block px-4 py-1 rounded-lg">Staff Earnings Summary</h3>
        
        {/* Staff Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-10">
            {/* Change staffPerformance.map to overviewStats.staffPerformance.map */}
{overviewStats.staffPerformance.map((staff, idx) => (
  <div 
    key={idx} 
    className="p-5 rounded-xl border border-gray-50 dark:border-slate-800 relative overflow-hidden transition-transform hover:scale-[1.02]" 
    style={{backgroundColor: `${staff.color}15` || '#f8fafc'}}
  >
    {/* --- RANK BADGE (Top Right) --- */}
    <div className="absolute top-3 right-3 flex items-center justify-center">
      <div className={`
        w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shadow-sm border
        ${idx === 0 ? 'bg-yellow-400 border-yellow-500 text-yellow-900 scale-110' : 
          idx === 1 ? 'bg-slate-300 border-slate-400 text-slate-700' : 
          idx === 2 ? 'bg-orange-300 border-orange-400 text-orange-900' : 
          'bg-white/50 border-gray-200 text-gray-400 dark:bg-slate-800 dark:border-slate-700'}
      `}>
        {idx + 1}
      </div>
    </div>

    <h4 className="text-sm font-black mb-1 pr-8" style={{color: staff.color}}>{staff.name}</h4>
    <p className="text-xl font-black text-gray-800 mb-4 dark:text-white">${staff.revenue.toFixed(2)}</p>
    
    <div className="space-y-1 dark:text-white">
      <PayoutRow 
        label={`Total Payout (${staff.commRateDisplay}%)`} 
        value={staff.payout} 
      />
      <PayoutRow 
  label={
    <span>
      Check <span className="opacity-60 font-medium">({staff.checkRate}%)</span>
    </span>
  } 
  value={staff.checkPayout} 
/>
      <PayoutRow label="Cash" value={staff.cashPayout} />
      {/* --- NEW: TIPS ROW --- */}
  <div className="pt-1 mt-1 border-t border-dashed border-gray-200 dark:border-slate-700">
    <PayoutRow 
      label="Total Tips" 
      value={staff.tips} 
    />
  </div>
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
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
         <h3 className="text-xl font-black text-gray-700 italic mb-6">Salon Revenue Trend</h3>
      <div className="h-[300px] w-full">
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={overviewStats.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
      <defs>
        {/* Pink Gradient for Total Revenue */}
        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={COLORS.pinkText} stopOpacity={0.3} />
          <stop offset="95%" stopColor={COLORS.pinkText} stopOpacity={0} />
        </linearGradient>
        {/* Green Gradient for Cash */}
        <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={COLORS.greenText} stopOpacity={0.3} />
          <stop offset="95%" stopColor={COLORS.greenText} stopOpacity={0} />
        </linearGradient>
      </defs>
      
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
      
      <XAxis 
        dataKey="name" 
        axisLine={false} 
        tickLine={false} 
        tick={{fontSize: 10, fontWeight: 700, fill: '#9ca3af'}} 
        dy={10}
      />
      
      <YAxis 
        axisLine={false} 
        tickLine={false} 
        tick={{fontSize: 10, fontWeight: 700, fill: '#9ca3af'}} 
        tickFormatter={(val) => `$${val}`}
      />
      
      <Tooltip 
        contentStyle={{
          borderRadius: '12px', // Matches your rounded-xl feel
          border: 'none', 
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          fontSize: '11px',
          fontWeight: 'bold'
        }}
      />
      
      <Area 
        type="monotone" 
        dataKey="revenue" 
        name="Total Revenue"
        stroke={COLORS.pinkText} 
        strokeWidth={4} 
        fillOpacity={1} 
        fill="url(#colorRevenue)" 
        activeDot={{ r: 6, strokeWidth: 0 }}
      />
      
      <Area 
        type="monotone" 
        dataKey="cash" 
        name="Cash Revenue"
        stroke={COLORS.greenText} 
        strokeWidth={4} 
        fillOpacity={1} 
        fill="url(#colorCash)" 
      />
    </AreaChart>
  </ResponsiveContainer>
</div>
      </div>

      {/* SECTION 5: UPCOMING APPOINTMENTS */}
{/* SECTION 5: UPCOMING APPOINTMENTS */}
<div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
  <div className="flex justify-between items-center mb-6">
    <h3 className="text-xl font-serif text-slate-700 font-bold">Upcoming Appointments</h3>
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
       {upcomingAppts.length > 0 ? (
    upcomingAppts.map((appt) => (
            <tr key={appt.id} className="hover:bg-gray-50/50 transition-colors group">
              <td className="px-6 py-5 font-bold text-indigo-600"><span 
  onClick={() => setSelectedClientProfile(appt)} 
  className="font-bold text-indigo-600 cursor-pointer hover:text-pink-600 hover:underline transition-all"
>{appt.name || "Phone Call"} </span></td>
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
                   <span 
  onClick={() => setSelectedClientProfile(appt)} 
  className="font-bold text-indigo-600 cursor-pointer hover:text-pink-600 hover:underline transition-all"
> <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span>
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
  <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 mb-8 dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
  <div ref={formRef} className="flex flex-col md:flex-row justify-between items-start mb-2 md:items-centergap-4">
  <h3 className="text-xl dark:text-white font-black text-gray-800 tracking-tight">
        Staff Earning Report <span className="text-pink-500 ml-2">({filteredStats.clientCount} Clients)</span>
      </h3>
      
    {/* TOTALS ON THE RIGHT */}
    <div className="flex gap-6">
      <div className="text-right">
        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Total Earnings</p>
        <p className="text-xl dark:text-pink-500 font-black text-gray-800">${filteredStats.totalEarnings.toFixed(2)}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black uppercase text-green-600 tracking-widest">Total Tips</p>
        <p className="text-xl font-black text-green-600">${filteredStats.totalTips.toFixed(2)}</p>
      </div>
    </div>
    </div>
  <div className="grid dark:bg-slate-950 dark:border-slate-800 grid-cols-2 md:grid-cols-6 gap-4 items-end bg-gray-50/50 p-6 rounded-xl border border-gray-100">
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Date</label>
      <input type="date" value={newEarning.date} onChange={e => setNewEarning({...newEarning, date: e.target.value})} className="dark:bg-slate-900/80  dark:border-slate-800  w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none" />
    </div>
    
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Service</label>
      <input placeholder="Service..." value={newEarning.service} onChange={e => setNewEarning({...newEarning, service: e.target.value})} className="dark:bg-slate-900/80  dark:border-slate-800  w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none" />
    </div>
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Staff Name</label>
      <select value={newEarning.staffName} onChange={e => setNewEarning({...newEarning, staffName: e.target.value})} className="dark:bg-slate-900/80  dark:border-slate-800  w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none">
        
        {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
      </select>
    </div>


    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Earning ($)</label>
      <input placeholder="0.00" type="number" value={newEarning.earning} onChange={e => setNewEarning({...newEarning, earning: e.target.value})} className="dark:bg-slate-900/80  dark:border-slate-800  w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none" />
    </div>

    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Tip ($)</label>
      <input placeholder="0.00" type="number" value={newEarning.tip} onChange={e => setNewEarning({...newEarning, tip: e.target.value})} className="dark:bg-slate-900/80 dark:border-slate-800 w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none" />
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
          className={`px-3 py-1 md:px-2 md:py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase transition-all ${
            reportFilterTech === name ? 'bg-pink-600 text-white shadow-md' : 'dark:bg-slate-950 dark:text-white bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {name}
        </button>
      ))}
    </div>

    {/* Date Filter (Right) */}
{/* Date Filter (Right) - NEW DROPDOWN STYLE */}
<div className="flex flex-wrap items-center gap-3 dark:bg-slate-900/80 dark:text-white dark:border-slate-800 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
  <div className="flex items-center gap-2">
    <div className="relative">
      <button 
        onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
        className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-black uppercase text-gray-700 dark:text-white shadow-sm"
      >
        <Calendar size={14} className="text-pink-500" />
        {startDate === endDate 
          ? `Daily: ${formatDisplayDate(startDate)}` 
          : `Range: ${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`}
      </button>

      {isFilterMenuOpen && (
        <>
          {/* BACKDROP */}
          <div 
            className="fixed inset-0 z-[40]" 
            onClick={() => setIsFilterMenuOpen(false)}
          />

          {/* MENU BOX */}
          <div className="absolute right-0 top-12 w-[300px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-2xl p-5 z-[50]">
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 tracking-widest">
              Pick a Date (Daily)
            </label>
            <input 
              type="date" 
              value={startDate === endDate ? startDate : getDefaultDailyDate()}
              onChange={(e) => {
                const newDate = e.target.value;
                setStartDate(newDate);
                setEndDate(newDate);
                setActiveFilter('custom');
              }}
              className="w-full bg-gray-50 dark:bg-slate-950 dark:text-white border border-gray-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-bold mb-4 outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer"
            />

            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 tracking-widest">
              Or Custom Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase">From</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => { setStartDate(e.target.value); setActiveFilter('custom'); }} 
                  className="w-full text-[10px] p-2 border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white rounded-lg outline-none" 
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase">To</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => { setEndDate(e.target.value); setActiveFilter('custom'); }} 
                  className="w-full text-[10px] p-2 border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white rounded-lg outline-none" 
                />
              </div>
            </div>
            
            <button 
              onClick={() => setIsFilterMenuOpen(false)}
              className="w-full mt-5 bg-pink-600 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl hover:bg-pink-700 transition-colors"
            >
              Apply Filter
            </button>
          </div>
        </>
      )}
    </div>
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
      className={`px-4 py-2 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all ${
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
      className={`px-4 py-2 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all ${
        activeFilter === 'thisMonth' ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30 dark:bg-pink-500' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
      }`}
    >
      This Month
    </button>
  </div>
</div>

  </div>

  {/* Table */}
  <div className="overflow-x-auto rounded-xl border border-gray-50 bg-white dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
    <table className="w-full text-left">
      <thead>
        <tr className="text-[10px] dark:border-slate-800  font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
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
 {(showAllRows ? filteredStats.rows : filteredStats.rows.slice(0, 10)).map((log, index) => (
    <tr key={log.id} className="text-sm font-bold text-gray-600 hover:bg-gray-50/50 transition-colors group dark:border-slate-800">
       <td className="px-3 py-1 text-gray-400">{index + 1}</td>
        <td className="px-4 py-1">{formatDisplayDate(log.dateStr)}</td>
        <td className="px-4 py-1 text-pink-600">{log.staffName}</td>
        <td className="px-4 py-1 text-gray-400 font-normal">{log.service || "N/A"}</td>
        <td className="px-4 py-1">${parseMoney(log.earning).toFixed(2)}</td>
        <td className="px-4 py-1 text-green-600 ">${parseMoney(log.tip).toFixed(2)}</td>
        <td className="px-4 py-1 text-right">
          <div className="flex justify-end gap-3  group-hover:opacity-100 transition-opacity">
            {/* EDIT ICON */}
            <button 
             onClick={() => {
  setNewEarning({
    id: log.id, // NEW: Tell the form we are editing!
    date: log.dateStr,
    staffName: log.staffName,
    service: log.service || "",
    earning: log.earning,
    oldEarningAmount: log.earning, // NEW: Save old amount for math
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
      <tfoot className="bg-gray-50/50 font-black text-gray-700 dark:bg-slate-950 ">
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
        <div className="dark:bg-slate-950 dark:border-slate-800  p-4 border-t border-gray-50 bg-gray-50/30 flex justify-center rounded-b-xl">
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
{/* CLIENT PROFILE MODAL COMPONENT */}
{selectedClientProfile && (
  <ClientProfileModal 
    client={selectedClientProfile} 
    onClose={() => setSelectedClientProfile(null)}
    finishedClients={finishedClients} // Pass your dashboard's state here
    appointments={appointments}       // Pass your dashboard's state here
  />
)}

    </div>
  );
}

// --- SUB COMPONENTS ---

function PastelCard({ label, value, bg, text, isText = false, icon }) {
    return (
        <div 
          style={{ backgroundColor: bg }} 
          className="p-6 rounded-xl flex flex-col justify-center min-h-[120px] relative overflow-hidden shadow-sm"
        >
            {/* The Label and Value */}
            <div className="relative z-10">
              <span style={{ color: text }} className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2 block">
                {label}
              </span>
              <span style={{ color: text }} className={`font-black ${isText ? 'text-xl' : 'text-3xl'} tracking-tight`}>
                {value}
              </span>
            </div>

            {/* The Background Icon */}
            {icon && (
              <div 
                style={{ color: text }} 
                className="absolute -right-2 -bottom-4 opacity-15 text-6xl transform -rotate-12 pointer-events-none"
              >
                <i className={icon}></i>
              </div>
            )}
        </div>
    );
}

function PayoutRow({ label, value }) {
    return (
        <div className="flex justify-between items-center text-[10px] dark:border-slate-800 dark:text-white font-bold text-gray-500 border-b border-gray-100 last:border-0 py-1">
            <span>{label}:</span>
            <span className="font-black text-gray-700">${value.toFixed(2)}</span>
        </div>
    );
}