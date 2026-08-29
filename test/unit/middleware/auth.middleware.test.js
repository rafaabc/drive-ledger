'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

let withAuth;
before(async () => {
  ({ withAuth } = await import('../../../lib/auth.mjs'));
});

function makeReq(authHeader) {
  return {
    headers: { get: (name) => (name === 'authorization' ? authHeader : null) },
  };
}

function makeHandler(captured = {}) {
  return async (req, ctx, user) => {
    captured.user = user;
    captured.called = true;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
}

describe('withAuth', () => {
  it('should call handler with decoded user when token is valid', async () => {
    const payload = { typ: 'access', id: 'abc123', username: 'alice' };
    const token = jwt.sign(payload, SECRET, { expiresIn: '1h' });
    const captured = {};
    const res = await withAuth(makeHandler(captured))(makeReq(`Bearer ${token}`), {});
    assert.strictEqual(res.status, 200);
    assert.ok(captured.called);
    assert.strictEqual(captured.user.id, payload.id);
    assert.strictEqual(captured.user.username, payload.username);
  });

  // Regression guard for the token-purpose-confusion fix: a single-purpose token
  // (e.g. password-reset) is signed with the same JWT_SECRET but must never be
  // usable as a session credential on an authenticated route.
  it('should return 401 for a valid token missing the typ:access claim', async () => {
    const token = jwt.sign({ id: 'abc123', username: 'alice' }, SECRET, { expiresIn: '1h' });
    const res = await withAuth(makeHandler())(makeReq(`Bearer ${token}`), {});
    assert.strictEqual(res.status, 401);
  });

  it('should return 401 for a password-reset-shaped token (purpose: reset)', async () => {
    const token = jwt.sign({ username: 'alice', purpose: 'reset' }, SECRET, { expiresIn: '15m' });
    const res = await withAuth(makeHandler())(makeReq(`Bearer ${token}`), {});
    assert.strictEqual(res.status, 401);
  });

  it('should return 401 for a typ:access token with no id claim', async () => {
    const token = jwt.sign({ typ: 'access', username: 'alice' }, SECRET, { expiresIn: '1h' });
    const res = await withAuth(makeHandler())(makeReq(`Bearer ${token}`), {});
    assert.strictEqual(res.status, 401);
  });

  it('should return 401 when Authorization header is missing', async () => {
    const res = await withAuth(makeHandler())(makeReq(undefined), {});
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.match(body.message, /not provided/i);
  });

  it('should return 401 when token is empty after Bearer', async () => {
    const res = await withAuth(makeHandler())(makeReq('Bearer '), {});
    assert.strictEqual(res.status, 401);
  });

  it('should return 401 when token is invalid', async () => {
    const res = await withAuth(makeHandler())(makeReq('Bearer this.is.not.valid'), {});
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.match(body.message, /invalid or expired/i);
  });

  it('should return 401 when token is expired', async () => {
    const token = jwt.sign({ id: '1' }, SECRET, { expiresIn: -1 });
    const res = await withAuth(makeHandler())(makeReq(`Bearer ${token}`), {});
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.match(body.message, /invalid or expired/i);
  });

  // Algorithm confusion — a token must be rejected unless it was signed with HS256,
  // regardless of what algorithm its own header claims.
  it('should return 401 for a token signed with alg "none"', async () => {
    const token = jwt.sign({ id: 'attacker' }, undefined, { algorithm: 'none' });
    const res = await withAuth(makeHandler())(makeReq(`Bearer ${token}`), {});
    assert.strictEqual(res.status, 401);
  });
});
