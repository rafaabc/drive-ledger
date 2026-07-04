function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Throws 403 with 'invite_required' when INVITE_ONLY is enabled and the
 * given code is not in the INVITE_CODES list. Reads env at call-time so
 * tests can set process.env dynamically.
 */
function assertInviteAllowed(code) {
  if (process.env.INVITE_ONLY !== 'true') return; // gate off
  const allowed = (process.env.INVITE_CODES || '')
    .split(',').map((c) => c.trim()).filter(Boolean);
  if (!code || !allowed.includes(code)) throw makeError(403, 'invite_required');
}

module.exports = { assertInviteAllowed };
