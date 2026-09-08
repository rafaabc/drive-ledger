'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
require('../../helpers/email-mock');
const authService = require('../../../lib/services/auth.service');
const userModel = require('../../../lib/models/user.model');
const expensesService = require('../../../lib/services/expenses.service');
const incomeService = require('../../../lib/services/income.service');

const VALID_CONSENT = { policyVersion: '2026-05-20', acceptedAt: new Date().toISOString() };

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const TODAY = new Date().toISOString().slice(0, 10);
const YEAR = new Date(TODAY).getUTCFullYear();

async function proUser(username) {
  await authService.register({
    username,
    password: 'Zx7Qw2vNp9Lm4Rk8',
    email: `${username}@test.com`,
    consent: VALID_CONSENT,
  });
  const user = await userModel.findByUsername(username);
  await userModel.updatePlan(user._id.toString(), 'pro');
  return user._id.toString();
}

describe('Fuel work/personal split — full flow', () => {
  it('splits real fuel spend between work and personal driving using odometer + Wolt km', async () => {
    const uid = await proUser('fuelsplit1');

    // Anchor fill before the period.
    await expensesService.createExpense(uid, {
      date: `${YEAR - 1}-12-20`,
      category: 'Fuel',
      litres: 20,
      price_per_litre: 17,
      odometer: 500,
    });

    // A Wolt shift with online km, then two in-period fill-ups spanning 500km.
    await incomeService.createIncome(uid, {
      date: TODAY,
      amount: 400,
      source: 'Wolt',
      startTime: '13:00',
      endTime: '15:00',
      km: 40,
    });
    await expensesService.createExpense(uid, {
      date: TODAY,
      category: 'Fuel',
      litres: 10,
      price_per_litre: 17,
      odometer: 700,
    });
    await expensesService.createExpense(uid, {
      date: TODAY,
      category: 'Fuel',
      litres: 10,
      price_per_litre: 17,
      odometer: 1000,
    });

    const summary = await incomeService.getProfitSummary(uid, { year: String(YEAR) });

    // totalKm = 1000 (last in-period fill) - 500 (anchor) = 500.
    assert.strictEqual(summary.totalKm, 500);
    assert.strictEqual(summary.workKm, 40);
    assert.strictEqual(summary.personalKm, 460);
    assert.strictEqual(summary.workShareBasis, 'odometerSplit');

    // fuelSpend is the actual money paid for the two in-period fills (not the anchor).
    assert.strictEqual(summary.fuelSpend, 340);

    const expectedFuelCost = Math.round(summary.fuelSpend * summary.workShare * 100) / 100;
    assert.strictEqual(summary.fuelCost, expectedFuelCost);
    assert.strictEqual(
      summary.netEarnings,
      Math.round((summary.totalIncome - expectedFuelCost) * 100) / 100,
    );

    // Cross-check against the expenses summary: fuelSpend must equal the
    // period's actual Fuel category total — the whole point of the change.
    const expenseSummary = await expensesService.getSummary(uid, { year: String(YEAR) });
    assert.strictEqual(summary.fuelSpend, expenseSummary.categories.Fuel);
  });

  it('charges 100% of fuel to work when no odometer split is available yet', async () => {
    const uid = await proUser('fuelsplit2');
    await incomeService.createIncome(uid, { date: TODAY, amount: 400, source: 'Wolt' });
    await expensesService.createExpense(uid, {
      date: TODAY,
      category: 'Fuel',
      litres: 10,
      price_per_litre: 17,
      odometer: 1000,
    });

    const summary = await incomeService.getProfitSummary(uid, { year: String(YEAR) });
    assert.strictEqual(summary.workShare, null);
    assert.strictEqual(summary.workShareBasis, 'noOdometerData');
    assert.strictEqual(summary.fuelCost, summary.fuelSpend);
  });
});
