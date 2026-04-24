'use strict';

const jwt = require('jsonwebtoken');
const { request, expect, BASE_URL } = require('../base/api-base');
const { getToken, getUser, uniqueUsername } = require('../hooks/auth');
const fixtures = require('../fixtures/auth.json');

function exactUsername(len) {
  // Put random digits first so short slices (len=3) get high-entropy chars,
  // not the stable leading digits of the timestamp.
  const rand = String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const ts = String(Date.now());
  const seed = rand + ts; // 22 alphanumeric chars
  if (len <= seed.length) return seed.slice(0, len);
  return seed.padEnd(len, 'a');
}

// ─── US-01: User Registration ─────────────────────────────────────────────────

describe('US-01 - User Registration', () => {
  describe('POST /api/auth/register', () => {

    it('[TC-01-01] should return 201 with id and username when credentials are valid', async () => {
      const res = await request(BASE_URL)
        .post('/api/auth/register')
        .send({ username: uniqueUsername('tc0101'), password: 'Password1' });

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('id').that.is.a('number');
      expect(res.body).to.have.property('username').that.is.a('string');
    });

    it('[TC-01-02] should return 409 when username is already taken', async () => {
      const username = uniqueUsername('tc0102');
      await request(BASE_URL).post('/api/auth/register').send({ username, password: 'Password1' });

      const res = await request(BASE_URL)
        .post('/api/auth/register')
        .send({ username, password: 'Password1' });

      expect(res.status).to.equal(409);
    });

    it('[TC-01-03] should include an error message in the response body when username is duplicate', async () => {
      const username = uniqueUsername('tc0103');
      await request(BASE_URL).post('/api/auth/register').send({ username, password: 'Password1' });

      const res = await request(BASE_URL)
        .post('/api/auth/register')
        .send({ username, password: 'Password1' });

      expect(res.body).to.have.property('message').that.is.a('string');
    });

    // Parametrized invalid registration cases (TC-01-04, 05, 07, 09, 11, 12, 14, 16)
    fixtures.invalidRegistrations.forEach(({ tcId, description, body, usernameLength, password, expectedStatus, expectedMessage }) => {
      it(`[${tcId}] should return ${expectedStatus} when ${description}`, async () => {
        const payload = body || { username: exactUsername(usernameLength), password };

        const res = await request(BASE_URL)
          .post('/api/auth/register')
          .send(payload);

        expect(res.status).to.equal(expectedStatus);
        if (expectedMessage) {
          expect(res.body).to.have.property('message', expectedMessage);
        }
      });
    });

    it('[TC-01-08] should return 201 when password has exactly 8 characters', async () => {
      const res = await request(BASE_URL)
        .post('/api/auth/register')
        .send({ username: uniqueUsername('tc0108'), password: 'Pass1234' });

      expect(res.status).to.equal(201);
    });

    it('[TC-01-10] should return 201 when username has exactly 3 characters', async () => {
      const res = await request(BASE_URL)
        .post('/api/auth/register')
        .send({ username: exactUsername(3), password: 'Password1' });

      expect(res.status).to.equal(201);
    });

    it('[TC-01-13] should return 201 when username contains alphanumeric characters and underscores', async () => {
      const username = uniqueUsername('v_u').replace(/-/g, '_').slice(0, 50);

      const res = await request(BASE_URL)
        .post('/api/auth/register')
        .send({ username, password: 'Password1' });

      expect(res.status).to.equal(201);
    });

    it('[TC-01-15] should return 201 when username has exactly 50 characters', async () => {
      const res = await request(BASE_URL)
        .post('/api/auth/register')
        .send({ username: exactUsername(50), password: 'Password1' });

      expect(res.status).to.equal(201);
    });

    it('[TC-01-17] should return 201 when password has exactly 20 characters', async () => {
      const res = await request(BASE_URL)
        .post('/api/auth/register')
        .send({ username: uniqueUsername('tc0117'), password: 'Password1234567890ab'.slice(0, 20) });

      expect(res.status).to.equal(201);
    });
  });
});

// ─── US-02: User Login ────────────────────────────────────────────────────────

describe('US-02 - User Login', () => {
  describe('POST /api/auth/login', () => {

    it('[TC-02-01] should return 200 and a token when credentials are valid', async () => {
      const { username, password } = getUser();

      const res = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username, password });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('token').that.is.a('string');
    });

    it('[TC-02-02] should return 401 when password is invalid', async () => {
      const { username } = getUser();

      const res = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username, password: 'WrongPassword1' });

      expect(res.status).to.equal(401);
    });

    it('[TC-02-03] should return 401 when username does not exist', async () => {
      const res = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username: 'nonexistent_user_xyz', password: 'Password1' });

      expect(res.status).to.equal(401);
    });

    it('[TC-02-04] should return a token in JWT format (three dot-separated base64url segments)', async () => {
      const token = getToken();
      const parts = token.split('.');

      expect(parts).to.have.lengthOf(3);
      parts.forEach(part => expect(part).to.match(/^[A-Za-z0-9_-]+$/));
    });

    it('[TC-02-05] should issue a JWT that expires in exactly 1 hour (exp - iat = 3600)', async () => {
      const token = getToken();
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

      expect(payload).to.have.property('iat').that.is.a('number');
      expect(payload).to.have.property('exp').that.is.a('number');
      expect(payload.exp - payload.iat).to.equal(3600);
    });

    it('[TC-02-08] should not lock out the account after multiple failed login attempts', async () => {
      const { username, password } = getUser();

      for (let i = 0; i < 5; i++) {
        await request(BASE_URL)
          .post('/api/auth/login')
          .send({ username, password: 'WrongPassword!' });
      }

      const res = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username, password });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('token');
    });
  });

  describe('Authentication middleware (JWT)', () => {

    it('[TC-02-06] should return 403 when an expired token is presented', async () => {
      const expiredToken = jwt.sign(
        { id: 0, username: 'expired', exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_SECRET
      );

      const res = await request(BASE_URL)
        .get('/api/expenses')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property('message', 'Invalid or expired token');
    });

    it('[TC-02-07] should return 401 when no Authorization header is provided', async () => {
      const res = await request(BASE_URL).get('/api/expenses');

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property('message', 'Token not provided');
    });
  });
});
