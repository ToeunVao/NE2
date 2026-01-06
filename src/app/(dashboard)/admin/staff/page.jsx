"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";

export default function StaffPayroll() {
  const [staff, setStaff] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    // 1. Fetch Staff Members (users collection)
    const unsubStaff = onSnapshot(collection(db, "users"), (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Fetch Earnings for the selected day
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23,59,59,999);

    const q = query(
      collection(db, "salon_earnings"), 
      where("date", "==", selectedDate)
    );

    const unsubEarnings = onSnapshot(q, (snap) => {
      setEarnings(snap.docs.map(doc => doc.data()));
    });

    return () => { unsubStaff(); unsubEarnings(); };
  }, [selectedDate]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-gray-800">Staff & Payroll</h1>
          <p className="text-gray-500 italic">Tracking commission and tips based on your salon rules</p>
        </div>
        <input 
          type="date" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-pink-500 font-bold text-gray-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {staff.filter(s => s.role !== 'admin').map((member) => {
          // Logic from your script: Filter earnings for this specific staff member
          const staffSales = earnings.filter(e => e.staffId === member.id || e.staffName === member.name);
          const totalRevenue = staffSales.reduce((acc, curr) => acc + (curr.total || 0), 0);
          const totalTips = staffSales.reduce((acc, curr) => acc + (curr.tip || 0), 0);
          
          // Commission Logic from your script.js (default to 60% if not set)
          const rate = member.commissionRate || 60;
          const commissionEarned = (totalRevenue * rate) / 100;
          const takeHomePay = commissionEarned + totalTips;

          return (
            <div key={member.id} className="bg-white p-8 rounded-[3rem] border border-gray-50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 group hover:shadow-md transition-all">
              <div className="flex items-center gap-6 w-full md:w-1/3">
                <div className="w-16 h-16 bg-pink-100 rounded-[1.5rem] flex items-center justify-center text-pink-600 font-bold text-2xl">
                  {member.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{member.name}</h3>
                  <p className="text-xs font-bold text-pink-400 uppercase tracking-widest">{rate}% Commission Rate</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full">
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Sales</p>
                  <p className="text-lg font-bold text-gray-800">${totalRevenue.toFixed(2)}</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Commission</p>
                  <p className="text-lg font-bold text-green-600">${commissionEarned.toFixed(2)}</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tips</p>
                  <p className="text-lg font-bold text-blue-600">${totalTips.toFixed(2)}</p>
                </div>
                <div className="text-center md:text-right bg-pink-50 p-3 rounded-2xl">
                  <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">Total Payout</p>
                  <p className="text-xl font-bold text-pink-600">${takeHomePay.toFixed(2)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}