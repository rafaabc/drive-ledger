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

function fuelExpense(userId, { litres, pricePerLitre, odometer, date = TODAY }) {
  const expense = { date, category: 'Fuel', litres, price_per_litre: pricePerLitre };
  if (odometer != null) expense.odometer = odometer;
  return expensesService.createExpense(userId, expense);
}

function shiftIncome(userId, { amount, km, startTime, endTime, date = TODAY }) {
  return incomeService.createIncome(userId, {
    date,
    amount,
    source: 'Wolt',
    startTime,
    endTime,
    km,
  });
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
  it('rejects listIncome for a free-plan user with 402', async () => {
    const u = await freeUser('freelistinc');
    await assert.rejects(
      () => incomeService.listIncome(u),
      (err) => {
        assert.strictEqual(err.status, 402);
        assert.match(err.message, /income_feature_locked/);
        return true;
      },
    );
  });

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
  it('rejects for a free-plan user with 402', async () => {
    const u = await freeUser('freeprofit');
    await assert.rejects(
      () => incomeService.getProfitSummary(u, { year: String(YEAR) }),
      (err) => {
        assert.strictEqual(err.status, 402);
        assert.match(err.message, /income_feature_locked/);
        return true;
      },
    );
  });

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

describe('incomeService.getProfitSummary() monthly breakdown', () => {
  it('omits months when breakdown is not requested', async () => {
    const u = await proUser('breakdown1');
    await incomeService.createIncome(u, { date: TODAY, amount: 500, source: 'Uber' });
    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    assert.strictEqual(summary.months, undefined);
  });

  it('omits months when a specific month is requested', async () => {
    const u = await proUser('breakdown2');
    await incomeService.createIncome(u, { date: TODAY, amount: 500, source: 'Uber' });
    const summary = await incomeService.getProfitSummary(u, {
      year: String(YEAR),
      month: '1',
      breakdown: 'monthly',
    });
    assert.strictEqual(summary.months, undefined);
  });

  it('returns 12 rows with zeroed/null fields for empty months', async () => {
    const u = await proUser('breakdown3');
    await incomeService.createIncome(u, { date: TODAY, amount: 500, source: 'Uber' });
    const summary = await incomeService.getProfitSummary(u, {
      year: String(YEAR),
      breakdown: 'monthly',
    });
    assert.strictEqual(summary.months.length, 12);
    const thisMonth = new Date(TODAY).getUTCMonth() + 1;
    for (const row of summary.months) {
      assert.strictEqual(row.month >= 1 && row.month <= 12, true);
      if (row.month !== thisMonth) {
        assert.strictEqual(row.totalIncome, 0);
        assert.strictEqual(row.netEarnings, null);
        assert.strictEqual(row.hours, null);
      }
    }
    const currentRow = summary.months.find((r) => r.month === thisMonth);
    assert.strictEqual(currentRow.totalIncome, 500);
  });

  it('anchors each month cost-per-km on the last fill before that month', async () => {
    const u = await proUser('breakdown4');
    const jan = `${YEAR}-01-10`;
    const feb = `${YEAR}-02-10`;
    await incomeService.createIncome(u, { date: feb, amount: 500, source: 'Uber', km: 100 });
    await expensesService.createExpense(u, {
      date: jan,
      category: 'Fuel',
      litres: 10,
      price_per_litre: 5,
      odometer: 1000,
    });
    await expensesService.createExpense(u, {
      date: feb,
      category: 'Fuel',
      litres: 10,
      price_per_litre: 5,
      odometer: 1100,
    });

    const summary = await incomeService.getProfitSummary(u, {
      year: String(YEAR),
      breakdown: 'monthly',
    });
    const febRow = summary.months.find((r) => r.month === 2);
    assert.strictEqual(febRow.costPerKm, 0.5);
    assert.strictEqual(febRow.fuelCost, 50);
    assert.strictEqual(febRow.netEarnings, 450);
  });
});

describe('incomeService shift fields', () => {
  it('derives hours from startTime/endTime', async () => {
    const u = await proUser('shift1');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 191.4,
      source: 'Wolt',
      startTime: '13:15',
      endTime: '15:00',
      km: 22.1,
      deliveries: 3,
    });
    assert.strictEqual(income.hours, 1.75);
    assert.strictEqual(income.km, 22.1);
    assert.strictEqual(income.deliveries, 3);
  });

  it('adds 24h when a shift crosses midnight', async () => {
    const u = await proUser('shift2');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 100,
      source: 'Wolt',
      startTime: '23:30',
      endTime: '00:15',
    });
    assert.strictEqual(income.hours, 0.75);
  });

  it('rejects startTime without endTime', async () => {
    const u = await proUser('shift3');
    await assert.rejects(
      () =>
        incomeService.createIncome(u, {
          date: TODAY,
          amount: 100,
          source: 'Wolt',
          startTime: '13:00',
        }),
      (err) => err.status === 400 && /startTime and endTime/i.test(err.message),
    );
  });

  it('rejects malformed time strings', async () => {
    const u = await proUser('shift4');
    await assert.rejects(
      () =>
        incomeService.createIncome(u, {
          date: TODAY,
          amount: 100,
          source: 'Wolt',
          startTime: '1pm',
          endTime: '15:00',
        }),
      (err) => err.status === 400 && /HH:MM/i.test(err.message),
    );
  });

  it('rejects an explicit hours alongside startTime/endTime', async () => {
    const u = await proUser('shift5');
    await assert.rejects(
      () =>
        incomeService.createIncome(u, {
          date: TODAY,
          amount: 100,
          source: 'Wolt',
          startTime: '13:00',
          endTime: '15:00',
          hours: 2,
        }),
      (err) => err.status === 400 && /derived/i.test(err.message),
    );
  });

  it('rejects negative km', async () => {
    const u = await proUser('shift6');
    await assert.rejects(
      () => incomeService.createIncome(u, { date: TODAY, amount: 100, source: 'Wolt', km: -1 }),
      (err) => err.status === 400 && /km must be/i.test(err.message),
    );
  });

  it('accepts Wolt as a source', async () => {
    const u = await proUser('shift7');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 100,
      source: 'Wolt',
    });
    assert.strictEqual(income.source, 'Wolt');
  });
});

