'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const userModel = require('../../../src/models/user.model');
const expenseModel = require('../../../src/models/expense.model');
const expensesService = require('../../../src/services/expenses.service');

const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const PAST_YEAR = new Date().getFullYear() - 1;
const FUTURE_YEAR = new Date().getFullYear() + 1;

const USER_ID = 1;

const validFuel = () => ({ date: TODAY, category: 'Fuel', litres: 40, price_per_litre: 1.5 });
const validOther = (cat = 'Parking') => ({ date: TODAY, category: cat, amount: 10 });

beforeEach(() => {
  userModel._reset();
  expenseModel._reset();
});

// ---------------------------------------------------------------------------
// US-03 — Create Expense Validation
// ---------------------------------------------------------------------------
describe('expensesService.createExpense()', () => {
  // TC-03-03
  it('should accept all 7 predefined categories', () => {
    const categories = ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];
    for (const category of categories) {
      expenseModel._reset();
      if (category === 'Fuel') {
        const expense = expensesService.createExpense(USER_ID, { date: TODAY, category, litres: 10, price_per_litre: 2 });
        assert.strictEqual(expense.category, category);
      } else {
        const expense = expensesService.createExpense(USER_ID, { date: TODAY, category, amount: 10 });
        assert.strictEqual(expense.category, category);
      }
    }
  });

  // TC-03-04
  it('should throw 400 when category is not one of the predefined values', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Snacks', amount: 10 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /category must be one of/i);
        return true;
      }
    );
  });

  // TC-03-05
  it('should accept duplicate expense entries with distinct ids', () => {
    const body = { date: TODAY, category: 'Parking', amount: 50 };
    const first = expensesService.createExpense(USER_ID, body);
    const second = expensesService.createExpense(USER_ID, body);
    assert.notStrictEqual(first.id, second.id);
    assert.strictEqual(first.amount, second.amount);
  });

  // TC-03-06
  it('should compute Fuel amount as litres × price_per_litre rounded to 2 decimals', () => {
    // 40 * 1.5 = 60.00
    const expense = expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: 40, price_per_litre: 1.5 });
    assert.strictEqual(expense.amount, 60);
  });

  it('should round Fuel amount correctly at the 2nd decimal place', () => {
    // 3 * 1.235 = 3.705 → rounds to 3.71
    const expense = expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: 3, price_per_litre: 1.235 });
    assert.strictEqual(expense.amount, 3.71);
  });

  // TC-03-07
  it('should throw 400 when Fuel expense is missing price_per_litre', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: 40 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /price_per_litre is required/i);
        return true;
      }
    );
  });

  // TC-03-08
  it('should throw 400 when Fuel expense is missing litres', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', price_per_litre: 1.5 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /litres is required/i);
        return true;
      }
    );
  });

  // TC-03-09
  it('should throw 400 when date is in the future', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: FUTURE, category: 'Parking', amount: 10 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /future/i);
        return true;
      }
    );
  });

  // TC-03-10
  it('should accept an expense with today\'s date', () => {
    const expense = expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: 10 });
    assert.ok(expense.id);
    assert.strictEqual(expense.date, TODAY);
  });

  // TC-03-11
  it('should throw 400 when amount is zero', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: 0 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /positive/i);
        return true;
      }
    );
  });

  // TC-03-12
  it('should throw 400 when amount is negative', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: -5 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /positive/i);
        return true;
      }
    );
  });

  // TC-03-18
  it('should return amount as a number, not a string', () => {
    const expense = expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: 25.5 });
    assert.strictEqual(typeof expense.amount, 'number');
  });

  it('should throw 400 when non-Fuel expense includes litres', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: 10, litres: 5 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      }
    );
  });

  it('should throw 400 when Fuel expense explicitly passes amount', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: 40, price_per_litre: 1.5, amount: 60 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /amount is not allowed for Fuel/i);
        return true;
      }
    );
  });

  it('should throw 400 when date is missing', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { category: 'Parking', amount: 10 }),
      (err) => { assert.strictEqual(err.status, 400); assert.match(err.message, /date is required/i); return true; }
    );
  });

  it('should throw 400 when category is missing', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, amount: 10 }),
      (err) => { assert.strictEqual(err.status, 400); assert.match(err.message, /category is required/i); return true; }
    );
  });

  it('should throw 400 when date string is not a valid date', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: 'not-a-date', category: 'Parking', amount: 10 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /date is invalid/i);
        return true;
      }
    );
  });

  it('should throw 400 when Fuel litres is null', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: null, price_per_litre: 1.5 }),
      (err) => { assert.strictEqual(err.status, 400); return true; }
    );
  });

  it('should throw 400 when Fuel price_per_litre is null', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: 40, price_per_litre: null }),
      (err) => { assert.strictEqual(err.status, 400); return true; }
    );
  });

  it('should throw 400 when Fuel litres is zero', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: 0, price_per_litre: 1.5 }),
      (err) => { assert.strictEqual(err.status, 400); assert.match(err.message, /positive/i); return true; }
    );
  });

  it('should throw 400 when Fuel litres is not a number', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: 'forty', price_per_litre: 1.5 }),
      (err) => { assert.strictEqual(err.status, 400); return true; }
    );
  });

  it('should throw 400 when Fuel price_per_litre is zero', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: 40, price_per_litre: 0 }),
      (err) => { assert.strictEqual(err.status, 400); assert.match(err.message, /positive/i); return true; }
    );
  });

  it('should throw 400 when Fuel price_per_litre is not a number', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: 40, price_per_litre: 'cheap' }),
      (err) => { assert.strictEqual(err.status, 400); return true; }
    );
  });

  it('should throw 400 when non-Fuel amount is null', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: null }),
      (err) => { assert.strictEqual(err.status, 400); return true; }
    );
  });

  it('should throw 400 when non-Fuel amount is not a number', () => {
    assert.throws(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: 'ten' }),
      (err) => { assert.strictEqual(err.status, 400); assert.match(err.message, /positive/i); return true; }
    );
  });
});

