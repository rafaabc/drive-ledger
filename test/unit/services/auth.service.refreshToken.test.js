'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const jwt = require('jsonwebtoken');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const userModel = require('../../../lib/models/user.model');
const authService = require('../../../lib/services/auth.service');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

describe('authService.refreshToken()', () => {
  it('re-issues a JWT reflecting the current DB plan', async () => {
    const user = await userModel.create({
      username: 'refreshuser1',
      password: 'x',
      email: 'refreshuser1@test.com',
      plan: 'free',
    });

    await userModel.updatePlanAndBilling(user._id, { plan: 'pro' });

    const { token } = await authService.refreshToken({ id: user._id.toString() });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert.strictEqual(decoded.plan, 'pro');
  });

  it('rejects an id that does not exist', async () => {
    const fakeId = '000000000000000000000000';
    await assert.rejects(
      () => authService.refreshToken({ id: fakeId }),
      (err) => err.status === 404,
    );
  });
});
