'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const authService = require('../../../src/services/auth.service');
const {
  createExpense,
  getExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
} = require('../../../src/services/expenses.service');
const userModel = require('../../../src/models/user.model');
const expenseModel = require('../../../src/models/expense.model');

const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  userModel._reset();
  expenseModel._reset();
});

describe('Expenses CRUD flow integration', () => {
  // TC-03-01 + TC-03-02
  it('should persist a non-Fuel expense and make it retrievable via list and get', async () => {
    // Arrange
    const user = await authService.register({ username: 'rafael', password: 'password1' });

    // Act
    const created = createExpense(user.id, { category: 'Parking', amount: 15, date: TODAY });
    const listed = listExpenses(user.id, {});
    const fetched = getExpense(user.id, String(created.id));

    // Assert
    assert.strictEqual(listed.length, 1);
    assert.strictEqual(listed[0].id, created.id);
    assert.strictEqual(fetched.id, created.id);
    assert.strictEqual(fetched.amount, 15);
  });

  // TC-03-01 (Fuel variant) + TC-03-02
  it('should persist a Fuel expense with computed amount and make it retrievable', async () => {
    // Arrange
    const user = await authService.register({ username: 'rafael', password: 'password1' });

    // Act
    const created = createExpense(user.id, {
      category: 'Fuel',
      litres: 40,
      price_per_litre: 1.85,
      date: TODAY,
    });
    const fetched = getExpense(user.id, String(created.id));

    // Assert — service computed and model stored the amount correctly
    assert.strictEqual(fetched.amount, 74.00); // 40 * 1.85
    assert.strictEqual(fetched.litres, 40);
    assert.strictEqual(fetched.price_per_litre, 1.85);
  });

  // TC-03-13
  it('should update an existing expense and reflect the change on subsequent read', async () => {
    // Arrange
    const user = await authService.register({ username: 'rafael', password: 'password1' });
    const created = createExpense(user.id, { category: 'Parking', amount: 10, date: TODAY });

    // Act
    updateExpense(user.id, String(created.id), { amount: 99 });
    const fetched = getExpense(user.id, String(created.id));

    // Assert
    assert.strictEqual(fetched.amount, 99);
  });

  // TC-03-14
  it('should throw 404 when updating a non-existent expense', async () => {
    // Arrange
    const user = await authService.register({ username: 'rafael', password: 'password1' });

    // Act + Assert
    assert.throws(
      () => updateExpense(user.id, '9999', { amount: 50 }),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      }
    );
  });

  // TC-03-15
  it('should delete an existing expense so it is no longer retrievable', async () => {
    // Arrange
    const user = await authService.register({ username: 'rafael', password: 'password1' });
    const created = createExpense(user.id, { category: 'Toll', amount: 3, date: TODAY });

    // Act
    deleteExpense(user.id, String(created.id));

    // Assert — get throws 404, list returns empty
    assert.throws(
      () => getExpense(user.id, String(created.id)),
      (err) => { assert.strictEqual(err.status, 404); return true; }
    );
    const remaining = listExpenses(user.id, {});
    assert.strictEqual(remaining.length, 0);
  });

  // TC-03-16
  it('should throw 404 when deleting a non-existent expense', async () => {
    // Arrange
    const user = await authService.register({ username: 'rafael', password: 'password1' });

    // Act + Assert
    assert.throws(
      () => deleteExpense(user.id, '9999'),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      }
    );
  });
});