// ---------------------------------------------------------------------------
// US-03 — Get / Update / Delete Expense
// ---------------------------------------------------------------------------
describe('expensesService.getExpense()', () => {
  it('should return the expense when it belongs to the user', () => {
    const created = expensesService.createExpense(USER_ID, validOther());
    const found = expensesService.getExpense(USER_ID, String(created.id));
    assert.deepStrictEqual(found, created);
  });

  it('should throw 404 when expense does not exist', () => {
    assert.throws(
      () => expensesService.getExpense(USER_ID, '999'),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      }
    );
  });

  it('should throw 404 when expense belongs to a different user', () => {
    const created = expensesService.createExpense(USER_ID, validOther());
    assert.throws(
      () => expensesService.getExpense(999, String(created.id)),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      }
    );
  });
});

describe('expensesService.updateExpense()', () => {
  it('should update a non-Fuel expense amount', () => {
    const created = expensesService.createExpense(USER_ID, validOther());
    const updated = expensesService.updateExpense(USER_ID, String(created.id), { amount: 99 });
    assert.strictEqual(updated.amount, 99);
  });

  it('should keep existing amount when non-Fuel update omits amount', () => {
    const created = expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-01-01`, category: 'Parking', amount: 42 });
    const updated = expensesService.updateExpense(USER_ID, String(created.id), { date: `${PAST_YEAR}-02-01` });
    assert.strictEqual(updated.amount, 42);
  });

  it('should recompute Fuel amount when litres or price_per_litre changes', () => {
    const created = expensesService.createExpense(USER_ID, validFuel());
    const updated = expensesService.updateExpense(USER_ID, String(created.id), { litres: 50 });
    assert.strictEqual(updated.amount, Math.round(50 * 1.5 * 100) / 100);
  });

  it('should recompute Fuel amount when only price_per_litre is updated', () => {
    const created = expensesService.createExpense(USER_ID, validFuel());
    const updated = expensesService.updateExpense(USER_ID, String(created.id), { price_per_litre: 2.0 });
    assert.strictEqual(updated.amount, Math.round(40 * 2.0 * 100) / 100);
  });

  it('should update the category of an existing expense', () => {
    const created = expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: 10 });
    const updated = expensesService.updateExpense(USER_ID, String(created.id), { category: 'Toll', amount: 10 });
    assert.strictEqual(updated.category, 'Toll');
  });

  it('should throw 404 when updating an expense belonging to another user', () => {
    const created = expensesService.createExpense(USER_ID, validOther());
    assert.throws(
      () => expensesService.updateExpense(999, String(created.id), { amount: 50 }),
      (err) => { assert.strictEqual(err.status, 404); return true; }
    );
  });
});

describe('expensesService.deleteExpense()', () => {
  it('should delete an existing expense without error', () => {
    const created = expensesService.createExpense(USER_ID, validOther());
    assert.doesNotThrow(() => expensesService.deleteExpense(USER_ID, String(created.id)));
    assert.throws(
      () => expensesService.getExpense(USER_ID, String(created.id)),
      (err) => { assert.strictEqual(err.status, 404); return true; }
    );
  });

  it('should throw 404 when deleting an expense belonging to another user', () => {
    const created = expensesService.createExpense(USER_ID, validOther());
    assert.throws(
      () => expensesService.deleteExpense(999, String(created.id)),
      (err) => { assert.strictEqual(err.status, 404); return true; }
    );
  });
});

// ---------------------------------------------------------------------------
// US-03 — List Expenses
// ---------------------------------------------------------------------------
describe('expensesService.listExpenses()', () => {
  it('should return only expenses belonging to the requesting user', () => {
    expensesService.createExpense(USER_ID, validOther());
    expensesService.createExpense(USER_ID, validOther());
    expensesService.createExpense(42, validOther());
    const results = expensesService.listExpenses(USER_ID, {});
    assert.strictEqual(results.length, 2);
  });

  it('should filter by category when query.category is provided', () => {
    expensesService.createExpense(USER_ID, { date: TODAY, category: 'Toll', amount: 5 });
    expensesService.createExpense(USER_ID, validOther('Parking'));
    const results = expensesService.listExpenses(USER_ID, { category: 'Toll' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].category, 'Toll');
  });

  it('should filter by year when query.year is provided', () => {
    expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-06-01`, category: 'Parking', amount: 5 });
    expensesService.createExpense(USER_ID, validOther());
    const results = expensesService.listExpenses(USER_ID, { year: String(PAST_YEAR) });
    assert.strictEqual(results.length, 1);
  });

  it('should filter by month when query.month is provided', () => {
    expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-01-15`, category: 'Parking', amount: 5 });
    expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-03-10`, category: 'Parking', amount: 8 });
    const results = expensesService.listExpenses(USER_ID, { year: String(PAST_YEAR), month: '1' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(new Date(results[0].date).getMonth(), 0);
  });
});

