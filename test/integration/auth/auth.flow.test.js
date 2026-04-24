'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const authService = require('../../../src/services/auth.service');
const userModel = require('../../../src/models/user.model');
const expenseModel = require('../../../src/models/expense.model');

beforeEach(() => {
  userModel._reset();
  expenseModel._reset();
});

describe('Auth flow integration', () => {
  // TC-01-01
  it('should persist registered user so a subsequent login succeeds', async () => {
    // Arrange
    await authService.register({ username: 'rafael', password: 'password1' });

    // Act
    const { token } = await authService.login({ username: 'rafael', password: 'password1' });

    // Assert
    assert.ok(token, 'login must return a token for the just-registered user');
  });

  // TC-01-03
  it('should reject duplicate username registration with "already taken" message', async () => {
    // Arrange
    await authService.register({ username: 'rafael', password: 'password1' });

    // Act + Assert
    await assert.rejects(
      () => authService.register({ username: 'rafael', password: 'other_pass1' }),
      (err) => {
        assert.strictEqual(err.status, 409);
        assert.match(err.message, /already taken/i);
        return true;
      }
    );
  });

  // TC-02-01
  it('should return an access token when valid credentials are provided', async () => {
    // Arrange
    await authService.register({ username: 'rafael', password: 'password1' });

    // Act
    const result = await authService.login({ username: 'rafael', password: 'password1' });

    // Assert
    assert.ok(result.token);
    assert.strictEqual(typeof result.token, 'string');
    assert.ok(result.token.length > 0);
  });

  // TC-02-04
  it('should return a well-formed JWT with user identity claims', async () => {
    // Arrange
    const user = await authService.register({ username: 'rafael', password: 'password1' });

    // Act
    const { token } = await authService.login({ username: 'rafael', password: 'password1' });
    const segments = token.split('.');
    const decoded = jwt.decode(token);

    // Assert — 3 dot-separated segments
    assert.strictEqual(segments.length, 3);
    // Assert — payload carries id, username, iat, exp
    assert.strictEqual(decoded.id, user.id);
    assert.strictEqual(decoded.username, 'rafael');
    assert.ok(decoded.iat);
    assert.ok(decoded.exp);
  });

  // TC-02-08
  it('should not lock account after multiple failed login attempts', async () => {
    // Arrange
    await authService.register({ username: 'rafael', password: 'password1' });

    // Act — 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await assert.rejects(
        () => authService.login({ username: 'rafael', password: 'wrongpass' }),
        { status: 401 }
      );
    }

    // Assert — correct credentials still succeed after the failed attempts
    const { token } = await authService.login({ username: 'rafael', password: 'password1' });
    assert.ok(token);
  });
});
