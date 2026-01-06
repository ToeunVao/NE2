"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  doc, 
  updateDoc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "firebase/firestore";

export default function POSPage() {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    // Only show appointments that are confirmed but NOT yet completed
    const q = query(collection(db, "appointments"), where("status", "==", "confirmed"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleCheckout = async () => {
    if (!selectedAppt) return;

    const basePrice = Number(selectedAppt.price) || 0;
    const totalTip = Number(tip) || 0;
    const totalAmount = basePrice + totalTip;
    
    // Loyalty Logic: 1 point for every $10 spent
    const pointsEarned = Math.floor(basePrice / 10);

    try {
      // 1. Record the Financial Transaction
      await addDoc(collection(db, "transactions"), {
        customerName: selectedAppt.name,
        technician: selectedAppt.technician,
        service: selectedAppt.service,
        basePrice: basePrice,
        tip: totalTip,
        total: totalAmount,
        date: serverTimestamp()
      });

      // 2. Update the Permanent Client Profile & Loyalty Points
      const clientRef = doc(db, "clients", selectedAppt.name); // Using Name as ID for now
      const clientSnap = await getDoc(clientRef);

      if (clientSnap.exists()) {
        // Update existing client
        await updateDoc(clientRef, {
          points: (clientSnap.data().points || 0) + pointsEarned,
          totalSpent: (clientSnap.data().totalSpent || 0) + basePrice,
          lastVisit: serverTimestamp(),
          phone: selectedAppt.phone // Ensure phone is kept up to date
        });
      } else {
        // Create brand new client profile
        await setDoc(clientRef, {
          name: selectedAppt.name,
          phone: selectedAppt.phone || "No Phone",
          points: pointsEarned,
          totalSpent: basePrice,
          joinedAt: serverTimestamp(),
          lastVisit: serverTimestamp()
        });
      }

      // 3. Mark the Appointment as Finished
      await updateDoc(doc(db, "appointments", selectedAppt.id), {
        status: "completed"
      });

      alert(`Success! ${selectedAppt.name} earned ${pointsEarned} points.`);
      setSelectedAppt(null);
      setTip(0);

    } catch (error) {
      console.error("Checkout failed:", error);
      alert("Error processing checkout. Check console.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <h1 className="text-3xl font-bold font-serif">Checkout Counter</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appointments.length === 0 ? (
            <p className="text-gray-400 italic">No confirmed appointments ready for checkout.</p>
          ) : (
            appointments.map(appt => (
              <button 
                key={appt.id}
                onClick={() => setSelectedAppt(appt)}
                className={`p-6 rounded-[2rem] text-left border-2 transition-all ${
                  selectedAppt?.id === appt.id ? "border-pink-500 bg-pink-50" : "border-gray-100 bg-white"
                }`}
              >
                <p className="font-bold text-gray-800">{appt.name}</p>
                <p className="text-xs text-pink-600 font-bold uppercase">{appt.service}</p>
                <p className="text-lg font-bold mt-2">${appt.price}</p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50">
          <h2 className="text-xl font-bold mb-6">Payment Summary</h2>
          {selectedAppt ? (
            <div className="space-y-4">
              <div className="flex justify-between text-gray-600">
                <span>{selectedAppt.service}</span>
                <span>${selectedAppt.price}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium text-sm">Add Tip</span>
                <input 
                  type="number" 
                  className="w-24 p-2 bg-gray-50 rounded-xl text-right font-bold outline-none focus:ring-2 focus:ring-pink-500"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                />
              </div>
              <div className="pt-4 border-t flex justify-between text-2xl font-bold text-gray-800">
                <span>Total</span>
                <span>${Number(selectedAppt.price) + Number(tip)}</span>
              </div>
              <button 
                onClick={handleCheckout}
                className="w-full bg-pink-600 text-white font-bold py-4 rounded-2xl mt-6 hover:bg-pink-700 shadow-lg"
              >
                Complete Sale
              </button>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-10">Select a client to start.</p>
          )}
        </div>
      </div>
    </div>
  );
}