describe('incomeService multi-block segments', () => {
  it('sums hours across two non-overlapping blocks', async () => {
    const u = await proUser('seg1');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 84.2,
      source: 'Wolt',
      segments: [
        { startTime: '12:00', endTime: '13:00' },
        { startTime: '15:30', endTime: '16:40' },
      ],
    });
    assert.strictEqual(income.hours, 2.17);
    assert.strictEqual(income.segments.length, 2);
    assert.strictEqual(income.startTime, undefined);
    assert.strictEqual(income.endTime, undefined);
  });

  it('creates a legacy startTime/endTime entry as a single segment', async () => {
    const u = await proUser('seg2');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 100,
      source: 'Wolt',
      startTime: '13:00',
      endTime: '15:00',
    });
    assert.strictEqual(income.hours, 2);
    assert.strictEqual(income.segments.length, 1);
    assert.strictEqual(income.segments[0].startTime, '13:00');
    assert.strictEqual(income.segments[0].endTime, '15:00');
  });

  it('lifts a legacy row into segments when edited without touching times', async () => {
    const u = await proUser('seg3');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 100,
      source: 'Wolt',
      startTime: '13:00',
      endTime: '15:00',
    });
    const updated = await incomeService.updateIncome(u, income.id, { amount: 120 });
    assert.strictEqual(updated.amount, 120);
    assert.strictEqual(updated.hours, 2);
    assert.strictEqual(updated.segments.length, 1);
    assert.strictEqual(updated.segments[0].startTime, '13:00');
  });

  it('replaces segments on update and recomputes hours', async () => {
    const u = await proUser('seg4');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 100,
      source: 'Wolt',
      segments: [{ startTime: '12:00', endTime: '13:00' }],
    });
    const updated = await incomeService.updateIncome(u, income.id, {
      segments: [
        { startTime: '12:00', endTime: '13:00' },
        { startTime: '15:30', endTime: '16:40' },
      ],
    });
    assert.strictEqual(updated.hours, 2.17);
    assert.strictEqual(updated.segments.length, 2);
  });

  it('rejects segments combined with startTime/endTime on create', async () => {
    const u = await proUser('seg5');
    await assert.rejects(
      () =>
        incomeService.createIncome(u, {
          date: TODAY,
          amount: 100,
          source: 'Wolt',
          segments: [{ startTime: '12:00', endTime: '13:00' }],
          startTime: '15:00',
          endTime: '16:00',
        }),
      (err) => err.status === 400 && /cannot be combined/i.test(err.message),
    );
  });

  it('rejects segments combined with startTime/endTime on update', async () => {
    const u = await proUser('seg6');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 100,
      source: 'Wolt',
      segments: [{ startTime: '12:00', endTime: '13:00' }],
    });
    await assert.rejects(
      () =>
        incomeService.updateIncome(u, income.id, {
          segments: [{ startTime: '09:00', endTime: '10:00' }],
          startTime: '15:00',
          endTime: '16:00',
        }),
      (err) => err.status === 400 && /cannot be combined/i.test(err.message),
    );
  });

  it('rejects overlapping time blocks', async () => {
    const u = await proUser('seg7');
    await assert.rejects(
      () =>
        incomeService.createIncome(u, {
          date: TODAY,
          amount: 100,
          source: 'Wolt',
          segments: [
            { startTime: '12:00', endTime: '14:00' },
            { startTime: '13:00', endTime: '15:00' },
          ],
        }),
      (err) => err.status === 400 && /overlap/i.test(err.message),
    );
  });

  it('rejects an empty segments array', async () => {
    const u = await proUser('seg8');
    await assert.rejects(
      () =>
        incomeService.createIncome(u, { date: TODAY, amount: 100, source: 'Wolt', segments: [] }),
      (err) => err.status === 400,
    );
  });

  it('rejects more than 12 segments', async () => {
    const u = await proUser('seg9');
    const segments = Array.from({ length: 13 }, (_, i) => ({
      startTime: `0${(i % 9) + 1}:00`.slice(-5),
      endTime: `0${(i % 9) + 1}:30`.slice(-5),
    }));
    await assert.rejects(
      () => incomeService.createIncome(u, { date: TODAY, amount: 100, source: 'Wolt', segments }),
      (err) => err.status === 400,
    );
  });

  it('rejects an explicit hours alongside segments', async () => {
    const u = await proUser('seg10');
    await assert.rejects(
      () =>
        incomeService.createIncome(u, {
          date: TODAY,
          amount: 100,
          source: 'Wolt',
          segments: [{ startTime: '12:00', endTime: '13:00' }],
          hours: 5,
        }),
      (err) => err.status === 400 && /derived/i.test(err.message),
    );
  });

  it('rejects a malformed time inside a segment', async () => {
    const u = await proUser('seg11');
    await assert.rejects(
      () =>
        incomeService.createIncome(u, {
          date: TODAY,
          amount: 100,
          source: 'Wolt',
          segments: [{ startTime: '12h00', endTime: '13:00' }],
        }),
      (err) => err.status === 400 && /HH:MM/i.test(err.message),
    );
  });

  it('allows a midnight-crossing block only as the last segment of the day', async () => {
    const u = await proUser('seg12');
    const income = await incomeService.createIncome(u, {
      date: TODAY,
      amount: 100,
      source: 'Wolt',
      segments: [
        { startTime: '20:00', endTime: '22:00' },
        { startTime: '23:30', endTime: '00:30' },
      ],
    });
    assert.strictEqual(income.hours, 3);
  });

  it('rejects a midnight-crossing block that is not the last segment of the day', async () => {
    const u = await proUser('seg13');
    await assert.rejects(
      () =>
        incomeService.createIncome(u, {
          date: TODAY,
          amount: 100,
          source: 'Wolt',
          segments: [
            { startTime: '23:30', endTime: '00:30' },
            { startTime: '23:45', endTime: '23:59' },
          ],
        }),
      (err) => err.status === 400 && /midnight/i.test(err.message),
    );
  });

  it('uses summed multi-block hours in the profit summary net/hour', async () => {
    const u = await proUser('seg14');
    await incomeService.createIncome(u, {
      date: TODAY,
      amount: 200,
      source: 'Wolt',
      segments: [
        { startTime: '12:00', endTime: '13:00' },
        { startTime: '15:30', endTime: '16:40' },
      ],
    });
    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    assert.strictEqual(summary.hours, 2.17);
    assert.strictEqual(summary.grossPerHour, Math.round((200 / 2.17) * 100) / 100);
  });
});

