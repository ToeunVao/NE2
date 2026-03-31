import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { amount, giftCardId, recipientName, senderName } = await req.json();

// Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"], 
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Gift Card for ${recipientName}`,
              description: `From: ${senderName} | Nails Express Salon`,
            },
            unit_amount: Math.round(amount * 100), 
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      
      // --- CRITICAL: Metadata links the Stripe Payment to your Firebase Doc ---
      metadata: {
        giftCardId: giftCardId, // This MUST match what the webhook looks for
        senderName: senderName,
        recipientName: recipientName
      },

      // --- FIX: Ensure the URL doesn't have double slashes ---
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")}/?payment=success&id=${giftCardId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe Session Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}