import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc, addDoc, collection, serverTimestamp, arrayUnion } from "firebase/firestore";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req) {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;

  try {
    // Verify that this message ACTUALLY came from Stripe (Security)
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook Signature Failed:", err.message);
    return NextResponse.json({ error: "Invalid Signature" }, { status: 400 });
  }

// Handle the specific event: Successful Payment
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const giftCardId = session.metadata.giftCardId;

if (giftCardId) {
      const giftCardRef = doc(db, "gift_cards", giftCardId);
      
      // We use a constant for the date to ensure history and paidAt match exactly
      const completionDate = new Date().toISOString();

      await updateDoc(giftCardRef, {
        status: "active",
        isActivated: true,
        isRead: false, 
        paidAt: serverTimestamp(), // This works here
        stripePaymentId: session.payment_intent,
        // History log for Admin audit trail
        history: arrayUnion({
          date: completionDate, // Use ISO string here, NOT serverTimestamp()
          type: 'Payment Received',
          note: `Stripe Payment Successful (Session: ${session.id})`
        })
      });

      // 2. Add an Admin Notification so the Bell Icon lights up
      await addDoc(collection(db, "notifications"), {
        type: "gift_card",
        title: "Gift Card Paid",
        message: `Card ${giftCardId.substring(0,5)}... is now active ($${session.amount_total / 100})`,
        createdAt: serverTimestamp(),
        isRead: false
      });
      
      console.log(`✅ Gift Card ${giftCardId} is now ACTIVE`);
    }
  }

  return NextResponse.json({ received: true });
}