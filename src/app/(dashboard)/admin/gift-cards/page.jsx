"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, query, orderBy } from "firebase/firestore";
import { format } from "date-fns";

export default function GiftCardPage() {
  const [cards, setCards] = useState([]);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");

  useEffect(() => {
    const q = query(collection(db, "gift_cards"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const issueCard = async (e) => {
    e.preventDefault();
    const code = "GIFT-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    await addDoc(collection(db, "gift_cards"), {
      code,
      recipient,
      balance: Number(amount),
      initialAmount: Number(amount),
      status: "active",
      createdAt: new Date()
    });
    setAmount("");
    setRecipient("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Form to Issue Card */}
      <div className="lg:col-span-1">
        <div className="bg-white p-6 rounded-3xl border border-pink-100 shadow-sm sticky top-24">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Issue Gift Card</h2>
          <form onSubmit={issueCard} className="space-y-4">
            <input 
              type="text" placeholder="Recipient Name" required
              className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-pink-500"
              value={recipient} onChange={e => setRecipient(e.target.value)}
            />
            <input 
              type="number" placeholder="Amount ($)" required
              className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-pink-500"
              value={amount} onChange={e => setAmount(e.target.value)}
            />
            <button className="w-full bg-pink-600 text-white font-bold py-3 rounded-xl hover:bg-pink-700 transition-all">
              GENERATE CARD
            </button>
          </form>
        </div>
      </div>

      {/* Active Cards List */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-xl font-bold text-gray-800">Recent Gift Cards</h2>
        {cards.map(card => (
          <div key={card.id} className="bg-white p-6 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm">
            <div>
              <p className="text-xs font-bold text-pink-500 tracking-widest uppercase">{card.code}</p>
              <h3 className="font-bold text-gray-800">{card.recipient}</h3>
              <p className="text-xs text-gray-400">{format(card.createdAt.toDate(), "PPP")}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800">${card.balance}</p>
              <span className="text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full font-bold uppercase">
                {card.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}