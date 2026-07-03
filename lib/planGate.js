const userModel = require('./models/user.model');

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Throws 402 with the given feature-specific message when the user
 * isn't on the pro plan. Shared by every paid-feature gate (income,
 * reports, ...).
 */
async function assertProPlan(userId, message) {
  const user = await userModel.findById(userId);
  if (user?.plan !== 'pro') throw makeError(402, message);
}

module.exports = { assertProPlan };
