'use strict';

const mongoose = require('mongoose');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const userModel = require('../../../lib/models/user.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

describe('userModel.create()', () => {
  it('should create a user with a unique _id', async () => {
    const user = await userModel.create({
      username: 'alice',
      password: 'hashed',
      email: 'alice@example.com',
    });
    assert.ok(user._id);
    assert.strictEqual(user.username, 'alice');
  });

  it('should populate createdAt and updatedAt timestamps', async () => {
    const user = await userModel.create({
      username: 'ts_user',
      password: 'hashed',
      email: 'ts@example.com',
    });
    assert.ok(user.createdAt instanceof Date, 'createdAt should be a Date');
    assert.ok(user.updatedAt instanceof Date, 'updatedAt should be a Date');
  });

  it('should assign distinct _ids to multiple users', async () => {
    const first = await userModel.create({
      username: 'alice',
      password: 'hashed',
      email: 'alice@example.com',
    });
    const second = await userModel.create({
      username: 'bob',
      password: 'hashed',
      email: 'bob@example.com',
    });
    assert.notStrictEqual(first._id.toString(), second._id.toString());
  });
});

describe('userModel.findByUsername()', () => {
  it('should return the user when the username matches', async () => {
    await userModel.create({ username: 'alice', password: 'hashed', email: 'alice@example.com' });
    const found = await userModel.findByUsername('alice');
    assert.ok(found);
    assert.strictEqual(found.username, 'alice');
  });

  it('should return null when the username does not exist', async () => {
    const found = await userModel.findByUsername('nobody');
    assert.strictEqual(found, null);
  });
});

describe('userModel.findByEmail()', () => {
  it('should return the user when the email matches', async () => {
    await userModel.create({ username: 'alice', password: 'hashed', email: 'alice@example.com' });
    const found = await userModel.findByEmail('alice@example.com');
    assert.ok(found);
    assert.strictEqual(found.email, 'alice@example.com');
  });

  it('should return null when the email does not exist', async () => {
    const found = await userModel.findByEmail('nobody@example.com');
    assert.strictEqual(found, null);
  });
});

describe('userModel.findById()', () => {
  it('should return the user when id matches', async () => {
    const created = await userModel.create({
      username: 'alice',
      password: 'hashed',
      email: 'alice@example.com',
    });
    const found = await userModel.findById(created._id);
    assert.ok(found);
    assert.strictEqual(found.username, 'alice');
  });

  it('should return null when id does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const found = await userModel.findById(fakeId);
    assert.strictEqual(found, null);
  });
});

describe('userModel._reset()', () => {
  it('should clear all users from the collection', async () => {
    await userModel.create({ username: 'alice', password: 'hashed', email: 'alice@example.com' });
    await userModel._reset();
    const found = await userModel.findByUsername('alice');
    assert.strictEqual(found, null);
  });
});

describe('userModel.updatePassword()', () => {
  it('should persist hashed password to the user document', async () => {
    await userModel.create({
      username: 'alice',
      password: 'original_hash',
      email: 'alice@example.com',
    });
    await userModel.updatePassword('alice', 'new_hash');
    const found = await userModel.findByUsername('alice');
    assert.strictEqual(found.password, 'new_hash');
  });
});

describe('userModel language field', () => {
  it('should default language to pt-BR', async () => {
    const user = await userModel.create({ username: 'lang1', password: 'h', email: 'lang1@x.com' });
    assert.strictEqual(user.language, 'pt-BR');
  });

  it('should reject an unsupported language value', async () => {
    await assert.rejects(
      () =>
        userModel.create({
          username: 'lang2',
          password: 'h',
          email: 'lang2@x.com',
          language: 'fr',
        }),
      /language/i,
    );
  });

  it('should persist and retrieve updateLanguage', async () => {
    const user = await userModel.create({ username: 'lang3', password: 'h', email: 'lang3@x.com' });
    await userModel.updateLanguage(user._id, 'en');
    const found = await userModel.findById(user._id);
    assert.strictEqual(found.language, 'en');
  });
});

describe('userModel — odometer', () => {
  it('should default currentKm to 0 and currentKmUpdatedAt to undefined', async () => {
    const user = await userModel.create({
      username: 'odo1',
      password: 'x',
      email: 'odo1@test.com',
    });
    assert.strictEqual(user.currentKm, 0);
    assert.strictEqual(user.currentKmUpdatedAt, undefined);
  });

  it('should update currentKm and currentKmUpdatedAt via updateOdometerAndReturn', async () => {
    const user = await userModel.create({
      username: 'odo2',
      password: 'x',
      email: 'odo2@test.com',
    });
    const updated = await userModel.updateOdometerAndReturn(user._id, 12345);
    assert.strictEqual(updated.currentKm, 12345);
    assert.ok(updated.currentKmUpdatedAt instanceof Date);
  });
});

describe('userModel — account lockout', () => {
  it('should default failedLoginAttempts to 0 for a new user', async () => {
    const user = await userModel.create({
      username: 'lockout1',
      password: 'hashed',
      email: 'lockout1@example.com',
    });
    assert.strictEqual(user.failedLoginAttempts, 0);
  });

  it('incrementFailedLogins() should atomically bump the counter and return the updated doc', async () => {
    const user = await userModel.create({
      username: 'lockout2',
      password: 'hashed',
      email: 'lockout2@example.com',
    });
    await userModel.incrementFailedLogins(user._id);
    const updated = await userModel.incrementFailedLogins(user._id);
    assert.strictEqual(updated.failedLoginAttempts, 2);
  });

  it('setLockUntil() should set the lockUntil field', async () => {
    const user = await userModel.create({
      username: 'lockout3',
      password: 'hashed',
      email: 'lockout3@example.com',
    });
    const until = new Date(Date.now() + 60_000);
    await userModel.setLockUntil(user._id, until);
    const found = await userModel.findByUsername('lockout3');
    assert.strictEqual(found.lockUntil.getTime(), until.getTime());
  });

  it('resetFailedLogins() should zero the counter and clear lockUntil', async () => {
    const user = await userModel.create({
      username: 'lockout4',
      password: 'hashed',
      email: 'lockout4@example.com',
    });
    await userModel.incrementFailedLogins(user._id);
    await userModel.setLockUntil(user._id, new Date(Date.now() + 60_000));
    await userModel.resetFailedLogins(user._id);
    const found = await userModel.findByUsername('lockout4');
    assert.strictEqual(found.failedLoginAttempts, 0);
    assert.strictEqual(found.lockUntil, undefined);
  });

  it('toJSON should strip failedLoginAttempts and lockUntil', async () => {
    const user = await userModel.create({
      username: 'lockout5',
      password: 'hashed',
      email: 'lockout5@example.com',
    });
    await userModel.setLockUntil(user._id, new Date(Date.now() + 60_000));
    const found = await userModel.findByUsername('lockout5');
    const json = found.toJSON();
    assert.strictEqual(json.failedLoginAttempts, undefined);
    assert.strictEqual(json.lockUntil, undefined);
  });
});
