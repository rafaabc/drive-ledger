'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
require('../../helpers/email-mock');
const authService = require('../../../lib/services/auth.service');

const VALID_CONSENT = { policyVersion: '2026-05-20', acceptedAt: new Date().toISOString() };
const { createExpense, getSummary } = require('../../../lib/services/expenses.service');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const PAST_YEAR = new Date().getFullYear() - 1;

// Registers a user and seeds three expenses across two months:
//   January  — Fuel  40L × 1.50 = 60.00
//   March    — Parking           = 20.00
//   March    — Fuel  20L × 2.00 = 40.00
async function seedUser() {
  const user = await authService.register({
    username: 'testuser',
    password: 'Zx7Qw2vNp9Lm4Rk8',
    email: 'testuser@example.com',
    consent: VALID_CONSENT,
  });
  await createExpense(user.id, {
    category: 'Fuel',
    litres: 40,
    price_per_litre: 1.5,
    date: `${PAST_YEAR}-01-15`,
  });
  await createExpense(user.id, { category: 'Parking', amount: 20, date: `${PAST_YEAR}-03-10` });
  await createExpense(user.id, {
    category: 'Fuel',
    litres: 20,
    price_per_litre: 2.0,
    date: `${PAST_YEAR}-03-20`,
  });
  return user;
}

describe('Expenses summary flow integration', () => {
  // TC-04-01
  it('should return per-category totals aggregated across the full year', async () => {
    const user = await seedUser();
    const summary = await getSummary(user.id, { year: String(PAST_YEAR) });
    assert.strictEqual(summary.categories['Fuel'], 100);
    assert.strictEqual(summary.categories['Parking'], 20);
    assert.strictEqual(summary.period.year, PAST_YEAR);
  });

  // TC-04-02
  it('should return per-category totals scoped to the requested month', async () => {
    const user = await seedUser();
    const summary = await getSummary(user.id, { year: String(PAST_YEAR), month: '1' });
    assert.strictEqual(summary.categories['Fuel'], 60);
    assert.strictEqual(summary.categories['Parking'], 0);
    assert.strictEqual(summary.period.month, 1);
  });

  // TC-04-03
  it('should include overall total matching the sum of all category values', async () => {
    const user = await seedUser();
    const summary = await getSummary(user.id, { year: String(PAST_YEAR) });
    const expectedTotal = Object.values(summary.categories).reduce((s, v) => s + v, 0);
    assert.strictEqual(summary.total, Math.round(expectedTotal * 100) / 100);
    assert.strictEqual(summary.total, 120);
  });

  // TC-04-05
  it('should return only the requested category when a category filter is applied', async () => {
    const user = await seedUser();
    const summary = await getSummary(user.id, { year: String(PAST_YEAR), category: 'Fuel' });
    const keys = Object.keys(summary.categories);
    assert.strictEqual(keys.length, 1);
    assert.strictEqual(keys[0], 'Fuel');
    assert.strictEqual(summary.categories['Fuel'], 100);
  });

  // TC-04-07
  it('should include all 7 predefined categories when no category filter is applied', async () => {
    const user = await seedUser();
    const summary = await getSummary(user.id, { year: String(PAST_YEAR) });
    const expected = ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];
    for (const cat of expected) {
      assert.ok(Object.hasOwn(summary.categories, cat), `category ${cat} missing from summary`);
    }
    assert.strictEqual(Object.keys(summary.categories).length, 7);
  });
});
