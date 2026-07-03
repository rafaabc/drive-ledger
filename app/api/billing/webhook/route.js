import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import stripeLib from '@/lib/stripe.js';
import billingService from '@/lib/services/billing.service';
import { reportHandlerError } from '@/lib/sentry.mjs';

export const runtime = 'nodejs';

export async function POST(req) {
  const sig = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  let event;
  try {
    const stripe = stripeLib.getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ message: 'Invalid webhook signature' }, { status: 400 });
  }

  await connectDB();
  try {
    await billingService.handleWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/billing/webhook', method: 'POST' }) },
    );
  }
}
