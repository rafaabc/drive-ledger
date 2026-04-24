'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const authMiddleware = require('../../../src/middleware/auth.middleware');
const authService = require('../../../src/services/auth.service');
const { createExpense, listExpenses } = require('../../../src/services/expenses.service');
const userModel = require('../../../src/models/user.model');
const expenseModel = require('../../../src/models/expense.model');

const TODAY = new Date().toISOString().slice(0, 10);

function makeRes() {
  const res = { _status: null, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

beforeEach(() => {
  userModel._reset();
  expenseModel._reset();
});

describe('Auth middleware → service hand-off integration', () => {
  // TC-02-07
  it('should reject request with missing token and not call next', (_, done) => {
    // Arrange
    const req = { headers: {} };
    const res = makeRes();
    let nextCalled = false;

    // Act
    authMiddleware(req, res, () => { nextCalled = true; });

    // Assert — synchronous rejection, readable in next tick
    setImmediate(() => {
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res._status, 401);
      assert.match(res._body.message, /not provided/i);
      done();
    });
  });

  // TC-02-06
  it('should reject expired token and not call next', (_, done) => {
    // Arrange
    const token = jwt.sign({ id: 1, username: 'rafael' }, process.env.JWT_SECRET, { expiresIn: -1 });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    let nextCalled = false;

    // Act
    authMiddleware(req, res, () => { nextCalled = true; });

    // Assert — jwt.verify callback is asynchronous
    setTimeout(() => {
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res._status, 403);
      assert.match(res._body.message, /invalid or expired/i);
      done();
    }, 50);
  });

  it('should decode a valid token and hand off user id to the service layer', async () => {
    // Arrange
    const user = await authService.register({ username: 'rafael', password: 'password1' });
    const { token } = await authService.login({ username: 'rafael', password: 'password1' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();

    // Act — invoke middleware; perform service calls inside next() using decoded req.user
    let nextCalled = false;
    let created;
    let listed;

    await new Promise((resolve, reject) => {
      authMiddleware(req, res, () => {
        try {
          nextCalled = true;
          created = createExpense(req.user.id, { category: 'Parking', amount: 5, date: TODAY });
          listed = listExpenses(req.user.id, {});
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });

    // Assert
    assert.ok(nextCalled);
    assert.strictEqual(req.user.id, user.id);
    assert.strictEqual(listed.length, 1);
    assert.strictEqual(listed[0].id, created.id);
  });
});