describe('incomeService.getProfitSummary() with shift data', () => {
  it('reproduces the 2026-09-01 Wolt shift data with a single fill (no cost/km yet)', async () => {
    const u = await proUser('woltday1');
    await incomeService.createIncome(u, {
      date: TODAY,
      amount: 191.4,
      source: 'Wolt',
      startTime: '13:15',
      endTime: '15:00',
      km: 22.1,
      deliveries: 3,
    });
    await incomeService.createIncome(u, {
      date: TODAY,
      amount: 202.97,
      source: 'Wolt',
      startTime: '17:15',
      endTime: '18:27',
      km: 18.9,
      deliveries: 4,
    });
    await expensesService.createExpense(u, {
      date: TODAY,
      category: 'Fuel',
      litres: 27.12,
      price_per_litre: 17.39,
      odometer: 1000,
    });

    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    assert.strictEqual(summary.totalIncome, 394.37);
    assert.strictEqual(summary.hours, 2.95);
    assert.strictEqual(summary.workKm, 41);
    assert.strictEqual(summary.deliveries, 7);
    // Only one fill-up so far: fill-to-fill cost/km needs a second anchor.
    assert.strictEqual(summary.costPerKm, null);
    assert.strictEqual(summary.fuelCost, null);
    assert.strictEqual(summary.netEarnings, null);
    assert.strictEqual(summary.grossPerHour, Math.round((394.37 / 2.95) * 100) / 100);
  });

  it('computes fill-to-fill costPerKm and net/hour once a second fill exists', async () => {
    const u = await proUser('woltday2');
    await incomeService.createIncome(u, {
      date: TODAY,
      amount: 400,
      source: 'Wolt',
      startTime: '13:00',
      endTime: '15:00',
      km: 40,
    });
    await expensesService.createExpense(u, {
      date: TODAY,
      category: 'Fuel',
      litres: 27.12,
      price_per_litre: 17.39,
      odometer: 1000,
    });
    await expensesService.createExpense(u, {
      date: TODAY,
      category: 'Fuel',
      litres: 10,
      price_per_litre: 17,
      odometer: 1200,
    });

    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    // Only the second fill's cost (170) pays for the 200km span since the first fill.
    assert.strictEqual(summary.costPerKm, Math.round((170 / 200) * 10000) / 10000);
    assert.strictEqual(summary.costPerKmSamples, 1);
    const expectedFuelCost = Math.round(summary.costPerKm * 40 * 100) / 100;
    assert.strictEqual(summary.fuelCost, expectedFuelCost);
    assert.strictEqual(summary.netEarnings, Math.round((400 - expectedFuelCost) * 100) / 100);
    assert.strictEqual(summary.netPerHour, Math.round((summary.netEarnings / 2) * 100) / 100);
  });

  it('flags costPerKm as suspect when the implied consumption is physically impossible', async () => {
    const u = await proUser('woltimplausible');
    await shiftIncome(u, { amount: 400, km: 40, startTime: '13:00', endTime: '15:00' });
    await fuelExpense(u, { litres: 27.12, pricePerLitre: 17.99, odometer: 1000 });
    // 1488km span on a 27.12L fill implies ~55 km/L (1.8 L/100km) — impossible for a car.
    await fuelExpense(u, { litres: 5, pricePerLitre: 17.79, odometer: 2488 });

    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    assert.strictEqual(summary.costPerKm, Math.round((88.95 / 1488) * 10000) / 10000);
    assert.ok(summary.costPerKmFlags.includes('impliedRangeTooHigh'));
    assert.strictEqual(summary.costPerKmSpanKm, 1488);
  });

  it('reproduces the real reported case: 27.12L over a 1488km span must be flagged', async () => {
    const u = await proUser('woltreal');
    await shiftIncome(u, { amount: 3464.87, km: 279.1, startTime: '09:00', endTime: '10:00' });
    await fuelExpense(u, { litres: 27.12, pricePerLitre: 17.99, odometer: 1000 });
    await fuelExpense(u, { litres: 5, pricePerLitre: 17.79, odometer: 2488 });

    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    assert.ok(summary.costPerKmFlags.includes('impliedRangeTooHigh'));
  });

  it('flags costPerKm when a Fuel expense inside the span has no odometer', async () => {
    const u = await proUser('woltmissingodo');
    await shiftIncome(u, { amount: 400, km: 40, startTime: '13:00', endTime: '15:00' });
    await fuelExpense(u, { litres: 10, pricePerLitre: 17, odometer: 1000 });
    // Un-odometered fill in between — invisible to the fill-to-fill calc, but real fuel spend.
    await fuelExpense(u, { litres: 8, pricePerLitre: 17 });
    await fuelExpense(u, { litres: 10, pricePerLitre: 17, odometer: 1200 });

    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    assert.ok(summary.costPerKmFlags.includes('missingOdometer'));
  });

  it('does not flag a normal 2-fill window with plausible consumption', async () => {
    const u = await proUser('woltnormal');
    await shiftIncome(u, { amount: 400, km: 40, startTime: '13:00', endTime: '15:00' });
    await fuelExpense(u, { litres: 27.12, pricePerLitre: 17.39, odometer: 1000 });
    await fuelExpense(u, { litres: 10, pricePerLitre: 17, odometer: 1200 });

    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    // Same fixture as the existing fill-to-fill test above — must stay unflagged and unchanged.
    assert.strictEqual(summary.costPerKm, Math.round((170 / 200) * 10000) / 10000);
    assert.deepStrictEqual(summary.costPerKmFlags, []);
  });

  it('keeps plain (non-shift) income rows working: hours/workKm null, no crash', async () => {
    const u = await proUser('plaininc');
    await incomeService.createIncome(u, { date: TODAY, amount: 500, source: 'Uber' });
    const summary = await incomeService.getProfitSummary(u, { year: String(YEAR) });
    assert.strictEqual(summary.hours, null);
    assert.strictEqual(summary.workKm, null);
    assert.strictEqual(summary.netPerHour, null);
    assert.strictEqual(summary.totalIncome, 500);
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
