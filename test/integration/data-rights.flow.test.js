'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const { describe, it, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { startMongo, stopMongo, resetMongo } = require('../helpers/mongo');
const { VALID_CONSENT } = require('../helpers/fixtures');
require('../helpers/email-mock');
const authService = require('../../lib/services/auth.service');
const userModel = require('../../lib/models/user.model');
const expensesService = require('../../lib/services/expenses.service');
const vehiclesService = require('../../lib/services/vehicles.service');
const vehicleModel = require('../../lib/models/vehicle.model');
const incomeModel = require('../../lib/models/income.model');
const stripeLib = require('../../lib/stripe.js');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

describe('data rights flow', () => {
  it('should reject registration without consent', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'alice',
          password: 'Zx7Qw2vNp9Lm4Rk8',
          email: 'alice@test.com',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should allow export and delete after register + verify', async () => {
    const { id: userId } = await authService.register({
      username: 'alice',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'alice@test.com',
      consent: VALID_CONSENT,
    });

    // manually verify email (simulate email verification)
    await userModel.setEmailVerified(userId);

    // Create an expense
    await expensesService.createExpense(userId, {
      category: 'Fuel',
      litres: 10,
      price_per_litre: 5.5,
      date: new Date(Date.now() - 86400000).toISOString(),
    });

    // Export should return user data with expenses
    const exported = await authService.exportUserData({ userId });
    assert.ok(exported.user.username === 'alice');
    assert.ok(exported.expenses.length > 0);
    assert.ok(!exported.user.password); // must not leak password
    assert.ok(exported.user.emailVerificationToken === undefined); // must not leak token

    const [vehicle] = await vehiclesService.listVehicles(userId);
    await incomeModel.create({
      userId,
      vehicleId: vehicle.id,
      date: new Date(),
      amount: 100,
      source: 'Uber',
    });

    // Delete account
    await authService.deleteAccount({ userId, password: 'Zx7Qw2vNp9Lm4Rk8' });

    // User and all owned records should no longer exist
    const deletedUser = await userModel.findById(userId);
    assert.strictEqual(deletedUser, null);
    assert.strictEqual((await vehicleModel.findByUserId(userId)).length, 0);
    assert.strictEqual((await incomeModel.findByUserId(userId)).length, 0);
  });

  it('cancels the Stripe subscription and scrubs billing fields when deleting an account with an active subscription', async () => {
    const user = await userModel.create({
      username: 'stripedeleteuser',
      password: await bcrypt.hash('pass1234', 12),
      email: 'stripedeleteuser@test.com',
    });
    await userModel.updatePlanAndBilling(user._id, {
      plan: 'pro',
      stripeCustomerId: 'cus_delete1',
      stripeSubscriptionId: 'sub_delete1',
    });

    let cancelledSubscriptionId = null;
    mock.method(stripeLib, 'getStripe', () => ({
      subscriptions: {
        cancel: async (subId) => {
          cancelledSubscriptionId = subId;
          return {};
        },
      },
    }));

    await authService.deleteAccount({ userId: user._id.toString(), password: 'pass1234' });

    assert.strictEqual(cancelledSubscriptionId, 'sub_delete1');
    const deletedUser = await userModel.findById(user._id);
    assert.strictEqual(deletedUser, null);
  });
});
