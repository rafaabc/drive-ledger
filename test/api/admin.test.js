'use strict';

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { request, expect, createAndLoginUser } = require('./base/api-base');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function promoteToAdmin(userId) {
  const UserM = mongoose.model('User');
  await UserM.findByIdAndUpdate(userId, { role: 'admin' });
}

describe('Admin API', function () {
  this.timeout(20000);
  let userToken, adminToken, adminUserId, targetUserId;

  before(async () => {
    userToken = await createAndLoginUser('adminregu');

    adminToken = await createAndLoginUser('adminrega');
    adminUserId = jwt.decode(adminToken).id;
    await promoteToAdmin(adminUserId);

    targetUserId = jwt.decode(userToken).id;
  });

  describe('GET /api/admin/users', () => {
    it('[TC-AD-01] returns 401 when token missing', async () => {
      const res = await request(BASE_URL).get('/api/admin/users');
      expect(res.status).to.equal(401);
    });

    it('[TC-AD-02] returns 403 for a non-admin user', async () => {
      const res = await request(BASE_URL)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).to.equal(403);
    });

    it('[TC-AD-03] returns the user list for an admin, without password fields', async () => {
      const res = await request(BASE_URL)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array');
      const found = res.body.find((u) => u.id === targetUserId || u._id === targetUserId);
      expect(found).to.exist;
      expect(found).to.not.have.property('password');
    });
  });

  describe('PATCH /api/admin/users/:id/plan', () => {
    it('[TC-AD-04] returns 401 when token missing', async () => {
      const res = await request(BASE_URL).patch(`/api/admin/users/${targetUserId}/plan`);
      expect(res.status).to.equal(401);
    });

    it('[TC-AD-05] returns 403 for a non-admin user', async () => {
      const res = await request(BASE_URL)
        .patch(`/api/admin/users/${targetUserId}/plan`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ plan: 'pro' });
      expect(res.status).to.equal(403);
    });

    it('[TC-AD-06] lets an admin change another user plan to pro and back to free', async () => {
      const res = await request(BASE_URL)
        .patch(`/api/admin/users/${targetUserId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'pro' });
      expect(res.status).to.equal(200);
      expect(res.body.plan).to.equal('pro');
      expect(res.body.planSource).to.equal('manual');

      const res2 = await request(BASE_URL)
        .patch(`/api/admin/users/${targetUserId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'free' });
      expect(res2.status).to.equal(200);
      expect(res2.body.plan).to.equal('free');
    });

    it('[TC-AD-07] rejects an invalid plan value from an admin', async () => {
      const res = await request(BASE_URL)
        .patch(`/api/admin/users/${targetUserId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'ultra' });
      expect(res.status).to.equal(400);
    });
  });
});
