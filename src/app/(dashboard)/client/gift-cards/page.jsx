"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, query, where, onSnapshot, 
  updateDoc, doc, getDocs, serverTimestamp, addDoc 
} from "firebase/firestore";
import { useToast } from "@/context/ToastContext";
import { toPng } from 'html-to-image';

// Helper Input Component
const InputItem = ({ label, value, onChange, type = "text" }) => (
  <div>
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">{label}</label>
    <input 
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold text-gray-700 transition-all"
    />
  </div>
);

// --- 3D CARD COMPONENT ---
const FlipCardItem = ({ card, onEdit, onRemove, handleShare }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef(null);
  const isPending = card.status === 'Pending';

  return (
    <div className={`w-full max-w-sm mx-auto space-y-4 animate-in slide-in-from-bottom-4 duration-300 relative ${isPending ? 'opacity-75' : ''}`}>
      <div 
        className="group perspective-1000 w-full h-[240px] cursor-pointer" 
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* FRONT OF CARD */}
          <div ref={cardRef} className="absolute inset-0 backface-hidden bg-slate-900 rounded-xl shadow-2xl overflow-hidden p-0 border border-slate-800">
            {isPending && (
              <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                <span className="bg-yellow-400 text-black text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-xl">
                  Waiting for Approval
                </span>
              </div>
            )}
            
            <div className="p-6 flex justify-between items-start relative z-10">
              <div>
                <h3 className="font-parisienne text-3xl font-black text-pink-500 leading-tight">Gift Card</h3>
                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">Nails Express</p>
              </div>
              <div className="text-right">
                <p className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-1">Balance</p>
                <p className="text-3xl font-black text-white tracking-tighter">${Number(card.balance || 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="px-6 mt-2 relative z-10 flex gap-8">
              <div>
                <p className="text-[7px] font-black text-pink-500 uppercase tracking-widest mb-1">To</p>
                <p className="text-xs font-bold text-white uppercase truncate max-w-[100px]">{card.recipientName || "Valued Guest"}</p>
              </div>
              <div>
                <p className="text-[7px] font-black text-pink-500 uppercase tracking-widest mb-1">From</p>
                <p className="text-xs font-bold text-white uppercase truncate max-w-[100px]">{card.senderName || "Guest"}</p>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent z-10">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Card Code</p>
                  <p className="text-sm font-mono text-white tracking-[0.2em]">{card.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</p>
                  <p className="text-[10px] font-bold text-white uppercase">{card.status}</p>
                </div>
              </div>
            </div>
          </div>

          {/* BACK OF CARD */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-xl border border-gray-100 shadow-xl flex flex-col p-8 overflow-hidden text-center">
            <div className="absolute top-0 left-0 right-0 h-10 bg-black"></div>
            <div className="mt-8 flex-1 flex flex-col justify-center">
              <p className="text-[10px] leading-relaxed text-gray-500 font-medium px-4 mb-4">This card is redeemable for services at Nails Express. Treat this card like cash, it is not replaceable if lost or stolen. This card is non-refundable and cannot be exchanged for cash.</p>
               <p className="text-[10px] leading-relaxed text-gray-500 font-medium mb-4">
                 Activate via Venmo @nailsexpress. Reference code {card.code} when paying.
               </p>
              <h4 className="text-sm font-black text-pink-600 uppercase">Nails Express</h4>
              <p className="text-[9px] text-gray-400 font-bold uppercase">(859) 236-2873</p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      {!isPending && (
        <div className="flex justify-between items-center px-1">
          <button onClick={(e) => handleShare(e, cardRef, card.code)} className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
            <i className="fas fa-share-alt"></i> Share
          </button>
          <div className="flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); onEdit(card); }} className="text-[10px] font-black text-pink-600 uppercase bg-pink-50 px-3 py-2 rounded-lg">
              <i className="fas fa-pen"></i>
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRemove(card); }} className="text-[10px] font-black text-red-500 uppercase bg-red-50 px-3 py-2 rounded-lg">
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN PAGE ---
export default function ClientGiftCards() {
  const [claimCode, setClaimCode] = useState("");
const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Modals/Steps
  const [step, setStep] = useState(null); // 'giftcard' or null
  const [giftAmount, setGiftAmount] = useState(50);
  const [giftData, setGiftData] = useState({ toName: "", toEmail: "", senderName: "" });
  const [editingCard, setEditingCard] = useState(null);
  const [editTo, setEditTo] = useState("");
const [editFrom, setEditFrom] = useState("");
const [deletingCard, setDeletingCard] = useState(null);
useEffect(() => {
  if (user && user.displayName) {
    setGiftData(prev => ({ ...prev, senderName: user.displayName }));
  }
}, [user]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setGiftData(prev => ({ ...prev, senderName: u.displayName || "" }));
        const q = query(collection(db, "gift_cards"), where("clientId", "==", u.uid));
        return onSnapshot(q, (s) => {
          setCards(s.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        });
      }
    });
    return () => unsub();
  }, []);
const handleUpdateNames = async () => {
  if (!editingCard) return;
  try {
    await updateDoc(doc(db, "gift_cards", editingCard.id), {
      recipientName: editTo,
      senderName: editFrom
    });
    showToast("Card updated successfully!", "success");
    setEditingCard(null); // This closes the modal
  } catch (err) {
    showToast("Error updating card", "error");
  }
};
const handleGiftPurchase = async () => {
  try {
    const finalAmount = Number(giftAmount);
    if (isNaN(finalAmount) || finalAmount <= 0) return showToast("Invalid amount", "error");

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    await addDoc(collection(db, "gift_cards"), {
      code: newCode,
      balance: finalAmount,
      initialAmount: finalAmount,
      clientId: user.uid,
      recipientName: giftData.toName || "Valued Guest",
      recipientEmail: giftData.toEmail,
      senderName: giftData.senderName || user.displayName || "Guest", // Saved here
      status: 'Pending',
      createdAt: serverTimestamp(),
    });

    showToast("Order submitted! Please pay to activate.", "success");
    setStep(null);
    // Reset data
    setGiftData({ toName: "", toEmail: "", senderName: user.displayName || "" });
  } catch (err) {
    showToast("Order failed to submit.", "error");
  }
};

  const handleGlobalShare = async (e, ref, code) => {
    e.stopPropagation();
    try {
      const dataUrl = await toPng(ref.current, { 
        cacheBust: true,
        filter: (n) => !['LINK', 'STYLE', 'SCRIPT'].includes(n.tagName)
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `GiftCard-${code}.png`, { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({ files: [file], title: 'Nails Express Card', text: `Code: ${code}` });
      } else {
        const link = document.createElement('a');
        link.download = `GiftCard-${code}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) { console.error(err); }
  };

  const handleRemove = async (card) => {
  // Check if card has money before confirming
  const confirmMsg = card.balance > 0 
    ? `Warning: This card still has $${card.balance}. Remove it from your wallet?`
    : "Remove this gift card from your wallet?";

  if (!window.confirm(confirmMsg)) return;

  try {
    // We set clientId to null so it leaves the user's dashboard 
    // but the card remains in the database (so the money isn't lost).
    await updateDoc(doc(db, "gift_cards", card.id), {
      clientId: null
    });
    showToast("Card removed from wallet", "success");
  } catch (err) {
    console.error("Remove error:", err);
    showToast("Error removing card", "error");
  }
};

  const handleManualClaim = async (e) => {
  e.preventDefault();
  const cleanCode = claimCode.trim().toUpperCase();

  if (cleanCode.length < 6) {
    showToast("Please enter a valid 6-digit code", "error");
    return;
  }

  setIsSubmitting(true);

  try {
    const q = query(collection(db, "gift_cards"), where("code", "==", cleanCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      showToast("Gift card code not found.", "error");
    } else {
      const cardDoc = querySnapshot.docs[0];
      const cardData = cardDoc.data();

      // Check if someone else already owns it
      if (cardData.clientId) {
        showToast("This card is already linked to an account.", "error");
        return;
      }

      // Link the card to the user
      await updateDoc(cardDoc.ref, {
        clientId: user.uid,
        claimedAt: serverTimestamp(),
        status: 'Active' // We assume physical/existing cards are pre-activated
      });
      
      showToast("Gift card added to your wallet!", "success");
      setClaimCode("");
    }
  } catch (err) {
    showToast("Error linking card. Try again.", "error");
  } finally {
    setIsSubmitting(false);
  }
};

const handleStripeCheckout = async () => {
  // 1. Safety check: Ensure we have the data before sending
  if (!giftAmount || !giftData.toEmail) {
    alert("Please fill in the recipient email and amount.");
    return;
  }
  
  setLoading(true);
  try {
    const response = await fetch('/api/checkout_sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: giftAmount,
        type: 'giftcard',
        // 2. We use || to handle both "senderName" or "fromName" just in case
        senderName: giftData.senderName || giftData.fromName || "Valued Customer",
        toName: giftData.toName || "Recipient",
        toEmail: giftData.toEmail,
      }),
    });

    const session = await response.json();
    
    if (session.url) {
      window.location.href = session.url;
    } else {
      console.error("Stripe Session Error:", session);
    }
  } catch (error) {
    console.error("Connection Error:", error);
  } finally {
    setLoading(false);
  }
};

  if (loading) return <div className="p-20 text-center font-black text-pink-500 uppercase tracking-widest animate-pulse">Loading Wallet...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-tight">Gift Card Wallet</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Order, Manage & Share</p>
        </div>
        <button 
          onClick={() => setStep('giftcard')} 
          className="bg-[#d63384] text-white px-8 py-3.5 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-black transition-all shadow-lg"
        >
          Buy New Card
        </button>
      </div>
{/* MANUAL CLAIM SECTION */}
<div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-12 max-w-lg">
  <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 text-gray-400">
    Have a physical card? Add it here
  </h3>
  <form onSubmit={handleManualClaim} className="flex gap-2">
    <input 
      type="text"
      value={claimCode}
      onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
      placeholder="ENTER 6-DIGIT CODE" 
      maxLength={6}
      className="flex-1 p-3.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-center tracking-[0.3em] outline-none focus:border-[#d63384] transition-all"
    />
    <button 
      type="submit"
      disabled={isSubmitting}
      className="bg-gray-900 text-white px-6 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-[#d63384] transition-colors disabled:opacity-50"
    >
      {isSubmitting ? '...' : 'Link Card'}
    </button>
  </form>
</div>
      {/* CARDS GRID */}
      <div className="grid gap-10 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
        {cards.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400 font-bold">No cards found. Buy one to get started!</p>
          </div>
        ) : (
          cards.map(c => (
            <FlipCardItem 
              key={c.id} 
              card={c} 
              handleShare={handleGlobalShare}
              onEdit={() => {
      setEditingCard(c);
      setEditTo(c.recipientName || "");
      setEditFrom(c.senderName || "");
    }}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>
{/* EDIT NAMES MODAL */}
{editingCard && (
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 font-serif">Personalize Card</h2>
        <button onClick={() => setEditingCard(null)} className="text-gray-400 hover:text-gray-600">
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">To (Recipient)</label>
          <input 
            type="text" 
            value={editTo} 
            onChange={(e) => setEditTo(e.target.value)}
            placeholder="e.g. Happy Birthday!"
            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">From (Sender)</label>
          <input 
            type="text" 
            value={editFrom} 
            onChange={(e) => setEditFrom(e.target.value)}
            placeholder="Your Name"
            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <button 
          onClick={() => setEditingCard(null)}
          className="flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest text-gray-400 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={handleUpdateNames}
          className="flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest text-white bg-[#d63384] hover:bg-pink-700 transition-colors shadow-lg"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
)}
{/* GIFT CARD PURCHASE MODAL */}
{step === 'giftcard' && (
  <div 
    className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
    onClick={() => setStep(null)}
  >
    <div 
      className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-100 relative"
      onClick={(e) => e.stopPropagation()}
    >
      {/* THE "X" CLOSE BUTTON */}
      <button 
        onClick={() => setStep(null)} 
        className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-[120]"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* HEADER */}
      <div className="bg-[#d63384] p-6 text-center">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Purchase Gift Card</h2>
        <p className="text-pink-100 text-[10px] font-bold uppercase tracking-widest mt-1">Instant Digital Delivery • Secure Checkout</p>
      </div>

      <div className="p-6 space-y-5">
        {/* AMOUNT SELECTION */}
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Select Amount</label>
          <div className="grid grid-cols-5 gap-2">
            {[25, 50, 100, 200].map((amt) => (
              <button 
                key={amt} 
                onClick={() => setGiftAmount(amt)}
                className={`py-3 rounded-xl border-2 font-black text-sm transition-all ${
                  giftAmount === amt ? 'border-[#d63384] bg-pink-50 text-[#d63384]' : 'border-gray-50 bg-gray-50 text-gray-400'
                }`}
              >
                ${amt}
              </button>
            ))}
            <button 
              onClick={() => setGiftAmount('custom')}
              className={`py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${
                giftAmount === 'custom' || (![25, 50, 100, 200].includes(giftAmount) && giftAmount > 0)
                  ? 'border-[#d63384] bg-pink-50 text-[#d63384]' 
                  : 'border-gray-50 bg-gray-50 text-gray-400'
              }`}
            >
              Custom
            </button>
          </div>

          {/* CUSTOM INPUT */}
          {(giftAmount === 'custom' || (![25, 50, 100, 200].includes(giftAmount) && giftAmount > 0)) && (
            <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
              <input 
                type="number"
                placeholder="Enter custom amount ($)"
                onChange={(e) => setGiftAmount(Number(e.target.value))}
                className="w-full p-4 bg-pink-50 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-[#d63384] font-bold text-[#d63384]"
              />
            </div>
          )}
        </div>

        {/* INPUT FIELDS */}
        <div className="grid grid-cols-2 gap-4">
          <InputItem label="Sender Name" value={giftData.senderName} onChange={(val) => setGiftData({...giftData, senderName: val})} />
          <InputItem label="Recipient Name" value={giftData.toName} onChange={(val) => setGiftData({...giftData, toName: val})} />
        </div>
        <InputItem label="Recipient Email" value={giftData.toEmail} onChange={(val) => setGiftData({...giftData, toEmail: val})} />

        {/* STRIPE PAYMENT BUTTON */}
        <div className="pt-2">
          <button 
            onClick={handleStripeCheckout} 
            disabled={loading || !giftAmount || !giftData.toEmail}
            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
              !loading && giftAmount && giftData.toEmail 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <span>Pay with Card / Apple Pay</span>
            )}
          </button>
          
          <p className="text-center mt-4 text-[9px] text-gray-400 font-bold uppercase tracking-widest">
            🔒 Secure Payment via Stripe
          </p>
        </div>
      </div>
    </div>
  </div>
)}

    </div>
  );
}