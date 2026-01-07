"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
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

export default function SalonEarningPage() {
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [earnings, setEarnings] = useState([]);
  
  // NEW: State for Monthly Filter (e.g., "2026-01")
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Initialize form
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

  // --- SAFE DATE FORMATTER ---
  const formatSafeDate = (ts) => {
    if (!ts) return "---";
    try {
      if (typeof ts === 'object' && ts.seconds) {
        return new Date(ts.seconds * 1000).toLocaleDateString('en-US', {
          month: 'numeric', day: 'numeric', year: 'numeric'
        });
      }
      return new Date(ts).toLocaleDateString('en-US', {
         month: 'numeric', day: 'numeric', year: 'numeric'
      });
    } catch (e) {
      return "Invalid Date";
    }
  };

  // --- LOAD DATA ---
  useEffect(() => {
    const qStaff = query(collection(db, "users"), where("role", "in", ["technician", "staff", "admin"]));
    const unsubStaff = onSnapshot(qStaff, (snap) => {
      const techs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStaffList(techs);
    });

    const qEarnings = query(collection(db, "salon_earnings"), orderBy("date", "desc"));
    const unsubEarnings = onSnapshot(qEarnings, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEarnings(data);
      setLoading(false);
    });

    return () => { unsubStaff(); unsubEarnings(); };
  }, []);

  // --- NEW: FILTER LOGIC ---
  const filteredEarnings = useMemo(() => {
    return earnings.filter(report => {
      let reportDate;
      if (report.date && report.date.seconds) {
        reportDate = new Date(report.date.seconds * 1000);
      } else {
        reportDate = new Date(report.id);
      }
      // Compare YYYY-MM
      const reportMonthStr = reportDate.toISOString().slice(0, 7);
      return reportMonthStr === selectedMonth;
    });
  }, [earnings, selectedMonth]);

  // --- CALCULATIONS ---
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

  const results = calculateTotals();

  // --- HANDLERS ---
  const handleSave = async () => {
    if (!formData.date) return alert("Please select a date");
    try {
      const docId = formData.date; 
      const timestampDate = new Date(formData.date + 'T12:00:00');
      await setDoc(doc(db, "salon_earnings", docId), {
        ...formData, ...results, date: timestampDate, updatedAt: serverTimestamp() 
      }, { merge: true });
      alert("Saved successfully!");
      setFormData(initialFormState);
    } catch (e) {
      alert("Error saving: " + e.message);
    }
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

  if (loading) return <div className="p-10 text-center font-bold text-gray-400">Loading...</div>;
const currentResults = calculateTotals();

const handlePrint = () => {
  window.print();
};

const handleExport = () => {
  let csvContent = "data:text/csv;charset=utf-8,";
  // Add Headers
  csvContent += "Date,Revenue,Cash,Credit,GC Sold\n";
  // Add Data
  filteredEarnings.forEach(row => {
    const date = formatSafeDate(row.date);
    csvContent += `${date},${row.totalRevenue},${row.totalCash},${row.totalCredit},${row.sellGiftCard}\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Salon_Report_${selectedMonth}.csv`);
  document.body.appendChild(link);
  link.click();
};

  return (
    <div className="max-w-[95%] mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-100 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-playfair font-black text-gray-800 italic uppercase">Salon Earning</h1>
          <p className="text-[10px] font-black text-pink-500 uppercase tracking-[4px] mt-2">Daily Financial Entry</p>
        </div>
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 ml-2 uppercase">Entry Date:</span>
          <input 
            type="date" 
            value={formData.date}
            onChange={e => setFormData({...formData, date: e.target.value})}
            className="border-none bg-transparent font-bold text-gray-700 p-2 outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* INPUT FORM */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            {staffList.map(staff => (
                <div key={staff.id}>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">{staff.name}</label>
                    <input 
                        type="number" 
                        placeholder="0.00"
                        value={formData[staff.name.toLowerCase()] || ""}
                        onChange={e => setFormData({...formData, [staff.name.toLowerCase()]: e.target.value})}
                        className="w-full p-2 bg-gray-50 rounded-lg text-sm font-bold border-none"
                    />
                </div>
            ))}
         </div>
         <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-dashed border-gray-100 pt-4">
            {[
                {k:'sellGiftCard', l:'Sell GC'}, {k:'returnGiftCard', l:'Return GC'}, 
                {k:'check', l:'Check'}, {k:'noOfCredit', l:'No Credit'}, 
                {k:'totalCredit', l:'Total Credit'}, {k:'venmo', l:'Venmo'}, {k:'square', l:'Square'}
            ].map(f => (
                <div key={f.k}>
                    <label className="text-[10px] font-bold text-pink-400 uppercase">{f.l}</label>
                    <input 
                        type="number" 
                        value={formData[f.k]} 
                        onChange={e => setFormData({...formData, [f.k]: e.target.value})}
                        className="w-full p-2 bg-pink-50/30 rounded-lg text-sm font-bold border-none"
                    />
                </div>
            ))}
         </div>
