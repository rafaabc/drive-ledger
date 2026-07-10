'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const mongoose = require('mongoose');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const expensesService = require('../../../lib/services/expenses.service');
const userModel = require('../../../lib/models/user.model');
const vehiclesService = require('../../../lib/services/vehicles.service');
const vehicleModel = require('../../../lib/models/vehicle.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const PAST_YEAR = new Date().getFullYear() - 1;
const FUTURE_YEAR = new Date().getFullYear() + 1;

const USER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_USER_ID = new mongoose.Types.ObjectId().toString();

const validFuel = () => ({ date: TODAY, category: 'Fuel', litres: 40, price_per_litre: 1.5 });
const validOther = (cat = 'Parking') => ({ date: TODAY, category: cat, amount: 10 });

// ---------------------------------------------------------------------------
// US-03 — Create Expense Validation
// ---------------------------------------------------------------------------
describe('expensesService.createExpense()', () => {
  // TC-03-03
  it('should accept all 7 predefined categories', async () => {
    const categories = ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];
    for (const category of categories) {
      if (category === 'Fuel') {
        const expense = await expensesService.createExpense(USER_ID, {
          date: TODAY,
          category,
          litres: 10,
          price_per_litre: 2,
        });
        assert.strictEqual(expense.category, category);
      } else {
        const expense = await expensesService.createExpense(USER_ID, {
          date: TODAY,
          category,
          amount: 10,
        });
        assert.strictEqual(expense.category, category);
      }
    }
  });

  // TC-03-04
  it('should throw 400 when category is not one of the predefined values', async () => {
    await assert.rejects(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Snacks', amount: 10 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /category must be one of/i);
        return true;
      },
    );
  });

  // TC-03-05
  it('should accept duplicate expense entries with distinct ids', async () => {
    const body = { date: TODAY, category: 'Parking', amount: 50 };
    const first = await expensesService.createExpense(USER_ID, body);
    const second = await expensesService.createExpense(USER_ID, body);
    assert.notStrictEqual(first.id, second.id);
    assert.strictEqual(first.amount, second.amount);
  });

  // TC-03-06
  it('should compute Fuel amount as litres × price_per_litre rounded to 2 decimals', async () => {
    const expense = await expensesService.createExpense(USER_ID, {
      date: TODAY,
      category: 'Fuel',
      litres: 40,
      price_per_litre: 1.5,
    });
    assert.strictEqual(expense.amount, 60);
  });

  it('should round Fuel amount correctly at the 2nd decimal place', async () => {
    const expense = await expensesService.createExpense(USER_ID, {
      date: TODAY,
      category: 'Fuel',
      litres: 3,
      price_per_litre: 1.235,
    });
    assert.strictEqual(expense.amount, 3.71);
  });

  // TC-03-07
  it('should throw 400 when Fuel expense is missing price_per_litre', async () => {
    await assert.rejects(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Fuel', litres: 40 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /price_per_litre is required/i);
        return true;
      },
    );
  });

  // TC-03-08
  it('should throw 400 when Fuel expense is missing litres', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: TODAY,
          category: 'Fuel',
          price_per_litre: 1.5,
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /litres is required/i);
        return true;
      },
    );
  });

  // TC-03-09
  it('should throw 400 when date is in the future', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, { date: FUTURE, category: 'Parking', amount: 10 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /future/i);
        return true;
      },
    );
  });

  // TC-03-10
  it("should accept an expense with today's date", async () => {
    const expense = await expensesService.createExpense(USER_ID, {
      date: TODAY,
      category: 'Parking',
      amount: 10,
    });
    assert.ok(expense.id);
    assert.strictEqual(new Date(expense.date).toISOString().slice(0, 10), TODAY);
  });

  // TC-03-11
  it('should throw 400 when amount is zero', async () => {
    await assert.rejects(
      () => expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: 0 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /positive/i);
        return true;
      },
    );
  });

  // TC-03-12
  it('should throw 400 when amount is negative', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: -5 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /positive/i);
        return true;
      },
    );
  });

  // TC-03-18
  it('should return amount as a number, not a string', async () => {
    const expense = await expensesService.createExpense(USER_ID, {
      date: TODAY,
      category: 'Parking',
      amount: 25.5,
    });
    assert.strictEqual(typeof expense.amount, 'number');
  });

  it('should throw 400 when non-Fuel expense includes litres', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: TODAY,
          category: 'Parking',
          amount: 10,
          litres: 5,
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when Fuel expense explicitly passes amount', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: TODAY,
          category: 'Fuel',
          litres: 40,
          price_per_litre: 1.5,
          amount: 60,
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /amount is not allowed for Fuel/i);
        return true;
      },
    );
  });

  it('should throw 400 when date is missing', async () => {
    await assert.rejects(
      () => expensesService.createExpense(USER_ID, { category: 'Parking', amount: 10 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /date is required/i);
        return true;
      },
    );
  });

  it('should throw 400 when category is missing', async () => {
    await assert.rejects(
      () => expensesService.createExpense(USER_ID, { date: TODAY, amount: 10 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /category is required/i);
        return true;
      },
    );
  });

  it('should throw 400 when date string is not a valid date', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: 'not-a-date',
          category: 'Parking',
          amount: 10,
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /date is invalid/i);
        return true;
      },
    );
  });

  it('should throw 400 when Fuel litres is null', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: TODAY,
          category: 'Fuel',
          litres: null,
          price_per_litre: 1.5,
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when Fuel price_per_litre is null', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: TODAY,
          category: 'Fuel',
          litres: 40,
          price_per_litre: null,
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when Fuel litres is zero', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: TODAY,
          category: 'Fuel',
          litres: 0,
          price_per_litre: 1.5,
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /positive/i);
        return true;
      },
    );
  });

  it('should throw 400 when Fuel litres is not a number', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: TODAY,
          category: 'Fuel',
          litres: 'forty',
          price_per_litre: 1.5,
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when Fuel price_per_litre is zero', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: TODAY,
          category: 'Fuel',
          litres: 40,
          price_per_litre: 0,
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /positive/i);
        return true;
      },
    );
  });

  it('should throw 400 when Fuel price_per_litre is not a number', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: TODAY,
          category: 'Fuel',
          litres: 40,
          price_per_litre: 'cheap',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when non-Fuel amount is null', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: null }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when non-Fuel amount is not a number', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, { date: TODAY, category: 'Parking', amount: 'ten' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /positive/i);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// US-03 — Get / Update / Delete Expense
// ---------------------------------------------------------------------------
describe('expensesService.getExpense()', () => {
  it('should return the expense when it belongs to the user', async () => {
    const created = await expensesService.createExpense(USER_ID, validOther());
    const found = await expensesService.getExpense(USER_ID, created.id);
    assert.strictEqual(found.id, created.id);
  });

  it('should throw 404 when expense does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await assert.rejects(
      () => expensesService.getExpense(USER_ID, fakeId),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });

  it('should throw 404 when expense belongs to a different user', async () => {
    const created = await expensesService.createExpense(USER_ID, validOther());
    await assert.rejects(
      () => expensesService.getExpense(OTHER_USER_ID, created.id),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });
});

describe('expensesService.updateExpense()', () => {
  it('should update a non-Fuel expense amount', async () => {
    const created = await expensesService.createExpense(USER_ID, validOther());
    const updated = await expensesService.updateExpense(USER_ID, created.id, { amount: 99 });
    assert.strictEqual(updated.amount, 99);
  });

  it('should keep existing amount when non-Fuel update omits amount', async () => {
    const created = await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-01-01`,
      category: 'Parking',
      amount: 42,
    });
    const updated = await expensesService.updateExpense(USER_ID, created.id, {
      date: `${PAST_YEAR}-02-01`,
    });
    assert.strictEqual(updated.amount, 42);
  });

  it('should recompute Fuel amount when litres or price_per_litre changes', async () => {
    const created = await expensesService.createExpense(USER_ID, validFuel());
    const updated = await expensesService.updateExpense(USER_ID, created.id, { litres: 50 });
    assert.strictEqual(updated.amount, Math.round(50 * 1.5 * 100) / 100);
  });

  it('should recompute Fuel amount when only price_per_litre is updated', async () => {
    const created = await expensesService.createExpense(USER_ID, validFuel());
    const updated = await expensesService.updateExpense(USER_ID, created.id, {
      price_per_litre: 2.0,
    });
    assert.strictEqual(updated.amount, Math.round(40 * 2.0 * 100) / 100);
  });

  it('should update the category of an existing expense', async () => {
    const created = await expensesService.createExpense(USER_ID, {
      date: TODAY,
      category: 'Parking',
      amount: 10,
    });
    const updated = await expensesService.updateExpense(USER_ID, created.id, {
      category: 'Toll',
      amount: 10,
    });
    assert.strictEqual(updated.category, 'Toll');
  });

  it('should throw 404 when updating an expense belonging to another user', async () => {
    const created = await expensesService.createExpense(USER_ID, validOther());
    await assert.rejects(
      () => expensesService.updateExpense(OTHER_USER_ID, created.id, { amount: 50 }),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });

  it('should reassign vehicleId to another owned vehicle', async () => {
    const created = await expensesService.createExpense(USER_ID, validOther());
    const originalVehicleId = created.vehicleId;
    const vehicleB = await vehicleModel.create({ userId: USER_ID, name: 'Car B' });

    const updated = await expensesService.updateExpense(USER_ID, created.id, {
      amount: 99,
      vehicleId: vehicleB._id.toString(),
    });

    assert.strictEqual(updated.vehicleId.toString(), vehicleB._id.toString());
    assert.notStrictEqual(updated.vehicleId.toString(), originalVehicleId);
  });

  it('should throw 404 when reassigning to a vehicleId owned by another user', async () => {
    const created = await expensesService.createExpense(USER_ID, validOther());
    const otherVehicle = await vehicleModel.create({ userId: OTHER_USER_ID, name: 'Not yours' });

    await assert.rejects(
      () =>
        expensesService.updateExpense(USER_ID, created.id, {
          amount: 99,
          vehicleId: otherVehicle._id.toString(),
        }),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });
});

describe('expensesService.deleteExpense()', () => {
  it('should delete an existing expense without error', async () => {
    const created = await expensesService.createExpense(USER_ID, validOther());
    await assert.doesNotReject(() => expensesService.deleteExpense(USER_ID, created.id));
    await assert.rejects(
      () => expensesService.getExpense(USER_ID, created.id),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });

  it('should throw 404 when deleting an expense belonging to another user', async () => {
    const created = await expensesService.createExpense(USER_ID, validOther());
    await assert.rejects(
      () => expensesService.deleteExpense(OTHER_USER_ID, created.id),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// US-03 — List Expenses
// ---------------------------------------------------------------------------
describe('expensesService.listExpenses()', () => {
  it('should return only expenses belonging to the requesting user', async () => {
    await expensesService.createExpense(USER_ID, validOther());
    await expensesService.createExpense(USER_ID, validOther());
    await expensesService.createExpense(OTHER_USER_ID, validOther());
    const results = await expensesService.listExpenses(USER_ID, {});
    assert.strictEqual(results.length, 2);
  });

  it('should filter by category when query.category is provided', async () => {
    await expensesService.createExpense(USER_ID, { date: TODAY, category: 'Toll', amount: 5 });
    await expensesService.createExpense(USER_ID, validOther('Parking'));
    const results = await expensesService.listExpenses(USER_ID, { category: 'Toll' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].category, 'Toll');
  });

  it('should filter by year when query.year is provided', async () => {
    await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-06-01`,
      category: 'Parking',
      amount: 5,
    });
    await expensesService.createExpense(USER_ID, validOther());
    const results = await expensesService.listExpenses(USER_ID, { year: String(PAST_YEAR) });
    assert.strictEqual(results.length, 1);
  });

  it('should filter by month when query.month is provided', async () => {
    await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-01-15`,
      category: 'Parking',
      amount: 5,
    });
    await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-03-10`,
      category: 'Parking',
      amount: 8,
    });
    const results = await expensesService.listExpenses(USER_ID, {
      year: String(PAST_YEAR),
      month: '1',
    });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(new Date(results[0].date).getMonth(), 0);
  });
});

