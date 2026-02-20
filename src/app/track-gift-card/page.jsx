"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";

export default function PublicGiftCardTracker() {
  const [cardNumber, setCardNumber] = useState("");
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

const handleTrack = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError("");
  setCardData(null);

  try {
    const input = cardNumber.trim();
    
    // 1. Point to "gift_cards" (underscore)
    // 2. Search for "code" instead of "cardNumber"
    const q = query(
      collection(db, "gift_cards"), 
      where("code", "in", [input, input.toUpperCase(), `GC-${input}`])
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      setError("Gift card not found. Please check the number.");
    } else {
     // Inside your handleTrack function...
const docData = querySnapshot.docs[0].data();
setCardData({ 
  id: querySnapshot.docs[0].id, 
  ...docData, // This pulls in the 'history' array automatically
customerName: docData.recipientName || "Valued Client", 
  expiryDate: docData.expirationDate?.toDate()?.toLocaleDateString() || "No Expiry"
});
    }
  } catch (err) {
    setError("Error connecting to database.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-auto max-w-md bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-black text-gray-800 tracking-tighter uppercase mb-2">Gift Card Tracker</h1>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Check your balance & status</p>

        <form onSubmit={handleTrack} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Card Number</label>
            <input
              type="text"
              placeholder="Enter your card number"
              className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-pink-500 font-bold"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              required
            />
          </div>
          <button
            disabled={loading}
            className="w-full py-4 bg-pink-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-pink-700 transition-all disabled:opacity-50"
          >
            {loading ? "Searching..." : "Track My Card"}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold text-center">
            {error}
          </div>
        )}

        {cardData && (
          <div className="mt-8 p-6 bg-pink-50 rounded-xl border border-pink-100 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest">Available Balance</p>
                <h2 className="text-4xl font-black text-pink-600 tracking-tighter">
                  ${Number(cardData.balance).toFixed(2)}
                </h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${cardData.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                {cardData.status}
              </span>
            </div>

            <div className="space-y-2 pt-4 border-t border-pink-100">
              <div className="flex justify-between text-[10px] font-bold uppercase text-pink-400">
                <span>Card Holder</span>
                <span className="text-pink-600">{cardData.customerName}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase text-pink-400">
                <span>Expiry Date</span>
                <span className="text-pink-600">{cardData.expiryDate || "No Expiry"}</span>
              </div>
            </div>
          </div>
        )}
{/* TRANSACTION HISTORY SECTION */}
<div className="mt-6 pt-6 border-t border-pink-100">
  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
    Detailed History
  </h3>
  
  <div className="space-y-3">
    {cardData?.history && cardData.history.length > 0 ? (
      // Sort history to show newest first
      [...cardData.history].reverse().map((log, index) => (
        <div key={index} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  log.type === 'Redeem' ? 'bg-pink-100 text-pink-600' : 'bg-green-100 text-green-600'
                }`}>
                  {log.type}
                </span>
                <span className="text-[9px] font-bold text-gray-400">
                  {log.date?.toDate ? log.date.toDate().toLocaleDateString() : 'Recent'}
                </span>
              </div>
              {/* SERVICE NAME */}
              <p className="text-xs font-black text-gray-800 uppercase mt-1">
                {log.service || (log.type === 'Redeem' ? 'General Service' : 'Funds Added')}
              </p>
            </div>
            
            <div className="text-right">
              <p className={`text-sm font-black ${log.type === 'Redeem' ? 'text-pink-600' : 'text-green-600'}`}>
                {log.type === 'Redeem' ? '-' : '+'}${Number(Math.abs(log.oldBalance - log.newBalance)).toFixed(2)}
              </p>
            </div>
          </div>

          {/* NOTES SECTION */}
          {log.note && (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg border-l-2 border-gray-200">
              <p className="text-[10px] text-gray-500 italic leading-relaxed">
                " {log.note} "
              </p>
            </div>
          )}

          <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between items-center">
            <span className="text-[8px] font-bold text-gray-300 uppercase">Balance After</span>
            <span className="text-[10px] font-black text-gray-400">${Number(log.newBalance).toFixed(2)}</span>
          </div>
        </div>
      ))
    ) : (
      <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <p className="text-[10px] font-bold text-gray-400 uppercase">No records found</p>
      </div>
    )}
  </div>
</div>

      </div>
      
      <p className="mt-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        Need help? Contact our support team.
      </p>
    </div>
  );
}