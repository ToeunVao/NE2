"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, query, onSnapshot, doc, updateDoc, 
  arrayUnion, increment, serverTimestamp 
} from "firebase/firestore";

export default function RoyaltyAdmin() {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [spendAmount, setSpendAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");

  // 1. Fetch Clients from your existing 'clients' collection
  useEffect(() => {
    const q = query(collection(db, "clients"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(clientData);
      
      // Keep selected client data updated if they are currently being viewed
      if (selectedClient) {
        const updated = clientData.find(c => c.id === selectedClient.id);
        setSelectedClient(updated);
      }
    });
    return () => unsubscribe();
  }, [selectedClient?.id]);

  // 2. Log New Cash Spending (1 point per $1)
  const handleLogSpending = async (e) => {
    e.preventDefault();
    if (!selectedClient || !spendAmount) return;

    const pointsEarned = Math.floor(parseFloat(spendAmount));
    const clientRef = doc(db, "clients", selectedClient.id);

    await updateDoc(clientRef, {
      points: increment(pointsEarned),
      totalSpent: increment(parseFloat(spendAmount)),
      history: arrayUnion({
        type: "EARN",
        amount: parseFloat(spendAmount),
        points: pointsEarned,
        timestamp: new Date().toISOString(),
        note: "Cash spending"
      })
    });

    setSpendAmount("");
    alert(`Success: ${pointsEarned} points added!`);
  };

  // 3. Redeem Points
  const handleRedeem = async () => {
    if (!selectedClient || !redeemAmount) return;
    if (selectedClient.points < redeemAmount) return alert("Not enough points!");

    const clientRef = doc(db, "clients", selectedClient.id);
    await updateDoc(clientRef, {
      points: increment(-parseInt(redeemAmount)),
      history: arrayUnion({
        type: "REDEEM",
        points: parseInt(redeemAmount),
        timestamp: new Date().toISOString(),
        note: "Point redemption"
      })
    });

    setRedeemAmount("");
    alert("Points redeemed successfully!");
  };

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm)
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">ROYALTY PROGRAM</h1>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em]">Customer Rewards Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COL: SEARCH & LIST */}
        <div className="lg:col-span-4 space-y-4">
          <input 
            type="text"
            placeholder="Search name or phone..."
            className="w-full p-4 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-pink-500 outline-none transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-[600px] overflow-y-auto">
            {filteredClients.map(client => (
              <button 
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className={`w-full border-gray-100 pl-4 p-2 text-left border-b last:border-0 transition-all ${selectedClient?.id === client.id ? 'bg-pink-50 border-l-4 border-l-pink-600' : 'hover:bg-gray-50'}`}
              >
                <p className="font-black text-gray-900 uppercase text-sm">{client.name}</p>
                <p className="text-xs text-gray-400 font-bold tracking-widest">{client.phone}</p>
                <div className="mt-2 inline-block bg-pink-100 text-pink-700 px-2 py-1 rounded-md text-[10px] font-black uppercase">
                   {client.points || 0} pts
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT COL: DETAILS & ACTIONS */}
        <div className="lg:col-span-8">
          {selectedClient ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Profile Overview */}
              <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-gray-900 rounded-xl flex items-center justify-center text-white text-3xl font-black">
                    {selectedClient.name[0]}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 uppercase">{selectedClient.name}</h2>
                    <p className="text-gray-500 font-bold tracking-widest text-xs uppercase">{selectedClient.phone}</p>
                  </div>
                </div>
                <div className="text-center md:text-right mt-6 md:mt-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Available Balance</p>
                  <p className="text-6xl font-black text-pink-600 tracking-tighter">{selectedClient.points || 0}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase">Points</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Earn Points Box */}
                <div className="bg-gray-900 p-8 rounded-xl text-white shadow-xl">
                  <h3 className="font-black uppercase tracking-widest text-xs mb-4 text-pink-400">Add Spending</h3>
                  <form onSubmit={handleLogSpending} className="space-y-4">
                    <input 
                      type="number" 
                      value={spendAmount}
                      onChange={(e) => setSpendAmount(e.target.value)}
                      placeholder="Amount ($)"
                      className="w-full p-4 bg-gray-800 border-none rounded-xl text-white outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <button className="w-full bg-pink-600 p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-pink-500 transition-all">
                      Log Visit
                    </button>
                  </form>
                </div>

                {/* Redeem Points Box */}
                <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="font-black uppercase tracking-widest text-xs mb-4 text-gray-400">Redeem Points</h3>
                  <div className="space-y-4">
                    <input 
                      type="number" 
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      placeholder="Points to Use"
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <button 
                      onClick={handleRedeem}
                      className="w-full bg-gray-900 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-black transition-all"
                    >
                      Redeem Reward
                    </button>
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                   <h3 className="font-black uppercase tracking-widest text-xs text-gray-500">Transaction History</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {selectedClient.history?.slice().reverse().map((item, idx) => (
                    <div key={idx} className="p-6 border-b border-gray-50 flex justify-between items-center last:border-0">
                      <div>
                        <p className={`font-black uppercase text-sm ${item.type === 'EARN' ? 'text-gray-900' : 'text-pink-600'}`}>
                          {item.type === 'EARN' ? 'Added Spending' : 'Redeemed Points'}
                        </p>
                        <p className="text-xs text-gray-400 font-bold">
                          {new Date(item.timestamp).toLocaleDateString()} • {item.note}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black ${item.type === 'EARN' ? 'text-green-600' : 'text-red-500'}`}>
                          {item.type === 'EARN' ? '+' : '-'}{item.points}
                        </p>
                        {item.amount && <p className="text-[10px] font-bold text-gray-400">${item.amount}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold uppercase tracking-widest">
              Select a client to view their rewards
            </div>
          )}
        </div>
      </div>
    </div>
  );
}