// ---------------------------------------------------------------------------
// US-04 — Summary
// ---------------------------------------------------------------------------
describe('expensesService.getSummary()', () => {
  // TC-04-08
  it('should throw 400 when year query parameter is missing', async () => {
    await assert.rejects(
      () => expensesService.getSummary(USER_ID, {}),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /year/i);
        return true;
      },
    );
  });

  // TC-04-09
  it('should throw 400 when month is 13', async () => {
    await assert.rejects(
      () => expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), month: '13' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when month is 0', async () => {
    await assert.rejects(
      () => expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), month: '0' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when month is not a number', async () => {
    await assert.rejects(
      () => expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), month: 'abc' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  // TC-04-10
  it('should throw 400 when year is in the future', async () => {
    await assert.rejects(
      () => expensesService.getSummary(USER_ID, { year: String(FUTURE_YEAR) }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /future/i);
        return true;
      },
    );
  });

  // TC-04-04
  it('should include all 7 categories with value 0 when there are no expenses', async () => {
    const summary = await expensesService.getSummary(USER_ID, { year: String(PAST_YEAR) });
    const expectedCategories = [
      'Fuel',
      'Maintenance',
      'Insurance',
      'Parking',
      'Toll',
      'Tax',
      'Other',
    ];
    for (const cat of expectedCategories) {
      assert.ok(Object.hasOwn(summary.categories, cat), `category ${cat} missing`);
      assert.strictEqual(summary.categories[cat], 0);
    }
    assert.strictEqual(summary.total, 0);
  });

  // TC-04-11
  it('should return category totals and overall total as numbers, not strings', async () => {
    await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-06-01`,
      category: 'Parking',
      amount: 10,
    });
    const summary = await expensesService.getSummary(USER_ID, { year: String(PAST_YEAR) });
    assert.strictEqual(typeof summary.total, 'number');
    for (const val of Object.values(summary.categories)) {
      assert.strictEqual(typeof val, 'number');
    }
  });

  it('should sum expenses correctly for a given year', async () => {
    await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-01-01`,
      category: 'Parking',
      amount: 10,
    });
    await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-02-01`,
      category: 'Parking',
      amount: 20,
    });
    const summary = await expensesService.getSummary(USER_ID, { year: String(PAST_YEAR) });
    assert.strictEqual(summary.categories['Parking'], 30);
    assert.strictEqual(summary.total, 30);
  });

  it('should return period with month when month query is provided', async () => {
    const summary = await expensesService.getSummary(USER_ID, {
      year: String(PAST_YEAR),
      month: '6',
    });
    assert.strictEqual(summary.period.year, PAST_YEAR);
    assert.strictEqual(summary.period.month, 6);
  });

  it('should throw 400 when year is not a number', async () => {
    await assert.rejects(
      () => expensesService.getSummary(USER_ID, { year: 'abc' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /year must be a number/i);
        return true;
      },
    );
  });

  it('should throw 400 when category filter is not a valid category', async () => {
    await assert.rejects(
      () => expensesService.getSummary(USER_ID, { year: String(PAST_YEAR), category: 'Snacks' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /category must be one of/i);
        return true;
      },
    );
  });

  it('should return only the filtered category when category query is provided', async () => {
    await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-03-01`,
      category: 'Toll',
      amount: 7,
    });
    await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-03-01`,
      category: 'Parking',
      amount: 5,
    });
    const summary = await expensesService.getSummary(USER_ID, {
      year: String(PAST_YEAR),
      category: 'Toll',
    });
    assert.ok(Object.hasOwn(summary.categories, 'Toll'));
    assert.strictEqual(Object.keys(summary.categories).length, 1);
    assert.strictEqual(summary.categories['Toll'], 7);
  });

  it('should filter by both month and category when both are provided', async () => {
    await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-06-01`,
      category: 'Parking',
      amount: 10,
    });
    await expensesService.createExpense(USER_ID, {
      date: `${PAST_YEAR}-07-01`,
      category: 'Parking',
      amount: 20,
    });
    const summary = await expensesService.getSummary(USER_ID, {
      year: String(PAST_YEAR),
      month: '6',
      category: 'Parking',
    });
    assert.strictEqual(summary.categories['Parking'], 10);
    assert.strictEqual(summary.total, 10);
  });
});

