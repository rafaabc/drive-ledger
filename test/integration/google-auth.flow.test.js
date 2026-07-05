'use strict';

// NOTE: Real Google OAuth cannot be scripted — no API or E2E tests for this flow.
// These tests use a fake verifier to exercise the full service↔model collaboration.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { startMongo, stopMongo, resetMongo } = require('../helpers/mongo');
require('../helpers/email-mock');
const authService = require('../../lib/services/auth.service');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const VALID_CONSENT = { policyVersion: '2026-05-20', acceptedAt: new Date().toISOString() };

const fakeVerify =
  (sub = 'g-sub-1', email = 'guser@gmail.com', emailVerified = true) =>
  async () => ({ sub, email, emailVerified, name: 'G User' });

describe('Google auth flow integration', () => {
  it('should create a new user on first Google sign-in and login again finding the same user', async () => {
    const { token: t1 } = await authService.googleLogin({ idToken: 'tok' }, fakeVerify());
    const { token: t2 } = await authService.googleLogin({ idToken: 'tok' }, fakeVerify());
    const d1 = jwt.decode(t1);
    const d2 = jwt.decode(t2);
    assert.strictEqual(d1.id, d2.id, 'same user on second login');
  });

  it('should auto-link Google to an existing password account sharing the same email', async () => {
    const user = await authService.register({
      username: 'alice',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'guser@gmail.com',
      consent: VALID_CONSENT,
    });
    const { token } = await authService.googleLogin({ idToken: 'tok' }, fakeVerify());
    const decoded = jwt.decode(token);
    assert.strictEqual(decoded.id, user.id, 'same user id after auto-link');
    assert.strictEqual(decoded.username, 'alice');
  });

  it('should allow linking Google via Settings then unlinking (user has password)', async () => {
    const user = await authService.register({
      username: 'bob',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'bob@gmail.com',
      consent: VALID_CONSENT,
    });
    const verify = fakeVerify('g-sub-bob', 'bob@gmail.com');

    const linkResult = await authService.linkGoogle({ userId: user.id, idToken: 'tok' }, verify);
    assert.match(linkResult.message, /linked/i);

    const unlinkResult = await authService.unlinkGoogle({ userId: user.id });
    assert.match(unlinkResult.message, /unlinked/i);
  });

  it('should refuse unlinking Google when user has no password', async () => {
    const { token } = await authService.googleLogin({ idToken: 'tok' }, fakeVerify());
    const { id } = jwt.decode(token);
    await assert.rejects(
      () => authService.unlinkGoogle({ userId: id }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should return authProviders and hasPassword via getProviders', async () => {
    const { token } = await authService.googleLogin({ idToken: 'tok' }, fakeVerify());
    const { id } = jwt.decode(token);
    const result = await authService.getProviders({ userId: id });
    assert.deepStrictEqual(result.authProviders, ['google']);
    assert.strictEqual(result.hasPassword, false);
  });

  it('should return password provider and hasPassword=true for a normal user', async () => {
    const user = await authService.register({
      username: 'carol',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'carol@example.com',
      consent: VALID_CONSENT,
    });
    const result = await authService.getProviders({ userId: user.id });
    assert.deepStrictEqual(result.authProviders, ['password']);
    assert.strictEqual(result.hasPassword, true);
  });
});
