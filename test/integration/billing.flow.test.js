'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.STRIPE_PRICE_MONTHLY = 'price_monthly_test';

const { describe, it, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../helpers/mongo');
const userModel = require('../../lib/models/user.model');
const stripeLib = require('../../lib/stripe.js');
const billingService = require('../../lib/services/billing.service');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

describe('billing flow — checkout completed → user is pro', () => {
  it('flips plan to pro end to end via handleWebhookEvent after a checkout session', async () => {
    const user = await userModel.create({
      username: 'flowuser1',
      password: 'x',
      email: 'flowuser1@test.com',
    });

    mock.method(stripeLib, 'getStripe', () => ({
      customers: { create: async () => ({ id: 'cus_flow1' }) },
      checkout: { sessions: { create: async () => ({ url: 'https://checkout.stripe.com/x' }) } },
    }));

    await billingService.createCheckoutSession({
      userId: user._id.toString(),
      interval: 'monthly',
    });

    await billingService.handleWebhookEvent({
      id: 'evt_flow1',
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_flow1', subscription: 'sub_flow1' } },
    });

    const afterCheckout = await userModel.findById(user._id);
    assert.strictEqual(afterCheckout.plan, 'pro');

    await billingService.handleWebhookEvent({
      id: 'evt_flow2',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_flow1', id: 'sub_flow1' } },
    });

    const afterCancel = await userModel.findById(user._id);
    assert.strictEqual(afterCancel.plan, 'free');
  });
});
