'use strict';

const {
  request,
  expect,
  BASE_URL,
  uniqueUsername,
  createAndLoginUser,
  verifyUserInDb,
} = require('../base/api-base');

const VALID_CONSENT = { policyVersion: '2026-05-20', acceptedAt: new Date().toISOString() };

async function registerAndLogin(prefix, password = 'Zx7Qw2vNp9Lm4Rk8') {
  const username = uniqueUsername(prefix);
  const email = `${username}@test.com`;
  const regRes = await request(BASE_URL)
    .post('/api/auth/register')
    .send({ username, password, email, consent: VALID_CONSENT });
  expect(regRes.status).to.equal(201);
  await verifyUserInDb(regRes.body.id);
  const loginRes = await request(BASE_URL).post('/api/auth/login').send({ username, password });
  return { username, password, token: loginRes.body.token };
}

describe('US-XX - Data Subject Rights', () => {
  describe('GET /api/auth/me/export', () => {
    it('[TC-DR-01] should return 200 with user data structure', async () => {
      const token = await createAndLoginUser('export');
      const res = await request(BASE_URL)
        .get('/api/auth/me/export')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('user');
      expect(res.body).to.have.property('expenses');
      expect(res.body).to.have.property('reminders');
      expect(res.body.user).to.not.have.property('password');
      expect(res.body.user).to.not.have.property('emailVerificationToken');
    });
  });

  describe('DELETE /api/auth/me', () => {
    it('[TC-DR-02] should return 204 and delete account with correct password', async () => {
      const { password, token } = await registerAndLogin('del');

      const deleteRes = await request(BASE_URL)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password });
      expect(deleteRes.status).to.equal(204);

      // Token is now invalid — user deleted
      const exportRes = await request(BASE_URL)
        .get('/api/auth/me/export')
        .set('Authorization', `Bearer ${token}`);
      expect(exportRes.status).to.be.oneOf([401, 403, 404, 500]);
    });

    it('[TC-DR-03] should return 401 with wrong password', async () => {
      const { token } = await registerAndLogin('delwrong');

      const deleteRes = await request(BASE_URL)
        .delete('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'WrongPassword1' });
      expect(deleteRes.status).to.equal(401);
    });
  });

  describe('GET /api/auth/me/access', () => {
    it('[TC-DR-04] should return 200 with data treatment disclosure', async () => {
      const token = await createAndLoginUser('access');
      const res = await request(BASE_URL)
        .get('/api/auth/me/access')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('dataController');
      expect(res.body).to.have.property('dpoContact');
      expect(res.body).to.have.property('retention');
    });
  });
});
