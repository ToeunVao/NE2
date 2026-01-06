"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

export default function EarningsPage() {
  const [transactions, setTransactions] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    // 1. Get Staff to know their commission rates
    const unsubStaff = onSnapshot(collection(db, "staff"), (snap) => {
      setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Get Transactions
    const q = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsubTrans = onSnapshot(q, (snap) => {
      const transData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(transData);
      setTotalRevenue(transData.reduce((sum, t) => sum + t.total, 0));
    });

    return () => { unsubStaff(); unsubTrans(); };
  }, []);

  // Logic to calculate how much a specific staff member earned
  const calculatePayroll = (staffName) => {
    const staffMember = staffList.find(s => s.name === staffName);
    const rate = staffMember ? staffMember.commissionRate / 100 : 0.5; // Default 50%
    
    const staffSales = transactions
      .filter(t => t.technician === staffName)
      .reduce((sum, t) => sum + t.basePrice, 0);

    const staffTips = transactions
      .filter(t => t.technician === staffName)
      .reduce((sum, t) => sum + t.tip, 0);

    return {
      commission: staffSales * rate,
      tips: staffTips,
      totalPayout: (staffSales * rate) + staffTips
    };
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-900 p-10 rounded-[3rem] text-white shadow-2xl">
        <p className="text-gray-400 font-bold uppercase tracking-tighter">Total Salon Volume</p>
        <h1 className="text-6xl font-bold mt-2">${totalRevenue.toLocaleString()}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payroll Table */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold mb-6 font-serif">Staff Payouts</h2>
          <div className="space-y-4">
            {staffList.map(staff => {
              const payroll = calculatePayroll(staff.name);
              return (
                <div key={staff.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                  <div>
                    <p className="font-bold text-gray-800">{staff.name}</p>
                    <p className="text-xs text-gray-400">Rate: {staff.commissionRate}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-pink-600">${payroll.totalPayout.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Incl. Tips</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold mb-6 font-serif">Recent Sales</h2>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {transactions.map(t => (
              <div key={t.id} className="py-4 flex justify-between">
                <div>
                  <p className="font-bold text-sm text-gray-800">{t.customerName}</p>
                  <p className="text-xs text-gray-400">{t.service} by {t.technician}</p>
                </div>
                <p className="font-bold text-gray-900">${t.total}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}