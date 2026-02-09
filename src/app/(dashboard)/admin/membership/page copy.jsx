"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, setDoc, getDoc, query, onSnapshot, doc, updateDoc, 
  arrayUnion, increment 
} from "firebase/firestore";

export default function MembershipRewards() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [cashAmount, setCashAmount] = useState("");

  // Default settings
  const [rewardSettings, setRewardSettings] = useState({
    threshold: 100,
    type: "fixed",
    value: 10
  });

  // 1. Load Settings from Firebase on mount
  useEffect(() => {
    const loadSettings = async () => {
      const settingsSnap = await getDoc(doc(db, "settings", "membership_rewards"));
      if (settingsSnap.exists()) {
        setRewardSettings(settingsSnap.data());
      }
    };
    loadSettings();
  }, []);

  // 2. Fetch Clients (Members)
  useEffect(() => {
    const q = query(collection(db, "clients"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const sorted = clientsData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setMembers(sorted);
    });
    return () => unsubscribe();
  }, []);

  const saveSettings = async () => {
    try {
      // Ensure values are stored as numbers
      const dataToSave = {
        threshold: parseFloat(rewardSettings.threshold),
        type: rewardSettings.type,
        value: parseFloat(rewardSettings.value)
      };
      await setDoc(doc(db, "settings", "membership_rewards"), dataToSave);
      alert("Reward Settings Saved!");
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const filteredMembers = members.filter(m => 
    m.name?.toLowerCase().includes(search.toLowerCase()) || 
    m.phone?.includes(search)
  );

  // 3. Updated Log Spending with Automatic Reward Calculation
  const handleAddSpending = async (e) => {
    e.preventDefault();
    if (!selectedMember || !cashAmount) return;

    const amount = parseFloat(cashAmount);
    
    // Use the latest rewardSettings from state
    const { threshold, type, value } = rewardSettings;
    
    // Calculate progress: how much have they spent since their last reward?
    // We use a 'rewardProgress' field to track this specifically.
    const currentProgress = (selectedMember.rewardProgress || 0) + amount;
    let rewardToAdd = 0;
    let newProgress = currentProgress;

    // Check if progress hits the threshold
    if (currentProgress >= threshold) {
      if (type === "fixed") {
        rewardToAdd = value;
      } else {
        rewardToAdd = amount * (value / 100);
      }
      // Reset progress by subtracting the threshold
      newProgress = currentProgress - threshold;
    }

    const clientRef = doc(db, "clients", selectedMember.id);
    await updateDoc(clientRef, {
      totalSpent: increment(amount),
      rewardProgress: newProgress, // Track progress toward next reward
      cashRewardBalance: increment(rewardToAdd),
      spendingHistory: arrayUnion({
        date: new Date().toISOString(),
        amount: amount,
        rewardEarned: rewardToAdd,
        type: "Cash Visit"
      })
    });

    setCashAmount("");
    if (rewardToAdd > 0) {
      alert(`Threshold Reached! $${rewardToAdd.toFixed(2)} reward added to balance.`);
    } else {
      alert(`Spending logged. $${(threshold - newProgress).toFixed(2)} more to go for next reward!`);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">CASH REWARDS</h1>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em]">VIP Membership Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: SEARCH & LIST */}
        <div className="lg:col-span-4 space-y-4">
          <input 
            type="text"
            placeholder="Search Members..."
            className="p-4 rounded-xl border border-gray-200 shadow-sm bg-white focus:ring-2 focus:ring-pink-500 w-full outline-none transition-all"
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[600px] overflow-y-auto">
            {filteredMembers.map(member => (
              <button 
                key={member.id}
                onClick={() => setSelectedMember(member)}
                className={`w-full p-6 text-left border-b border-gray-50 transition-all ${selectedMember?.id === member.id ? 'bg-pink-50 border-l-4 border-l-pink-600' : 'hover:bg-gray-50'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-gray-900 uppercase text-sm">{member.name || "Unknown"}</p>
                    <p className="text-xs text-gray-400 font-bold">{member.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-pink-600">${(member.cashRewardBalance || 0).toFixed(2)}</p>
                    <p className="text-[8px] uppercase text-gray-400 font-bold">Balance</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIONS & SETTINGS */}
        <div className="lg:col-span-8 space-y-6">
          {selectedMember ? (
            <div className="animate-in fade-in duration-500 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Total Spent" value={`$${selectedMember.totalSpent?.toFixed(2) || "0.00"}`} color="bg-gray-900" />
                <StatCard label="Current Reward" value={`$${selectedMember.cashRewardBalance?.toFixed(2) || "0.00"}`} color="bg-pink-600" />
                <StatCard label="Progress to Next" value={`$${(selectedMember.rewardProgress || 0).toFixed(2)} / $${rewardSettings.threshold}`} color="bg-indigo-600" />
              </div>

              <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-black uppercase tracking-widest text-xs mb-6 text-gray-400">Log New Cash Spending</h3>
                <form onSubmit={handleAddSpending} className="flex gap-4">
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="Enter Amount ($)"
                    className="flex-grow p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    required
                  />
                  <button className="bg-gray-900 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-pink-600 transition-all shadow-lg">
                    Add Spending
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold uppercase tracking-widest">
              Select a member to log spending
            </div>
          )}

          {/* GLOBAL SETTINGS SECTION */}
          <div className="p-8 bg-white rounded-xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-black uppercase tracking-widest text-sm text-pink-600">Reward Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Threshold ($)</label>
                <input type="number" className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-pink-500" 
                  value={rewardSettings.threshold} 
                  onChange={(e) => setRewardSettings({...rewardSettings, threshold: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Reward Type</label>
                <select className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-pink-500 appearance-none font-bold" 
                  value={rewardSettings.type} 
                  onChange={(e) => setRewardSettings({...rewardSettings, type: e.target.value})}>
                  <option value="fixed">Fixed ($)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Value</label>
                <input type="number" className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-pink-500" 
                  value={rewardSettings.value} 
                  onChange={(e) => setRewardSettings({...rewardSettings, value: e.target.value})} />
              </div>
            </div>
            <button onClick={saveSettings} className="bg-gray-900 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all">
              Save Reward Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`${color} p-6 rounded-xl text-white shadow-lg`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-black tracking-tighter">{value}</p>
    </div>
  );
}