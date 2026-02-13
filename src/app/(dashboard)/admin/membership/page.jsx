"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, setDoc, getDoc, query, onSnapshot, doc, updateDoc, 
  arrayUnion, increment 
} from "firebase/firestore";
import { useToast } from "@/context/ToastContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // Import the function directly

export default function MembershipRewards() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null); // Track ID, not the whole object
  const [cashAmount, setCashAmount] = useState("");
  const [rewardSettings, setRewardSettings] = useState({ threshold: 100, type: "fixed", value: 10 });
const [redeemAmount, setRedeemAmount] = useState("");

// 1. Get current date info
const today = new Date();
const currentMonth = today.getMonth(); // 0 = Jan, 1 = Feb, etc.

// 2. Create the birthdayMembers list by filtering the main members list
const birthdayMembers = (members || []).filter(m => {
  if (!m.birthday) return false;
  const bDay = new Date(m.birthday);
  return bDay.getUTCMonth() === currentMonth;
}).sort((a, b) => {
  return new Date(a.birthday).getUTCDate() - new Date(b.birthday).getUTCDate();
});

// This turns "(714) 123-4567" into "7141234567"
const cleanPhone = (phone) => {
  return phone ? phone.replace(/\D/g, '') : '';
};

  // 1. Live listener for Members (Clients)
  useEffect(() => {
    const q = query(collection(db, "clients"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembers(clientsData);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load Settings
  useEffect(() => {
    const loadSettings = async () => {
      const settingsSnap = await getDoc(doc(db, "settings", "membership_rewards"));
      if (settingsSnap.exists()) setRewardSettings(settingsSnap.data());
    };
    loadSettings();
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
  // --- KEY FIX: Find the member from the LIVE list ---
  const activeMember = members.find(m => m.id === selectedId);

  const handleAddSpending = async (e) => {
    e.preventDefault();
    if (!activeMember || !cashAmount) return;

    const amount = parseFloat(cashAmount);
    const { threshold, type, value } = rewardSettings;
    
    // Calculate new progress locally for the alert
    const currentProgress = (activeMember.rewardProgress || 0) + amount;
    let rewardToAdd = 0;
    let newProgress = currentProgress;

    if (currentProgress >= threshold) {
      rewardToAdd = type === "fixed" ? parseFloat(value) : amount * (parseFloat(value) / 100);
      newProgress = currentProgress - threshold;
    }

    const clientRef = doc(db, "clients", activeMember.id);
    await updateDoc(clientRef, {
      totalSpent: increment(amount),
      rewardProgress: newProgress,
      cashRewardBalance: increment(rewardToAdd),
      spendingHistory: arrayUnion({
        date: new Date().toISOString(),
        amount: amount,
        rewardEarned: rewardToAdd,
        type: "Cash Visit"
      })
    });

    setCashAmount("");
  };

  const generatePDF = () => {
  if (!activeMember) return;

  const doc = new jsPDF();
  
  // 1. Header & Branding
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20); // Dark Gray
  doc.text("NAILSXPRESS", 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Membership Reward Statement", 14, 28);
  doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, 14, 34);

  // 2. Client Info Box
  doc.setDrawColor(230, 230, 230);
  doc.line(14, 40, 196, 40); // Horizontal line

  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Client: ${activeMember.name || "Unnamed"}`, 14, 50);
  doc.text(`Phone: ${activeMember.phone || "N/A"}`, 14, 57);
  doc.text(`Current Balance Reward: $${(activeMember.cashRewardBalance || 0).toFixed(2)}`, 14, 64);

  // 3. Table of History
  const tableColumn = ["Date", "Description", "Spend Amount", "Reward Earned"];
  const tableRows = [];

  const history = activeMember.spendingHistory ? [...activeMember.spendingHistory].reverse() : [];

  history.forEach(log => {
    const rowData = [
      new Date(log.date).toLocaleDateString(),
      log.type || "Cash Visit",
      `$${parseFloat(log.amount).toFixed(2)}`,
      `$${parseFloat(log.rewardEarned).toFixed(2)}`
    ];
    tableRows.push(rowData);
  });

autoTable(doc, {
    startY: 75,
    head: [tableColumn],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' }, // Dark Slate
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { top: 75 },
  });

  // 4. Save the PDF
  doc.save(`Rewards_${activeMember.name.replace(/\s+/g, '_')}.pdf`);
};

const handleRedeem = async () => {
  // 1. Validation
  if (!activeMember || !redeemAmount) return;
  const redeemVal = parseFloat(redeemAmount);
  
  if ((activeMember.cashRewardBalance || 0) < redeemVal) {
    return alert("Insufficient reward balance! They only have $" + (activeMember.cashRewardBalance || 0).toFixed(2));
  }

  // 2. Confirmation
  const confirmRedeem = window.confirm(`Redeem $${redeemVal} from ${activeMember.name}'s balance?`);
  if (!confirmRedeem) return;

  try {
    const clientRef = doc(db, "clients", activeMember.id);
    
    // 3. Update Database
    await updateDoc(clientRef, {
      cashRewardBalance: increment(-redeemVal), // Subtract the amount
      spendingHistory: arrayUnion({
        date: new Date().toISOString(),
        amount: 0,
        rewardEarned: -redeemVal, // Negative reward shows as a deduction
        type: "Reward Redemption"
      })
    });

    setRedeemAmount("");
    alert("Reward applied successfully!");
  } catch (error) {
    console.error("Redemption error:", error);
    alert("Something went wrong with the redemption.");
  }
};
const filteredMembers = members.filter(m => {
  const searchTerm = search.toLowerCase().trim();
  
  // 1. Name Match (Normal text search)
  const nameMatch = m.name?.toLowerCase().includes(searchTerm);

  // 2. Phone Match (Cleaned numeric search)
  const cleanSearch = searchTerm.replace(/\D/g, ''); // Get only numbers from search
  const cleanMemberPhone = (m.phone || "").replace(/\D/g, ''); // Get only numbers from database
  
  // If user typed numbers, check phone. If they typed letters, check name.
  const phoneMatch = cleanSearch !== "" && cleanMemberPhone.includes(cleanSearch);

  return nameMatch || phoneMatch;
});

// Get Top 5 Spenders for the Leaderboard
const topSpenders = [...members]
  .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
  .slice(0, 5);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">CASH REWARDS</h1>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em]">VIP Membership Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN */}

        <div className="lg:col-span-4 space-y-4">
          
          {/* BIRTHDAY CELEBRATIONS SECTION */}
{birthdayMembers.length > 0 && (
  <div className="mb-6 bg-gradient-to-br from-pink-500 to-rose-400 rounded-xl p-5 shadow-lg text-white">
    <div className="flex items-center gap-2 mb-4">
      <i className="fas fa-birthday-cake animate-bounce"></i>
<h3 className="text-[10px] font-black uppercase tracking-[0.2em]">
  {today.toLocaleString('default', { month: 'long' })} Birthdays
</h3>
    </div>
    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
      {birthdayMembers.map(member => (
        <div key={member.id} className="min-w-[120px] bg-white/20 backdrop-blur-md p-3 rounded-xl text-center border border-white/30">
          <p className="text-[10px] font-black uppercase truncate">{member.name || "Customer"}</p>
          <p className="text-[9px] font-bold opacity-80 mt-1">
            {/* Show the specific day */}
            {new Date(member.birthday).getUTCDate()} {today.toLocaleString('default', { month: 'short' })}
          </p>
          <button 
            onClick={() => setSelectedId(member.id)}
            className="mt-2 bg-white text-pink-600 text-[8px] font-black px-3 py-1 rounded-full uppercase hover:bg-pink-50 transition-colors"
          >
            Give Gift
          </button>
        </div>
      ))}
    </div>
  </div>
)}
 <div className="space-y-1">
  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Client Birthday</label>
  <input 
    type="date"
    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none font-bold text-gray-700"
    value={activeMember?.birthday || ""}
   onChange={async (e) => {
  if (!activeMember?.id) return; // Safety check
  const bday = e.target.value;
  const memberRef = doc(db, "clients", activeMember.id);
  await updateDoc(memberRef, { birthday: bday });
}}
  />
  <p className="text-[9px] text-gray-400 italic ml-1 mt-1">* Used to trigger birthday reward alerts</p>
</div>


          {/* VIP LEADERBOARD SECTION */}
<div className="mb-8 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 shadow-xl border border-gray-700">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] flex items-center gap-2">
      <i className="fas fa-crown"></i> VIP Top Spenders
    </h3>
    <span className="text-[10px] text-gray-500 font-bold uppercase">All Time</span>
  </div>

  <div className="space-y-3">
    {topSpenders.map((member, index) => (
      <div key={member.id} className="flex items-center justify-between group">
        <div className="flex items-center gap-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black 
            ${index === 0 ? 'bg-amber-400 text-amber-900' : 'bg-gray-700 text-gray-400'}`}>
            {index + 1}
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-tight group-hover:text-amber-400 transition-colors">
              {member.name || "Unnamed"}
            </p>
            <p className="text-[9px] text-gray-500 font-bold uppercase">Member since {new Date(member.createdAt).getFullYear() || '2024'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-amber-400">${(member.totalSpent || 0).toFixed(2)}</p>
          <div className="w-16 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
             <div 
               className="h-full bg-amber-400" 
               style={{ width: `${(member.totalSpent / (topSpenders[0].totalSpent || 1)) * 100}%` }}
             ></div>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
<div className="relative w-full">
  <input 
    type="text"
    placeholder="Search name or phone..."
    value={search}
    className="w-full p-4 pr-12 rounded-xl border border-gray-200 shadow-sm bg-white focus:ring-2 focus:ring-pink-500 outline-none transition-all font-medium"
    onChange={(e) => setSearch(e.target.value)}
  />
  {search && (
    <button 
      onClick={() => setSearch("")}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-600 font-black text-xs uppercase"
    >
      Clear
    </button>
  )}
</div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-[600px] overflow-y-auto">
            {filteredMembers.map(member => {
  // 1. CALCULATE FOR THIS SPECIFIC MEMBER
  const isVIP = topSpenders.some(vip => vip.id === member.id);
  
  // Get current date info for the check
  const today = new Date();
  const currentMonth = today.getMonth(); // 0 = Jan, 1 = Feb...
  
  // Safety check: if no birthday is set, it's false
  const isBirthdayMonth = member.birthday && new Date(member.birthday).getUTCMonth() === currentMonth;
  return (
    <button 
      key={member.id}
      onClick={() => setSelectedId(member.id)} 
      className={`w-full border-gray-100 pl-4 p-4 text-left border-b transition-all ${selectedId === member.id ? 'bg-pink-50 border-l-4 border-l-pink-600' : 'hover:bg-gray-50'}`}
    >
      <div className="flex items-center gap-2">
        <p className="font-black text-gray-900 uppercase text-sm">{member.name || "Unnamed"}</p>
        {isVIP && <i className="fas fa-crown text-amber-500 text-[10px]" title="VIP Client"></i>}
      </div>
      <p className="text-xs text-gray-400 font-bold tracking-widest mt-1">
        {member.phone || "No Phone Number"}
      </p>
       <p className="mt-2 inline-block bg-pink-100 text-pink-700 px-2 py-1 rounded-md text-[10px] font-black uppercase">
      ${(member.cashRewardBalance || 0).toFixed(2)} Reward
    </p>
    <p className="font-black text-gray-900 uppercase text-sm">{member.name}</p>
        {isVIP && <i className="fas fa-crown text-amber-500 text-[10px]"></i>}
        {isBirthdayMonth && <i className="fas fa-birthday-cake text-pink-500 text-[10px]"></i>}
    </button>
  );
})}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-8 space-y-6">
          {activeMember ? (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <StatCard 
    label="Total Spent" 
    value={`$${activeMember.totalSpent?.toFixed(2) || "0.00"}`} 
    color="bg-gray-900" 
  />
  
  <StatCard 
    label="Current Balance Reward" 
    value={`$${activeMember.cashRewardBalance?.toFixed(2) || "0.00"}`} 
    color="bg-pink-600"
    /* This tells the card to glow only if balance is more than 0 */
    isGlowing={parseFloat(activeMember.cashRewardBalance) > 0} 
  />
                {/* THIS CARD WILL NOW UPDATE INSTANTLY */}
                <div className="bg-indigo-600 p-6 rounded-xl text-white shadow-lg relative overflow-hidden">
                   <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Progress to Next</p>
                   <p className="text-2xl font-black tracking-tighter">${(activeMember.rewardProgress || 0).toFixed(2)} / ${rewardSettings.threshold}</p>
                   {/* Visual Progress Bar */}
                   <div className="w-full bg-white/20 h-1 mt-4 rounded-full overflow-hidden">
                      <div 
                        className="bg-white h-full transition-all duration-1000" 
                        style={{ width: `${Math.min(((activeMember.rewardProgress || 0) / rewardSettings.threshold) * 100, 100)}%` }}
                      ></div>
                   </div>
                </div>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* BOX 1: LOG SPENDING (Existing) */}
  <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
    <h3 className="font-black uppercase tracking-widest text-[10px] mb-4 text-gray-400">Log New Cash Spending</h3>
    <div className="flex gap-2">
      <input 
        type="number" step="0.01" value={cashAmount}
        onChange={(e) => setCashAmount(e.target.value)}
        className="flex-grow p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold"
        placeholder="Amount ($)"
      />
      <button onClick={handleAddSpending} className="bg-gray-900 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-pink-600 transition-all">
        Add
      </button>
    </div>
  </div>

  {/* BOX 2: REDEEM REWARD (New) */}
  <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
    <h3 className="font-black uppercase tracking-widest text-[10px] mb-4 text-pink-600">Redeem Cash Reward</h3>
    <div className="flex gap-2">
      <input 
        type="number" step="0.01" value={redeemAmount}
        onChange={(e) => setRedeemAmount(e.target.value)}
        className="flex-grow p-4 bg-pink-50 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold"
        placeholder="Redeem ($)"
      />
      <button onClick={handleRedeem} className="bg-pink-600 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-pink-700 transition-all shadow-lg shadow-pink-100">
        Redeem
      </button>
    </div>
  </div>
</div>
              {/* --- HISTORY LOG SECTION --- */}
<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
  <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
    <h3 className="font-black uppercase tracking-widest text-xs text-gray-500">Transaction History</h3>
    {/* PDF DOWNLOAD BUTTON */}
  <button 
    onClick={generatePDF}
    className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-all shadow-sm"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  Download PDF
  </button>
   <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-1 rounded font-bold uppercase">
      {activeMember.spendingHistory?.length || 0} Visits
    </span>
   
  </div>

  <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
    {activeMember.spendingHistory && activeMember.spendingHistory.length > 0 ? (
      activeMember.spendingHistory.slice().reverse().map((log, index) => (
        <div key={index} className="p-6 flex justify-between items-center hover:bg-gray-50 transition-all">
          <div className="flex items-center gap-4">
            {/* Date Icon */}
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm">
                {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {log.type || "Cash Visit"}
              </p>
            </div>
          </div>

          <div className="text-right">
  <p className="font-black text-gray-900">
    {log.amount > 0 ? `$${parseFloat(log.amount).toFixed(2)}` : "—"}
  </p>
  
  {log.rewardEarned > 0 ? (
    <p className="text-xs text-green-600 font-black">
      +${parseFloat(log.rewardEarned).toFixed(2)} Reward
    </p>
  ) : log.rewardEarned < 0 ? (
    <p className="text-xs text-red-500 font-black">
      -${Math.abs(log.rewardEarned).toFixed(2)} Used
    </p>
  ) : (
    <p className="text-[10px] text-gray-400 font-bold uppercase">No Reward</p>
  )}
</div>
        </div>
      ))
    ) : (
      <div className="p-20 text-center">
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs italic">
          No history found for this member
        </p>
      </div>
    )}
  </div>
</div>
            </div>
            
          ) : (
            <div className="h-48 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold uppercase tracking-widest">
              Select a member to see live progress
            </div>
            
          )}
          
           
        </div>
      </div>
     
      {/* GLOBAL SETTINGS SECTION */}
          <div className="p-8 bg-white rounded-xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-black uppercase tracking-widest text-sm text-pink-600">Reward Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
               <button onClick={saveSettings} className="bg-gray-900 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all">
              Save Reward Settings
            </button>
            </div>
           
          </div>
    </div>
  );
}

// Bottom of your file
function StatCard({ label, value, color, isGlowing }) {
  return (
    <div className={`${color} p-6 rounded-xl text-white shadow-lg transition-all duration-500 ${isGlowing ? 'ring-4 ring-pink-500/40 scale-[1.02]' : ''}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-black tracking-tighter">{value}</p>
    </div>
  );
}