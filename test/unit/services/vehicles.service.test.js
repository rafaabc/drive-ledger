'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const mongoose = require('mongoose');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const vehiclesService = require('../../../lib/services/vehicles.service');
const userModel = require('../../../lib/models/user.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const USER_ID = () => new mongoose.Types.ObjectId().toString();

describe('vehiclesService.createVehicle()', () => {
  it('creates a vehicle for a free user with none yet', async () => {
    const u = USER_ID();
    const vehicle = await vehiclesService.createVehicle(u, { name: 'Civic' });
    assert.strictEqual(vehicle.name, 'Civic');
  });

  it('rejects a 2nd vehicle for a free-plan user with 402', async () => {
    const u = USER_ID();
    await userModel.create({ _id: u, username: 'free1', password: 'x', email: 'free1@test.com' });
    await vehiclesService.createVehicle(u, { name: 'Civic' });
    await assert.rejects(
      () => vehiclesService.createVehicle(u, { name: 'Corolla' }),
      (err) => {
        assert.strictEqual(err.status, 402);
        assert.match(err.message, /vehicle_limit_reached/);
        return true;
      },
    );
  });

  it('allows unlimited vehicles for a pro-plan user', async () => {
    const u = USER_ID();
    await userModel.create({
      _id: u,
      username: 'pro1',
      password: 'x',
      email: 'pro1@test.com',
      plan: 'pro',
    });
    await vehiclesService.createVehicle(u, { name: 'Civic' });
    const second = await vehiclesService.createVehicle(u, { name: 'Corolla' });
    assert.strictEqual(second.name, 'Corolla');
  });

  it('rejects when name is missing', async () => {
    const u = USER_ID();
    await assert.rejects(
      () => vehiclesService.createVehicle(u, {}),
      (err) => err.status === 400,
    );
  });
});

describe('vehiclesService.resolveVehicleId()', () => {
  it('auto-creates a default vehicle when the user has none', async () => {
    const u = USER_ID();
    const vehicle = await vehiclesService.resolveVehicleId(u, undefined);
    assert.strictEqual(vehicle.name, 'My Vehicle');
  });

  it('reuses the same default vehicle on subsequent calls', async () => {
    const u = USER_ID();
    const first = await vehiclesService.resolveVehicleId(u, undefined);
    const second = await vehiclesService.resolveVehicleId(u, undefined);
    assert.strictEqual(first.id, second.id);
  });

  it('does not count the auto-created default vehicle against the free-tier gate', async () => {
    const u = USER_ID();
    await userModel.create({ _id: u, username: 'free2', password: 'x', email: 'free2@test.com' });
    await vehiclesService.resolveVehicleId(u, undefined);
    // free tier still allows exactly 1 explicit vehicle — but one already exists (the
    // auto-created default), so an explicit create should now hit the same 402 gate.
    await assert.rejects(
      () => vehiclesService.createVehicle(u, { name: 'Second' }),
      (err) => err.status === 402,
    );
  });

  it('throws 404 when an explicit vehicleId does not belong to the user', async () => {
    const u = USER_ID();
    const other = USER_ID();
    const vehicle = await vehiclesService.createVehicle(other, { name: 'NotMine' });
    await assert.rejects(
      () => vehiclesService.resolveVehicleId(u, vehicle.id),
      (err) => err.status === 404,
    );
  });
});

describe('vehiclesService.updateOdometer()', () => {
  it('raises currentKm; older reading does not lower it', async () => {
    const u = USER_ID();
    const vehicle = await vehiclesService.createVehicle(u, { name: 'Civic' });
    await vehiclesService.updateOdometer(vehicle.id, 1000);
    await vehiclesService.updateOdometer(vehicle.id, 500);
    const updated = await vehiclesService.getVehicle(u, vehicle.id);
    assert.strictEqual(updated.currentKm, 1000);
  });
});

describe('vehiclesService — manual currentKm override', () => {
  it('createVehicle accepts an initial currentKm', async () => {
    const u = USER_ID();
    const vehicle = await vehiclesService.createVehicle(u, { name: 'Civic', currentKm: 5000 });
    assert.strictEqual(vehicle.currentKm, 5000);
  });

  it('updateVehicle allows manually setting currentKm to a lower value', async () => {
    const u = USER_ID();
    const vehicle = await vehiclesService.createVehicle(u, { name: 'Civic', currentKm: 5000 });
    const updated = await vehiclesService.updateVehicle(u, vehicle.id, { currentKm: 1000 });
    assert.strictEqual(updated.currentKm, 1000);
  });

  it('rejects a negative currentKm', async () => {
    const u = USER_ID();
    await assert.rejects(
      () => vehiclesService.createVehicle(u, { name: 'Civic', currentKm: -5 }),
      (err) => err.status === 400,
    );
  });
});

describe('vehiclesService.deleteAllByUser()', () => {
  it('deletes all vehicles for the given userId', async () => {
    const u = USER_ID();
    const other = USER_ID();
    await vehiclesService.createVehicle(u, { name: 'Mine' });
    await vehiclesService.createVehicle(other, { name: 'TheirsAlso' });
    await vehiclesService.deleteAllByUser(u);
    assert.strictEqual((await vehiclesService.listVehicles(u)).length, 0);
    assert.strictEqual((await vehiclesService.listVehicles(other)).length, 1);
  });
});
