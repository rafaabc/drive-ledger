'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
require('../../helpers/email-mock');
const authService = require('../../../lib/services/auth.service');

const VALID_CONSENT = { policyVersion: '2026-05-20', acceptedAt: new Date().toISOString() };
const {
  createExpense,
  getExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
} = require('../../../lib/services/expenses.service');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const TODAY = new Date().toISOString().slice(0, 10);

describe('Expenses CRUD flow integration', () => {
  // TC-03-01 + TC-03-02
  it('should persist a non-Fuel expense and make it retrievable via list and get', async () => {
    const user = await authService.register({
      username: 'testuser',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    const created = await createExpense(user.id, { category: 'Parking', amount: 15, date: TODAY });
    const listed = await listExpenses(user.id, {});
    const fetched = await getExpense(user.id, created.id);
    assert.strictEqual(listed.length, 1);
    assert.strictEqual(listed[0].id, created.id);
    assert.strictEqual(fetched.id, created.id);
    assert.strictEqual(fetched.amount, 15);
  });

  // TC-03-01 (Fuel variant) + TC-03-02
  it('should persist a Fuel expense with computed amount and make it retrievable', async () => {
    const user = await authService.register({
      username: 'testuser',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    const created = await createExpense(user.id, {
      category: 'Fuel',
      litres: 40,
      price_per_litre: 1.85,
      date: TODAY,
    });
    const fetched = await getExpense(user.id, created.id);
    assert.strictEqual(fetched.amount, 74.0);
    assert.strictEqual(fetched.litres, 40);
    assert.strictEqual(fetched.price_per_litre, 1.85);
  });

  // TC-03-13
  it('should update an existing expense and reflect the change on subsequent read', async () => {
    const user = await authService.register({
      username: 'testuser',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    const created = await createExpense(user.id, { category: 'Parking', amount: 10, date: TODAY });
    await updateExpense(user.id, created.id, { amount: 99 });
    const fetched = await getExpense(user.id, created.id);
    assert.strictEqual(fetched.amount, 99);
  });

  // TC-03-14
  it('should throw 404 when updating a non-existent expense', async () => {
    const user = await authService.register({
      username: 'testuser',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    const fakeId = new mongoose.Types.ObjectId().toString();
    await assert.rejects(
      () => updateExpense(user.id, fakeId, { amount: 50 }),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });

  // TC-03-15
  it('should delete an existing expense so it is no longer retrievable', async () => {
    const user = await authService.register({
      username: 'testuser',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    const created = await createExpense(user.id, { category: 'Toll', amount: 3, date: TODAY });
    await deleteExpense(user.id, created.id);
    await assert.rejects(
      () => getExpense(user.id, created.id),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
    const remaining = await listExpenses(user.id, {});
    assert.strictEqual(remaining.length, 0);
  });

  // TC-03-16
  it('should throw 404 when deleting a non-existent expense', async () => {
    const user = await authService.register({
      username: 'testuser',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    const fakeId = new mongoose.Types.ObjectId().toString();
    await assert.rejects(
      () => deleteExpense(user.id, fakeId),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });
});
