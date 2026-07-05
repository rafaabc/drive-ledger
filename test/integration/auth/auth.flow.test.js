'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const { VALID_CONSENT } = require('../../helpers/fixtures');
require('../../helpers/email-mock');
const authService = require('../../../lib/services/auth.service');

const STRONG_PASSWORD = 'Zx7$Qw2vNp9!Lm4';
const STRONG_PASSWORD_OTHER = 'Hb3#Ty8xRk1!Vn6';

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

describe('Auth flow integration', () => {
  // TC-01-01
  it('should persist registered user so a subsequent login succeeds', async () => {
    await authService.register({
      username: 'testuser',
      password: STRONG_PASSWORD,
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    const { token } = await authService.login({ username: 'testuser', password: STRONG_PASSWORD });
    assert.ok(token, 'login must return a token for the just-registered user');
  });

  // TC-01-03
  it('should reject duplicate username registration with "already taken" message', async () => {
    await authService.register({
      username: 'testuser',
      password: STRONG_PASSWORD,
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    await assert.rejects(
      () =>
        authService.register({
          username: 'testuser',
          password: STRONG_PASSWORD_OTHER,
          email: 'testuser2@example.com',
          consent: VALID_CONSENT,
        }),
      (err) => {
        assert.strictEqual(err.status, 409);
        assert.match(err.message, /already taken/i);
        return true;
      },
    );
  });

  // TC-02-01
  it('should return an access token when valid credentials are provided', async () => {
    await authService.register({
      username: 'testuser',
      password: STRONG_PASSWORD,
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    const result = await authService.login({ username: 'testuser', password: STRONG_PASSWORD });
    assert.ok(result.token);
    assert.strictEqual(typeof result.token, 'string');
    assert.ok(result.token.length > 0);
  });

  // TC-02-04
  it('should return a well-formed JWT with user identity claims', async () => {
    const user = await authService.register({
      username: 'testuser',
      password: STRONG_PASSWORD,
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    const { token } = await authService.login({ username: 'testuser', password: STRONG_PASSWORD });
    const segments = token.split('.');
    const decoded = jwt.decode(token);
    assert.strictEqual(segments.length, 3);
    assert.strictEqual(decoded.id, user.id);
    assert.strictEqual(decoded.username, 'testuser');
    assert.ok(decoded.iat);
    assert.ok(decoded.exp);
  });

  it('should persist language preference and return it in the next JWT', async () => {
    const { id } = await authService.register({
      username: 'langflow',
      password: STRONG_PASSWORD,
      email: 'langflow@x.com',
      consent: VALID_CONSENT,
    });

    const { token } = await authService.updateLanguage({ id, language: 'en' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.strictEqual(payload.language, 'en');

    const { token: token2 } = await authService.login({
      username: 'langflow',
      password: STRONG_PASSWORD,
    });
    const payload2 = jwt.verify(token2, process.env.JWT_SECRET);
    assert.strictEqual(payload2.language, 'en');
  });

  // TC-02-08 — superseded by account lockout hardening: 5 consecutive failed
  // attempts now locks the account instead of allowing an immediate correct-password
  // recovery. See authService.login() — account lockout unit tests for full coverage.
  it('should lock account after 5 consecutive failed login attempts, rejecting the correct password too', async () => {
    await authService.register({
      username: 'testuser',
      password: STRONG_PASSWORD,
      email: 'testuser@example.com',
      consent: VALID_CONSENT,
    });
    for (let i = 0; i < 5; i++) {
      await assert.rejects(
        () => authService.login({ username: 'testuser', password: 'wrongpass' }),
        { status: 401 },
      );
    }
    await assert.rejects(
      () => authService.login({ username: 'testuser', password: STRONG_PASSWORD }),
      { status: 401 },
    );
  });
});
