'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startMongo, stopMongo, resetMongo } = require('../helpers/mongo');
const userModel = require('../../lib/models/user.model');
const adminService = require('../../lib/services/admin.service');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

async function createAdmin() {
  return userModel.create({
    username: 'admin1',
    password: 'hashed',
    email: 'admin1@example.com',
    role: 'admin',
  });
}

let userCounter = 0;

async function createRegularUser() {
  const n = userCounter++;
  return userModel.create({
    username: `user${n}`,
    password: 'hashed',
    email: `user${n}@example.com`,
  });
}

describe('admin.service', () => {
  describe('listUsers()', () => {
    it('throws 403 admin_required when caller is not an admin', async () => {
      const user = await createRegularUser();
      await assert.rejects(
        () => adminService.listUsers(user._id),
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.message, 'admin_required');
          return true;
        },
      );
    });

    it('returns a plain array of users when caller is an admin', async () => {
      const admin = await createAdmin();
      await createRegularUser();
      const users = await adminService.listUsers(admin._id);
      assert.ok(Array.isArray(users));
      assert.strictEqual(users.length, 2);
    });
  });

  describe('setUserPlan()', () => {
    it('throws 403 admin_required when caller is not an admin', async () => {
      const user = await createRegularUser();
      const target = await createRegularUser();
      await assert.rejects(
        () => adminService.setUserPlan(user._id, target._id, 'pro'),
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.message, 'admin_required');
          return true;
        },
      );
    });

    it('rejects an invalid plan value', async () => {
      const admin = await createAdmin();
      const target = await createRegularUser();
      await assert.rejects(
        () => adminService.setUserPlan(admin._id, target._id, 'ultra'),
        (err) => {
          assert.strictEqual(err.status, 400);
          return true;
        },
      );
    });

    it('throws 404 when targetUserId is a malformed ObjectId', async () => {
      const admin = await createAdmin();
      await assert.rejects(
        () => adminService.setUserPlan(admin._id, 'not-an-object-id', 'pro'),
        (err) => {
          assert.strictEqual(err.status, 404);
          assert.strictEqual(err.message, 'User not found');
          return true;
        },
      );
    });

    it('throws 404 when targetUserId is well-formed but no user exists', async () => {
      const admin = await createAdmin();
      const nonExistentId = new mongoose.Types.ObjectId();
      await assert.rejects(
        () => adminService.setUserPlan(admin._id, nonExistentId, 'pro'),
        (err) => {
          assert.strictEqual(err.status, 404);
          assert.strictEqual(err.message, 'User not found');
          return true;
        },
      );
    });

    it('persists the new plan with planSource "manual" and returns the updated user', async () => {
      const admin = await createAdmin();
      const target = await createRegularUser();
      const updated = await adminService.setUserPlan(admin._id, target._id, 'pro');
      assert.strictEqual(updated.plan, 'pro');
      assert.strictEqual(updated.planSource, 'manual');

      const persisted = await userModel.findById(target._id);
      assert.strictEqual(persisted.plan, 'pro');
      assert.strictEqual(persisted.planSource, 'manual');
    });
  });
});
