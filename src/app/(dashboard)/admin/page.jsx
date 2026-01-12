"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
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

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  // Default to current month, e.g., "2026-01"
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  
  const [earningsData, setEarningsData] = useState([]);
  const [staffList, setStaffList] = useState([]);
const [appointments, setAppointments] = useState([]); // Add this line
  // --- 1. SYNC DATABASE ---
useEffect(() => {
  setLoading(true);

  // 1. Fetch Daily Reports (Removed orderBy to bypass index errors)
  const qEarnings = query(collection(db, "salon_earnings"));
  const unsubEarnings = onSnapshot(qEarnings, (snap) => {
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("DATABASE CHECK: Fetched", data.length, "documents from salon_earnings");
    setEarningsData(data);
  }, (error) => {
    console.error("DATABASE ERROR (Earnings):", error);
  });
// Inside useEffect...
// 3. Fetch Appointments
// Inside your AdminDashboard component

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



  // 2. Fetch Staff List
 const qStaff = query(collection(db, "users"), where("role", "in", ["technician", "staff"]));
  const unsubStaff = onSnapshot(qStaff, (snap) => {
    const staffData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log("DATABASE CHECK: Fetched", staffData.length, "staff members");
    setStaffList(staffData);
  }, (error) => {
    console.error("DATABASE ERROR (Staff):", error);
  });

  setLoading(false);
  return () => { unsubEarnings(); unsubStaff(); unsubAppts();};
}, []);

const dashboardData = useMemo(() => {
  if (staffList.length === 0) return null;

  const parseMoney = (val) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/[^0-9.-]+/g, "")) || 0;
  };

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
    totalClients += parseMoney(report.totalClients);
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
    if (report) {
      staffList.forEach(s => dailyRev += parseMoney(report[s.name.toLowerCase()]));
      dailyRev += parseMoney(report.sellGiftCard);
    }
    return { day, "Total Revenue": dailyRev };
  });

  // 5. APPOINTMENT LOGIC
  const monthAppts = (appointments || []).filter(appt => {
    if (!appt.date) return false;
    const apptYear = appt.date.getFullYear();
    const apptMonth = (appt.date.getMonth() + 1).toString().padStart(2, '0');
    return `${apptYear}-${apptMonth}` === selectedMonth;
  });

  const now = new Date();
  const upcomingAppts = monthAppts.filter(appt => appt.date >= now);

  // --- FINAL RETURN (Everything is now defined before this line) ---
  return {
    totals: { 
      totalRevenue, 
      totalCash, 
      totalClients, 
      totalGiftCard, 
      totalExpense, 
      topEarnerName: staffPerformance[0]?.name || "-" 
    },
    staffPerformance,
    trendData,      // Fixed!
    monthAppts,    
    upcomingAppts  
  };
}, [selectedMonth, earningsData, staffList, appointments]);

  if (loading || !dashboardData) return <div className="p-20 text-center font-black text-gray-300 tracking-widest uppercase">Loading Data...</div>;

  const { totals, staffPerformance, trendData } = dashboardData;

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
        <PastelCard label="Top Booking Technician" value="-" bg={COLORS.purple} text={COLORS.purpleText} isText />
      </div>

      {/* ROW 2: SECONDARY STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
  <PastelCard 
  label="Total Appointments" 
  /* Use optional chaining to reach inside dashboardData */
  value={dashboardData?.monthAppts?.length || 0} 
  bg={COLORS.periwinkle} 
  text={COLORS.periwinkleText} 
/>
        {/* Note: Using totalClients for appointments as fallback */}
       <PastelCard 
  label="Total Clients" 
  value={dashboardData?.totals?.totalClients || 0} 
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
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
            tech === 'All' ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-gray-100'
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
                  <button className="text-blue-500 font-bold text-sm hover:underline">Check In</button>
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