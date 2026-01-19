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
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const initialFormState = {
    date: new Date().toISOString().split('T')[0],
    sellGiftCard: "", 
    returnGiftCard: "", 
    check: "", 
    noOfCredit: "", 
    totalCredit: "", 
    venmo: "", 
    square: ""
  };

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
  useEffect(() => {
    if (!user) return;

   // Remove "admin" from the query to show only Technician and Staff
const qStaff = query(collection(db, "users"), where("role", "in", ["technician", "staff"])); 
const unsubStaff = onSnapshot(qStaff, (snap) => {
      const techs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStaffList(techs);
    }, (err) => console.error(err));

    const qEarnings = query(collection(db, "salon_earnings"), orderBy("date", "desc"));
    const unsubEarnings = onSnapshot(qEarnings, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEarnings(data);
      setLoading(false);
    }, (err) => console.error(err));

    return () => { 
      unsubStaff(); 
      unsubEarnings(); 
    };
  }, [user]);

  // Calculations
  const filteredEarnings = useMemo(() => {
    return earnings.filter(report => {
      let reportDate;
      if (report.date && report.date.seconds) {
        reportDate = new Date(report.date.seconds * 1000);
      } else {
        reportDate = new Date(report.id);
      }
      return reportDate.toISOString().slice(0, 7) === selectedMonth;
    });
  }, [earnings, selectedMonth]);

  const staffTotals = useMemo(() => {
  const totals = {};
  staffList.forEach(s => {
    const staffKey = s.name.toLowerCase();
    const rawRate = parseFloat(s.commission) || 0.6;
    const commissionRate = rawRate > 1 ? rawRate / 100 : rawRate;
    const sum = filteredEarnings.reduce((acc, r) => acc + (parseFloat(r[staffKey]) || 0), 0);
    const payout = sum * commissionRate;
    const check = payout * 0.70;
    const cash = payout - check;

    totals[staffKey] = { sum, payout, check, cash, rate: commissionRate };
  });
  return totals;
}, [filteredEarnings, staffList]);


  const monthlySummary = useMemo(() => {
let totals = { clients: 0, revenue: 0, payout: 0, checkPayout: 0, cashPayout: 0 };
// REPLACE the logic inside your filteredEarnings.forEach loop:
filteredEarnings.forEach(report => {
  // 1. Calculate Revenue specifically for this staff member row logic
  const dailyStaffSum = staffList.reduce((acc, s) => acc + (parseFloat(report[s.name.toLowerCase()]) || 0), 0);
  const dailyRevenue = dailyStaffSum + (parseFloat(report.sellGiftCard) || 0);

  // 2. STAFF PAYOUT FORMULA (Staff earns 60% of their total generation)
// Use the pre-calculated staff totals for accuracy
const staffTotalPayout = Object.values(staffTotals).reduce((acc, curr) => acc + curr.payout, 0);
 const staffCheckPayout = staffTotalPayout * 0.70;
  const staffCashPayout = staffTotalPayout - staffCheckPayout;

  // 3. Update Monthly Totals
  totals.revenue += dailyRevenue;
  totals.payout += staffTotalPayout;
  totals.checkPayout += staffCheckPayout;
  totals.cashPayout += staffCashPayout;
  
  // Keep other totals
  totals.clients += (parseInt(report.noOfCredit) || 0);
  totals.gc += (parseFloat(report.sellGiftCard) || 0);
  totals.credit += (parseFloat(report.totalCredit) || 0);
  totals.cash += (dailyRevenue - ((parseFloat(report.totalCredit) || 0) + (parseFloat(report.check) || 0)));
});

return totals;
}, [filteredEarnings, staffTotals]); // <--- Now this works!

  const calculateTotals = () => {
    let revenue = 0;
    staffList.forEach(s => {
      revenue += parseFloat(formData[s.name.toLowerCase()] || 0);
    });
    revenue += parseFloat(formData.sellGiftCard || 0);
    const nonCash = parseFloat(formData.totalCredit || 0) + 
                    parseFloat(formData.check || 0) + 
                    parseFloat(formData.returnGiftCard || 0) + 
                    parseFloat(formData.venmo || 0) + 
                    parseFloat(formData.square || 0);

    return { totalRevenue: revenue, totalCash: revenue - nonCash };
  };

  const currentResults = calculateTotals();
