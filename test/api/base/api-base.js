'use strict';

const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');

// Register models with this mongoose instance (no connection needed at require time)
require('../../../lib/models/user.model.js');
require('../../../lib/models/expense.model.js');
require('../../../lib/models/reminder.model.js');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const CATEGORIES = ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];

const VALID_CONSENT = { policyVersion: '2026-05-20', acceptedAt: new Date().toISOString() };

let authToken = null;
let authUser = null;
let counter = 0;

// Tracks every userId created by this test suite for cleanup in after()
const createdUserIds = [];

function uniqueUsername(prefix) {
  return `${prefix}_${Date.now()}_${counter++}`;
}

function getToken() {
  return authToken;
}
function getUser() {
  return authUser;
}

function authHeader() {
  return { Authorization: `Bearer ${getToken()}` };
}

// Registers a user, tracks their ID for cleanup, returns the full supertest response.
async function registerAndTrack(username, password, email) {
  const res = await request(BASE_URL)
    .post('/api/auth/register')
    .send({ username, password, email: email || `${username}@test.com`, consent: VALID_CONSENT });

  if (res.status === 201 && res.body.id) {
    createdUserIds.push(res.body.id);
  }
  return res;
}

// Registers + logs in a fresh user; tracks them for cleanup; returns token only.
async function createAndLoginUser(prefix) {
  const username = uniqueUsername(prefix);
  const password = 'Zx7Qw2vNp9Lm4Rk8';
  const email = `${username}@test.com`;

  const regRes = await request(BASE_URL)
    .post('/api/auth/register')
    .send({ username, password, email, consent: VALID_CONSENT });

  if (regRes.status === 201 && regRes.body.id) {
    createdUserIds.push(regRes.body.id);
    await verifyUserInDb(regRes.body.id);
  }

  const loginRes = await request(BASE_URL).post('/api/auth/login').send({ username, password });

  return loginRes.body.token;
}

// Marks a user as email-verified directly in the DB (bypasses email flow in tests).
async function verifyUserInDb(userId) {
  const UserM = mongoose.model('User');
  await UserM.findByIdAndUpdate(userId, { emailVerified: true });
}

// Root-suite before() — runs once before all test files.
before(async function () {
  this.timeout(15000);

  // Open DB connection first so we can mark users as verified after registration.
  await mongoose.connect(process.env.MONGODB_URI);

  const username = uniqueUsername('primary');
  const password = 'Zx7Qw2vNp9Lm4Rk8';
  const email = `${username}@test.com`;

  const regRes = await request(BASE_URL)
    .post('/api/auth/register')
    .send({ username, password, email, consent: VALID_CONSENT })
    .catch(() => null);

  if (!regRes) {
    throw new Error(
      `API server not reachable at ${BASE_URL}. Run "npm run dev" in a separate terminal before running the API test suite.`,
    );
  }

  expect(regRes.status, 'primary user registration failed').to.equal(201);

  createdUserIds.push(regRes.body.id);
  await verifyUserInDb(regRes.body.id);

  const loginRes = await request(BASE_URL).post('/api/auth/login').send({ username, password });

  expect(loginRes.status, 'primary user login failed').to.equal(200);

  authToken = loginRes.body.token;
  authUser = { username, password, id: regRes.body.id };
});

// Root-suite after() — deletes only the users (and their expenses) created by this suite.
after(async function () {
  this.timeout(30000);
  try {
    const UserM = mongoose.model('User');
    const ExpenseM = mongoose.model('Expense');
    const ReminderM = mongoose.model('Reminder');

    for (const id of createdUserIds) {
      const oid = new mongoose.Types.ObjectId(id);
      await ExpenseM.deleteMany({ userId: oid });
      await ReminderM.deleteMany({ userId: oid });
      await UserM.findByIdAndDelete(oid);
    }
  } catch (err) {
    console.warn('[api-base] Cleanup warning:', err.message);
  } finally {
    await Promise.race([
      mongoose.connection.close(true),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
  }
});

module.exports = {
  request,
  expect,
  BASE_URL,
  CATEGORIES,
  getToken,
  getUser,
  uniqueUsername,
  authHeader,
  createAndLoginUser,
  registerAndTrack,
  verifyUserInDb,
};
