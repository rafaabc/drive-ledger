'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const mongoose = require('mongoose');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const reportsService = require('../../../lib/services/reports.service');
const incomeService = require('../../../lib/services/income.service');
const expensesService = require('../../../lib/services/expenses.service');
const vehiclesService = require('../../../lib/services/vehicles.service');
const userModel = require('../../../lib/models/user.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const TODAY = new Date().toISOString().slice(0, 10);
const YEAR = new Date().getUTCFullYear();

async function proUser(username, currency) {
  const u = new mongoose.Types.ObjectId().toString();
  await userModel.create({
    _id: u,
    username,
    password: 'x',
    email: `${username}@test.com`,
    plan: 'pro',
    ...(currency && { currency }),
  });
  return u;
}

async function freeUser(username) {
  const u = new mongoose.Types.ObjectId().toString();
  await userModel.create({ _id: u, username, password: 'x', email: `${username}@test.com` });
  return u;
}

describe('reportsService.generateReport()', () => {
  it('rejects for a free-plan user with 402', async () => {
    const u = await freeUser('freerep1');
    await assert.rejects(
      () => reportsService.generateReport(u, { year: String(YEAR) }, 'csv'),
      (err) => {
        assert.strictEqual(err.status, 402);
        assert.match(err.message, /reports_feature_locked/);
        return true;
      },
    );
  });

  it('rejects an unsupported format', async () => {
    const u = await proUser('proreport1');
    await assert.rejects(
      () => reportsService.generateReport(u, { year: String(YEAR) }, 'xlsx'),
      (err) => err.status === 400 && /format must be csv or pdf/i.test(err.message),
    );
  });

  it('generates a CSV report with income, expenses, and profit', async () => {
    const u = await proUser('proreport2');
    await incomeService.createIncome(u, { date: TODAY, amount: 1000, source: 'Uber' });
    await expensesService.createExpense(u, { date: TODAY, category: 'Parking', amount: 300 });

    const result = await reportsService.generateReport(u, { year: String(YEAR) }, 'csv');
    assert.strictEqual(result.contentType, 'text/csv');
    assert.match(result.filename, /\.csv$/);
    assert.match(result.body, /Currency,BRL/);
    assert.match(result.body, /Total Income,1000\.00 BRL/);
    assert.match(result.body, /Parking,300\.00 BRL/);
    assert.match(result.body, /Net Profit,700\.00 BRL/);
  });

  it('uses the requesting users own currency in the report', async () => {
    const u = await proUser('proreport5', 'USD');
    await incomeService.createIncome(u, { date: TODAY, amount: 1000, source: 'Uber' });

    const result = await reportsService.generateReport(u, { year: String(YEAR) }, 'csv');
    assert.match(result.body, /Currency,USD/);
    assert.match(result.body, /Total Income,1000\.00 USD/);
  });

  it('includes the vehicle name when vehicleId is provided', async () => {
    const u = await proUser('proreport3');
    const vehicle = await vehiclesService.createVehicle(u, { name: 'My Civic' });
    await incomeService.createIncome(u, {
      date: TODAY,
      amount: 500,
      source: 'Uber',
      vehicleId: vehicle.id,
    });

    const result = await reportsService.generateReport(
      u,
      { year: String(YEAR), vehicleId: vehicle.id },
      'csv',
    );
    assert.match(result.body, /Vehicle,My Civic/);
  });

  it('generates a valid PDF buffer', async () => {
    const u = await proUser('proreport4');
    await incomeService.createIncome(u, { date: TODAY, amount: 1000, source: 'Uber' });

    const result = await reportsService.generateReport(u, { year: String(YEAR) }, 'pdf');
    assert.strictEqual(result.contentType, 'application/pdf');
    assert.match(result.filename, /\.pdf$/);
    assert.ok(Buffer.isBuffer(result.body));
    assert.strictEqual(result.body.subarray(0, 5).toString(), '%PDF-');
  });
});
