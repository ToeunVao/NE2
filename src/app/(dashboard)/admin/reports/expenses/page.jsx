"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, collectionGroup, query, orderBy, onSnapshot } from "firebase/firestore"; // Added collectionGroup

export default function MonthlyExpensePage() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  
  // --- FILTER STATES (Defaulted to "All") ---
  const [filterMonth, setFilterMonth] = useState("All"); // Changed from current month to All
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterSupplier, setFilterSupplier] = useState("All");

  const categories = ["Rent", "Supplies", "Electricity", "Water", "Insurance", "Marketing", "Repairs", "Other"];
  const paymentMethods = ["Cash", "Credit Card", "Check", "Venmo", "Square"];

  const initialFormState = {
    date: new Date().toISOString().split('T')[0],
    expenseName: "",
    category: "Supplies",
    supplier: "",
    paidVia: "Credit Card",
    amount: "",
    attachment: ""
  };

  const [formData, setFormData] = useState(initialFormState);

  // --- DATA LOADING ---
useEffect(() => {
  // Removing 'orderBy' makes this a Simple Query (No Index Needed)
  const q = query(collectionGroup(db, "expenses"));
  
  const unsub = onSnapshot(q, (snap) => {
    let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Sort the data in JavaScript instead of Firestore
    data.sort((a, b) => {
      const dateA = a.date?.seconds ? a.date.seconds : new Date(a.date).getTime();
      const dateB = b.date?.seconds ? b.date.seconds : new Date(b.date).getTime();
      return dateB - dateA; // Sort descending
    });

    setExpenses(data);
    setLoading(false);
  });
  return () => unsub();
}, []);

  // --- MULTI-FILTER LOGIC (Updated for "All" default) ---
// Replace your existing filteredExpenses useMemo with this "Smart" version:
const filteredExpenses = useMemo(() => {
  return expenses.filter(ex => {
    // 1. SMART DATE DETECTION (Fixes "no show" issue)
    let exDate;
    if (ex.date?.seconds) {
      // It's a Firebase Timestamp
      exDate = new Date(ex.date.seconds * 1000);
    } else if (typeof ex.date === 'string') {
      // It's a String from your old app (e.g., "2025-10-15")
      exDate = new Date(ex.date + 'T12:00:00'); 
    } else {
      // It's already a JS Date or we use the ID as a fallback
      exDate = new Date(ex.date || ex.id.split('_')[0]);
    }

    // 2. CHECK IF DATE IS VALID
    if (isNaN(exDate.getTime())) return false;

    // 3. APPLY FILTERS
    const matchMonth = filterMonth === "All" || exDate.toISOString().slice(0, 7) === filterMonth;
    const matchCat = filterCategory === "All" || ex.category === filterCategory;
    
    // Support older data that might not have a supplier field
    const currentSupplier = ex.supplier || "N/A";
    const matchSup = filterSupplier === "All" || currentSupplier === filterSupplier;

    return matchMonth && matchCat && matchSup;
  });
}, [expenses, filterMonth, filterCategory, filterSupplier]);
  // Unique suppliers list
  const uniqueSuppliers = useMemo(() => {
    const sups = expenses.map(e => e.supplier).filter(s => s && s.trim() !== "");
    return ["All", ...new Set(sups)];
  }, [expenses]);

  const handleSave = async () => {
    if (!formData.amount || !formData.expenseName) return alert("Please fill in required fields");
    try {
      const docId = `${formData.date}_${Date.now()}`;
      await setDoc(doc(db, "salon_expenses", docId), {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date + 'T12:00:00'),
        updatedAt: serverTimestamp() 
      });
      setFormData(initialFormState);
    } catch (e) { alert("Error: " + e.message); }
  };