<div className="mt-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
    {/* LEFT SIDE: TOTALS */}
    <div className="flex gap-8">
       <div>
           <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Calculated Revenue</p>
           <p className="text-2xl font-black text-gray-800">${currentResults.totalRevenue.toFixed(2)}</p>
       </div>
       <div className="border-l border-gray-100 pl-8">
           <p className="text-[10px] font-black text-pink-500 uppercase mb-1">Calculated Cash</p>
           <p className="text-2xl font-black text-green-600">${currentResults.totalCash.toFixed(2)}</p>
       </div>
    </div>
             <button onClick={handleSave} className="bg-pink-600 text-white px-8 py-3 rounded-xl font-bold uppercase text-xs shadow-lg hover:bg-pink-700">Save Daily Report</button>
         </div>
      </div>

      {/* --- DETAILED TABLE WITH MONTHLY FILTER --- */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        
        {/* MONTH PICKER UI */}
        <div className="px-6 py-4 bg-gray-50 border-b flex flex-col md:flex-row justify-between items-center gap-4">
       <div className="flex items-center gap-4">
    {/* IMPORT */}
    <label className="cursor-pointer flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-[10px] font-black text-gray-500 hover:bg-gray-50 uppercase">
        <i className="fas fa-file-import text-blue-500"></i> Import
        <input type="file" className="hidden" onChange={(e) => console.log("Import Logic Here")} />
    </label>

    {/* EXPORT */}
    <button onClick={handleExport} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-[10px] font-black text-gray-500 hover:bg-gray-50 uppercase">
        <i className="fas fa-file-export text-green-500"></i> Export
    </button>

    {/* PRINT */}
    <button onClick={handlePrint} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-[10px] font-black text-gray-500 hover:bg-gray-50 uppercase">
        <i className="fas fa-print text-purple-500"></i> Print
    </button>
</div>
 <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                <i className="fas fa-calendar-alt text-pink-500"></i>
                <label className="text-[10px] font-black text-gray-400 uppercase">View Month:</label>
                <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="border-none font-bold text-gray-700 outline-none cursor-pointer"
                />
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500 tracking-wider">
              <tr>
                <th className="px-4 py-4 sticky left-0 bg-gray-50 z-10 border-r border-gray-100">Date</th>
                {staffList.map(staff => (
                    <th key={staff.id} className="px-3 py-4 border-r border-gray-100 text-center">{staff.name}</th>
                ))}
                <th className="px-3 py-4 text-center bg-green-50/50">Sell GC</th>
                <th className="px-3 py-4 text-center text-red-400">Return GC</th>
                <th className="px-3 py-4 text-center">Check</th>
                <th className="px-3 py-4 text-center">No Credit</th>
                <th className="px-3 py-4 text-center">Total Credit</th>
                <th className="px-3 py-4 text-center">Venmo</th>
                <th className="px-3 py-4 text-center">Square</th>
                <th className="px-3 py-4 text-center bg-gray-100 font-extrabold text-gray-700">Total</th>
                <th className="px-3 py-4 text-center bg-green-100 font-extrabold text-green-700">Cash</th>
                <th className="px-4 py-4 text-center sticky right-0 bg-gray-50 z-10">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-bold text-gray-600">
              {filteredEarnings.length > 0 ? filteredEarnings.map((report) => {
                 let rowStaffTotal = 0;
                 staffList.forEach(s => rowStaffTotal += parseFloat(report[s.name.toLowerCase()] || 0));
                 const rowTotal = rowStaffTotal + parseFloat(report.sellGiftCard || 0);
                 const rowCash = rowTotal - (
                    parseFloat(report.totalCredit || 0) + 
                    parseFloat(report.check || 0) + 
                    parseFloat(report.returnGiftCard || 0) + 
                    parseFloat(report.venmo || 0) + 
                    parseFloat(report.square || 0)
                 );

                 return (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 sticky left-0 bg-white z-10 border-r border-gray-100 font-bold text-gray-800">
                        {formatSafeDate(report.date)}
                    </td>
                    {staffList.map(staff => (
                        <td key={staff.id} className="px-3 py-4 text-center border-r border-gray-50">
                            ${Number(report[staff.name.toLowerCase()] || 0).toFixed(2)}
                        </td>
                    ))}
                    <td className="px-3 py-4 text-center bg-green-50/30 text-green-600">${Number(report.sellGiftCard || 0).toFixed(2)}</td>
                    <td className="px-3 py-4 text-center text-red-500">${Number(report.returnGiftCard || 0).toFixed(2)}</td>
                    <td className="px-3 py-4 text-center">${Number(report.check || 0).toFixed(2)}</td>
                    <td className="px-3 py-4 text-center text-blue-500">{report.noOfCredit || 0}</td>
                    <td className="px-3 py-4 text-center">${Number(report.totalCredit || 0).toFixed(2)}</td>
                    <td className="px-3 py-4 text-center">${Number(report.venmo || 0).toFixed(2)}</td>
                    <td className="px-3 py-4 text-center">${Number(report.square || 0).toFixed(2)}</td>
                    <td className="px-3 py-4 text-center bg-gray-50 font-black text-gray-800 border-l border-gray-200">${rowTotal.toFixed(2)}</td>
                    <td className="px-3 py-4 text-center bg-green-50 font-black text-green-600 border-l border-green-100">${rowCash.toFixed(2)}</td>
                    <td className="px-4 py-4 text-center sticky right-0 bg-white z-10 border-l border-gray-100 space-x-2">
                        <button onClick={() => handleEdit(report)} className="text-blue-500"><i className="fas fa-edit"></i></button>
                        <button onClick={() => handleDelete(report.id)} className="text-red-500"><i className="fas fa-trash"></i></button>
                    </td>
                  </tr>
                 );
              }) : (
                <tr>
                  <td colSpan={staffList.length + 11} className="p-20 text-center text-gray-400 font-bold uppercase tracking-widest">
                    No data found for this month
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