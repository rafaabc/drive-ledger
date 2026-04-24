'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const authService = require('../../../src/services/auth.service');
const { createExpense, getSummary } = require('../../../src/services/expenses.service');
const userModel = require('../../../src/models/user.model');
const expenseModel = require('../../../src/models/expense.model');

const PAST_YEAR = new Date().getFullYear() - 1;

beforeEach(() => {
  userModel._reset();
  expenseModel._reset();
});

// Registers a user and seeds three expenses across two months:
//   January  — Fuel  40L × 1.50 = 60.00
//   March    — Parking           = 20.00
//   March    — Fuel  20L × 2.00 = 40.00
async function seedUser() {
  const user = await authService.register({ username: 'rafael', password: 'password1' });
  createExpense(user.id, { category: 'Fuel', litres: 40, price_per_litre: 1.5, date: `${PAST_YEAR}-01-15` });
  createExpense(user.id, { category: 'Parking', amount: 20, date: `${PAST_YEAR}-03-10` });
  createExpense(user.id, { category: 'Fuel', litres: 20, price_per_litre: 2.0, date: `${PAST_YEAR}-03-20` });
  return user;
}

describe('Expenses summary flow integration', () => {
  // TC-04-01
  it('should return per-category totals aggregated across the full year', async () => {
    // Arrange
    const user = await seedUser();

    // Act
    const summary = getSummary(user.id, { year: String(PAST_YEAR) });

    // Assert — Fuel = 60 + 40 = 100, Parking = 20
    assert.strictEqual(summary.categories['Fuel'], 100);
    assert.strictEqual(summary.categories['Parking'], 20);
    assert.strictEqual(summary.period.year, PAST_YEAR);
  });

  // TC-04-02
  it('should return per-category totals scoped to the requested month', async () => {
    // Arrange
    const user = await seedUser();

    // Act — filter to January only
    const summary = getSummary(user.id, { year: String(PAST_YEAR), month: '1' });

    // Assert — only January expense: Fuel=60, Parking=0
    assert.strictEqual(summary.categories['Fuel'], 60);
    assert.strictEqual(summary.categories['Parking'], 0);
    assert.strictEqual(summary.period.month, 1);
  });

  // TC-04-03
  it('should include overall total matching the sum of all category values', async () => {
    // Arrange
    const user = await seedUser();

    // Act
    const summary = getSummary(user.id, { year: String(PAST_YEAR) });

    // Assert — total equals sum of category values = 100 + 20 = 120
    const expectedTotal = Object.values(summary.categories).reduce((s, v) => s + v, 0);
    assert.strictEqual(summary.total, Math.round(expectedTotal * 100) / 100);
    assert.strictEqual(summary.total, 120);
  });

  // TC-04-05
  it('should return only the requested category when a category filter is applied', async () => {
    // Arrange
    const user = await seedUser();

    // Act
    const summary = getSummary(user.id, { year: String(PAST_YEAR), category: 'Fuel' });

    // Assert — exactly one key, value matches seeded total
    const keys = Object.keys(summary.categories);
    assert.strictEqual(keys.length, 1);
    assert.strictEqual(keys[0], 'Fuel');
    assert.strictEqual(summary.categories['Fuel'], 100);
  });

  // TC-04-07
  it('should include all 7 predefined categories when no category filter is applied', async () => {
    // Arrange
    const user = await seedUser();

    // Act
    const summary = getSummary(user.id, { year: String(PAST_YEAR) });

    // Assert
    const expected = ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];
    for (const cat of expected) {
      assert.ok(Object.hasOwn(summary.categories, cat), `category ${cat} missing from summary`);
    }
    assert.strictEqual(Object.keys(summary.categories).length, 7);
  });
});
