'use strict';

const { request, expect, BASE_URL, createAndLoginUser } = require('../base/api-base');

// ─── US-05: Change Password ───────────────────────────────────────────────────

describe('US-05 - Change Password', () => {
  describe('PATCH /api/auth/password', () => {
    it('[TC-05-01] should return 200 when token is valid and credentials are correct', async () => {
      const token = await createAndLoginUser('tc0501');

      const res = await request(BASE_URL)
        .patch('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Zx7Qw2vNp9Lm4Rk8', newPassword: 'Hb3Ty8xRk1Vn6Zq5' });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('message').that.is.a('string');
    });

    it('[TC-05-02] should return 401 when no token is provided', async () => {
      const res = await request(BASE_URL)
        .patch('/api/auth/password')
        .send({ currentPassword: 'Zx7Qw2vNp9Lm4Rk8', newPassword: 'Hb3Ty8xRk1Vn6Zq5' });

      expect(res.status).to.equal(401);
    });

    it('[TC-05-03] should return 401 when currentPassword is wrong', async () => {
      const token = await createAndLoginUser('tc0503');

      const res = await request(BASE_URL)
        .patch('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongPass1', newPassword: 'Hb3Ty8xRk1Vn6Zq5' });

      expect(res.status).to.equal(401);
    });

    it('[TC-05-04] should return 400 when newPassword is too short', async () => {
      const token = await createAndLoginUser('tc0504');

      const res = await request(BASE_URL)
        .patch('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Zx7Qw2vNp9Lm4Rk8', newPassword: 'short' });

      expect(res.status).to.equal(400);
    });

    it('[TC-05-05] should return 400 when required fields are missing', async () => {
      const token = await createAndLoginUser('tc0505');

      const res = await request(BASE_URL)
        .patch('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).to.equal(400);
    });
  });
});
