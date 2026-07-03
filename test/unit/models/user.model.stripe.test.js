'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const userModel = require('../../../lib/models/user.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

describe('userModel — Stripe fields', () => {
  it('updatePlanAndBilling sets plan and Stripe fields and returns the updated doc', async () => {
    const user = await userModel.create({
      username: 'billtest1',
      password: 'x',
      email: 'billtest1@test.com',
    });

    const updated = await userModel.updatePlanAndBilling(user._id, {
      plan: 'pro',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionStatus: 'active',
      planRenewsAt: new Date('2026-08-01T00:00:00.000Z'),
      lastStripeEventId: 'evt_1',
    });

    assert.strictEqual(updated.plan, 'pro');
    assert.strictEqual(updated.stripeCustomerId, 'cus_123');
    assert.strictEqual(updated.stripeSubscriptionId, 'sub_123');
    assert.strictEqual(updated.stripeSubscriptionStatus, 'active');
    assert.strictEqual(updated.lastStripeEventId, 'evt_1');
  });

  it('findByStripeCustomerId finds the user by stripeCustomerId', async () => {
    const user = await userModel.create({
      username: 'billtest2',
      password: 'x',
      email: 'billtest2@test.com',
    });
    await userModel.updatePlanAndBilling(user._id, {
      plan: 'pro',
      stripeCustomerId: 'cus_456',
    });

    const found = await userModel.findByStripeCustomerId('cus_456');
    assert.strictEqual(found.username, 'billtest2');
  });

  it('findByStripeCustomerId returns null for an unknown customer id', async () => {
    const found = await userModel.findByStripeCustomerId('cus_does_not_exist');
    assert.strictEqual(found, null);
  });

  it('clearBilling unsets Stripe fields and resets plan to free', async () => {
    const user = await userModel.create({
      username: 'billtest3',
      password: 'x',
      email: 'billtest3@test.com',
    });
    await userModel.updatePlanAndBilling(user._id, {
      plan: 'pro',
      stripeCustomerId: 'cus_789',
      stripeSubscriptionId: 'sub_789',
      stripeSubscriptionStatus: 'active',
    });

    const cleared = await userModel.clearBilling(user._id);
    assert.strictEqual(cleared.plan, 'free');
    assert.strictEqual(cleared.stripeCustomerId, undefined);
    assert.strictEqual(cleared.stripeSubscriptionId, undefined);
  });
});
