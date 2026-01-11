"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, doc, deleteDoc, 
  serverTimestamp, query, orderBy, writeBatch, updateDoc, arrayUnion 
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
  // --- STATE ---
  const [giftCards, setGiftCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCard, setSelectedCard] = useState(null); // Controls the Modal

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

  // --- ACTIONS: CREATE ---
  const handleSaveAndPrint = async () => {
    const qty = parseInt(form.quantity);
    const amount = parseFloat(form.amount);
    if (qty < 1 || amount <= 0) return alert("Invalid quantity or amount");
    
    const batch = writeBatch(db);
    const cardsToPrint = [];

    for (let i = 0; i < qty; i++) {
        let finalCode = (qty === 1 && form.code) ? form.code : `GC-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const cardData = {
            amount: amount,
            balance: amount,
            recipientName: form.recipient,
            senderName: form.sender,
            code: finalCode,
            status: 'Active',
            type: 'Physical',
            backgroundUrl: bgImage,
            noExpiry: form.noExpiry,
            expiryDate: form.noExpiry ? "" : form.expiryDate,
            showTo: form.showTo,
            showFrom: form.showFrom,
            createdAt: serverTimestamp(),
            history: [{
                date: new Date().toLocaleString(),
                type: "Created",
                oldBalance: 0,
                newBalance: amount,
                note: "Initial issuance"
            }] 
        };
        const newCardRef = doc(collection(db, "gift_cards"));
        batch.set(newCardRef, cardData);
        cardsToPrint.push(cardData);
    }

    try {
        await batch.commit();
        printCards(cardsToPrint);
        // Reset specific form fields but keep amount/category for convenience
        setForm(prev => ({...prev, recipient: "", sender: "", code: ""}));
        alert(`Successfully generated ${qty} gift cards!`);
    } catch (e) {
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

  return (
    <div className="max-w-[95%] mx-auto space-y-8 pb-20 pt-4">
      
      {/* =======================
          DESIGNER SECTION 
      ======================= */}
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* LEFT: Controls */}
        <div className="w-full lg:w-1/2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
            <h2 className="text-xl font-black text-gray-800 uppercase italic">Printable Gift Card Designer</h2>
            
            {/* Show/Hide Toggles */}
            <div className="grid grid-cols-2 gap-4">
               <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer border border-transparent hover:border-pink-200 transition-all">
                  <input type="checkbox" checked={form.showTo} onChange={e => setForm({...form, showTo: e.target.checked})} className="w-4 h-4 accent-pink-500" />
                  <span className="text-[10px] font-black uppercase text-gray-600">Show 'To' Field</span>
               </label>
               <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer border border-transparent hover:border-pink-200 transition-all">
                  <input type="checkbox" checked={form.showFrom} onChange={e => setForm({...form, showFrom: e.target.checked})} className="w-4 h-4 accent-pink-500" />
                  <span className="text-[10px] font-black uppercase text-gray-600">Show 'From' Field</span>
               </label>
            </div>

            {/* Recipient & Sender Row */}
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Recipient Name</label>
                 <input type="text" value={form.recipient} onChange={e => setForm({...form, recipient: e.target.value})} className="w-full p-2.5 bg-gray-50 rounded-xl text-xs font-bold border-none" />
               </div>
               <div>
                 <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Sender Name</label>
                 <input type="text" value={form.sender} onChange={e => setForm({...form, sender: e.target.value})} className="w-full p-2.5 bg-gray-50 rounded-xl text-xs font-bold border-none" />
               </div>
            </div>

            {/* MIDDLE SECTION: Code & Expiry */}
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-4">
               <div>
                 <label className="text-[10px] font-black text-purple-700 uppercase ml-1">Gift Card Code (Optional)</label>
                 <input type="text" placeholder="Leave blank for auto-generate" value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="w-full p-2.5 bg-white rounded-xl text-xs font-bold border-none" />
               </div>
               <div className="space-y-3 pt-2 border-t border-purple-200">
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.noExpiry} onChange={e => setForm({...form, noExpiry: e.target.checked})} className="w-4 h-4 accent-purple-600" />
                    <span className="text-[10px] font-black uppercase text-purple-700">No Expiration (Handwritten)</span>
                 </label>
                 {!form.noExpiry && (
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-purple-400 uppercase ml-1">Set Expiration Date</label>
                      <input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} className="w-full p-2.5 bg-white rounded-xl text-xs font-bold border-none" />
                   </div>
                 )}
               </div>
            </div>

            {/* Background Image Selection */}
            <div>
                <div className="flex gap-2 border-b border-gray-100 pb-2 mb-3 overflow-x-auto text-nowrap">
                    {Object.keys(giftCardBackgrounds).map(cat => (
                        <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1 text-xs font-bold uppercase rounded-lg ${category === cat ? 'bg-pink-100 text-pink-600' : 'text-gray-400'}`}>{cat}</button>
                    ))}
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {giftCardBackgrounds[category].map((url, idx) => (
                        <button key={idx} onClick={() => setBgImage(url)} className={`h-12 w-full rounded-xl bg-cover bg-center border-2 ${bgImage === url ? 'border-pink-500' : 'border-transparent'}`} style={{ backgroundImage: `url(${url})` }}></button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Quantity</label>
                 <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="w-full p-2.5 bg-gray-50 rounded-xl text-xs font-bold border-none" />
               </div>
               <div>
                 <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Value ($)</label>
                 <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full p-2.5 bg-gray-50 rounded-xl text-xs font-bold border-none" />
               </div>
            </div>
            
            <button onClick={handleSaveAndPrint} className="w-full py-4 bg-pink-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-pink-700 transition-all shadow-lg flex items-center justify-center gap-2">
                <i className="fas fa-print"></i> Save & Print Cards
            </button>
        </div>

        {/* RIGHT: Live Preview (Front & Back) */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6 items-center bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8">
             
             {/* FRONT PREVIEW */}
             <div className="w-[400px] h-[228px] rounded-xl shadow-2xl relative overflow-hidden bg-cover bg-center text-white flex flex-col justify-between p-8"
                  style={{ backgroundImage: `url(${bgImage})`, textShadow: '1px 1px 3px rgba(0,0,0,0.6)' }}>
                <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-full border-2 border-white bg-white/20 backdrop-blur-sm"></div>
                    <div className="text-right">
                        <p className="font-parisienne text-3xl leading-none">Gift Card</p>
                        <p className="text-[8px] font-bold tracking-widest uppercase opacity-90">Nails Express</p>
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-5xl font-bold tracking-tighter">${parseFloat(form.amount || 0).toFixed(2)}</p>
                </div>
                <div className="text-[10px] space-y-2">
                    <div className="flex justify-between font-bold">
                        <span>{form.showTo ? `TO: ${form.recipient || '__________'}` : ''}</span>
                        <span>{form.showFrom ? `FROM: ${form.sender || '__________'}` : ''}</span>
                    </div>
                    {/* Centered Code and Expiry */}
                    <div className="flex flex-col items-center pt-2 border-t border-white/30">
                      <p className="font-mono tracking-[0.2em] text-[11px]">{form.code || 'GC-XXXX-XXXX'}</p>
                      <p className="text-[7px] uppercase font-bold opacity-80 mt-0.5">Expires: {form.noExpiry ? '________________' : (form.expiryDate || 'N/A')}</p>
                    </div>
                </div>
             </div>

             {/* BACK PREVIEW */}
             <div className="w-[400px] h-[228px] rounded-xl shadow-lg bg-white border border-gray-200 p-6 flex flex-col justify-between">
                <div className="w-full h-10 bg-black/80 rounded-lg"></div>
                <div className="px-4 text-center space-y-2">
                   <p className="text-[9px] text-gray-500 leading-relaxed">This card is redeemable for services at Nails Express. Treat this card like cash; it is not replaceable if lost or stolen. Non-refundable.</p>
                </div>
                <div className="text-center">
                   <p className="text-[10px] font-black uppercase tracking-widest text-pink-600 leading-none">Nails Express</p>
                   <p className="text-[8px] text-gray-400 mt-1">1560 Hustonville Rd #345, Danville, KY</p>
                </div>
             </div>
        </div>
      </div>

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
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-xl text-[9px] uppercase ${card.balance > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {card.balance > 0 ? 'Active' : 'Empty'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center space-x-3">
                    <button onClick={() => setSelectedCard(card)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Manage Card"><i className="fas fa-edit"></i></button>
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
                
                {/* QUICK REDEEM */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase ml-1">Quick Redeem</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 10, 20, 30, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => handleQuickRedeem(amt)}
                        className="py-2 rounded-xl bg-pink-50 text-pink-600 font-black text-xs border border-pink-100 hover:bg-pink-600 hover:text-white transition-all shadow-sm"
                      >
                        -${amt}
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* EDIT FORM */}
                <form onSubmit={handleUpdateCard} className="space-y-4">
                  <div className="p-4 bg-gray-900 rounded-xl shadow-inner">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Total Balance ($)</label>
                    <input 
                        type="number" 
                        step="0.01"
                        value={selectedCard.balance} 
                        onChange={e => setSelectedCard({...selectedCard, balance: e.target.value})}
                        className="w-full bg-transparent border-none p-0 text-3xl font-black text-white focus:ring-0 outline-none" 
                    />
                  </div>

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

                  <button type="submit" className="w-full py-4 bg-pink-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-pink-700 transition-all shadow-lg">
                    Save Details
                  </button>
                </form>
              </div>

              {/* Right Column: History */}
              <div className="p-6 lg:w-3/5 bg-gray-50 flex flex-col overflow-hidden">
                <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 flex items-center gap-2">
                  <i className="fas fa-history text-pink-500"></i> Transaction History
                </h4>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {[...(selectedCard.history || [])].reverse().map((log, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center group hover:border-pink-200 transition-colors">
                      <div>
                        <p className={`text-[10px] font-black uppercase ${log.type === 'Redemption' ? 'text-red-500' : (log.type === 'Created' ? 'text-green-600' : 'text-blue-500')}`}>
                          {log.type}
                        </p>
                        <p className="text-[8px] text-gray-400 font-mono mt-0.5">{log.date}</p>
                        {log.note && <p className="text-[9px] text-gray-500 mt-1 italic">"{log.note}"</p>}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs font-bold text-gray-400 line-through">${Number(log.oldBalance).toFixed(2)}</span>
                          <i className="fas fa-chevron-right text-[10px] text-gray-300"></i>
                          <span className="text-sm font-black text-gray-800">${Number(log.newBalance).toFixed(2)}</span>
                        </div>
                        {log.type === 'Redemption' && (
                          <p className="text-[10px] font-bold text-red-600 mt-1">
                            -{ (log.oldBalance - log.newBalance).toFixed(2) }
                          </p>
                        )}
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