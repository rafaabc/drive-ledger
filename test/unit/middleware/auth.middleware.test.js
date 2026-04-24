'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const authMiddleware = require('../../../src/middleware/auth.middleware');

const SECRET = process.env.JWT_SECRET;

function makeReq(authHeader) {
  return { headers: { authorization: authHeader } };
}

function makeRes() {
  const res = { _status: null, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

describe('authMiddleware', () => {
  it('should call next() and set req.user when token is valid', (_, done) => {
    const payload = { id: 1, username: 'alice' };
    const token = jwt.sign(payload, SECRET, { expiresIn: '1h' });
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    authMiddleware(req, res, () => {
      assert.ok(req.user);
      assert.strictEqual(req.user.id, payload.id);
      assert.strictEqual(req.user.username, payload.username);
      done();
    });
  });

  it('should respond with 401 when Authorization header is missing', (_, done) => {
    const req = makeReq(undefined);
    const res = makeRes();

    authMiddleware(req, res, () => {
      assert.fail('next() should not have been called');
    });

    setImmediate(() => {
      assert.strictEqual(res._status, 401);
      assert.match(res._body.message, /not provided/i);
      done();
    });
  });

  it('should respond with 401 when Authorization header has no token after Bearer', (_, done) => {
    const req = makeReq('Bearer ');
    const res = makeRes();

    authMiddleware(req, res, () => {
      assert.fail('next() should not have been called');
    });

    setImmediate(() => {
      assert.strictEqual(res._status, 401);
      done();
    });
  });

  it('should respond with 403 when token is invalid', (_, done) => {
    const req = makeReq('Bearer this.is.not.valid');
    const res = makeRes();

    authMiddleware(req, res, () => {
      assert.fail('next() should not have been called');
    });

    setTimeout(() => {
      assert.strictEqual(res._status, 403);
      assert.match(res._body.message, /invalid or expired/i);
      done();
    }, 50);
  });

  it('should respond with 403 when token is expired', (_, done) => {
    const token = jwt.sign({ id: 1 }, SECRET, { expiresIn: -1 });
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    authMiddleware(req, res, () => {
      assert.fail('next() should not have been called');
    });

    setTimeout(() => {
      assert.strictEqual(res._status, 403);
      assert.match(res._body.message, /invalid or expired/i);
      done();
    }, 50);
  });
});