const monthlyTotals = useMemo(() => {
    let totals = { 
      clients: 0, revenue: 0, cash: 0, credit: 0, check: 0, gc: 0,
      payout: 0, checkPayout: 0, cashPayout: 0 
    };

    filteredEarnings.forEach(report => {
      // 1. Calculate Daily Revenue (Staff + Gift Cards)
      const dailyStaffSum = staffList.reduce((acc, s) => acc + (parseFloat(report[s.name.toLowerCase()]) || 0), 0);
      const dailyRevenue = dailyStaffSum + (parseFloat(report.sellGiftCard) || 0);

      // 2. Calculate Payouts (Old Script Logic)
      const dailyPayout = dailyRevenue * 0.60;
      const dailyCheckPayout = dailyPayout * 0.70;
      const dailyCashPayout = dailyPayout - dailyCheckPayout;

      // 3. Daily Cash calculation
      const nonCash = (parseFloat(report.totalCredit) || 0) + (parseFloat(report.check) || 0) + 
                      (parseFloat(report.venmo) || 0) + (parseFloat(report.square) || 0) + (parseFloat(report.returnGiftCard) || 0);

      // Add to running monthly totals
      totals.clients += (parseInt(report.noOfCredit) || 0);
      totals.revenue += dailyRevenue;
      totals.cash += (dailyRevenue - nonCash);
      totals.credit += (parseFloat(report.totalCredit) || 0);
      totals.check += (parseFloat(report.check) || 0);
      totals.gc += (parseFloat(report.sellGiftCard) || 0);
      
      // Add payouts to totals
      totals.payout += dailyPayout;
      totals.checkPayout += dailyCheckPayout;
      totals.cashPayout += dailyCashPayout;
    });
    return totals;
  }, [filteredEarnings, staffList]);

  const handleSave = async () => {
    if (!user || !formData.date) return;
    try {
      const timestampDate = new Date(formData.date + 'T12:00:00');
      await setDoc(doc(db, "salon_earnings", formData.date), {
        ...formData, ...currentResults, date: timestampDate, updatedAt: serverTimestamp() 
      }, { merge: true });
      setFormData(initialFormState);
    } catch (e) { console.error(e); }
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

  if (loading) return <div className="p-10 text-center font-black text-gray-300 uppercase tracking-widest">Loading Records...</div>;

  
  return (
    <div className="max-w-[98%] mx-auto space-y-6 pb-20 mt-6 font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-end bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 uppercase italic">Salon Earning</h1>
          <p className="text-[10px] font-black text-pink-500 uppercase tracking-[4px] mt-2">
            Monthly Overview: {monthlySummary.clients} Clients
          </p>
        </div>
        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl border border-gray-100">
          <div className="px-3 border-r border-gray-200">
             <p className="text-[9px] font-bold text-gray-400 uppercase">Monthly Revenue</p>
             <p className="text-sm font-black text-green-600">${monthlySummary.revenue.toFixed(2)}</p>
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
                <div key={staff.id}>
                    <label className="text-[9px] font-bold text-gray-400 uppercase">{staff.name}</label>
                    <input 
                        type="number" 
                        placeholder="0.00"
                        value={formData[staff.name.toLowerCase()] || ""}
                        onChange={e => setFormData({...formData, [staff.name.toLowerCase()]: e.target.value})}
                        className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none focus:ring-1 focus:ring-pink-200 outline-none"
                    />
                </div>
            ))}
         </div>
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 border-t border-dashed border-gray-100 pt-6">
            {[
                {k:'sellGiftCard', l:'Sell GC'}, {k:'returnGiftCard', l:'Return GC'}, 
                {k:'check', l:'Check'}, {k:'noOfCredit', l:'No Credit'}, 
                {k:'totalCredit', l:'Total Credit'}, {k:'venmo', l:'Venmo'}, {k:'square', l:'Square'}
            ].map(f => (
                <div key={f.k}>
                    <label className="text-[9px] font-bold text-pink-400 uppercase">{f.l}</label>
                    <input 
                        type="number" 
                        value={formData[f.k]} 
                        placeholder="0"
                        onChange={e => setFormData({...formData, [f.k]: e.target.value})}
                        className="w-full p-2 bg-pink-50/30 rounded-lg text-xs font-bold border-none focus:ring-1 focus:ring-pink-200 outline-none"
                    />
                </div>
            ))}
         </div>
         <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex gap-10">
               <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-wider">Day Revenue</p>
                  <p className="text-xl font-black text-gray-800">${currentResults.totalRevenue.toFixed(2)}</p>
               </div>
               <div className="border-l border-gray-100 pl-10">
                  <p className="text-[9px] font-black text-pink-500 uppercase mb-1 tracking-wider">Day Cash</p>
                  <p className="text-xl font-black text-green-600">${currentResults.totalCash.toFixed(2)}</p>
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
    <th className="px-4 py-4 text-center sticky right-0 bg-gray-50 z-10 border-l">Action</th>
  </tr>
