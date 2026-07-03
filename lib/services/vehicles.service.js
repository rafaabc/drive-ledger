const mongoose = require('mongoose');
const vehicleModel = require('../models/vehicle.model');
const userModel = require('../models/user.model');

const FREE_VEHICLE_LIMIT = 1;

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function assertValidObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw makeError(404, 'Vehicle not found');
}

function validateVehicleFields(body) {
  if (!body.name || typeof body.name !== 'string' || !body.name.trim())
    throw makeError(400, 'name is required');
  if (body.currentKm === undefined) return;
  if (typeof body.currentKm !== 'number' || body.currentKm < 0)
    throw makeError(400, 'currentKm must be a non-negative number');
}

async function createVehicle(userId, body) {
  validateVehicleFields(body);

  const user = await userModel.findById(userId);
  const isPro = user?.plan === 'pro';
  if (!isPro) {
    const count = await vehicleModel.countByUserId(userId);
    if (count >= FREE_VEHICLE_LIMIT) throw makeError(402, 'vehicle_limit_reached');
  }

  return vehicleModel.create({
    userId,
    name: body.name.trim(),
    currentKm: body.currentKm !== undefined ? body.currentKm : 0,
    currentKmUpdatedAt: body.currentKm !== undefined ? new Date() : undefined,
  });
}

async function listVehicles(userId) {
  return vehicleModel.findByUserId(userId);
}

async function getVehicle(userId, id) {
  assertValidObjectId(id);
  const vehicle = await vehicleModel.findById(id);
  if (!vehicle || vehicle.userId.toString() !== userId) throw makeError(404, 'Vehicle not found');
  return vehicle;
}

async function updateVehicle(userId, id, body) {
  assertValidObjectId(id);
  const existing = await vehicleModel.findById(id);
  if (!existing || existing.userId.toString() !== userId) throw makeError(404, 'Vehicle not found');

  const merged = {
    name: body.name === undefined ? existing.name : body.name,
    currentKm: body.currentKm === undefined ? existing.currentKm : body.currentKm,
  };
  validateVehicleFields(merged);

  const updateData = { name: merged.name };
  if (body.currentKm !== undefined) {
    updateData.currentKm = body.currentKm;
    updateData.currentKmUpdatedAt = new Date();
  }

  return vehicleModel.update(id, updateData);
}

async function deleteVehicle(userId, id) {
  assertValidObjectId(id);
  const vehicle = await vehicleModel.findById(id);
  if (!vehicle || vehicle.userId.toString() !== userId) throw makeError(404, 'Vehicle not found');
  await vehicleModel.remove(id);
}

async function deleteAllByUser(userId) {
  await vehicleModel.removeAllByUser(userId);
}

/**
 * Resolves the vehicle a request should operate against.
 * - If vehicleId is provided, validates ownership and returns that vehicle.
 * - Otherwise returns the user's first vehicle, auto-creating a default one
 *   (seeded from the legacy user.currentKm) for back-compat with single-vehicle
 *   callers and pre-migration accounts. Does not count against the freemium gate.
 */
async function resolveVehicleId(userId, vehicleId) {
  if (vehicleId !== undefined && vehicleId !== null) {
    return getVehicle(userId, vehicleId);
  }

  const existing = await vehicleModel.findByUserId(userId);
  if (existing.length > 0) return existing[0];

  const user = await userModel.findById(userId);
  return vehicleModel.create({
    userId,
    name: 'My Vehicle',
    currentKm: user?.currentKm || 0,
    currentKmUpdatedAt: user?.currentKmUpdatedAt || undefined,
  });
}

async function updateOdometer(vehicleId, odometer) {
  if (odometer === undefined) return;
  const vehicle = await vehicleModel.findById(vehicleId);
  if (!vehicle) return;
  if (odometer > (vehicle.currentKm || 0)) {
    await vehicleModel.updateOdometerAndReturn(vehicleId, odometer);
  }
}

module.exports = {
  FREE_VEHICLE_LIMIT,
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle,
  deleteAllByUser,
  resolveVehicleId,
  updateOdometer,
};
