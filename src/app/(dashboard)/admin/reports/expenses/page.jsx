"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  collectionGroup, 
  query, 
  orderBy, 
  onSnapshot, 
  doc,       // Add this
  setDoc,     // Add this
  deleteDoc,  // Add this
  serverTimestamp 
} from "firebase/firestore";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MonthlyExpensePage() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  
  // --- DATE HELPERS ---
  const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now - offset).toISOString().split('T')[0];
  };

  const getFirstDayOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
      .toISOString().split('T')[0];
  };

  // --- UPDATED FILTER STATES ---
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getLocalDate());
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterSupplier, setFilterSupplier] = useState("All");

  const categories = ["Rent", "Supplies", "Electricity", "Water", "Insurance", "Marketing", "Repairs", "Other"];
  const paymentMethods = ["Cash", "Credit Card", "Check", "Venmo", "Square"];

  const initialFormState = {
    date: getLocalDate(),
    expenseName: "",
    category: "Supplies",
    supplier: "",
    paidVia: "Credit Card",
    amount: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  // --- DATE FORMATTER HELPER (MM/DD/YYYY) ---
  const formatDateDisplay = (dateValue) => {
    if (!dateValue) return "N/A";
    let d;
    if (dateValue?.seconds) d = new Date(dateValue.seconds * 1000);
    else d = new Date(dateValue + 'T12:00:00');
    
    if (isNaN(d.getTime())) return "Invalid Date";
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  // --- DATA LOADING ---
  useEffect(() => {
    const q = query(collectionGroup(db, "expenses"));
    const unsub = onSnapshot(q, (snap) => {
      let data = snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() }));
      data.sort((a, b) => {
        const dateA = a.date?.seconds ? a.date.seconds : new Date(a.date).getTime();
        const dateB = b.date?.seconds ? b.date.seconds : new Date(b.date).getTime();
        return dateB - dateA;
      });
      setExpenses(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // --- FILTER LOGIC ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter(ex => {
      let exDateStr;
      if (ex.date?.seconds) {
        exDateStr = new Date(ex.date.seconds * 1000).toISOString().split('T')[0];
      } else if (typeof ex.date === 'string') {
        exDateStr = ex.date;
      } else {
        exDateStr = new Date(ex.date).toISOString().split('T')[0];
      }

      const matchDate = exDateStr >= startDate && exDateStr <= endDate;
      const matchCat = filterCategory === "All" || ex.category === filterCategory;
      const currentSupplier = ex.supplier || "N/A";
      const matchSup = filterSupplier === "All" || currentSupplier === filterSupplier;

      return matchDate && matchCat && matchSup;
    });
  }, [expenses, startDate, endDate, filterCategory, filterSupplier]);

  const uniqueSuppliers = useMemo(() => {
    const sups = expenses.map(e => e.supplier).filter(s => s && s.trim() !== "");
    return ["All", ...new Set(sups)];
  }, [expenses]);

  const subtotal = useMemo(() => {
    return filteredExpenses.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
  }, [filteredExpenses]);

