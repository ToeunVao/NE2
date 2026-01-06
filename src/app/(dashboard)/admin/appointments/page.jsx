"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { format } from "date-fns";
import emailjs from "@emailjs/browser";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "appointments"), orderBy("appointmentTimestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const sendConfirmationEmail = (appt) => {
    const templateParams = {
      customer_name: appt.name,
      service: appt.service,
      time: format(appt.appointmentTimestamp.toDate(), "PPPP p"),
      to_email: appt.email, // Ensure your booking form collects emails!
    };

    emailjs.send(
      "service_j3vq4ds",
      "nailxpress",
      templateParams,
      "VK2ghzXAUeQ2_XT8w"
    ).then(() => {
      console.log("Email sent successfully!");
    });
  };

  const updateStatus = async (appt, newStatus) => {
    await updateDoc(doc(db, "appointments", appt.id), { status: newStatus });
    
    // Trigger email only when status becomes 'confirmed'
    if (newStatus === "confirmed" && appt.email) {
      sendConfirmationEmail(appt);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-serif text-gray-800">Live Bookings</h1>
        <div className="flex gap-2">
            <span className="bg-pink-100 text-pink-600 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                {appointments.length} Total
            </span>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50 border-b border-gray-100">
            <tr>
              <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer</th>
              <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Service</th>
              <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Schedule</th>
              <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {appointments.map((appt) => (
              <tr key={appt.id} className="hover:bg-pink-50/10 transition-colors">
                <td className="px-8 py-5">
                  <p className="font-bold text-gray-800">{appt.name}</p>
                  <p className="text-xs text-gray-400">{appt.email || appt.phone}</p>
                </td>
                <td className="px-8 py-5">
                  <span className="text-xs font-bold text-pink-500 bg-pink-50 px-3 py-1 rounded-lg">
                    {appt.service}
                  </span>
                </td>
                <td className="px-8 py-5 text-sm text-gray-600">
                  {appt.appointmentTimestamp ? format(appt.appointmentTimestamp.toDate(), "MMM d, h:mm a") : "N/A"}
                </td>
                <td className="px-8 py-5">
                  <select 
                    value={appt.status} 
                    onChange={(e) => updateStatus(appt, e.target.value)}
                    className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-full border-none outline-none ring-1 cursor-pointer transition-all ${
                      appt.status === 'confirmed' ? 'bg-green-100 text-green-600 ring-green-200' : 
                      appt.status === 'pending' ? 'bg-orange-100 text-orange-600 ring-orange-200' : 'bg-gray-100 text-gray-500 ring-gray-200'
                    }`}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="no-show">No Show</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}