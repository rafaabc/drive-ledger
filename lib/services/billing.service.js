const userModel = require('../models/user.model');
const stripeLib = require('../stripe.js');

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const INTERVAL_PRICE_ENV = {
  monthly: 'STRIPE_PRICE_MONTHLY',
  annual: 'STRIPE_PRICE_ANNUAL',
};

async function createCheckoutSession({ userId, interval }) {
  const priceEnvVar = INTERVAL_PRICE_ENV[interval];
  if (!priceEnvVar) throw makeError(400, 'interval must be one of: monthly, annual');
  const priceId = process.env[priceEnvVar];
  if (!priceId) throw makeError(500, 'billing_not_configured');

  const user = await userModel.findById(userId);
  if (!user) throw makeError(404, 'User not found');

  const stripe = stripeLib.getStripe();
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user._id.toString() },
    });
    customerId = customer.id;
    await userModel.updatePlanAndBilling(user._id, { stripeCustomerId: customerId });
  }

  const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL;
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/settings?checkout=success`,
    cancel_url: `${baseUrl}/settings?checkout=cancelled`,
  });

  return { url: session.url };
}

async function createPortalSession({ userId }) {
  const user = await userModel.findById(userId);
  if (!user) throw makeError(404, 'User not found');
  if (!user.stripeCustomerId) throw makeError(400, 'no billing account for this user yet');

  const stripe = stripeLib.getStripe();
  const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL;
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/settings`,
  });

  return { url: session.url };
}

async function resolveUserByCustomerId(customerId) {
  return userModel.findByStripeCustomerId(customerId);
}

const TERMINAL_INACTIVE_STATUSES = ['canceled', 'unpaid', 'incomplete_expired'];

async function handleWebhookEvent(event) {
  const object = event.data.object;
  const customerId = object.customer;
  if (!customerId) return;

  const user = await resolveUserByCustomerId(customerId);
  if (!user) return;

  if (user.lastStripeEventId === event.id) return; // already processed — idempotent no-op

  switch (event.type) {
    case 'checkout.session.completed': {
      await userModel.updatePlanAndBilling(user._id, {
        plan: 'pro',
        planSource: 'stripe',
        stripeSubscriptionId: object.subscription,
        lastStripeEventId: event.id,
      });
      break;
    }
    case 'customer.subscription.updated': {
      const plan = TERMINAL_INACTIVE_STATUSES.includes(object.status) ? 'free' : 'pro';
      // As of Stripe API version 2025-03-31.basil (and the 2026-06-24.dahlia pinned
      // in lib/stripe.js), current_period_end/current_period_start no longer exist
      // on the Subscription object — they moved to SubscriptionItem. Read it off
      // the first (and, for this single-price setup, only) item instead.
      const periodEnd = object.items?.data?.[0]?.current_period_end;
      await userModel.updatePlanAndBilling(user._id, {
        plan,
        planSource: 'stripe',
        stripeSubscriptionId: object.id,
        stripeSubscriptionStatus: object.status,
        planRenewsAt: periodEnd ? new Date(periodEnd * 1000) : undefined,
        lastStripeEventId: event.id,
      });
      break;
    }
    case 'customer.subscription.deleted': {
      // clearBilling() also $unsets stripeCustomerId, which would make this user
      // unreachable via findByStripeCustomerId on any future event (or portal
      // session) for the same Stripe customer. Restore it immediately after.
      await userModel.clearBilling(user._id);
      await userModel.updatePlanAndBilling(user._id, {
        stripeCustomerId: customerId,
        lastStripeEventId: event.id,
      });
      break;
    }
    case 'invoice.payment_failed': {
      await userModel.updatePlanAndBilling(user._id, {
        stripeSubscriptionStatus: 'past_due',
        lastStripeEventId: event.id,
      });
      break;
    }
    default:
      break;
  }
}

module.exports = { createCheckoutSession, createPortalSession, handleWebhookEvent };