const handleSave = async () => {
  if (!formData.amount || !formData.expenseName) return alert("Please fill in required fields");
  
  try {
    // 1. Determine the ID (use existing ID if editing, otherwise create new)
    const docId = formData.id ? String(formData.id) : `${formData.date}_${Date.now()}`;
    
    // 2. Prepare clean data
    const cleanData = {
      expenseName: formData.expenseName || "",
      category: formData.category || "Supplies",
      supplier: formData.supplier || "",
      paidVia: formData.paidVia || "Credit Card",
      amount: parseFloat(formData.amount) || 0,
      date: formData.date,
      updatedAt: serverTimestamp()
    };

    // 3. CORRECT METHOD: Use setDoc to save/update
    // We use "expenses" here to match your old rules
    await setDoc(doc(db, "expenses", docId), cleanData);
    
    setFormData(initialFormState);
    alert("Saved successfully!");
  } catch (e) {
    console.error("Save Error:", e);
    alert("Error: " + e.message);
  }
};

 const handleDelete = async (docId, docPath) => {
  if (!window.confirm("Are you sure you want to delete this expense?")) return;
  try {
    // If docPath is provided by Firestore, use it; otherwise, use the default collection
    const targetPath = docPath || `expenses/${docId}`;
    await deleteDoc(doc(db, targetPath));
    alert("Expense deleted successfully");
  } catch (error) {
    alert("Error deleting: " + error.message);
  }
};

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('en-US');

    doc.setFontSize(20);
    doc.setTextColor(214, 51, 132); 
    doc.text("Nails Express", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Report Generated: ${today}`, 196, 20, { align: 'right' });

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Expense Report", 14, 32);
    
    doc.setFontSize(9);
    doc.text(`Period: ${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)} | Category: ${filterCategory}`, 14, 38);

    const tableColumn = ["Date", "Expense Name", "Category", "Supplier", "Paid Via", "Amount"];
    const tableRows = filteredExpenses.map(ex => [
      formatDateDisplay(ex.date),
      ex.expenseName || ex.name || "N/A",
      ex.category || "",
      ex.supplier || "N/A",
      ex.paidVia || "",
      `$${Number(ex.amount).toFixed(2)}`
    ]);

    tableRows.push([
      { content: 'TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: `$${subtotal.toFixed(2)}`, styles: { fontStyle: 'bold', textColor: [214, 51, 132] } }
    ]);

    autoTable(doc, {
      startY: 45,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [214, 51, 132] },
      styles: { fontSize: 8 },
    });

    doc.save(`Expenses_${startDate}_to_${endDate}.pdf`);
  };
// Get unique Expense Names for autocomplete
const existingNames = useMemo(() => {
  const names = expenses.map(e => e.expenseName || e.name).filter(Boolean);
  return [...new Set(names)].sort();
}, [expenses]);

// Get unique Suppliers for autocomplete
const existingSuppliers = useMemo(() => {
  const sups = expenses.map(e => e.supplier).filter(Boolean);
  return [...new Set(sups)].sort();
}, [expenses]);


  if (loading) return <div className="p-10 text-center font-bold text-gray-400 uppercase">Loading All Expenses...</div>;

  return (
    <div className="max-w-[95%] mx-auto space-y-6 pb-20">
<style dangerouslySetInnerHTML={{ __html: `
  @media print {
  th:nth-child(2), td:nth-child(2) { width: 25%; } /* Give Name column set width */
  th:nth-child(6), td:nth-child(6) { width: 15%; } /* Ensure Amount has room */
    /* Hide navigation, sidebar, and UI elements */
    nav, aside, header, .print-hidden, .print\\:hidden, button, form, .no-print {
      display: none !important;
    }

    /* Reset layout for paper to ensure full width */
    body, .max-w-\\[95\\%\\] {
      padding: 0 !important;
      margin: 0 !important;
      background: white !important;
      max-width: 100% !important;
      width: 100% !important;
    }

    /* FIX: Force the table container to show everything */
    .overflow-x-auto {
      overflow: visible !important;
    }

    /* Force table to fit on the page */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: auto !important;
      font-size: 9pt !important; /* Slightly smaller to fit all columns */
    }
    
    th, td {
      border: 1px solid #eee !important;
      padding: 6px 4px !important;
      white-space: normal !important; /* Allow text to wrap if needed */
    }

    /* Ensure specific columns are visible */
    th:nth-child(5), td:nth-child(5), /* Paid Via */
    th:nth-child(6), td:nth-child(6)  /* Amount */ {
      display: table-cell !important;
    }

    .print-only-header {
      display: flex !important;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #D63384;
      margin-bottom: 20px;
      padding-bottom: 10px;
    }
  }

  .print-only-header {
    display: none;
  }
