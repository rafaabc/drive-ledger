const userModel = require('./models/user.model');

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Throws 403 when the user isn't an admin. Shared by every admin-only route.
 */
async function assertAdmin(userId) {
  const user = await userModel.findById(userId);
  if (user?.role !== 'admin') throw makeError(403, 'admin_required');
}

module.exports = { assertAdmin };