const handleDelete = async (docId, docPath) => {
  if (!window.confirm("Are you sure you want to delete this expense?")) return;

  try {
    // If we have the full path (from the map function), use it!
    if (docPath) {
      await deleteDoc(doc(db, docPath));
    } else {
      // Fallback for new items
      await deleteDoc(doc(db, "salon_expenses", docId));
    }
    alert("Expense deleted successfully");
  } catch (error) {
    console.error("Delete Error:", error);
    alert("Error deleting: " + error.message);
  }
};
  if (loading) return <div className="p-10 text-center font-bold text-gray-400 uppercase">Loading All Expenses...</div>;

  return (
    <div className="max-w-[95%] mx-auto space-y-6 pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
            <h1 className="text-2xl font-black text-gray-800 uppercase italic">Expense Ledger</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Displaying: {filterMonth === "All" ? "All Time" : filterMonth}</p>
        </div>
        <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase">Visible Total</p>
            <p className="text-xl font-black text-red-500">${filteredExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0).toFixed(2)}</p>
        </div>
      </div>

      {/* INPUT FORM */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Date</label>
            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="p-2 bg-gray-50 rounded-lg text-xs font-bold" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Expense Name</label>
            <input type="text" placeholder="Item" value={formData.expenseName} onChange={e => setFormData({...formData, expenseName: e.target.value})} className="p-2 bg-gray-50 rounded-lg text-xs font-bold" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Category</label>
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="p-2 bg-gray-50 rounded-lg text-xs font-bold outline-none">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Supplier</label>
            <input type="text" placeholder="e.g. Amazon" value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} className="p-2 bg-gray-50 rounded-lg text-xs font-bold" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Paid Via</label>
            <select value={formData.paidVia} onChange={e => setFormData({...formData, paidVia: e.target.value})} className="p-2 bg-gray-50 rounded-lg text-xs font-bold outline-none">
                {paymentMethods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Amount</label>
            <input type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="p-2 bg-gray-50 rounded-lg text-xs font-bold" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="opacity-0">Save</label>
            <button onClick={handleSave} className="bg-pink-600 text-white p-2 rounded-lg text-[10px] font-black uppercase hover:bg-pink-700 transition-all shadow-md">{formData.id ? "Update Expense" : "Add Expense"}</button>
          </div>
      </div>

      {/* MULTI-FILTER BAR (With "All" Month Option) */}
      <div className="flex flex-wrap gap-6 bg-gray-50 p-4 rounded-xl items-center border border-gray-100">
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase">Filter Month:</span>
            <div className="flex items-center gap-2">
                <input 
                    type="month" 
                    value={filterMonth === "All" ? "" : filterMonth} 
                    onChange={e => setFilterMonth(e.target.value || "All")} 
                    className="bg-white border px-2 py-1 rounded-md text-xs font-bold" 
                />
                {filterMonth !== "All" && (
                    <button onClick={() => setFilterMonth("All")} className="text-[9px] font-black text-pink-500 uppercase border border-pink-200 px-2 py-1 rounded hover:bg-pink-50">Clear</button>
                )}
            </div>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase">Category:</span>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-white border px-2 py-1 rounded-md text-xs font-bold outline-none">
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase">Supplier:</span>
            <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="bg-white border px-2 py-1 rounded-md text-xs font-bold outline-none">
                {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Expense Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Paid Via</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-bold text-gray-600">
              {filteredExpenses.length > 0 ? filteredExpenses.map((ex) => (
                <tr key={ex.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">{ex.date?.seconds ? new Date(ex.date.seconds * 1000).toLocaleDateString() : ex.date}</td>
                  <td className="px-6 py-4 text-gray-800 uppercase tracking-tight">{ex.expenseName || ex.name || ex.item || ex.description || "Unnamed Expense"}</td>
                  <td className="px-6 py-4"><span className="bg-blue-50 text-blue-600 px-2 py-1 rounded uppercase text-[9px]">{ex.category}</span></td>
                  <td className="px-6 py-4 text-gray-400">{ex.supplier || "N/A"}</td>
                  <td className="px-6 py-4 text-[10px] text-gray-400">{ex.paidVia}</td>
                  <td className="px-6 py-4 text-right text-red-500 font-black">${Number(ex.amount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                   <button 
            onClick={() => {
                // This loads the data back into the top form for editing
                setFormData({
                    id: ex.id,
                    date: ex.date?.seconds 
                        ? new Date(ex.date.seconds * 1000).toISOString().split('T')[0] 
                        : new Date(ex.date).toISOString().split('T')[0],
                    expenseName: ex.expenseName || ex.name || ex.item || "",
                    category: ex.category || "Supplies",
                    supplier: ex.supplier || ex.vendor || "",
                    paidVia: ex.paidVia || "Credit Card",
                    amount: ex.amount || ex.price || 0,
                });
                // Smooth scroll back to top to edit
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }} 
            className="mr-2 text-blue-400 hover:text-blue-600 transition-colors"
        >
            <i className="fas fa-edit"></i>
        </button>
         <button onClick={() => handleDelete(ex.id, ex.path)} className="text-red-500 hover:text-red-500"><i className="fas fa-trash"></i></button>
                  </td>
                </tr>
              )) : (
                <tr>
                    <td colSpan="7" className="p-20 text-center text-gray-300 uppercase font-black tracking-widest">No matching records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}