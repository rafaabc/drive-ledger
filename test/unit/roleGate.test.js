'use strict';

const mongoose = require('mongoose');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startMongo, stopMongo, resetMongo } = require('../helpers/mongo');
const userModel = require('../../lib/models/user.model');
const { assertAdmin } = require('../../lib/roleGate.js');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

describe('assertAdmin()', () => {
  it('does not throw when the user has role admin', async () => {
    const user = await userModel.create({
      username: 'admin1',
      password: 'hashed',
      email: 'admin1@example.com',
      role: 'admin',
    });
    await assert.doesNotReject(() => assertAdmin(user._id));
  });

  it('throws 403 admin_required when the user has role user', async () => {
    const user = await userModel.create({
      username: 'user1',
      password: 'hashed',
      email: 'user1@example.com',
    });
    await assert.rejects(
      () => assertAdmin(user._id),
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.strictEqual(err.message, 'admin_required');
        return true;
      },
    );
  });

  it('throws 403 admin_required when the user does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await assert.rejects(
      () => assertAdmin(fakeId),
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.strictEqual(err.message, 'admin_required');
        return true;
      },
    );
  });
});