// ---------------------------------------------------------------------------
// Fuel odometer side effect
// ---------------------------------------------------------------------------
describe('expensesService — Fuel odometer side effect', () => {
  it('should raise the vehicle currentKm when Fuel has odometer greater than current', async () => {
    const user = await userModel.create({
      username: 'odoTest1',
      password: 'x',
      email: 'odot1@test.com',
      currentKm: 1000,
    });
    const uid = user._id.toString();
    await expensesService.createExpense(uid, {
      date: TODAY,
      category: 'Fuel',
      litres: 40,
      price_per_litre: 1.5,
      odometer: 2000,
    });
    const [vehicle] = await vehiclesService.listVehicles(uid);
    assert.strictEqual(vehicle.currentKm, 2000);
  });

  it('should NOT lower the vehicle currentKm when Fuel odometer is older reading', async () => {
    const user = await userModel.create({
      username: 'odoTest2',
      password: 'x',
      email: 'odot2@test.com',
      currentKm: 5000,
    });
    const uid = user._id.toString();
    await expensesService.createExpense(uid, {
      date: TODAY,
      category: 'Fuel',
      litres: 40,
      price_per_litre: 1.5,
      odometer: 6000,
    });
    await expensesService.createExpense(uid, {
      date: TODAY,
      category: 'Fuel',
      litres: 40,
      price_per_litre: 1.5,
      odometer: 3000,
    });
    const [vehicle] = await vehiclesService.listVehicles(uid);
    assert.strictEqual(vehicle.currentKm, 6000);
  });

  it('should throw 400 when odometer is supplied for non-Fuel category', async () => {
    await assert.rejects(
      () =>
        expensesService.createExpense(USER_ID, {
          date: TODAY,
          category: 'Parking',
          amount: 10,
          odometer: 1000,
        }),
      (err) => err.status === 400 && /odometer is only valid for Fuel/i.test(err.message),
    );
  });

  it('should accept Fuel without odometer (optional)', async () => {
    const exp = await expensesService.createExpense(USER_ID, {
      date: TODAY,
      category: 'Fuel',
      litres: 40,
      price_per_litre: 1.5,
    });
    assert.strictEqual(exp.category, 'Fuel');
    assert.strictEqual(exp.odometer, undefined);
  });
});

// ---------------------------------------------------------------------------
// deleteAllByUser
// ---------------------------------------------------------------------------
describe('expensesService.deleteAllByUser()', () => {
  it('should delete all expenses for the given userId', async () => {
    await expensesService.createExpense(USER_ID, validOther());
    await expensesService.createExpense(USER_ID, validOther());
    await expensesService.deleteAllByUser(USER_ID);
    const remaining = await expensesService.listExpenses(USER_ID, {});
    assert.strictEqual(remaining.length, 0);
  });

  it('should not delete expenses belonging to another user', async () => {
    await expensesService.createExpense(USER_ID, validOther());
    await expensesService.createExpense(OTHER_USER_ID, validOther());
    await expensesService.deleteAllByUser(USER_ID);
    const otherRemaining = await expensesService.listExpenses(OTHER_USER_ID, {});
    assert.strictEqual(otherRemaining.length, 1);
  });
});
