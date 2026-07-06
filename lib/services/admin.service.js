const mongoose = require('mongoose');
const userModel = require('../models/user.model');
const roleGate = require('../roleGate');

const VALID_PLANS = ['free', 'pro'];

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function assertValidObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw makeError(404, 'User not found');
}

async function listUsers(adminUserId) {
  await roleGate.assertAdmin(adminUserId);
  return userModel.listForAdmin();
}

async function setUserPlan(adminUserId, targetUserId, plan) {
  await roleGate.assertAdmin(adminUserId);
  if (!VALID_PLANS.includes(plan))
    throw makeError(400, `plan must be one of: ${VALID_PLANS.join(', ')}`);
  assertValidObjectId(targetUserId);
  const existing = await userModel.findById(targetUserId);
  if (!existing) throw makeError(404, 'User not found');
  await userModel.setPlanManually(targetUserId, plan);
  return userModel.findById(targetUserId);
}

module.exports = { listUsers, setUserPlan };
