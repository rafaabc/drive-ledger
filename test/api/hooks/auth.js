'use strict';

const request = require('supertest');
const { expect } = require('chai');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let authToken = null;
let authUser = null;
let counter = 0;

function uniqueUsername(prefix) {
  return `${prefix}_${Date.now()}_${counter++}`;
}

exports.getToken = () => authToken;
exports.getUser = () => authUser;
exports.uniqueUsername = uniqueUsername;

// Root-suite before() — runs once before all test files.
// Loaded via the "file" option in .mocharc.js so mocha processes it as a test file.
before(async function () {
  this.timeout(15000);

  const username = uniqueUsername('primary');
  const password = 'Password1';

  const regRes = await request(BASE_URL)
    .post('/api/auth/register')
    .send({ username, password })
    .catch(() => null);

  if (!regRes) {
    throw new Error(
      `API server not reachable at ${BASE_URL}. Run "npm run dev" in a separate terminal before running the API test suite.`
    );
  }

  expect(regRes.status, 'primary user registration failed').to.equal(201);

  const loginRes = await request(BASE_URL)
    .post('/api/auth/login')
    .send({ username, password });

  expect(loginRes.status, 'primary user login failed').to.equal(200);

  authToken = loginRes.body.token;
  authUser = { username, password, id: regRes.body.id };
});
