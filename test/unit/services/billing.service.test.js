'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_fake';
process.env.STRIPE_PRICE_MONTHLY = 'price_monthly_test';
process.env.STRIPE_PRICE_ANNUAL = 'price_annual_test';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const { describe, it, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const userModel = require('../../../lib/models/user.model');
const stripeLib = require('../../../lib/stripe.js');
const billingService = require('../../../lib/services/billing.service');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

describe('billingService.createCheckoutSession()', () => {
  it('creates a Stripe customer for a first-time subscriber and returns a checkout url', async () => {
    const user = await userModel.create({
      username: 'checkoutuser1',
      password: 'x',
      email: 'checkoutuser1@test.com',
    });

    const fakeCustomer = { id: 'cus_new1' };
    const fakeSession = { url: 'https://checkout.stripe.com/session1' };
    mock.method(stripeLib, 'getStripe', () => ({
      customers: { create: async () => fakeCustomer },
      checkout: { sessions: { create: async () => fakeSession } },
    }));

    const result = await billingService.createCheckoutSession({
      userId: user._id.toString(),
      interval: 'monthly',
    });

    assert.strictEqual(result.url, 'https://checkout.stripe.com/session1');
    const updated = await userModel.findById(user._id);
    assert.strictEqual(updated.stripeCustomerId, 'cus_new1');
  });

  it('reuses an existing stripeCustomerId instead of creating a new customer', async () => {
    const user = await userModel.create({
      username: 'checkoutuser2',
      password: 'x',
      email: 'checkoutuser2@test.com',
    });
    await userModel.updatePlanAndBilling(user._id, { stripeCustomerId: 'cus_existing' });

    let customersCreateCalled = false;
    mock.method(stripeLib, 'getStripe', () => ({
      customers: {
        create: async () => {
          customersCreateCalled = true;
          return { id: 'cus_should_not_be_used' };
        },
      },
      checkout: {
        sessions: {
          create: async (opts) => {
            assert.strictEqual(opts.customer, 'cus_existing');
            return { url: 'https://checkout.stripe.com/session2' };
          },
        },
      },
    }));

    await billingService.createCheckoutSession({ userId: user._id.toString(), interval: 'annual' });
    assert.strictEqual(customersCreateCalled, false);
  });

  it('rejects an invalid interval', async () => {
    const user = await userModel.create({
      username: 'checkoutuser3',
      password: 'x',
      email: 'checkoutuser3@test.com',
    });
    await assert.rejects(
      () =>
        billingService.createCheckoutSession({ userId: user._id.toString(), interval: 'weekly' }),
      (err) => err.status === 400,
    );
  });
});

describe('billingService.createPortalSession()', () => {
  it('rejects a user with no stripeCustomerId', async () => {
    const user = await userModel.create({
      username: 'portaluser1',
      password: 'x',
      email: 'portaluser1@test.com',
    });
    await assert.rejects(
      () => billingService.createPortalSession({ userId: user._id.toString() }),
      (err) => err.status === 400 && /no billing account/.test(err.message),
    );
  });

  it('returns a portal url for a user with a stripeCustomerId', async () => {
    const user = await userModel.create({
      username: 'portaluser2',
      password: 'x',
      email: 'portaluser2@test.com',
    });
    await userModel.updatePlanAndBilling(user._id, { stripeCustomerId: 'cus_portal1' });

    mock.method(stripeLib, 'getStripe', () => ({
      billingPortal: {
        sessions: {
          create: async (opts) => {
            assert.strictEqual(opts.customer, 'cus_portal1');
            return { url: 'https://billing.stripe.com/portal1' };
          },
        },
      },
    }));

    const result = await billingService.createPortalSession({ userId: user._id.toString() });
    assert.strictEqual(result.url, 'https://billing.stripe.com/portal1');
  });
});

describe('billingService.handleWebhookEvent()', () => {
  async function makeStripeUser(overrides = {}) {
    const user = await userModel.create({
      username: overrides.username || 'webhookuser1',
      password: 'x',
      email: (overrides.username || 'webhookuser1') + '@test.com',
    });
    await userModel.updatePlanAndBilling(user._id, {
      stripeCustomerId: overrides.stripeCustomerId || 'cus_wh1',
    });
    return user;
  }

  it('checkout.session.completed sets plan=pro and stores subscription id', async () => {
    await makeStripeUser({ stripeCustomerId: 'cus_wh1' });
    await billingService.handleWebhookEvent({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_wh1', subscription: 'sub_wh1' } },
    });

    const updated = await userModel.findByStripeCustomerId('cus_wh1');
    assert.strictEqual(updated.plan, 'pro');
    assert.strictEqual(updated.stripeSubscriptionId, 'sub_wh1');
    assert.strictEqual(updated.lastStripeEventId, 'evt_1');
  });

  it('is idempotent: redelivering the same event.id is a no-op', async () => {
    await makeStripeUser({ stripeCustomerId: 'cus_wh2' });
    const event = {
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_wh2', subscription: 'sub_wh2' } },
    };
    await billingService.handleWebhookEvent(event);
    await billingService.handleWebhookEvent(event);

    const updated = await userModel.findByStripeCustomerId('cus_wh2');
    assert.strictEqual(updated.plan, 'pro');
    assert.strictEqual(updated.lastStripeEventId, 'evt_2');
  });

  it('customer.subscription.updated with status=active keeps plan=pro and stores planRenewsAt', async () => {
    await makeStripeUser({ stripeCustomerId: 'cus_wh3' });
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    await billingService.handleWebhookEvent({
      id: 'evt_3',
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_wh3',
          id: 'sub_wh3',
          status: 'active',
          items: { data: [{ current_period_end: periodEnd }] },
        },
      },
    });

    const updated = await userModel.findByStripeCustomerId('cus_wh3');
    assert.strictEqual(updated.plan, 'pro');
    assert.strictEqual(updated.stripeSubscriptionStatus, 'active');
    assert.ok(updated.planRenewsAt);
  });

  it('customer.subscription.updated with status=canceled sets plan=free', async () => {
    await makeStripeUser({ stripeCustomerId: 'cus_wh4' });
    await billingService.handleWebhookEvent({
      id: 'evt_4',
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_wh4', id: 'sub_wh4', status: 'canceled' } },
    });

    const updated = await userModel.findByStripeCustomerId('cus_wh4');
    assert.strictEqual(updated.plan, 'free');
  });

  it('customer.subscription.deleted clears billing and sets plan=free', async () => {
    await makeStripeUser({ stripeCustomerId: 'cus_wh5' });
    await billingService.handleWebhookEvent({
      id: 'evt_5',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_wh5', id: 'sub_wh5' } },
    });

    const updated = await userModel.findByStripeCustomerId('cus_wh5');
    assert.strictEqual(updated.plan, 'free');
    assert.strictEqual(updated.stripeSubscriptionId, undefined);
  });

  it('invoice.payment_failed records past_due without downgrading plan', async () => {
    const user = await makeStripeUser({ stripeCustomerId: 'cus_wh6' });
    await userModel.updatePlanAndBilling(user._id, { plan: 'pro', stripeCustomerId: 'cus_wh6' });

    await billingService.handleWebhookEvent({
      id: 'evt_6',
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_wh6' } },
    });

    const updated = await userModel.findByStripeCustomerId('cus_wh6');
    assert.strictEqual(updated.plan, 'pro');
    assert.strictEqual(updated.stripeSubscriptionStatus, 'past_due');
  });

  it('does not reprocess a stale retried event delivered after a later event already changed state', async () => {
    // Reproduces the concrete Stripe redelivery race: checkout.session.completed (evt_a)
    // fails transiently and gets queued for retry; meanwhile the subscription is
    // cancelled and customer.subscription.deleted (evt_b) lands and succeeds first.
    // When Stripe retries evt_a afterward, it must still be recognized as already
    // processed and NOT re-apply plan:'pro' over the cancellation.
    await makeStripeUser({ stripeCustomerId: 'cus_wh_race' });
    const evtA = {
      id: 'evt_race_a',
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_wh_race', subscription: 'sub_race' } },
    };
    const evtB = {
      id: 'evt_race_b',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_wh_race', id: 'sub_race' } },
    };

    await billingService.handleWebhookEvent(evtA);
    let updated = await userModel.findByStripeCustomerId('cus_wh_race');
    assert.strictEqual(updated.plan, 'pro');

    await billingService.handleWebhookEvent(evtB);
    updated = await userModel.findByStripeCustomerId('cus_wh_race');
    assert.strictEqual(updated.plan, 'free');

    // Stripe redelivers evt_a (the stale, previously-processed event) after evt_b.
    await billingService.handleWebhookEvent(evtA);
    updated = await userModel.findByStripeCustomerId('cus_wh_race');
    assert.strictEqual(updated.plan, 'free', 'stale retried event must not resurrect plan=pro');
  });

  it('does not clobber an admin-granted manual comp with a Stripe webhook for the same customer', async () => {
    const user = await makeStripeUser({ stripeCustomerId: 'cus_wh_manual' });
    await userModel.updatePlanAndBilling(user._id, {
      plan: 'pro',
      planSource: 'manual',
      stripeCustomerId: 'cus_wh_manual',
    });

    const updatePlanAndBillingMock = mock.method(userModel, 'updatePlanAndBilling');

    await billingService.handleWebhookEvent({
      id: 'evt_manual_1',
      type: 'customer.subscription.updated',
      data: {
        object: { customer: 'cus_wh_manual', id: 'sub_manual', status: 'active' },
      },
    });

    assert.strictEqual(updatePlanAndBillingMock.mock.callCount(), 0);
    updatePlanAndBillingMock.mock.restore();

    const updated = await userModel.findByStripeCustomerId('cus_wh_manual');
    assert.strictEqual(updated.plan, 'pro');
    assert.strictEqual(updated.planSource, 'manual');
  });

  it('silently ignores an event for an unknown customer id', async () => {
    await assert.doesNotReject(() =>
      billingService.handleWebhookEvent({
        id: 'evt_7',
        type: 'checkout.session.completed',
        data: { object: { customer: 'cus_does_not_exist', subscription: 'sub_x' } },
      }),
    );
  });
});
