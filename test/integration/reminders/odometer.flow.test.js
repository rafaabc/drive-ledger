'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
require('../../helpers/email-mock');
const authService = require('../../../lib/services/auth.service');

const VALID_CONSENT = { policyVersion: '2026-05-20', acceptedAt: new Date().toISOString() };
const expensesService = require('../../../lib/services/expenses.service');
const userModel = require('../../../lib/models/user.model');
const vehiclesService = require('../../../lib/services/vehicles.service');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const TODAY = new Date().toISOString().slice(0, 10);

describe('Odometer flow', () => {
  it('fuel odometer raises the vehicle currentKm; older reading does not lower it', async () => {
    await authService.register({
      username: 'od1',
      password: 'pass1234',
      email: 'od1@test.com',
      consent: VALID_CONSENT,
    });
    const user = await userModel.findByUsername('od1');
    const uid = user._id.toString();

    await expensesService.createExpense(uid, {
      date: TODAY,
      category: 'Fuel',
      litres: 30,
      price_per_litre: 1.5,
      odometer: 1000,
    });
    const [vehicle] = await vehiclesService.listVehicles(uid);
    let v = await vehiclesService.getVehicle(uid, vehicle.id);
    assert.strictEqual(v.currentKm, 1000);

    await expensesService.createExpense(uid, {
      date: TODAY,
      category: 'Fuel',
      litres: 30,
      price_per_litre: 1.5,
      odometer: 500,
    });
    v = await vehiclesService.getVehicle(uid, vehicle.id);
    assert.strictEqual(v.currentKm, 1000);
  });

  it('manual override allows setting a lower value', async () => {
    await authService.register({
      username: 'od2',
      password: 'pass1234',
      email: 'od2@test.com',
      consent: VALID_CONSENT,
    });
    const user = await userModel.findByUsername('od2');
    const uid = user._id.toString();

    await authService.updateOdometer({ id: uid, currentKm: 5000 });
    const result = await authService.updateOdometer({ id: uid, currentKm: 1000 });
    assert.strictEqual(result.currentKm, 1000);
  });
});
