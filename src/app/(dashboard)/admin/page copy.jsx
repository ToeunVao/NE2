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
const formRef = useRef(null);
  // --- NEW STATES FOR FILTERED TABLE ---
  const [serviceLogs, setServiceLogs] = useState([]); // Raw logs from Firestore
  const [reportFilterTech, setReportFilterTech] = useState('All'); // Technician Tab
// 1. Fixed Date Logic (Uses local time instead of UTC to prevent date jumping)
const getLocalDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().split('T')[0];
};

const [reportFilterDate, setReportFilterDate] = useState(getLocalDate());
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
    // Normalize date to string "YYYY-MM-DD"
    let dateVal = data.date?.toDate ? data.date.toDate().toISOString().split('T')[0] : data.date;
    return { id: doc.id, ...data, dateStr: dateVal }; // <--- MUST BE dateStr
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
    // Change log.date to log.dateStr here:
    const isDateMatch = log.dateStr === reportFilterDate; 
    const isTechMatch = reportFilterTech === 'All' || log.staffName === reportFilterTech;
    return isDateMatch && isTechMatch;
  });

  const totalEarnings = filtered.reduce((sum, log) => sum + parseMoney(log.earning), 0);
  const totalTips = filtered.reduce((sum, log) => sum + parseMoney(log.tip), 0);
  const clientCount = filtered.length;

  return { totalEarnings, totalTips, clientCount };
}, [serviceLogs, reportFilterDate, reportFilterTech]);


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
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center">
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            <span className="text-xs font-black text-gray-500 uppercase self-center mr-2">Quick Links:</span>
            {['Staff Summary', 'Revenue Trend', 'Upcoming', 'Earning Report'].map(link => (
                <button key={link} className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-[10px] font-black uppercase hover:bg-pink-50 hover:text-pink-600 transition-colors whitespace-nowrap">
                    {link}
                </button>
            ))}
        </div>
        <div className="flex items-center gap-3">
            <span className="text-xs font-black text-gray-500 uppercase">Date Range:</span>
            <input 
                type="month" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)} 
                className="bg-gray-50 border-none rounded-lg text-xs font-bold px-3 py-1.5 outline-none focus:ring-2 focus:ring-pink-200"
            />
        </div>
      </div>

      {/* ROW 1: TOP STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <PastelCard label="Total Salon Revenue" value={`$${totals.totalRevenue.toFixed(2)}`} bg={COLORS.pink} text={COLORS.pinkText} />
        <PastelCard label="Total Cash" value={`$${totals.totalCash.toFixed(2)}`} bg={COLORS.green} text={COLORS.greenText} />
        <PastelCard label="Top Earning Technician" value={totals.topEarnerName} bg={COLORS.blue} text={COLORS.blueText} isText />
<PastelCard 
  label="Top Booking Technician" 
  value={totals.topBookingName} // Use the destructured value
  bg={COLORS.purple} 
  text={COLORS.purpleText} 
  isText={true} 
/>
      </div>

      {/* ROW 2: SECONDARY STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
<PastelCard 
  label="Total Appointments" 
  value={totalSystemAppointments} // Now uses the global count
  bg={COLORS.periwinkle} 
  text={COLORS.periwinkleText} 
/>
<PastelCard 
  label="Total Clients" 
  value={totals.totalClients || 0} 
  bg={COLORS.mint} 
  text={COLORS.mintText} 
/>
 <PastelCard label="Total Gift Cards Sales" value={`$${totals.totalGiftCard.toFixed(2)}`} bg={COLORS.orange} text={COLORS.orangeText} />
        <PastelCard label="Total Expense" value={`$${totals.totalExpense.toFixed(2)}`} bg={COLORS.red} text={COLORS.redText} />
      </div>

      {/* SECTION 3: STAFF EARNINGS SUMMARY (Cards + Chart) */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-black text-gray-700 italic mb-6 bg-gray-100 inline-block px-4 py-1 rounded-lg">Staff Earnings Summary</h3>
        
        {/* Staff Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-10">
            {staffPerformance.map((staff, idx) => (
                <div key={idx} className="p-5 rounded-xl border border-gray-50 hover:shadow-md transition-all" style={{backgroundColor: `${staff.color}15`}}> {/* 15 is opacity */}
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
                <BarChart data={staffPerformance} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
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
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Legend wrapperStyle={{paddingTop: '20px', fontSize: '11px', fontWeight: 700}} />
                    <Line type="monotone" dataKey="Total Revenue" stroke="#ec4899" strokeWidth={3} dot={{r: 3, fill: '#ec4899'}} activeDot={{r: 6}} />
                    <Line type="monotone" dataKey="Cash Revenue" stroke="#10b981" strokeWidth={3} dot={{r: 3, fill: '#10b981'}} activeDot={{r: 6}} />
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
    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100 w-full md:w-auto">
       <span className="text-[10px] font-black uppercase text-gray-400 px-2 border-r border-gray-200">Daily</span>
       <input 
         type="date" 
         value={reportFilterDate} 
         onChange={e => setReportFilterDate(e.target.value)} 
         className="bg-white border border-gray-200 rounded-lg text-xs font-bold px-3 py-1.5 outline-none focus:ring-2 focus:ring-pink-100" 
       />
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
  {serviceLogs
    .filter(log => {
      const isDateMatch = log.dateStr === reportFilterDate;
      const isTechMatch = reportFilterTech === 'All' || log.staffName === reportFilterTech;
      return isDateMatch && isTechMatch;
    })
    .map((log, idx) => (
      <tr key={log.id} className="text-sm font-bold text-gray-600 hover:bg-gray-50/50">
        <td className="px-6 py-4 text-gray-400">{idx + 1}</td>
        <td className="px-6 py-4">{log.dateStr}</td>
        <td className="px-6 py-4 text-pink-600">{log.staffName}</td>
        <td className="px-6 py-4 text-gray-400 font-normal">{log.service || "General"}</td>
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
      .filter(log => log.dateStr === reportFilterDate && (reportFilterTech === 'All' || log.staffName === reportFilterTech))
      .reduce((sum, log) => sum + parseMoney(log.earning), 0).toFixed(2)}
             </td>
          <td className="px-6 py-4 text-green-600">
           {/* SUM TIPS */}
    ${serviceLogs
      .filter(log => log.dateStr === reportFilterDate && (reportFilterTech === 'All' || log.staffName === reportFilterTech))
      .reduce((sum, log) => sum + parseMoney(log.tip), 0).toFixed(2)}
          </td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>
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