</thead>
<tbody className="divide-y divide-gray-100 text-[11px] font-bold text-gray-600">
  {filteredEarnings.map((report) => {
    // 1. REVENUE CALCULATION FOR THIS ROW
    // Sum up only the staff currently in our filtered staffList (Technicians/Staff)
    const dailyStaffSum = staffList.reduce((acc, s) => acc + (parseFloat(report[s.name.toLowerCase()]) || 0), 0);
    
    // Total Revenue = Staff Earnings + Gift Cards Sold
    const dailyRevenue = dailyStaffSum + (parseFloat(report.sellGiftCard) || 0);

    // 2. CASH CALCULATION FOR THIS ROW
    // Gather all non-cash items to subtract from revenue
    const nonCash = (parseFloat(report.totalCredit) || 0) + 
                    (parseFloat(report.check) || 0) + 
                    (parseFloat(report.venmo) || 0) + 
                    (parseFloat(report.square) || 0) +
                    (parseFloat(report.returnGiftCard) || 0);
    
    // Total Cash = Total Revenue - (Credits + Checks + Venmo + Square + Returns)
    const dailyCash = dailyRevenue - nonCash;

    return (
      <tr key={report.id} className="hover:bg-gray-50 transition-colors">
        {/* DATE COLUMN */}
        <td className="px-4 py-4 sticky left-0 bg-white z-10 font-black text-gray-800 border-r border-gray-100">
          {report.date?.seconds ? new Date(report.date.seconds * 1000).toLocaleDateString() : report.id}
        </td>

        {/* DYNAMIC STAFF COLUMNS */}
        {staffList.map(s => (
          <td key={s.id} className="px-3 py-4 text-center text-gray-400">
            {report[s.name.toLowerCase()] ? `$${Number(report[s.name.toLowerCase()]).toFixed(2)}` : '—'}
          </td>
        ))}

        {/* FINANCIAL COLUMNS */}
        <td className="px-3 py-4 text-center text-pink-500 font-medium">
          ${Number(report.sellGiftCard || 0).toFixed(2)}
        </td>
        <td className="px-3 py-4 text-center text-red-400">
          ${Number(report.returnGiftCard || 0).toFixed(2)}
        </td>
        <td className="px-3 py-4 text-center text-gray-500">
          ${Number(report.check || 0).toFixed(2)}
        </td>
        <td className="px-3 py-4 text-center text-blue-500">
          {report.noOfCredit || 0}
        </td>
        <td className="px-3 py-4 text-center text-gray-500">
          ${Number(report.totalCredit || 0).toFixed(2)}
        </td>

        {/* TOTAL CASH COLUMN (Calculated Live) */}
        <td className="px-3 py-4 text-center bg-green-50/30 text-green-700 font-black">
          ${dailyCash.toFixed(2)}
        </td>

        {/* TOTAL REVENUE COLUMN (Calculated Live) */}
        <td className="px-3 py-4 text-center font-black text-gray-800">
          ${dailyRevenue.toFixed(2)}
        </td>

        {/* ACTIONS */}
        <td className="px-4 py-4 text-center sticky right-0 bg-white z-10 border-l space-x-3">
          <button 
            onClick={() => handleEdit(report)} 
            className="text-blue-500 hover:scale-110 transition-transform"
          >
            <i className="fas fa-edit"></i>
          </button>
          <button 
            onClick={() => handleDelete(report.id)} 
            className="text-red-400 hover:scale-110 transition-transform"
          >
            <i className="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    );
  })}
</tbody>
<tfoot className="bg-slate-900 text-white text-[10px] font-black uppercase">
  {/* ROW 1: MONTHLY TOTAL remains the same */}
  <tr className="border-b border-slate-800">
    <td className="px-4 py-4 border-r border-slate-700">Monthly Total</td>
    {staffList.map(s => {
      const total = staffTotals[s.name.toLowerCase()]?.sum || 0;
      return <td key={s.id} className="px-3 py-4 text-center text-slate-400 font-bold">${total.toFixed(2)}</td>
    })}
    <td className="px-3 py-4 text-center text-pink-400">${monthlyTotals.gc.toFixed(2)}</td>
    <td colSpan={3}></td>
    <td className="px-3 py-4 text-center text-green-400 font-black">${monthlyTotals.cash.toFixed(2)}</td>
    <td className="px-3 py-4 text-center text-white border-l border-slate-700 text-xs font-black">${monthlyTotals.revenue.toFixed(2)}</td>
    <td></td>
    <td></td>
  </tr>

  {/* ROW 2: DYNAMIC TOTAL PAYOUT (Shows 60% or 70% per column) */}
  <tr className="bg-slate-800/40 border-b border-slate-700">
    <td className="px-4 py-3 border-r border-slate-700 text-indigo-300 italic">Total Payout</td>
    {staffList.map(s => {
      const data = staffTotals[s.name.toLowerCase()];
// This ensures 0.7 and 70 both display as "70% Rate"
const displayRate = data?.rate ? (data.rate > 1 ? data.rate : data.rate * 100) : 60;

return (
  <td key={s.id} className="px-3 py-3 text-center text-indigo-200">
    <span className="block text-[8px] opacity-50 text-white">{Math.round(displayRate)}% Rate</span>
    ${(data?.payout || 0).toFixed(2)}
  </td>
);
    })}
    <td colSpan={8}></td>
  </tr>

  {/* ROW 3: CHECK PAYOUT */}
  <tr className="bg-slate-800/20 border-b border-slate-700">
    <td className="px-4 py-3 border-r border-slate-700 text-slate-400 font-normal">Check Payout (70%)</td>
    {staffList.map(s => {
      const val = staffTotals[s.name.toLowerCase()]?.check || 0;
      return <td key={s.id} className="px-3 py-3 text-center text-slate-300 font-normal">${val.toFixed(2)}</td>
    })}
    <td colSpan={8}></td>
  </tr>

  {/* ROW 4: CASH PAYOUT */}
  <tr className="bg-slate-800/10">
    <td className="px-4 py-3 border-r border-slate-700 text-slate-400 font-normal">Cash Payout (30%)</td>
    {staffList.map(s => {
      const val = staffTotals[s.name.toLowerCase()]?.cash || 0;
      return <td key={s.id} className="px-3 py-3 text-center text-slate-300 font-normal">${val.toFixed(2)}</td>
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