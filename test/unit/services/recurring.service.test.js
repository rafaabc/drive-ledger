'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const mongoose = require('mongoose');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const recurringService = require('../../../lib/services/recurring.service');
const expenseModel = require('../../../lib/models/expense.model');
const userModel = require('../../../lib/models/user.model');
const vehicleModel = require('../../../lib/models/vehicle.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

function makeUserId() {
  return new mongoose.Types.ObjectId().toString();
}

async function createUser() {
  return userModel.create({
    username: `user_${Date.now()}`,
    email: `user_${Date.now()}@test.com`,
    password: 'hashed',
    emailVerified: true,
  });
}

function pastDate(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

const validRule = (overrides = {}) => ({
  category: 'Insurance',
  amount: 150,
  startDate: pastDate(60),
  interval: 1,
  ...overrides,
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('recurringService.createRule() — validation', () => {
  it('rejects Fuel category', async () => {
    const userId = makeUserId();
    await assert.rejects(
      () => recurringService.createRule(userId, { ...validRule(), category: 'Fuel' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('rejects invalid category', async () => {
    const userId = makeUserId();
    await assert.rejects(
      () => recurringService.createRule(userId, { ...validRule(), category: 'Food' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('rejects missing amount', async () => {
    const userId = makeUserId();
    await assert.rejects(
      () => recurringService.createRule(userId, { ...validRule(), amount: undefined }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('rejects non-positive amount', async () => {
    const userId = makeUserId();
    await assert.rejects(
      () => recurringService.createRule(userId, { ...validRule(), amount: 0 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('rejects invalid interval', async () => {
    const userId = makeUserId();
    await assert.rejects(
      () => recurringService.createRule(userId, { ...validRule(), interval: 3 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('rejects litres field', async () => {
    const userId = makeUserId();
    await assert.rejects(
      () => recurringService.createRule(userId, { ...validRule(), litres: 50 }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });
});

// ── CRUD ──────────────────────────────────────────────────────────────────────

describe('recurringService CRUD', () => {
  it('creates a rule and derives dayOfMonth from startDate', async () => {
    const user = await createUser();
    const rule = await recurringService.createRule(
      user._id.toString(),
      validRule({
        startDate: '2024-01-15',
      }),
    );
    assert.strictEqual(rule.category, 'Insurance');
    assert.strictEqual(rule.amount, 150);
    assert.strictEqual(rule.interval, 1);
    assert.strictEqual(rule.dayOfMonth, 15);
    assert.strictEqual(rule.active, true);
    assert.strictEqual(rule.lastGeneratedDate, null);
  });

  it('listRules returns only rules for the requesting user', async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    await recurringService.createRule(u1._id.toString(), validRule());
    await recurringService.createRule(u2._id.toString(), validRule({ category: 'Tax' }));

    const u1Rules = await recurringService.listRules(u1._id.toString());
    assert.strictEqual(u1Rules.length, 1);
    assert.strictEqual(u1Rules[0].category, 'Insurance');
  });

  it("getRule throws 404 for another user's rule", async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    const rule = await recurringService.createRule(u1._id.toString(), validRule());

    await assert.rejects(
      () => recurringService.getRule(u2._id.toString(), rule.id),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });

  it('updateRule updates fields and recalculates dayOfMonth on startDate change', async () => {
    const user = await createUser();
    const rule = await recurringService.createRule(
      user._id.toString(),
      validRule({ startDate: '2024-01-15' }),
    );
    const updated = await recurringService.updateRule(user._id.toString(), rule.id, {
      startDate: '2024-03-20',
      amount: 200,
    });
    assert.strictEqual(updated.amount, 200);
    assert.strictEqual(updated.dayOfMonth, 20);
  });

  it('updateRule reassigns vehicleId to another owned vehicle', async () => {
    const user = await createUser();
    const vehicleB = await vehicleModel.create({ userId: user._id, name: 'Car B' });
    const rule = await recurringService.createRule(user._id.toString(), validRule());
    const originalVehicleId = rule.vehicleId;

    const updated = await recurringService.updateRule(user._id.toString(), rule.id, {
      vehicleId: vehicleB._id.toString(),
    });

    assert.strictEqual(updated.vehicleId.toString(), vehicleB._id.toString());
    assert.notStrictEqual(updated.vehicleId.toString(), originalVehicleId);
  });

  it('updateRule throws 404 for a vehicleId owned by another user', async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    const otherVehicle = await vehicleModel.create({ userId: u2._id, name: 'Not yours' });
    const rule = await recurringService.createRule(u1._id.toString(), validRule());

    await assert.rejects(
      () =>
        recurringService.updateRule(u1._id.toString(), rule.id, {
          vehicleId: otherVehicle._id.toString(),
        }),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });

  it('deleteRule removes the rule', async () => {
    const user = await createUser();
    const rule = await recurringService.createRule(user._id.toString(), validRule());
    await recurringService.deleteRule(user._id.toString(), rule.id);
    const rules = await recurringService.listRules(user._id.toString());
    assert.strictEqual(rules.length, 0);
  });

  it('deleteRule throws 404 for another user', async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    const rule = await recurringService.createRule(u1._id.toString(), validRule());
    await assert.rejects(
      () => recurringService.deleteRule(u2._id.toString(), rule.id),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });
});

// ── runCatchUp ────────────────────────────────────────────────────────────────

describe('recurringService.runCatchUp()', () => {
  it('creates expenses for overdue occurrences', async () => {
    const user = await createUser();
    // startDate 2 months ago with monthly interval → 2 or 3 occurrences depending on day
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const startDate = twoMonthsAgo.toISOString().split('T')[0];

    await recurringService.createRule(user._id.toString(), {
      category: 'Insurance',
      amount: 100,
      startDate,
      interval: 1,
    });

    const { created } = await recurringService.runCatchUp(user._id.toString());
    assert.ok(created >= 2, `Expected at least 2 created, got ${created}`);

    const expenses = await expenseModel.findByUserId(user._id.toString());
    assert.strictEqual(expenses.length, created);
    // All expenses should have recurringRuleId set
    for (const exp of expenses) {
      assert.ok(exp.recurringRuleId, 'Expected recurringRuleId on generated expense');
      assert.strictEqual(exp.category, 'Insurance');
      assert.strictEqual(exp.amount, 100);
    }
  });

  it('is idempotent: second runCatchUp creates no new expenses', async () => {
    const user = await createUser();
    const startDate = pastDate(60);

    await recurringService.createRule(user._id.toString(), {
      category: 'Tax',
      amount: 50,
      startDate,
      interval: 1,
    });

    const first = await recurringService.runCatchUp(user._id.toString());
    assert.ok(first.created > 0);

    const second = await recurringService.runCatchUp(user._id.toString());
    assert.strictEqual(second.created, 0);

    const total = await expenseModel.findByUserId(user._id.toString());
    assert.strictEqual(total.length, first.created);
  });

  it('skips inactive rules', async () => {
    const user = await createUser();
    await recurringService.createRule(user._id.toString(), {
      category: 'Parking',
      amount: 30,
      startDate: pastDate(60),
      interval: 1,
      active: false,
    });

    const { created } = await recurringService.runCatchUp(user._id.toString());
    assert.strictEqual(created, 0);
  });

  it('advances lastGeneratedDate after generation', async () => {
    const user = await createUser();
    await recurringService.createRule(user._id.toString(), {
      category: 'Maintenance',
      amount: 75,
      startDate: pastDate(30),
      interval: 1,
    });

    await recurringService.runCatchUp(user._id.toString());

    const rules = await recurringService.listRules(user._id.toString());
    assert.ok(
      rules[0].lastGeneratedDate !== null,
      'lastGeneratedDate should be set after catch-up',
    );
  });
});
