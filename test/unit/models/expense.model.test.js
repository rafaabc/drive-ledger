'use strict';

const mongoose = require('mongoose');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const expenseModel = require('../../../lib/models/expense.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const USER_ID = new mongoose.Types.ObjectId();
const OTHER_USER_ID = new mongoose.Types.ObjectId();

const sample = (overrides = {}) => ({
  userId: USER_ID,
  date: '2025-01-01',
  category: 'Parking',
  amount: 10,
  ...overrides,
});

describe('expenseModel.create()', () => {
  it('should create an expense with a unique _id', async () => {
    const expense = await expenseModel.create(sample());
    assert.ok(expense._id);
    assert.strictEqual(expense.category, 'Parking');
  });

  it('should populate createdAt and updatedAt timestamps', async () => {
    const expense = await expenseModel.create(sample());
    assert.ok(expense.createdAt instanceof Date, 'createdAt should be a Date');
    assert.ok(expense.updatedAt instanceof Date, 'updatedAt should be a Date');
  });

  it('should assign distinct _ids to multiple expenses', async () => {
    const first = await expenseModel.create(sample());
    const second = await expenseModel.create(sample({ category: 'Toll' }));
    assert.notStrictEqual(first._id.toString(), second._id.toString());
  });
});

describe('expenseModel.findById()', () => {
  it('should return the expense when id matches', async () => {
    const created = await expenseModel.create(sample());
    const found = await expenseModel.findById(created._id);
    assert.ok(found);
    assert.strictEqual(found.category, 'Parking');
  });

  it('should return null when id does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const found = await expenseModel.findById(fakeId);
    assert.strictEqual(found, null);
  });
});

describe('expenseModel.findByUserId()', () => {
  it('should return only expenses belonging to the given user', async () => {
    await expenseModel.create(sample({ userId: USER_ID }));
    await expenseModel.create(sample({ userId: USER_ID }));
    await expenseModel.create(sample({ userId: OTHER_USER_ID }));
    const results = await expenseModel.findByUserId(USER_ID);
    assert.strictEqual(results.length, 2);
    assert.ok(results.every((e) => e.userId.toString() === USER_ID.toString()));
  });

  it('should return an empty array when user has no expenses', async () => {
    const results = await expenseModel.findByUserId(new mongoose.Types.ObjectId());
    assert.deepStrictEqual(results, []);
  });

  // Regression guard: an undefined userId must never widen the filter to match
  // every user's expenses — see lib/models/queryScope.js.
  it('should return an empty array — not every users expenses — when userId is undefined', async () => {
    await expenseModel.create(sample({ userId: USER_ID }));
    await expenseModel.create(sample({ userId: OTHER_USER_ID }));
    const results = await expenseModel.findByUserId(undefined);
    assert.deepStrictEqual(results, []);
  });
});

describe('expenseModel.update()', () => {
  it('should merge new data into the existing expense and return it', async () => {
    const created = await expenseModel.create(sample());
    const updated = await expenseModel.update(created._id, { amount: 99 });
    assert.strictEqual(updated.amount, 99);
    assert.strictEqual(updated.category, 'Parking');
  });

  it('should return null when the expense id does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await expenseModel.update(fakeId, { amount: 10 });
    assert.strictEqual(result, null);
  });
});

describe('expenseModel.remove()', () => {
  it('should remove the expense so it is no longer findable', async () => {
    const created = await expenseModel.create(sample());
    await expenseModel.remove(created._id);
    const found = await expenseModel.findById(created._id);
    assert.strictEqual(found, null);
  });

  it('should return null when the expense id does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await expenseModel.remove(fakeId);
    assert.strictEqual(result, null);
  });
});

describe('expenseModel.findAll()', () => {
  it('should return an empty array when no expenses exist', async () => {
    const all = await expenseModel.findAll();
    assert.deepStrictEqual(all, []);
  });

  it('should return all created expenses', async () => {
    await expenseModel.create(sample());
    await expenseModel.create(sample({ category: 'Toll' }));
    const all = await expenseModel.findAll();
    assert.strictEqual(all.length, 2);
  });
});

describe('expenseModel._reset()', () => {
  it('should clear all expenses from the collection', async () => {
    await expenseModel.create(sample());
    await expenseModel._reset();
    const all = await expenseModel.findAll();
    assert.deepStrictEqual(all, []);
  });
});

describe('expenseModel odometer field', () => {
  it('should persist optional odometer field on Fuel expense', async () => {
    const exp = await expenseModel.create({
      userId: new mongoose.Types.ObjectId(),
      date: new Date(),
      category: 'Fuel',
      amount: 60,
      litres: 40,
      price_per_litre: 1.5,
      odometer: 12500,
    });
    assert.strictEqual(exp.odometer, 12500);
  });
});
