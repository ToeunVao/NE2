"use client";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getDoc, doc, updateDoc, serverTimestamp, collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
export default function ClientDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [upcomingAppts, setUpcomingAppts] = useState([]);
  const [pastAppts, setPastAppts] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalSpend: 0,
    giftCardBalance: 0, // We will calculate this if you have a gift cards collection
    loyaltyPoints: 0    // Suggested 4th card!
  });
  
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
    if (!currentUser) {
      router.push("/");
      return;
    }
    setUser(currentUser);

    // 1. Fetch Client Profile to get their Phone Number
    const clientDoc = await getDoc(doc(db, "clients", currentUser.uid));
    let userPhone = "";
    if (clientDoc.exists()) {
      userPhone = clientDoc.data().phone;
    }

    // 2. Fetch Appointments (Keep your existing code here)
    const qAppts = query(
      collection(db, "appointments"), 
      where("clientId", "==", currentUser.uid),
      orderBy("appointmentTimestamp", "desc")
    );

    const unsubAppts = onSnapshot(qAppts, (snap) => {
      const allAppts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = new Date();
      const upcoming = allAppts.filter(a => a.appointmentTimestamp.toDate() >= now && a.status !== 'cancelled');
      const past = allAppts.filter(a => a.appointmentTimestamp.toDate() < now || a.status === 'cancelled');
      const spend = past.reduce((sum, appt) => sum + (Number(appt.price) || 0), 0);

      setUpcomingAppts(upcoming);
      setPastAppts(past);
      setStats(prev => ({
        ...prev,
        totalBookings: allAppts.length,
        totalSpend: spend,
        loyaltyPoints: Math.floor(spend * 0.10)
      }));
    });

    // 3. NEW: Fetch Gift Card Balance
    // Assuming your collection is called "giftcards" and stores "phone" and "balance"
    if (userPhone) {
      const qCards = query(
        collection(db, "giftcards"), 
        where("phone", "==", userPhone) 
      );

      const unsubCards = onSnapshot(qCards, (snap) => {
        const totalBalance = snap.docs.reduce((sum, doc) => sum + (Number(doc.data().balance) || 0), 0);
        setStats(prev => ({
          ...prev,
          giftCardBalance: totalBalance
        }));
      });
      
      return () => {
        unsubAppts();
        unsubCards();
      };
    }

    return () => unsubAppts();
  });

  return () => unsubscribeAuth();
}, [router]);

  // Add this function inside your ClientDashboard component
const handleCancel = async (apptId) => {
  const confirmCancel = window.confirm("Do you want to cancel this appointment?");
  if (!confirmCancel) return;

  try {
    const apptRef = doc(db, "appointments", apptId);
    await updateDoc(apptRef, {
      status: "cancelled",
      isRead: false, // CRITICAL: This makes it appear in the Admin Notification Center
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp() 
    });
    // If you have showToast: showToast("Appointment cancelled", "success");
  } catch (err) {
    console.error("Error cancelling:", err);
  }
};

 // if (loading) return <div className="min-h-screen flex items-center justify-center text-pink-500 font-bold tracking-widest uppercase">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
     
      <div className="max-w-5xl mx-auto px-6 mt-8 space-y-8">
        
        {/* 1. STATISTIC CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total Bookings</p>
            <p className="text-2xl font-black text-gray-900">{stats.totalBookings}</p>
          </div>
        {/* <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total Spend</p>
            <p className="text-2xl font-black text-gray-900">${stats.totalSpend}</p>
          </div>*/}
     <div className="bg-gradient-to-br from-pink-500 to-rose-500 p-5 rounded-xl border border-pink-500 shadow-sm text-white relative overflow-hidden">
         <p className="text-[10px] text-pink-200 font-black uppercase tracking-widest mb-1">Gift Card Balance</p>
   <p className="text-2xl font-black">${stats.giftCardBalance}</p>
  
  {/* Subtle icon in the corner */}
  <i className="fas fa-gift absolute -right-2 -bottom-2 text-4xl text-white/10 rotate-12"></i>
</div> {/*
          <div className="bg-gradient-to-br from-pink-500 to-rose-500 p-5 rounded-xl border border-pink-500 shadow-sm text-white">
            <p className="text-[10px] text-pink-200 font-black uppercase tracking-widest mb-1">Loyalty Points</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black">{stats.loyaltyPoints}</p>
              <span className="text-xs font-medium text-pink-100">pts</span>
            </div>
          </div>*/}
        </div>

        {/* 2. UPCOMING APPOINTMENT */}
{/* 2. UPCOMING APPOINTMENTS */}
<div>
  <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-4">Upcoming Appointments</h2>
  {upcomingAppts.length === 0 ? (
    <div className="bg-white p-6 rounded-xl border border-dashed border-gray-200 text-center">
      <p className="text-gray-500 text-xs">No upcoming visits.</p>
    </div>
  ) : (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-2">
      {/* IMPORTANT: This 'appt' variable only exists inside this arrow function. 
          Make sure the opening parenthesis '(' is right after the '=>' 
      */}
      {upcomingAppts.map((appt) => (
        <div key={appt.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group">
          <div className="flex items-center gap-3">
            {/* Date Badge */}
            <div className="bg-pink-50 min-w-[45px] py-1.5 rounded-lg flex flex-col items-center justify-center">
              <span className="text-[8px] font-black text-pink-400 uppercase leading-none">
                {appt.appointmentTimestamp?.toDate().toLocaleString('default', { month: 'short' })}
              </span>
              <span className="text-base font-black text-pink-600 leading-none mt-1">
                {appt.appointmentTimestamp?.toDate().getDate()}
              </span>
            </div>
            
            {/* Details */}
            <div>
              <h3 className="font-bold text-xs text-gray-900 leading-tight">{appt.service}</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {appt.appointmentTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {appt.technician}
              </p>
            </div>
          </div>

          {/* Action Icon Button */}
          <button 
            onClick={() => handleCancel(appt.id)}
            title="Cancel Appointment"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer border-none bg-transparent"
          >
            <i className="fas fa-trash-alt text-xs"></i>
          </button>
        </div>
      ))}
    </div>
  )}
</div>

        {/* 3. PAST HISTORY (Optional but recommended) */}
        {pastAppts.length > 0 && (
          <div>
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Past History</h2>
            <div className=" grid gap-3 grid-cols-2 sm:grid-cols-2  overflow-hidden">
              {pastAppts.map((appt, i) => (
                <div key={appt.id} className={`p-4 bg-white  rounded-xl border border-gray-100 flex justify-between items-center ${i !== pastAppts.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div>
                    <p className="font-black text-sm text-gray-900">{appt.service}</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">{appt.appointmentTimestamp.toDate().toLocaleDateString()} • {appt.technician}</p>
                  </div>
                  <span className={`px-2 py-1  text-[9px] font-black uppercase ${appt.status === 'cancelled' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                    {appt.status || 'Completed'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}