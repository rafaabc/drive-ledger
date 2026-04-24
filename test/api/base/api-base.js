'use strict';

const request = require('supertest');
const { expect } = require('chai');
const { getToken, uniqueUsername } = require('../hooks/auth');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const CATEGORIES = ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];

function authHeader() {
  return { Authorization: `Bearer ${getToken()}` };
}

async function createAndLoginUser(prefix) {
  const username = uniqueUsername(prefix);
  const password = 'Password1';

  await request(BASE_URL)
    .post('/api/auth/register')
    .send({ username, password });

  const loginRes = await request(BASE_URL)
    .post('/api/auth/login')
    .send({ username, password });

  return loginRes.body.token;
}

module.exports = { request, expect, BASE_URL, CATEGORIES, authHeader, createAndLoginUser };
