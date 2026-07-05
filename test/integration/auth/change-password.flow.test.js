'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const { VALID_CONSENT } = require('../../helpers/fixtures');
require('../../helpers/email-mock');
const authService = require('../../../lib/services/auth.service');

const STRONG_PASSWORD = 'Zx7$Qw2vNp9!Lm4';

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => {
  await resetMongo();
  await authService.register({
    username: 'testuser',
    password: STRONG_PASSWORD,
    email: 'testuser@example.com',
    consent: VALID_CONSENT,
  });
});

describe('Change-password flow integration', () => {
  it('should allow login with new password after change', async () => {
    await authService.changePassword({
      username: 'testuser',
      currentPassword: STRONG_PASSWORD,
      newPassword: 'newPass99',
    });
    const { token } = await authService.login({ username: 'testuser', password: 'newPass99' });
    assert.ok(token, 'login with new password must return a token');
  });

  it('should reject login with old password after change', async () => {
    await authService.changePassword({
      username: 'testuser',
      currentPassword: STRONG_PASSWORD,
      newPassword: 'newPass99',
    });
    await assert.rejects(
      () => authService.login({ username: 'testuser', password: STRONG_PASSWORD }),
      (err) => {
        assert.strictEqual(err.status, 401);
        return true;
      },
    );
  });
});
