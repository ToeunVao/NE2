"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

export default function ClientDetails() {
  const { id } = useParams(); // This gets the "name" or "id" from the URL
  const [client, setClient] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchDetails = async () => {
      // 1. Fetch Client Profile
      const docRef = doc(db, "clients", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setClient(docSnap.data());

      // 2. Fetch Transaction History for this client
      const q = query(collection(db, "transactions"), where("customerName", "==", id));
      const querySnap = await getDocs(q);
      setHistory(querySnap.docs.map(d => d.data()));
    };
    fetchDetails();
  }, [id]);

  if (!client) return <div className="p-10">Loading profile...</div>;

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
        <h1 className="text-3xl font-bold font-serif">{client.name}</h1>
        <p className="text-pink-600 font-bold">{client.points} Loyalty Points</p>
      </div>

      <div className="bg-white p-8 rounded-[3rem] border border-gray-100">
        <h2 className="text-xl font-bold mb-4 italic text-gray-400">Visit History</h2>
        <div className="space-y-4">
          {history.map((visit, index) => (
            <div key={index} className="flex justify-between p-4 bg-gray-50 rounded-2xl">
              <div>
                <p className="font-bold text-gray-800">{visit.service}</p>
                <p className="text-xs text-gray-400">By {visit.technician}</p>
              </div>
              <p className="font-bold">${visit.total}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}