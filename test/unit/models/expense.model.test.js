'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const expenseModel = require('../../../src/models/expense.model');

beforeEach(() => {
  expenseModel._reset();
});

const sample = (overrides = {}) => ({
  userId: 1,
  date: '2025-01-01',
  category: 'Parking',
  amount: 10,
  ...overrides,
});

describe('expenseModel.create()', () => {
  it('should create an expense with an auto-incremented id', () => {
    const expense = expenseModel.create(sample());
    assert.strictEqual(expense.id, 1);
    assert.strictEqual(expense.category, 'Parking');
  });

  it('should assign sequential ids to multiple expenses', () => {
    const first = expenseModel.create(sample());
    const second = expenseModel.create(sample({ category: 'Toll' }));
    assert.strictEqual(first.id, 1);
    assert.strictEqual(second.id, 2);
  });
});

describe('expenseModel.findById()', () => {
  it('should return the expense when id matches', () => {
    const created = expenseModel.create(sample());
    const found = expenseModel.findById(created.id);
    assert.deepStrictEqual(found, created);
  });

  it('should return undefined when id does not exist', () => {
    const found = expenseModel.findById(999);
    assert.strictEqual(found, undefined);
  });
});

describe('expenseModel.findByUserId()', () => {
  it('should return only expenses belonging to the given user', () => {
    expenseModel.create(sample({ userId: 1 }));
    expenseModel.create(sample({ userId: 1 }));
    expenseModel.create(sample({ userId: 2 }));
    const results = expenseModel.findByUserId(1);
    assert.strictEqual(results.length, 2);
    assert.ok(results.every((e) => e.userId === 1));
  });

  it('should return an empty array when user has no expenses', () => {
    const results = expenseModel.findByUserId(99);
    assert.deepStrictEqual(results, []);
  });
});

describe('expenseModel.update()', () => {
  it('should merge new data into the existing expense and return it', () => {
    const created = expenseModel.create(sample());
    const updated = expenseModel.update(created.id, { amount: 99 });
    assert.strictEqual(updated.amount, 99);
    assert.strictEqual(updated.category, 'Parking');
  });

  it('should return null when the expense id does not exist', () => {
    const result = expenseModel.update(999, { amount: 10 });
    assert.strictEqual(result, null);
  });
});

describe('expenseModel.remove()', () => {
  it('should remove the expense and return true', () => {
    const created = expenseModel.create(sample());
    const result = expenseModel.remove(created.id);
    assert.strictEqual(result, true);
    assert.strictEqual(expenseModel.findById(created.id), undefined);
  });

  it('should return false when the expense id does not exist', () => {
    const result = expenseModel.remove(999);
    assert.strictEqual(result, false);
  });
});

describe('expenseModel.findAll()', () => {
  it('should return an empty array when no expenses exist', () => {
    assert.deepStrictEqual(expenseModel.findAll(), []);
  });

  it('should return all created expenses', () => {
    expenseModel.create(sample());
    expenseModel.create(sample({ category: 'Toll' }));
    assert.strictEqual(expenseModel.findAll().length, 2);
  });
});

describe('expenseModel._reset()', () => {
  it('should clear all expenses and reset id counter', () => {
    expenseModel.create(sample());
    expenseModel._reset();
    assert.deepStrictEqual(expenseModel.findAll(), []);
    const expense = expenseModel.create(sample());
    assert.strictEqual(expense.id, 1);
  });
});
