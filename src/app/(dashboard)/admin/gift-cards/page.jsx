"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, doc, deleteDoc, 
  serverTimestamp, query, orderBy, writeBatch, updateDoc, arrayUnion, Timestamp
} from "firebase/firestore";

// --- ASSETS ---
const giftCardBackgrounds = {
    'General': [
        'https://img.freepik.com/premium-photo/women-s-legs-with-bright-pedicure-pink-background-chamomile-flower-decoration-spa-pedicure-skincare-concept_256259-166.jpg', 
        'https://png.pngtree.com/thumb_back/fh260/background/20250205/pngtree-soft-pastel-floral-design-light-blue-background-image_16896113.jpg', 
        'https://files.123freevectors.com/wp-content/original/119522-abstract-pastel-pink-background-image.jpg'
    ],
    'Holidays': [
        'https://media.istockphoto.com/id/1281966270/vector/christmas-background-with-snowflakes.jpg?s=612x612&w=0&k=20&c=3t2mJbipFc4aln2M8qDbd3kJvUwtjl1md1F3Rj0xVI4=', 
        'https://media.istockphoto.com/id/1180986336/vector/red-bokeh-snowflakes-background.jpg?s=612x612&w=0&k=20&c=NR_Hf8C2owuvtCxtjk789Ckynqdm6l2oDWLHwI7uqlE=', 
        'https://png.pngtree.com/background/20210710/original/pngtree-red-christmas-snow-winter-cartoon-show-board-background-picture-image_979028.jpg'
    ],
    'Valentines': [
        'https://slidescorner.com/wp-content/uploads/2023/02/01-Cute-Pink-Hearts-Valentines-Day-Background-Aesthetic-FREE-by-SlidesCorner.com_.jpg', 
        'https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTExL2xhdXJhc3RlZmFubzI2Nl9waW5rX3ZhbGVudGluZXNfZGF5X2JhY2tncm91bmRfd2l0aF9oZWFydHNfYm9rZV9kZTAzMWNjMy05MmJmLTQ2NzAtYjliZC0wN2Y2ZDkzYTM1ZDBfMS5qcGc.jpg', 
        'https://cms-artifacts.artlist.io/content/motion_array/1390934/Valentines_Day_Romantic_Background_high_resolution_preview_1390934.jpg?Expires=2037527646045&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=fCbOC95RTvVc0Ld-pyxhFN5gzuS-VqGG1UYsxvu48kx8A6rdAPf~gjuv0sVBrV~0p0~2u99BYafKT5oRUsRbluBt9c8eH4k~YXVcT2KdNrQUjVD-wKS2qTcgdp8aVDYCCILMkFT4hrWRWzKlsjjgoBe7mAIaHV3cc2iqMErb-qGWlk8jX0J8vLfCvXH~daNNPMqO7tssbeYiHVrD7y89fbJ0YRVfR6wwb1AoBLseF8-7IsAZe8Hh2bn-kUEp8KocRZ4X7DBTFD~9Ho-E0HeRym4oZ37u3BdLAqY-y0a1HdIf3dOXXkF6X~UQpMlPtxTvWj4857QSez20b1mhnBhpsQ__'
    ],
    'Birthday': [
        'https://marketplace.canva.com/EAGhbM7XcuY/1/0/1600w/canva-white-and-blue-birthday-background-card-yqLk4e5MQjY.jpg', 
        'https://images.rawpixel.com/image_800/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvam9iNTE2LW51bm9vbi0xMC5qcGc.jpg', 
        'https://www.creativefabrica.com/wp-content/uploads/2021/08/30/Happy-birthday-background-design-Graphics-16518598-1-1-580x430.jpg'
    ]
};
export default function GiftCardPage() {
  // Add these near your other useState hooks
const [transaction, setTransaction] = useState({ type: 'Redeem', amount: '', note: '' });
const [isEditingCode, setIsEditingCode] = useState(false);
const [newCodeInput, setNewCodeInput] = useState("");

  const [giftCards, setGiftCards] = useState([]);
// 1. Add this state
    const [clients, setClients] = useState([]);

    // 2. Add this useEffect to get your clients
    useEffect(() => {
        const q = query(collection(db, "clients"), orderBy("name", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setClients(snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })));
        });
        return () => unsubscribe();
    }, []);

    // 3. Define the missing variable here (Fixes your error)
    const autocompleteNames = useMemo(() => {
        return clients.map(c => c.name).filter(Boolean);
    }, [clients]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCard, setSelectedCard] = useState(null); // Controls the Modal

