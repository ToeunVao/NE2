"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { startOfDay, endOfDay } from "date-fns";

export default function AdminOverview() {
  const [stats, setStats] = useState({
    revenue: 0,
    appointments: 0,
    pending: 0,
    avgTicket: 0
  });

  useEffect(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // Listen for all appointments today
    const q = query(
      collection(db, "appointments"),
      where("appointmentTimestamp", ">=", todayStart),
      where("appointmentTimestamp", "<=", todayEnd)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      let totalRev = 0;
      let apptCount = snap.docs.length;
      let pendingCount = 0;

      snap.docs.forEach(doc => {
        const data = doc.data();
        totalRev += Number(data.price || 0);
        if (data.status === 'pending') pendingCount++;
      });

      setStats({
        revenue: totalRev,
        appointments: apptCount,
        pending: pendingCount,
        avgTicket: apptCount > 0 ? totalRev / apptCount : 0
      });
    });

    return () => unsubscribe();
  }, []);

  const cards = [
    { title: "Today's Revenue", value: `$${stats.revenue}`, icon: "fa-dollar-sign", color: "bg-green-500" },
    { title: "Appointments", value: stats.appointments, icon: "fa-calendar-check", color: "bg-blue-500" },
    { title: "Pending Requests", value: stats.pending, icon: "fa-clock", color: "bg-orange-500" },
    { title: "Avg. Sale", value: `$${stats.avgTicket.toFixed(2)}`, icon: "fa-chart-line", color: "bg-purple-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-serif text-gray-800">Business Dashboard</h1>
        <p className="text-gray-500 mt-1">Here is what's happening at NailsXpress today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className={`${card.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg`}>
              <i className={`fas ${card.icon}`}></i>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{card.title}</p>
              <h3 className="text-2xl font-bold text-gray-800">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* We can add a "Recent Activity" list or a "Staff Performance" chart here next */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm min-h-[300px]">
          <h3 className="font-bold text-gray-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="p-4 bg-pink-50 rounded-2xl text-pink-600 font-bold hover:bg-pink-100 transition-all text-sm">
              <i className="fas fa-plus mb-2 block text-xl"></i> New Booking
            </button>
            <button className="p-4 bg-gray-50 rounded-2xl text-gray-600 font-bold hover:bg-gray-100 transition-all text-sm">
              <i className="fas fa-print mb-2 block text-xl"></i> Daily Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}