`}} />

      {/* PRINT ONLY HEADER */}
      <div className="print-only-header w-full">
        <div>
          <h1 className="text-2xl font-black text-pink-600 uppercase">Nails Express</h1>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Expense Report: {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase">Generated On</p>
          <p className="text-sm font-bold">{new Date().toLocaleDateString('en-US')}</p>
        </div>
      </div>

      {/* ON-SCREEN HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-end print:hidden">
        <div>
            <h1 className="text-2xl font-black text-gray-800 uppercase italic">Expense Ledger</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Displaying: {formatDateDisplay(startDate)} TO {formatDateDisplay(endDate)}</p>
        </div>
        <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase">Visible Total</p>
            <p className="text-xl font-black text-red-500">${subtotal.toFixed(2)}</p>
        </div>
      </div>

      {/* INPUT FORM */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 print:hidden">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Date</label>
            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="p-2 bg-gray-50 rounded-lg text-xs font-bold" />
          </div>
         <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase">Expense Name</label>
     <input 
  type="text" 
  list="expense-names"
  placeholder="Item Name" 
  value={formData.expenseName || ""} // Add || "" here
  onChange={e => setFormData({...formData, expenseName: e.target.value})} 
  className="p-2 bg-gray-50 rounded-lg text-xs font-bold" 
/>
      <datalist id="expense-names">
        {existingNames.map(name => <option key={name} value={name} />)}
      </datalist>
    </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Category</label>
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="p-2 bg-gray-50 rounded-lg text-xs font-bold outline-none">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
         <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase">Supplier</label>
     <input 
  type="text" 
  list="supplier-names"
  placeholder="e.g. Amazon" 
  value={formData.supplier || ""} // Add || "" here
  onChange={e => setFormData({...formData, supplier: e.target.value})} 
  className="p-2 bg-gray-50 rounded-lg text-xs font-bold" 
/>
      <datalist id="supplier-names">
        {existingSuppliers.map(sup => <option key={sup} value={sup} />)}
      </datalist>
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
            <button onClick={handleSave} className="bg-pink-600 text-white p-2 rounded-lg text-[10px] font-black uppercase hover:bg-pink-700 transition-all shadow-md">{formData.id ? "Update" : "Add"}</button>
          </div>
      </div>

      {/* MULTI-FILTER BAR */}
      <div className="flex flex-wrap gap-6 bg-gray-50 p-4 rounded-xl items-center border border-gray-100 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase">From:</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white border px-2 py-1 rounded-md text-xs font-bold" />
          <span className="text-[10px] font-black text-gray-400 uppercase">To:</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white border px-2 py-1 rounded-md text-xs font-bold" />
        </div>

        <div className="flex gap-1 pl-2 border-l border-gray-200">
          <button onClick={() => { setStartDate(getLocalDate()); setEndDate(getLocalDate()); }} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${startDate === getLocalDate() && endDate === getLocalDate() ? 'bg-pink-600 text-white' : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-100'}`}>Today</button>
          <button onClick={() => { setStartDate(getFirstDayOfMonth()); setEndDate(getLocalDate()); }} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${startDate === getFirstDayOfMonth() ? 'bg-pink-600 text-white' : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-100'}`}>This Month</button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category:</span>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-white border px-2 py-1 rounded-md text-xs font-bold outline-none">
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier:</span>
          <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="bg-white border px-2 py-1 rounded-md text-xs font-bold outline-none">
            {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex-1"></div>

        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase text-gray-600 hover:bg-gray-50 shadow-sm"><i className="fas fa-print text-blue-500"></i>Print</button>
          <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl text-[10px] font-black uppercase text-white hover:bg-black shadow-md"><i className="fas fa-file-pdf text-red-400"></i>PDF</button>
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
    {/* Ensure this stays on the right even in print */}
    <th className="px-6 py-4 text-right">Amount</th>
    <th className="px-6 py-4 text-center print:hidden">Action</th>
  </tr>
</thead>
            <tbody className="divide-y divide-gray-100 text-xs font-bold text-gray-600">
              {filteredExpenses.length > 0 ? filteredExpenses.map((ex) => (
                <tr key={ex.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">{formatDateDisplay(ex.date)}</td>
                 <td className="px-6 py-4 text-gray-800 uppercase tracking-tight max-w-[200px] whitespace-normal break-words">
  {ex.expenseName || ex.name || "N/A"}
</td>
                  <td className="px-6 py-4"><span className="bg-blue-50 text-blue-600 px-2 py-1 rounded uppercase text-[9px]">{ex.category}</span></td>
                  <td className="px-6 py-4 text-gray-400">{ex.supplier || "N/A"}</td>
                  <td className="px-6 py-4 text-[10px] text-gray-400">{ex.paidVia}</td>
                  <td className="px-6 py-4 text-right text-red-500 font-black">${Number(ex.amount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-center print:hidden">
                    <button onClick={() => {
    // This loads the data back into the top form for editing
    setFormData({
        id: ex.id,
        // Ensure date is valid for the input type="date"
        date: ex.date?.seconds 
            ? new Date(ex.date.seconds * 1000).toISOString().split('T')[0] 
            : (ex.date || getLocalDate()),
        // FALLBACKS: Use || "" to prevent 'uncontrolled input' error
        expenseName: ex.expenseName || ex.name || ex.item || "",
        category: ex.category || "Supplies",
        supplier: ex.supplier || ex.vendor || "",
        paidVia: ex.paidVia || "Credit Card",
        amount: ex.amount || "",
    });
    // Smooth scroll back to top to edit
    window.scrollTo({ top: 0, behavior: 'smooth' });
}} className="mr-2 text-blue-400 hover:text-blue-600"><i className="fas fa-edit"></i></button>
                    <button onClick={() => handleDelete(ex.id, ex.path)} className="text-red-400 hover:text-red-600"><i className="fas fa-trash"></i></button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="p-20 text-center text-gray-300 uppercase font-black tracking-widest">No matching records found</td></tr>
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot className="bg-gray-100/50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-right">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mr-2">Subtotal for Filtered View:</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-lg font-black text-pink-600">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </td>
                  <td className="px-6 py-4 print:hidden"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}