const [expValue, setExpValue] = useState(6);
const [expUnit, setExpUnit] = useState('months');

  // Designer State
  const [category, setCategory] = useState('General');
  const [bgImage, setBgImage] = useState(giftCardBackgrounds['General'][0]);
  const [form, setForm] = useState({
    amount: "50",
    quantity: 1,
    recipient: "",
    sender: "",
    code: "", 
    noExpiry: true,
    expiryDate: "",
    showTo: true,
    showFrom: true
  });
  // --- FIREBASE LISTENERS ---
  useEffect(() => {
    const q = query(collection(db, "gift_cards"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setGiftCards(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const filteredCards = useMemo(() => {
    return giftCards.filter(card => 
      (card.code && card.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (card.recipientName && card.recipientName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [giftCards, searchTerm]);

const handleSaveAndPrint = async () => {
    const qty = parseInt(form.quantity) || 1;
    const amount = parseFloat(form.amount) || 0;
    const manualInput = form.code.trim();

    if (amount <= 0) return alert("Please enter a valid amount");

    // 1. Calculate Expiration
    let finalExpirationDate = null;
    if (!form.noExpiry && expUnit !== 'never') {
        const d = new Date();
        const val = Number(expValue);
        if (expUnit === 'months') d.setMonth(d.getMonth() + val);
        else if (expUnit === 'years') d.setFullYear(d.getFullYear() + val);
        finalExpirationDate = Timestamp.fromDate(d);
    }

    const batch = writeBatch(db);
    let startNumber;

    // 2. Determine the starting number (NO Date.now() here)
    if (manualInput !== "") {
        // If admin typed 123, numericPart becomes 123
        const numericPart = manualInput.toUpperCase().replace("GC-", "");
        startNumber = parseInt(numericPart);
        if (isNaN(startNumber)) return alert("Please enter a numeric code");
    } else {
        // AUTO-CALCULATE: Look at the table below (giftCards state)
        if (giftCards.length > 0) {
            const existingNumbers = giftCards
                .map(card => {
                    // This regex finds the numbers in "GC-000005" -> 5
                    const match = card.code.match(/\d+/);
                    return match ? parseInt(match[0]) : 0;
                })
                .filter(num => !isNaN(num));

            const maxNum = Math.max(...existingNumbers, 0);
            startNumber = maxNum + 1; // If highest is 10, start at 11
        } else {
            startNumber = 1; // If system is empty, start at 000001
        }
    }

    // 3. Generate Sequential Batch
    for (let i = 0; i < qty; i++) {
        const currentNum = startNumber + i;
        
        // This forces exactly 6 digits with leading zeros
        const paddedNumber = currentNum.toString().padStart(6, '0');
        const finalCode = `GC-${paddedNumber}`;

        // Duplicate check against current state
        if (giftCards.some(card => card.code === finalCode)) {
            // If it exists, we skip to the next available number automatically
            startNumber++; 
            i--; // Repeat this loop index
            continue;
        }

        const cardData = {
            amount: amount,
            balance: amount,
            recipientName: form.recipient || "Customer",
            senderName: form.sender || "Store",
            code: finalCode,
            status: 'Active',
            type: 'Physical',
            expirationDate: finalExpirationDate,
            createdAt: serverTimestamp(),
            history: [{
                date: Timestamp.fromDate(new Date()),
                type: "Created",
                oldBalance: 0,
                newBalance: amount,
                note: "Initial issuance"
            }] 
        };
        
        const newCardRef = doc(collection(db, "gift_cards"));
        batch.set(newCardRef, cardData);
    }

    try {
        await batch.commit();
        // Clear form (keeping sender for convenience)
        setForm(prev => ({...prev, recipient: "", code: "", quantity: 1, amount: ""}));
        alert(`Successfully generated ${qty} gift cards!`);
    } catch (e) {
        console.error("Save Error:", e);
        alert("Error saving: " + e.message);
    }
};
  // --- ACTIONS: MODAL UPDATE / REDEEM ---
  const handleUpdateCard = async (e) => {
    e.preventDefault();
    if (!selectedCard) return;

    // We fetch the 'real' current card from state to compare balance
    const currentRealCard = giftCards.find(c => c.id === selectedCard.id) || selectedCard;
    const oldBalance = parseFloat(currentRealCard.balance);
    const newBalance = parseFloat(selectedCard.balance);
    
    try {
        await updateDoc(doc(db, "gift_cards", selectedCard.id), {
            balance: newBalance,
            recipientName: selectedCard.recipientName,
            senderName: selectedCard.senderName,
            history: arrayUnion({
                date: new Date().toLocaleString(),
                type: oldBalance !== newBalance ? "Manual Edit" : "Info Update",
                oldBalance: oldBalance,
                newBalance: newBalance,
                note: oldBalance !== newBalance ? "Balance overridden manually" : "Updated names"
            })
        });
        setSelectedCard(null); // Close modal
        alert("Gift card updated!");
    } catch (err) { alert(err.message); }
  };
const handleAddCard = async () => {
  try {
    // 1. Calculate the Expiration Date
let finalExpirationDate = null;
if (expUnit !== 'never') {
    const d = new Date();
    const val = Number(expValue);
    if (expUnit === 'months') {
        d.setMonth(d.getMonth() + val);
    } else if (expUnit === 'years') {
        d.setFullYear(d.getFullYear() + val);
    }
    finalExpirationDate = Timestamp.fromDate(d); // Compatible with Old App
}

    // 2. Prepare the data object
    const amountNum = Number(newCardData.amount);
    const docData = {
      ...newCardData,
      amount: amountNum,
      balance: amountNum,
      status: 'active',
      expirationDate: finalExpirationDate, // MUST match the table field
      createdAt: serverTimestamp(),
      history: [{
        date: Timestamp.fromDate(new Date()),
        type: 'Initial Load',
        amount: amountNum,
        oldBalance: 0,
        newBalance: amountNum,
        note: 'Admin Created'
      }]
    };

    // 3. Save
    await addDoc(collection(db, "gift_cards"), docData);
    
    // 4. Reset UI
    setIsAddModalOpen(false);
    setExpValue(6);
    setExpUnit('months');
  } catch (error) {
    console.error("Error saving gift card:", error);
  }
};
  const handleQuickRedeem = async (amountToSubtract) => {
    if (!selectedCard) return;
    const currentBalance = parseFloat(selectedCard.balance);
    const subtractValue = parseFloat(amountToSubtract);

    if (currentBalance < subtractValue) {
      alert("Error: Insufficient balance on card.");
      return;
    }

    const newBalance = currentBalance - subtractValue;

    try {
      await updateDoc(doc(db, "gift_cards", selectedCard.id), {
        balance: newBalance,
        history: arrayUnion({
          date: new Date().toLocaleString(),
          type: "Redemption",
          oldBalance: currentBalance,
          newBalance: newBalance,
          note: `Quick Redeem: -$${subtractValue}`
        })
      });
      // Update local state immediately for UI feedback
      setSelectedCard(prev => ({...prev, balance: newBalance}));
    } catch (err) {
      alert("Redemption failed: " + err.message);
    }
  };

  const handleSendSMS = () => {
    if (!selectedCard) return;
    const phoneNumber = prompt("Enter customer phone number (digits only):");
    if (!phoneNumber) return;

    const message = encodeURIComponent(
      `Nails Express Gift Card 💅\n` +
      `Code: ${selectedCard.code}\n` +
      `Balance: $${parseFloat(selectedCard.balance).toFixed(2)}\n` +
      `Valid at: 1560 Hustonville Rd, Danville, KY`
    );
    window.location.href = `sms:${phoneNumber}?body=${message}`;
  };
// Get unique list of Recipient and Sender names for autocomplete


  // --- PRINTING ---
  const printCards = (cards) => {
    let printHTML = `<html><head><title>Print Gift Cards</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Parisienne&display=swap" rel="stylesheet"><style>body{font-family:sans-serif;margin:0;background-color:#f0f0f0;}.font-parisienne{font-family:'Parisienne',cursive;}.print-page{display:flex;flex-wrap:wrap;gap:10mm;padding:10mm;}.card-container{display:grid;grid-template-columns:repeat(2,1fr);margin-bottom:10px;}.card{width:400px;height:228px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}</style></head><body><div class="print-page">`;
    
    cards.forEach(card => {
        printHTML += `
        <div class="card-container">
            <div class="card rounded-xl p-6 flex flex-col justify-between bg-cover bg-center text-white" style="background-image: url('${card.backgroundUrl}'); text-shadow: 1px 1px 3px rgba(0,0,0,0.6);">
                <div class="flex justify-between items-start">
                    <div class="w-12 h-12 rounded-full border-2 border-white bg-white/20"></div>
                    <div class="text-right">
                        <p class="font-parisienne text-3xl leading-none">Gift Card</p>
                        <p class="text-[8px] font-bold tracking-widest uppercase">Nails Express</p>
                    </div>
                </div>
                <div class="text-center">
                    <p class="text-5xl font-bold">$${Number(card.amount).toFixed(2)}</p>
                </div>
                <div class="text-[10px] space-y-2">
                    <div class="flex justify-between font-bold">
                        <span>${card.showTo ? `TO: <span class="font-normal">${card.recipientName || '__________'}</span>` : ''}</span>
                        <span>${card.showFrom ? `FROM: <span class="font-normal">${card.senderName || '__________'}</span>` : ''}</span>
                    </div>
                    <div class="flex flex-col items-center pt-2 border-t border-white/30">
                        <p class="font-mono tracking-[0.2em] text-xs">${card.code}</p>
                        <p class="italic uppercase text-[7px] mt-1">Expires: ${card.noExpiry ? '________________' : (card.expiryDate || 'N/A')}</p>
                    </div>
                </div>
            </div>
            <div class="card rounded-xl p-6 flex flex-col justify-between bg-white text-gray-800 border border-gray-100">
                <div class="w-full h-10 bg-black/80 rounded-lg"></div>
                <div class="space-y-2">
                   <p class="text-[9px] text-center text-gray-500 px-4 leading-relaxed font-medium">This card is redeemable for services at Nails Express. Treat this card like cash; it is not replaceable if lost or stolen. Non-refundable.</p>
                </div>
                <div class="text-center text-[9px] pb-2 font-bold uppercase tracking-tight text-pink-600">
                   <p>Nails Express</p>
                   <p class="text-gray-400 font-normal normal-case">1560 Hustonville Rd #345, Danville, KY</p>
                </div>
            </div>
        </div>`;
    });
    
    printHTML += '</div></body></html>';
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHTML);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleApplyTransaction = async () => {
    const amount = parseFloat(transaction.amount);
    if (!amount || amount <= 0) return alert("Please enter a valid amount");

    const currentBalance = Number(selectedCard.balance);
    let newBalance;

    if (transaction.type === 'Redeem') {
        if (amount > currentBalance) return alert("Insufficient balance");
        newBalance = currentBalance - amount;
    } else {
        newBalance = currentBalance + amount;
    }

    try {
        const cardRef = doc(db, "gift_cards", selectedCard.id);
        await updateDoc(cardRef, {
            balance: newBalance,
            history: arrayUnion({
                date: Timestamp.fromDate(new Date()),
                type: transaction.type,
                oldBalance: currentBalance,
                newBalance: newBalance,
                note: transaction.note || `${transaction.type} transaction`
            })
        });
        
        // Update local state to reflect change in modal
        setSelectedCard(prev => ({
            ...prev, 
            balance: newBalance,
            history: [...prev.history, { 
                date: Timestamp.fromDate(new Date()), 
                type: transaction.type, 
                oldBalance: currentBalance, 
                newBalance: newBalance, 
                note: transaction.note 
            }]
        }));
        setTransaction({ type: 'Redeem', amount: '', note: '' });
        alert("Transaction successful!");
    } catch (e) {
        alert("Error: " + e.message);
    }
};
const handleUpdateCode = async () => {
    if (!newCodeInput.trim()) return;
    
    // Check if new code already exists
    const exists = giftCards.some(c => c.code === newCodeInput && c.id !== selectedCard.id);
    if (exists) return alert("This code is already in use!");

    try {
        const cardRef = doc(db, "gift_cards", selectedCard.id);
        await updateDoc(cardRef, { code: newCodeInput });
        setSelectedCard(prev => ({ ...prev, code: newCodeInput }));
        setIsEditingCode(false);
        alert("Code updated successfully!");
    } catch (e) {
        alert("Error updating code: " + e.message);
    }
};

const handleActivate = async (id) => {
  const confirm = window.confirm("Has the client paid for this gift card?");
  if (!confirm) return;

  const cardRef = doc(db, "gift_cards", id);
  await updateDoc(cardRef, {
    status: "active",
    isActivated: true,
    activatedAt: new Date().toISOString()
  });
  
  alert("Gift Card is now ACTIVE and ready for use!");
};

  return (
    <div className="max-w-[95%] mx-auto space-y-8 pb-20 pt-4">
      
{/* =======================
    SIMPLE GIFT CARD CREATOR 
======================= */}
<div className="mx-auto mb-12">
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center">
                <i className="fas fa-plus text-pink-500 text-xl"></i>
            </div>
            <div>
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Create Gift Card</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Enter details to generate new cards</p>
            </div>
        </div>
 <hr className="mb-3 border-gray-100" />
      {/* Redesigned Input Grid */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Row 1: Names with Autocomplete */}
    <div className="space-y-1.5">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Recipient Name</label>
        <input 
            type="text" 
            list="client-list" 
            value={form.recipient} 
            onChange={e => setForm({...form, recipient: e.target.value})} 
            placeholder="To clients"
            className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-pink-100" 
        />
    </div>
    <div className="space-y-1.5">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sender Name</label>
        <input 
            type="text" 
            list="client-list" 
            value={form.sender} 
            onChange={e => setForm({...form, sender: e.target.value})} 
            placeholder="From clients"
            className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-pink-100" 
        />
    </div>


    {/* Row 2: Qty & Amount */}
    <div className="space-y-1.5">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quantity</label>
        <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-pink-100" />
    </div>
    <div className="space-y-1.5">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount ($)</label>
        <input type="number" placeholder="50"  value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-pink-100" />
    </div>


    {/* Row 3: Manual Code (The one we are adding back) */}
<div className="md:col-span-1 space-y-1.5">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
        Custom Gift Card Code (Optional)
    </label>
    <input 
        type="text" 
        maxLength={6} // <--- Forces the limit
        value={form.code} 
        onChange={e => {
            // Only allow numbers to be typed
            const val = e.target.value.replace(/\D/g, "");
            setForm({...form, code: val});
        }} 
        placeholder="000001"
        className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-pink-100" 
    />
    {giftCards.some(c => c.code.toLowerCase() === form.code.trim().toLowerCase()) && form.code !== "" && (
        <p className="text-[10px] text-red-500 font-bold ml-1 uppercase">
            <i className="fas fa-exclamation-triangle mr-1"></i> This code already exists!
        </p>
    )}
</div>
        {/* Expiration Settings */}
     <div className="md:col-span-1 space-y-1.5">
        <label className="flex items-center gap-3 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={form.noExpiry} 
                    onChange={(e) => {
                        const isChecked = e.target.checked;
                        setForm({ ...form, noExpiry: isChecked });
                        if (isChecked) setExpUnit('never');
                        else setExpUnit('months');
                    }} 
                    className="w-5 h-5 accent-pink-500 rounded-md" 
                />
                <span className="text-xs font-black uppercase text-pink-700">No Expiration Date</span>
            </label>

            {!form.noExpiry && (
                <div className="flex gap-3 items-center">
                    <span className="text-[10px] font-black text-pink-400 uppercase">Valid for:</span>
                    <input type="number" value={expValue} onChange={(e) => setExpValue(e.target.value)} className="w-24 p-3 bg-white rounded-xl text-sm font-bold outline-none shadow-sm" />
                    <select value={expUnit} onChange={(e) => setExpUnit(e.target.value)} className="flex-1 max-w-[150px] p-3 bg-white rounded-xl text-sm font-bold outline-none shadow-sm appearance-none">
                        <option value="months">Months</option>
                        <option value="years">Years</option>
                    </select>
                </div>
            )}
        </div>
         <div className="md:col-span-1 space-y-1.5">
        <button 
            onClick={handleSaveAndPrint}
            className="w-full py-5 bg-pink-700 hover:bg-black text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
        >
            <i className="fas fa-save mr-2"></i> Save Gift Card
        </button>
        </div>
</div>



        
    </div>
</div>

{/* Keep your datalist here */}
<datalist id="client-list">
    {autocompleteNames.map((name, index) => (
        <option key={index} value={name} />
    ))}
</datalist>
{/* NEW: PENDING ACTIVATIONS SECTION */}
  {giftCards.filter(gc => gc.status === "pending").length > 0 && (
    <div className="space-y-3">
      <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] ml-1">
        Needs Activation ({giftCards.filter(gc => gc.status === "pending").length})
      </h3>
      {giftCards.filter(gc => gc.status === "pending").map(card => (
        <div key={card.id} className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex justify-between items-center shadow-sm animate-pulse-slow">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-200 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">Pending</span>
              <p className="font-black text-gray-900 text-sm">{card.recipientName}</p>
            </div>
            <p className="text-[10px] text-gray-500 font-bold mt-0.5">Code: {card.code} • ${card.amount}</p>
          </div>

          <button 
            onClick={() => handleActivate(card.id)}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-green-600 transition-all shadow-sm"
          >
            Activate
          </button>
        </div>
      ))}
    </div>
  )}

      <hr className="border-gray-100" />

      {/* =======================
          REGISTRY TABLE 
      ======================= */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-black text-gray-800 uppercase italic">Gift Card Registry</h2>
            <input type="text" placeholder="Search Code or Name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white border rounded-xl px-4 py-2 text-xs font-bold w-64 outline-none focus:border-pink-300" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden text-nowrap overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400">
              <tr>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Balance</th>
                <th className="px-6 py-4">To / From</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
  Expires
</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-bold text-gray-600">
              {filteredCards.length > 0 ? filteredCards.map((card) => (
                <tr key={card.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">{card.createdAt?.seconds ? new Date(card.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-6 py-4 font-mono text-pink-600">{card.code}</td>
                  <td className="px-6 py-4 text-gray-900 font-black">${Number(card.balance).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span>{card.recipientName || '---'}</span>
                        <span className="text-[9px] text-gray-400">Fr: {card.senderName || '---'}</span>
                    </div>
                  </td>
                  {/* Inside your giftCards.map((card) => (...)) */}
<td className="px-6 py-4 whitespace-nowrap">
    {card.expirationDate ? (
        <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-700">
                {card.expirationDate.toDate().toLocaleDateString()}
            </span>
            <span className={`text-[9px] font-black uppercase tracking-tighter ${
                card.expirationDate.toDate() < new Date() ? 'text-red-500' : 'text-green-500'
            }`}>
                ● {card.expirationDate.toDate() < new Date() ? 'Expired' : 'Valid'}
            </span>
        </div>
    ) : (
        <span className="px-3 py-1 bg-gray-100 text-gray-400 text-[10px] font-black uppercase rounded-xl">
            Never
        </span>
    )}
</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-xl text-[9px] uppercase ${card.balance > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {card.balance > 0 ? 'Active' : 'Empty'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center space-x-3">
                   <button 
  onClick={() => {
    setSelectedCard({
      ...card,
      // Safety: Ensure these exist as numbers or arrays to prevent .toFixed() and .map() crashes
      amount: card.amount || 0,
      balance: card.balance || 0,
      history: card.history || [] 
    });
  }} 
  className="text-gray-400 hover:text-blue-600 transition-colors" 
  title="Manage Card"
>
  <i className="fas fa-edit"></i>
</button>
 <button onClick={() => printCards([card])} className="text-gray-400 hover:text-pink-600 transition-colors" title="Print"><i className="fas fa-print"></i></button>
                    <button onClick={() => deleteDoc(doc(db, "gift_cards", card.id))} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete"><i className="fas fa-trash"></i></button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="p-10 text-center text-gray-400 font-medium">No gift cards found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =======================
          MANAGE MODAL 
      ======================= */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
            {/* Header */}
            <div className="bg-gray-900 p-6 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter">Manage Gift Card</h3>
                  <p className="text-[10px] font-mono text-pink-400 uppercase tracking-[0.3em] font-bold">{selectedCard.code}</p>
                </div>
                <button 
                  onClick={handleSendSMS}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-lg ml-4"
                >
                  <i className="fas fa-comment-dots"></i> SMS Details
                </button>
              </div>
              <button onClick={() => setSelectedCard(null)} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="flex flex-col lg:flex-row overflow-hidden flex-1">
              
              {/* Left Column: Quick Redeem & Edit Form */}
              <div className="p-6 space-y-6 lg:w-2/5 border-r border-gray-100 overflow-y-auto">
                
                {isEditingCode ? (
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={newCodeInput} 
                    onChange={e => setNewCodeInput(e.target.value)}
                    className="flex-1 p-2 bg-white border rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-pink-200"
                />
                <button onClick={handleUpdateCode} className="px-3 py-1 bg-green-500 text-white rounded-lg text-xs font-bold">Save</button>
                <button onClick={() => setIsEditingCode(false)} className="px-3 py-1 bg-gray-300 text-white rounded-lg text-xs font-bold">X</button>
            </div>
        ) : (
            <div className="flex justify-between items-center">
                <span className="text-lg font-black text-gray-800">{selectedCard.code}</span>
                <button 
                    onClick={() => { setIsEditingCode(true); setNewCodeInput(selectedCard.code); }}
                    className="text-pink-500 hover:text-pink-600 text-xs font-bold uppercase"
                >
                    <i className="fas fa-edit mr-1"></i> Edit Code
                </button>
            </div>
        )}
         <hr className="border-gray-100" />
               {/* BALANCE STATS GRID */}
<div className="grid grid-cols-2 gap-4 mt-4">
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
            Original Amount
        </label>
        <span className="text-xl font-black text-gray-500">
            ${Number(selectedCard.amount || 0).toFixed(2)}
        </span>
    </div>
    
    <div className="p-4 bg-pink-50 rounded-xl border border-pink-100">
        <label className="text-[10px] font-black text-pink-400 uppercase tracking-widest block mb-1">
            Current Balance
        </label>
        <span className="text-2xl font-black text-pink-600">
            ${Number(selectedCard.balance || 0).toFixed(2)}
        </span>
    </div>
</div>
               {/* 2. APPLY TRANSACTION (Redeem / Add Value) */}
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                <select 
                    value={transaction.type}
                    onChange={e => setTransaction({...transaction, type: e.target.value})}
                    className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-pink-100"
                >
                    <option value="Redeem">Redeem (Minus)</option>
                    <option value="Add Value">Add Value (Plus)</option>
                </select>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount ($)</label>
                <input 
                    type="number" 
                    value={transaction.amount}
                    onChange={e => setTransaction({...transaction, amount: e.target.value})}
                    placeholder="0.00"
                    className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-pink-100"
                />
            </div>
        </div>

        <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notes / Service (Optional)</label>
            <textarea 
                value={transaction.note}
                onChange={e => setTransaction({...transaction, note: e.target.value})}
                placeholder="e.g. Manicure service, Birthday bonus..."
                className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-pink-100 h-20 resize-none"
            />
        </div>

        <button 
            onClick={handleApplyTransaction}
            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all text-white shadow-lg ${
                transaction.type === 'Redeem' ? 'bg-pink-500 hover:bg-pink-600' : 'bg-gray-800 hover:bg-black'
            }`}
        >
            Confirm {transaction.type}
        </button>
    </div>


                {/* EDIT FORM */}
              {/* <form onSubmit={handleUpdateCard} className="space-y-4">
                 

                  <div className="space-y-3">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Recipient</label>
                        <input type="text" value={selectedCard.recipientName} onChange={e => setSelectedCard({...selectedCard, recipientName: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Sender</label>
                        <input type="text" value={selectedCard.senderName} onChange={e => setSelectedCard({...selectedCard, senderName: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border-none" />
                    </div>
                  </div>

                  <button type="submit" className="w-full py-4 bg-gray-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-pink-700 transition-all shadow-lg">
                    Save Details
                  </button>
                </form> */}
              </div>

              {/* Right Column: History */}
              <div className="p-6 lg:w-3/5 bg-gray-50 flex flex-col overflow-hidden">
                <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 flex items-center gap-2">
                  <i className="fas fa-history text-pink-500"></i> Transaction History
                </h4>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
{selectedCard.history?.slice().reverse().map((log, index) => (
  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
    <div className="flex flex-col flex-1">
      <span className="text-[10px] font-black text-pink-500 uppercase tracking-wider">
        {log.date && typeof log.date.toDate === 'function' 
          ? log.date.toDate().toLocaleDateString() 
          : "Initial"}
      </span>
      <p className="text-xs font-black text-gray-800 uppercase mt-0.5">{log.type || 'Transaction'}</p>
      {log.note && (
        <p className="text-[10px] font-bold text-gray-500 italic mt-1 leading-tight">
          {log.note}
        </p>
      )}
    </div>
    
    <div className="text-right ml-4">
      <div className="flex items-center gap-2 justify-end">
        {/* SAFETY: The (log.oldBalance || 0) prevents the 'undefined' crash */}
        <span className="text-xs font-bold text-gray-400 line-through">
          ${Number(log.oldBalance || 0).toFixed(2)}
        </span>
        <span className={`text-sm font-black ${log.type === 'Redeem' ? 'text-pink-600' : 'text-green-600'}`}>
          ${Number(log.newBalance || 0).toFixed(2)}
        </span>
      </div>
    </div>
  </div>
))}
                  
                  {(!selectedCard.history || selectedCard.history.length === 0) && (
                     <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50 italic">
                        <i className="fas fa-receipt text-3xl mb-2"></i>
                        <p className="text-[10px] font-bold uppercase">No history yet</p>
                     </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}