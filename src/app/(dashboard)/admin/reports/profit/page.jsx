"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

export default function ProfitDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState([]);
  const [expenses, setExpenses] = useState([]); // NEW: Expense State
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    // 1. Fetch Earnings
    const qEarnings = query(collection(db, "salon_earnings"), orderBy("date", "desc"));
    const unsubEarnings = onSnapshot(qEarnings, (snap) => {
      setEarnings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Fetch Expenses
    const qExpenses = query(collection(db, "salon_expenses"), orderBy("date", "desc"));
    const unsubExpenses = onSnapshot(qExpenses, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubEarnings(); unsubExpenses(); };
  }, []);

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    // Filter Earnings for month
    const filteredEarnings = earnings.filter(report => {
      let d = report.date?.seconds ? new Date(report.date.seconds * 1000) : new Date(report.id);
      return d.toISOString().slice(0, 7) === selectedMonth;
    });

    // Filter Expenses for month
    const filteredExpenses = expenses.filter(ex => {
      let d = ex.date?.seconds ? new Date(ex.date.seconds * 1000) : new Date(ex.id.split('_')[0]);
      return d.toISOString().slice(0, 7) === selectedMonth;
    });

    let totalRev = 0;
    let totalCredit = 0;
    let totalCash = 0;
    let staffPayout = 0;

    filteredEarnings.forEach(day => {
      totalRev += day.totalRevenue || 0;
      totalCredit += day.totalCredit || 0;
      totalCash += day.totalCash || 0;
      // Example: 60% Payout to staff
      staffPayout += (day.totalRevenue || 0) * 0.60;
    });

    const totalExpenseAmount = filteredExpenses.reduce((sum, ex) => sum + parseFloat(ex.amount || 0), 0);
    
    // FINAL MATH: Gross - Staff - Operating Costs
    const netProfit = totalRev - staffPayout - totalExpenseAmount;

    return { 
      totalRev, 
      staffPayout, 
      totalExpenseAmount, 
      netProfit, 
      totalCredit,
      totalCash,
      daysCount: filteredEarnings.length 
    };
  }, [earnings, expenses, selectedMonth]);

  if (loading) return <div className="p-10 text-center font-bold text-gray-400 uppercase tracking-widest">Generating Financial Report...</div>;

  return (
    <div className="max-w-[95%] mx-auto space-y-8 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 italic uppercase">Profit Analytics</h1>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[4px] mt-2">True Net Performance</p>
        </div>
        <div className="bg-white p-2 rounded-xl shadow-sm border flex items-center gap-2">
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border-none bg-transparent font-bold p-2 outline-none cursor-pointer" />
        </div>
      </div>

      {/* TOP STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Gross Revenue</p>
          <p className="text-3xl font-black text-gray-800">${stats.totalRev.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Staff Payouts (60%)</p>
          <p className="text-3xl font-black text-red-400">-${stats.staffPayout.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Operating Expenses</p>
          <p className="text-3xl font-black text-orange-500">-${stats.totalExpenseAmount.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border-2 border-green-500 shadow-lg bg-green-50/10">
          <p className="text-[10px] font-black text-green-600 uppercase mb-2">True Net Profit</p>
          <p className="text-3xl font-black text-green-600">${stats.netProfit.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-green-400 mt-2 uppercase">Your Actual Earnings</p>
        </div>
      </div>

      {/* BREAKDOWN BOXES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">Financial Summary</h3>
          <div className="space-y-4">
             <div className="flex justify-between py-3 border-b border-gray-50">
                <span className="text-xs font-bold text-gray-400 uppercase">Cash Collected</span>
                <span className="text-xs font-black text-gray-700">${stats.totalCash.toLocaleString()}</span>
             </div>
             <div className="flex justify-between py-3 border-b border-gray-50">
                <span className="text-xs font-bold text-gray-400 uppercase">Credit Collected</span>
                <span className="text-xs font-black text-gray-700">${stats.totalCredit.toLocaleString()}</span>
             </div>
             <div className="flex justify-between py-3">
                <span className="text-xs font-bold text-gray-400 uppercase">Profit Margin</span>
                <span className="text-xs font-black text-blue-600">
                    {stats.totalRev > 0 ? ((stats.netProfit / stats.totalRev) * 100).toFixed(1) : 0}%
                </span>
             </div>
          </div>
        </div>

        <div className="bg-gray-900 p-8 rounded-xl shadow-xl text-white">
           <h3 className="text-sm font-black uppercase tracking-widest mb-6 text-pink-500">Expense Alert</h3>
           <p className="text-sm opacity-80 leading-relaxed mb-6">
              You have spent <b>${stats.totalExpenseAmount.toLocaleString()}</b> on bills and supplies this month. 
              This accounts for <b>{stats.totalRev > 0 ? ((stats.totalExpenseAmount / stats.totalRev) * 100).toFixed(1) : 0}%</b> of your gross income.
           </p>
           <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">
              View Detailed Expenses
           </button>
        </div>
      </div>
    </div>
  );
}