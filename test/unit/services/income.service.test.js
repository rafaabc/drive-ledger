'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const mongoose = require('mongoose');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const incomeService = require('../../../lib/services/income.service');
const expensesService = require('../../../lib/services/expenses.service');
const userModel = require('../../../lib/models/user.model');
const vehicleModel = require('../../../lib/models/vehicle.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const YEAR = new Date().getUTCFullYear();

async function proUser(username) {
  const u = new mongoose.Types.ObjectId().toString();
  await userModel.create({
    _id: u,
    username,
    password: 'x',
    email: `${username}@test.com`,
    plan: 'pro',
  });
  return u;
}

async function freeUser(username) {
  const u = new mongoose.Types.ObjectId().toString();
  await userModel.create({ _id: u, username, password: 'x', email: `${username}@test.com` });
  return u;
}

describe('incomeService.createIncome()', () => {
  it('rejects for a free-plan user with 402', async () => {
    const u = await freeUser('freeinc1');
    await assert.rejects(
      () => incomeService.createIncome(u, { date: TODAY, amount: 100, source: 'Uber' }),
      (err) => {
        assert.strictEqual(err.status, 402);
        assert.match(err.message, /income_feature_locked/);
        return true;
      },
    );
  });

  it('creates for a pro-plan user', async () => {
    const u = await proUser('proinc1');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 250.5,
      source: 'Uber',
    });
    assert.strictEqual(income.amount, 250.5);
    assert.strictEqual(income.source, 'Uber');
    assert.ok(income.vehicleId);
  });

  it('rejects invalid source', async () => {
    const u = await proUser('proinc2');
    await assert.rejects(
      () => incomeService.createIncome(u, { date: TODAY, amount: 100, source: 'Lyft' }),
      (err) => err.status === 400 && /source must be one of/i.test(err.message),
    );
  });

  it('rejects non-positive amount', async () => {
    const u = await proUser('proinc3');
    await assert.rejects(
      () => incomeService.createIncome(u, { date: TODAY, amount: 0, source: 'Uber' }),
      (err) => err.status === 400,
    );
  });

  it('rejects future date', async () => {
    const u = await proUser('proinc4');
    await assert.rejects(
      () => incomeService.createIncome(u, { date: FUTURE, amount: 10, source: 'Other' }),
      (err) => err.status === 400 && /future/i.test(err.message),
    );
  });
});

describe('incomeService.listIncome() / getIncome()', () => {
  it('returns only this users income entries', async () => {
    const me = await proUser('listme');
    const other = await proUser('listother');
    await incomeService.createIncome(me, { date: TODAY, amount: 100, source: 'Uber' });
    await incomeService.createIncome(other, { date: TODAY, amount: 200, source: '99' });

    const list = await incomeService.listIncome(me);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].amount, 100);
  });

  it('returns 404 when income does not belong to user', async () => {
    const me = await proUser('getme');
    const other = await proUser('getother');
    const income = await incomeService.createIncome(other, {
      date: TODAY,
      amount: 100,
      source: 'Uber',
    });
    await assert.rejects(
      () => incomeService.getIncome(me, income.id),
      (err) => err.status === 404,
    );
  });
});

describe('incomeService.updateIncome() / deleteIncome()', () => {
  it('updates allowed fields', async () => {
    const u = await proUser('updinc');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 100,
      source: 'Uber',
    });
    const updated = await incomeService.updateIncome(u, income.id, { amount: 150 });
    assert.strictEqual(updated.amount, 150);
  });

  it('reassigns vehicleId to another owned vehicle', async () => {
    const u = await proUser('vehinc');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 100,
      source: 'Uber',
    });
    const originalVehicleId = income.vehicleId.toString();
    const vehicleB = await vehicleModel.create({ userId: u, name: 'Car B' });

    const updated = await incomeService.updateIncome(u, income.id, {
      vehicleId: vehicleB._id.toString(),
    });

    assert.strictEqual(updated.vehicleId.toString(), vehicleB._id.toString());
    assert.notStrictEqual(updated.vehicleId.toString(), originalVehicleId);
  });

  it('throws 404 when reassigning to a vehicleId owned by another user', async () => {
    const u1 = await proUser('vehinc1');
    const u2 = await proUser('vehinc2');
    const income = await incomeService.createIncome(u1, {
      date: TODAY,
      amount: 100,
      source: 'Uber',
    });
    const otherVehicle = await vehicleModel.create({ userId: u2, name: 'Not yours' });

    await assert.rejects(
      () => incomeService.updateIncome(u1, income.id, { vehicleId: otherVehicle._id.toString() }),
      (err) => err.status === 404,
    );
  });

  it('deletes an entry', async () => {
    const u = await proUser('delinc');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 100,
      source: 'Uber',
    });
    await incomeService.deleteIncome(u, income.id);
    await assert.rejects(
      () => incomeService.getIncome(u, income.id),
      (err) => err.status === 404,
    );
  });
});

describe('incomeService.getProfitSummary()', () => {
  it('computes profit as income minus expenses', async () => {
    const u = await proUser('profit1');
    await incomeService.createIncome(u, { date: TODAY, amount: 1000, source: 'Uber' });
    await expensesService.createExpense(u, { date: TODAY, category: 'Parking', amount: 300 });

    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    assert.strictEqual(summary.totalIncome, 1000);
    assert.strictEqual(summary.totalExpenses, 300);
    assert.strictEqual(summary.profit, 700);
  });

  it('estimates profitPerKm from Fuel odometer readings when at least 2 exist', async () => {
    const u = await proUser('profit2');
    await incomeService.createIncome(u, { date: TODAY, amount: 500, source: 'Uber' });
    await expensesService.createExpense(u, {
      date: TODAY,
      category: 'Fuel',
      litres: 10,
      price_per_litre: 5,
      odometer: 1000,
    });
    await expensesService.createExpense(u, {
      date: TODAY,
      category: 'Fuel',
      litres: 10,
      price_per_litre: 5,
      odometer: 1200,
    });

    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    assert.strictEqual(summary.kmDriven, 200);
    assert.strictEqual(summary.profitPerKm, summary.profit / 200);
  });

  it('returns null profitPerKm when fewer than 2 odometer readings exist', async () => {
    const u = await proUser('profit3');
    await incomeService.createIncome(u, { date: TODAY, amount: 500, source: 'Uber' });
    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    assert.strictEqual(summary.profitPerKm, null);
  });

  it('rejects when year is missing', async () => {
    const u = await proUser('profit4');
    await assert.rejects(
      () => incomeService.getProfitSummary(u, {}),
      (err) => err.status === 400,
    );
  });
});

describe('incomeService.deleteAllByUser()', () => {
  it('deletes all income entries for the given userId', async () => {
    const u = await proUser('delall1');
    const other = await proUser('delall2');
    await incomeService.createIncome(u, { date: TODAY, amount: 100, source: 'Uber' });
    await incomeService.createIncome(other, { date: TODAY, amount: 200, source: '99' });

    await incomeService.deleteAllByUser(u);
    assert.strictEqual((await incomeService.listIncome(u)).length, 0);
    assert.strictEqual((await incomeService.listIncome(other)).length, 1);
  });
});