// ---------------------------------------------------------------------------
// US-04 — Summary
// ---------------------------------------------------------------------------
describe('expensesService.getSummary()', () => {
  // TC-04-08
  it('should throw 400 when year query parameter is missing', () => {
    assert.throws(
      () => expensesService.getSummary(USER_ID, {}),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /year/i);
        return true;
      }
    );
  });

  // TC-04-09
  it('should throw 400 when month is 13', () => {
    assert.throws(
      () => expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), month: '13' }),
      (err) => { assert.strictEqual(err.status, 400); return true; }
    );
  });

  it('should throw 400 when month is 0', () => {
    assert.throws(
      () => expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), month: '0' }),
      (err) => { assert.strictEqual(err.status, 400); return true; }
    );
  });

  it('should throw 400 when month is not a number', () => {
    assert.throws(
      () => expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), month: 'abc' }),
      (err) => { assert.strictEqual(err.status, 400); return true; }
    );
  });

  // TC-04-10
  it('should throw 400 when year is in the future', () => {
    assert.throws(
      () => expensesService.getSummary(USER_ID, { year: String(FUTURE_YEAR) }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /future/i);
        return true;
      }
    );
  });

  // TC-04-04
  it('should include all 7 categories with value 0 when there are no expenses', () => {
    const summary = expensesService.getSummary(USER_ID, { year: String(PAST_YEAR) });
    const expectedCategories = ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];
    for (const cat of expectedCategories) {
      assert.ok(Object.hasOwn(summary.categories, cat), `category ${cat} missing`);
      assert.strictEqual(summary.categories[cat], 0);
    }
    assert.strictEqual(summary.total, 0);
  });

  // TC-04-11
  it('should return category totals and overall total as numbers, not strings', () => {
    expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-06-01`, category: 'Parking', amount: 10 });
    const summary = expensesService.getSummary(USER_ID, { year: String(PAST_YEAR) });
    assert.strictEqual(typeof summary.total, 'number');
    for (const val of Object.values(summary.categories)) {
      assert.strictEqual(typeof val, 'number');
    }
  });

  it('should sum expenses correctly for a given year', () => {
    expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-01-01`, category: 'Parking', amount: 10 });
    expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-02-01`, category: 'Parking', amount: 20 });
    const summary = expensesService.getSummary(USER_ID, { year: String(PAST_YEAR) });
    assert.strictEqual(summary.categories['Parking'], 30);
    assert.strictEqual(summary.total, 30);
  });

  it('should return period with month when month query is provided', () => {
    const summary = expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), month: '6' });
    assert.strictEqual(summary.period.year, PAST_YEAR);
    assert.strictEqual(summary.period.month, 6);
  });

  it('should throw 400 when year is not a number', () => {
    assert.throws(
      () => expensesService.getSummary(USER_ID, { year: 'abc' }),
      (err) => { assert.strictEqual(err.status, 400); assert.match(err.message, /year must be a number/i); return true; }
    );
  });

  it('should throw 400 when category filter is not a valid category', () => {
    assert.throws(
      () => expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), category: 'Snacks' }),
      (err) => { assert.strictEqual(err.status, 400); assert.match(err.message, /category must be one of/i); return true; }
    );
  });

  it('should return only the filtered category when category query is provided', () => {
    expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-03-01`, category: 'Toll', amount: 7 });
    expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-03-01`, category: 'Parking', amount: 5 });
    const summary = expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), category: 'Toll' });
    assert.ok(Object.hasOwn(summary.categories, 'Toll'));
    assert.strictEqual(Object.keys(summary.categories).length, 1);
    assert.strictEqual(summary.categories['Toll'], 7);
  });

  it('should filter by both month and category when both are provided', () => {
    expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-06-01`, category: 'Parking', amount: 10 });
    expensesService.createExpense(USER_ID, { date: `${PAST_YEAR}-07-01`, category: 'Parking', amount: 20 });
    const summary = expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), month: '6', category: 'Parking' });
    assert.strictEqual(summary.categories['Parking'], 10);
    assert.strictEqual(summary.total, 10);
  });
});
