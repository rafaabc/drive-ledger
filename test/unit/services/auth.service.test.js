'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const userModel = require('../../../src/models/user.model');
const authService = require('../../../src/services/auth.service');

beforeEach(() => {
  userModel._reset();
});

// ---------------------------------------------------------------------------
// US-01 — User Registration
// ---------------------------------------------------------------------------
describe('authService.register()', () => {
  // TC-01-02
  it('should throw 409 when username is already taken', async () => {
    await authService.register({ username: 'alice', password: 'password1' });
    await assert.rejects(
      () => authService.register({ username: 'alice', password: 'password2' }),
      (err) => {
        assert.strictEqual(err.status, 409);
        assert.match(err.message, /already taken/i);
        return true;
      }
    );
  });

  // TC-01-04
  it('should throw 400 when username is missing', async () => {
    await assert.rejects(
      () => authService.register({ password: 'password1' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username and password are required/i);
        return true;
      }
    );
  });

  // TC-01-05
  it('should throw 400 when password is missing', async () => {
    await assert.rejects(
      () => authService.register({ username: 'alice' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username and password are required/i);
        return true;
      }
    );
  });

  // TC-01-07
  it('should throw 400 when password has fewer than 8 characters', async () => {
    await assert.rejects(
      () => authService.register({ username: 'alice', password: '1234567' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /at least 8 characters/i);
        return true;
      }
    );
  });

  // TC-01-08
  it('should succeed when password has exactly 8 characters', async () => {
    const result = await authService.register({ username: 'alice', password: '12345678' });
    assert.ok(result.id);
    assert.strictEqual(result.username, 'alice');
  });

  // TC-01-09
  it('should throw 400 when username has fewer than 3 characters', async () => {
    await assert.rejects(
      () => authService.register({ username: 'ab', password: 'password1' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      }
    );
  });

  // TC-01-10
  it('should succeed when username has exactly 3 characters', async () => {
    const result = await authService.register({ username: 'abc', password: 'password1' });
    assert.strictEqual(result.username, 'abc');
  });

  // TC-01-11
  it('should throw 400 when username contains spaces', async () => {
    await assert.rejects(
      () => authService.register({ username: 'ali ce', password: 'password1' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      }
    );
  });

  // TC-01-12
  it('should throw 400 when username contains special characters other than underscore', async () => {
    await assert.rejects(
      () => authService.register({ username: 'ali@ce', password: 'password1' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      }
    );
  });

  // TC-01-13
  it('should succeed when username contains alphanumeric characters and underscores', async () => {
    const result = await authService.register({ username: 'alice_01', password: 'password1' });
    assert.strictEqual(result.username, 'alice_01');
  });

  // TC-01-14
  it('should throw 400 when username exceeds 50 characters', async () => {
    const longUsername = 'a'.repeat(51);
    await assert.rejects(
      () => authService.register({ username: longUsername, password: 'password1' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      }
    );
  });

  // TC-01-15
  it('should succeed when username has exactly 50 characters', async () => {
    const username = 'a'.repeat(50);
    const result = await authService.register({ username, password: 'password1' });
    assert.strictEqual(result.username, username);
  });

  // TC-01-16
  it('should throw 400 when password exceeds 20 characters', async () => {
    await assert.rejects(
      () => authService.register({ username: 'alice', password: 'a'.repeat(21) }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /at most 20/i);
        return true;
      }
    );
  });

  // TC-01-17
  it('should succeed when password has exactly 20 characters', async () => {
    const result = await authService.register({ username: 'alice', password: 'a'.repeat(20) });
    assert.ok(result.id);
  });
});

// ---------------------------------------------------------------------------
// US-02 — User Login
// ---------------------------------------------------------------------------
describe('authService.login()', () => {
  beforeEach(async () => {
    await authService.register({ username: 'alice', password: 'password1' });
  });

  // TC-02-02
  it('should throw 401 when password is invalid', async () => {
    await assert.rejects(
      () => authService.login({ username: 'alice', password: 'wrongpass' }),
      (err) => {
        assert.strictEqual(err.status, 401);
        assert.match(err.message, /Invalid credentials/i);
        return true;
      }
    );
  });

  // TC-02-03
  it('should throw 401 when username does not exist', async () => {
    await assert.rejects(
      () => authService.login({ username: 'nobody', password: 'password1' }),
      (err) => {
        assert.strictEqual(err.status, 401);
        assert.match(err.message, /Invalid credentials/i);
        return true;
      }
    );
  });

  // TC-02-05
  it('should return a JWT that expires in exactly 1 hour when JWT_EXPIRES_IN is 1h', async () => {
    const { token } = await authService.login({ username: 'alice', password: 'password1' });
    const decoded = jwt.decode(token);
    assert.strictEqual(decoded.exp - decoded.iat, 3600);
  });

  it('should throw 400 when login is called without username', async () => {
    await assert.rejects(
      () => authService.login({ password: 'password1' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username and password are required/i);
        return true;
      }
    );
  });

  it('should throw 400 when login is called without password', async () => {
    await assert.rejects(
      () => authService.login({ username: 'alice' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username and password are required/i);
        return true;
      }
    );
  });

  it('should default JWT expiry to 1 hour when JWT_EXPIRES_IN env is not set', async () => {
    const original = process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_EXPIRES_IN;
    try {
      const { token } = await authService.login({ username: 'alice', password: 'password1' });
      const decoded = jwt.decode(token);
      assert.strictEqual(decoded.exp - decoded.iat, 3600);
    } finally {
      process.env.JWT_EXPIRES_IN = original;
    }
  });
});
