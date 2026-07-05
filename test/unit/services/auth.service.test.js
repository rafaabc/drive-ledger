'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const authService = require('../../../lib/services/auth.service');
const userModel = require('../../../lib/models/user.model');
const emailService = require('../../../lib/services/email.service');
const { POLICY_VERSION } = require('../../../lib/constants/legal');

// Suppress real email sends in unit tests
emailService.sendVerificationEmail = async () => {};
emailService.sendPasswordResetEmail = async () => {};
emailService.sendAccountExistsEmail = async () => {};

// passwordPolicy.assertStrongPassword() defaults to the global fetch for its HIBP
// breach check — stub it so unit tests never hit the real network. "Not breached"
// response so the strength score is the only gate the fixtures above need to clear.
global.fetch = async () => ({ ok: true, text: async () => '' });

// Valid consent fixture used by all tests that exercise paths beyond consent validation
const VALID_CONSENT = {
  consent: { policyVersion: POLICY_VERSION, acceptedAt: new Date().toISOString() },
};

// Strength/breach-policy-passing password fixtures. Weak literals like 'password1'
// or '12345678' now get rejected by passwordPolicy.assertStrongPassword() — these
// stand in wherever a test needs a password that is merely valid, not weak-on-purpose.
const STRONG_PASSWORD = 'Zx7$Qw2vNp9!Lm4';
const STRONG_PASSWORD_8 = 'fl9n1Sjo';
const STRONG_PASSWORD_100 =
  'jpWr3Au49Ix96Sw6s2ur9E1kb84EO4NEC8SdytzseOYkdBw6bextT4fBD6bD84BXlxs6PXezzx2qpGenEKNjxyaC2akDdqfakRV5';
const STRONG_PASSWORD_128 =
  'gYf7H7JFxLnx1xDFMp2xNkoSE8KskQwaj8zKgE7EZGWqexCQSuXQMkL1SjyX80Dr6IwzfQ4QyzfOxas1xUcfZyRPjWkSFcKBSp7u6H896oPsEIRxd9B8kHsuW3bLSd06';

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

// ---------------------------------------------------------------------------
// US-01 — User Registration
// ---------------------------------------------------------------------------
describe('authService.register()', () => {
  // TC-01-02
  it('should throw 409 when username is already taken', async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    await assert.rejects(
      () =>
        authService.register({
          username: 'alice',
          password: 'password2',
          email: 'alice2@example.com',
          ...VALID_CONSENT,
        }),
      (err) => {
        assert.strictEqual(err.status, 409);
        assert.match(err.message, /already taken/i);
        return true;
      },
    );
  });

  // Email enumeration fix: a duplicate EMAIL must not confirm the account exists.
  // Unlike username (a deliberately public handle), email is the sensitive identifier
  // here, so register() returns the same generic success shape either way and emails
  // the existing account instead of creating a duplicate.
  it('should return a generic success (not 409) when email is already registered', async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    const result = await authService.register({
      username: 'alice2',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    assert.strictEqual(result.username, 'alice2');
  });

  it('should not create a second account when email is already registered', async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    await authService.register({
      username: 'alice2',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    const duplicateAttemptUser = await userModel.findByUsername('alice2');
    assert.strictEqual(duplicateAttemptUser, null, 'alice2 must not have been created');
    const original = await userModel.findByUsername('alice');
    assert.ok(original, 'the original account must be untouched');
  });

  it('should send an account-exists notice to the existing address instead of creating a duplicate', async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    let sentTo = null;
    emailService.sendAccountExistsEmail = async ({ to }) => {
      sentTo = to;
    };
    await authService.register({
      username: 'alice2',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    assert.strictEqual(sentTo, 'alice@example.com');
  });

  it('should still throw 409 when the username is already taken (username stays a public availability check)', async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    await assert.rejects(
      () =>
        authService.register({
          username: 'alice',
          password: STRONG_PASSWORD,
          email: 'somebodyelse@example.com',
          ...VALID_CONSENT,
        }),
      (err) => {
        assert.strictEqual(err.status, 409);
        assert.match(err.message, /already taken/i);
        return true;
      },
    );
  });

  // TC-01-04
  it('should throw 400 when username is missing', async () => {
    await assert.rejects(
      () => authService.register({ password: STRONG_PASSWORD, email: 'alice@example.com' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username, password and email are required/i);
        return true;
      },
    );
  });

  // TC-01-05
  it('should throw 400 when password is missing', async () => {
    await assert.rejects(
      () => authService.register({ username: 'alice', email: 'alice@example.com' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username, password and email are required/i);
        return true;
      },
    );
  });

  it('should throw 400 when email is missing', async () => {
    await assert.rejects(
      () => authService.register({ username: 'alice', password: STRONG_PASSWORD }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username, password and email are required/i);
        return true;
      },
    );
  });

  it('should throw 400 when email format is invalid', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'alice',
          password: STRONG_PASSWORD,
          email: 'not-an-email',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /invalid email format/i);
        return true;
      },
    );
  });

  // TC-01-07
  it('should throw 400 when password has fewer than 8 characters', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'alice',
          password: '1234567',
          email: 'alice@example.com',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /at least 8 characters/i);
        return true;
      },
    );
  });

  // TC-01-08
  it('should succeed when password has exactly 8 characters', async () => {
    const result = await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD_8,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    assert.ok(result.id);
    assert.strictEqual(result.username, 'alice');
  });

  // TC-01-09
  it('should throw 400 when username has fewer than 3 characters', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'ab',
          password: STRONG_PASSWORD,
          email: 'alice@example.com',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  // TC-01-10
  it('should succeed when username has exactly 3 characters', async () => {
    const result = await authService.register({
      username: 'abc',
      password: STRONG_PASSWORD,
      email: 'abc@example.com',
      ...VALID_CONSENT,
    });
    assert.strictEqual(result.username, 'abc');
  });

  // TC-01-11
  it('should throw 400 when username contains spaces', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'ali ce',
          password: STRONG_PASSWORD,
          email: 'alice@example.com',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  // TC-01-12
  it('should throw 400 when username contains special characters other than underscore', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'ali@ce',
          password: STRONG_PASSWORD,
          email: 'alice@example.com',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  // TC-01-13
  it('should succeed when username contains alphanumeric characters and underscores', async () => {
    const result = await authService.register({
      username: 'alice_01',
      password: STRONG_PASSWORD,
      email: 'alice_01@example.com',
      ...VALID_CONSENT,
    });
    assert.strictEqual(result.username, 'alice_01');
  });

  // TC-01-14
  it('should throw 400 when username exceeds 50 characters', async () => {
    const longUsername = 'a'.repeat(51);
    await assert.rejects(
      () =>
        authService.register({
          username: longUsername,
          password: STRONG_PASSWORD,
          email: 'alice@example.com',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  // TC-01-15
  it('should succeed when username has exactly 50 characters', async () => {
    const username = 'a'.repeat(50);
    const result = await authService.register({
      username,
      password: STRONG_PASSWORD,
      email: 'long@example.com',
      ...VALID_CONSENT,
    });
    assert.strictEqual(result.username, username);
  });

  // TC-01-16
  it('should throw 400 when password exceeds 128 characters', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'alice',
          password: 'a'.repeat(129),
          email: 'alice@example.com',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /at most 128/i);
        return true;
      },
    );
  });

  // TC-01-17
  it('should succeed when password has exactly 128 characters', async () => {
    const result = await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD_128,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    assert.ok(result.id);
  });

  it('should succeed when password has 100 characters', async () => {
    const result = await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD_100,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    assert.ok(result.id);
  });
});

// ---------------------------------------------------------------------------
// US-02 — User Login
// ---------------------------------------------------------------------------
describe('authService.login()', () => {
  beforeEach(async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
  });

  // TC-02-02
  it('should throw 401 when password is invalid', async () => {
    await assert.rejects(
      () => authService.login({ username: 'alice', password: 'wrongpass' }),
      (err) => {
        assert.strictEqual(err.status, 401);
        assert.match(err.message, /Invalid credentials/i);
        return true;
      },
    );
  });

  // TC-02-03
  it('should throw 401 when username does not exist', async () => {
    await assert.rejects(
      () => authService.login({ username: 'nobody', password: STRONG_PASSWORD }),
      (err) => {
        assert.strictEqual(err.status, 401);
        assert.match(err.message, /Invalid credentials/i);
        return true;
      },
    );
  });

  // TC-02-05
  it('should return a JWT that expires in exactly 1 hour when JWT_EXPIRES_IN is 1h', async () => {
    const { token } = await authService.login({ username: 'alice', password: STRONG_PASSWORD });
    const decoded = jwt.decode(token);
    assert.strictEqual(decoded.exp - decoded.iat, 3600);
  });

  it('should throw 400 when login is called without username', async () => {
    await assert.rejects(
      () => authService.login({ password: STRONG_PASSWORD }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username and password are required/i);
        return true;
      },
    );
  });

  it('should throw 400 when login is called without password', async () => {
    await assert.rejects(
      () => authService.login({ username: 'alice' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username and password are required/i);
        return true;
      },
    );
  });

  // NoSQL operator injection — a query-operator object must never reach the DB filter
  it('should throw 400 (not select an arbitrary user) when username is a query operator object', async () => {
    await assert.rejects(
      () => authService.login({ username: { $gt: '' }, password: STRONG_PASSWORD }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when password is a query operator object', async () => {
    await assert.rejects(
      () => authService.login({ username: 'alice', password: { $ne: null } }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should default JWT expiry to 1 hour when JWT_EXPIRES_IN env is not set', async () => {
    const original = process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_EXPIRES_IN;
    try {
      const { token } = await authService.login({ username: 'alice', password: STRONG_PASSWORD });
      const decoded = jwt.decode(token);
      assert.strictEqual(decoded.exp - decoded.iat, 3600);
    } finally {
      process.env.JWT_EXPIRES_IN = original;
    }
  });
});

// ---------------------------------------------------------------------------
// Account lockout
// ---------------------------------------------------------------------------
describe('authService.login() — account lockout', () => {
  beforeEach(async () => {
    await authService.register({
      username: 'lockuser',
      password: STRONG_PASSWORD,
      email: 'lockuser@example.com',
      ...VALID_CONSENT,
    });
  });

  it('should still return generic 401 (not lockout-specific) on the 5th consecutive bad password', async () => {
    for (let i = 0; i < 4; i++) {
      await assert.rejects(() =>
        authService.login({ username: 'lockuser', password: 'wrongpass' }),
      );
    }
    await assert.rejects(
      () => authService.login({ username: 'lockuser', password: 'wrongpass' }),
      (err) => {
        assert.strictEqual(err.status, 401);
        assert.match(err.message, /Invalid credentials/i);
        return true;
      },
    );
  });

  it('should lock the account after 5 consecutive bad passwords, rejecting even the correct password', async () => {
    for (let i = 0; i < 5; i++) {
      await assert.rejects(() =>
        authService.login({ username: 'lockuser', password: 'wrongpass' }),
      );
    }
    await assert.rejects(
      () => authService.login({ username: 'lockuser', password: STRONG_PASSWORD }),
      (err) => {
        assert.strictEqual(err.status, 401);
        assert.match(err.message, /Invalid credentials/i);
        return true;
      },
    );
  });

  it('should persist the lockUntil field on the user once locked', async () => {
    for (let i = 0; i < 5; i++) {
      await assert.rejects(() =>
        authService.login({ username: 'lockuser', password: 'wrongpass' }),
      );
    }
    const user = await userModel.findByUsername('lockuser');
    assert.ok(user.lockUntil > new Date(), 'lockUntil should be set in the future');
  });

  it('should reset the failed-attempt counter and lock after a successful login', async () => {
    for (let i = 0; i < 3; i++) {
      await assert.rejects(() =>
        authService.login({ username: 'lockuser', password: 'wrongpass' }),
      );
    }
    await authService.login({ username: 'lockuser', password: STRONG_PASSWORD });
    const user = await userModel.findByUsername('lockuser');
    assert.strictEqual(user.failedLoginAttempts, 0);
    assert.strictEqual(user.lockUntil, undefined);
  });

  it('should not lock the account before reaching the threshold', async () => {
    for (let i = 0; i < 4; i++) {
      await assert.rejects(() =>
        authService.login({ username: 'lockuser', password: 'wrongpass' }),
      );
    }
    // 5th attempt with the CORRECT password should still succeed — not yet locked
    const { token } = await authService.login({ username: 'lockuser', password: STRONG_PASSWORD });
    assert.ok(token);
  });
});

// ---------------------------------------------------------------------------
// US-03 — Change Password
// ---------------------------------------------------------------------------
describe('authService.changePassword()', () => {
  it('should update password when username exists and credentials are valid', async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    const result = await authService.changePassword({
      username: 'alice',
      currentPassword: STRONG_PASSWORD,
      newPassword: 'newPass99',
    });
    assert.strictEqual(result.message, 'Password updated successfully');
  });

  it('should throw 401 when currentPassword is wrong', async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    await assert.rejects(
      () =>
        authService.changePassword({
          username: 'alice',
          currentPassword: 'wrongPass1',
          newPassword: 'newPass99',
        }),
      (err) => {
        assert.strictEqual(err.status, 401);
        assert.match(err.message, /invalid credentials/i);
        return true;
      },
    );
  });

  it('should throw 404 when username not found', async () => {
    await assert.rejects(
      () =>
        authService.changePassword({
          username: 'nobody',
          currentPassword: STRONG_PASSWORD,
          newPassword: 'newPass99',
        }),
      (err) => {
        assert.strictEqual(err.status, 404);
        assert.match(err.message, /user not found/i);
        return true;
      },
    );
  });

  it('should throw 400 when newPassword is too short', async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    await assert.rejects(
      () =>
        authService.changePassword({
          username: 'alice',
          currentPassword: STRONG_PASSWORD,
          newPassword: '1234567',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /at least 8 characters/i);
        return true;
      },
    );
  });

  it('should throw 400 when newPassword is too long', async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    await assert.rejects(
      () =>
        authService.changePassword({
          username: 'alice',
          currentPassword: STRONG_PASSWORD,
          newPassword: 'a'.repeat(129),
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /at most 128/i);
        return true;
      },
    );
  });

  it('should throw 400 when username is missing', async () => {
    await assert.rejects(
      () =>
        authService.changePassword({ currentPassword: STRONG_PASSWORD, newPassword: 'newPass99' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username, currentPassword and newPassword are required/i);
        return true;
      },
    );
  });

  it('should throw 400 when currentPassword is missing', async () => {
    await assert.rejects(
      () => authService.changePassword({ username: 'alice', newPassword: 'newPass99' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username, currentPassword and newPassword are required/i);
        return true;
      },
    );
  });

  it('should throw 400 when newPassword is missing', async () => {
    await assert.rejects(
      () => authService.changePassword({ username: 'alice', currentPassword: STRONG_PASSWORD }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /username, currentPassword and newPassword are required/i);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Google Auth — googleLogin, linkGoogle, unlinkGoogle
// ---------------------------------------------------------------------------

const fakePayload = (overrides = {}) => ({
  sub: 'google-sub-123',
  email: 'guser@gmail.com',
  emailVerified: true,
  name: 'G User',
  ...overrides,
});

describe('authService.googleLogin()', () => {
  it('should create a new user and return a token for a first-time Google sign-in', async () => {
    const fakeVerify = async () => fakePayload();
    const result = await authService.googleLogin({ idToken: 'tok' }, fakeVerify);
    assert.ok(result.token);
  });

  it('should derive a valid username from email local-part', async () => {
    const fakeVerify = async () => fakePayload({ email: 'john.doe@gmail.com' });
    const { token } = await authService.googleLogin({ idToken: 'tok' }, fakeVerify);
    const decoded = jwt.decode(token);
    assert.match(decoded.username, /^\w{3,50}$/);
  });

  it('should append a suffix when derived username collides', async () => {
    await authService.register({
      username: 'guser',
      password: STRONG_PASSWORD,
      email: 'other@example.com',
      ...VALID_CONSENT,
    });
    const fakeVerify = async () => fakePayload();
    const { token } = await authService.googleLogin({ idToken: 'tok' }, fakeVerify);
    const decoded = jwt.decode(token);
    assert.notStrictEqual(decoded.username, 'guser');
    assert.match(decoded.username, /^\w{3,50}$/);
  });

  it('should return the same token on a second Google login (existing googleId)', async () => {
    const fakeVerify = async () => fakePayload();
    const first = await authService.googleLogin({ idToken: 'tok' }, fakeVerify);
    const second = await authService.googleLogin({ idToken: 'tok' }, fakeVerify);
    const d1 = jwt.decode(first.token);
    const d2 = jwt.decode(second.token);
    assert.strictEqual(d1.id, d2.id);
  });

  it('should auto-link Google to an existing password user with the same email', async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'guser@gmail.com',
      ...VALID_CONSENT,
    });
    const fakeVerify = async () => fakePayload();
    const { token } = await authService.googleLogin({ idToken: 'tok' }, fakeVerify);
    const decoded = jwt.decode(token);
    assert.strictEqual(decoded.username, 'alice');
  });

  it('should throw 400 when idToken is missing', async () => {
    await assert.rejects(
      () => authService.googleLogin({}),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 401 when the verifier rejects the token', async () => {
    const fakeVerify = async () => {
      const e = new Error('Invalid Google token');
      e.status = 401;
      throw e;
    };
    await assert.rejects(
      () => authService.googleLogin({ idToken: 'bad' }, fakeVerify),
      (err) => {
        assert.strictEqual(err.status, 401);
        return true;
      },
    );
  });
});

describe('authService.linkGoogle()', () => {
  it('should link Google to an existing user', async () => {
    const user = await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'guser@gmail.com',
      ...VALID_CONSENT,
    });
    const fakeVerify = async () => fakePayload();
    const result = await authService.linkGoogle({ userId: user.id, idToken: 'tok' }, fakeVerify);
    assert.match(result.message, /linked/i);
  });

  it('should throw 400 when Google email does not match user email', async () => {
    const user = await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    const fakeVerify = async () => fakePayload({ email: 'other@gmail.com' });
    await assert.rejects(
      () => authService.linkGoogle({ userId: user.id, idToken: 'tok' }, fakeVerify),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 409 when googleId is already linked to another user', async () => {
    const fakeVerify = async () => fakePayload();
    await authService.googleLogin({ idToken: 'tok' }, fakeVerify);
    const alice = await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    const fakeVerifyAlice = async () => fakePayload({ email: 'alice@example.com' });
    await assert.rejects(
      () => authService.linkGoogle({ userId: alice.id, idToken: 'tok' }, fakeVerifyAlice),
      (err) => {
        assert.strictEqual(err.status, 409);
        return true;
      },
    );
  });
});

describe('authService.unlinkGoogle()', () => {
  it('should unlink Google when user has a password', async () => {
    const user = await authService.register({
      username: 'bob',
      password: STRONG_PASSWORD,
      email: 'bob@gmail.com',
      ...VALID_CONSENT,
    });
    const fakeVerify = async () => fakePayload({ sub: 'sub-bob', email: 'bob@gmail.com' });
    await authService.linkGoogle({ userId: user.id, idToken: 'tok' }, fakeVerify);
    const result = await authService.unlinkGoogle({ userId: user.id });
    assert.match(result.message, /unlinked/i);
  });

  it('should throw 400 when user has no password (Google-only)', async () => {
    const fakeVerify = async () => fakePayload();
    const { token } = await authService.googleLogin({ idToken: 'tok' }, fakeVerify);
    const { id } = jwt.decode(token);
    await assert.rejects(
      () => authService.unlinkGoogle({ userId: id }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// US-04 — Forgot Password
// ---------------------------------------------------------------------------
describe('authService.forgotPassword()', () => {
  beforeEach(async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
  });

  it('should return 200 message when email is not registered (no enumeration)', async () => {
    const mockSend = async () => {};
    const result = await authService.forgotPassword({ email: 'nobody@example.com' }, mockSend);
    assert.match(result.message, /reset link was sent/i);
  });

  it('should return 200 message and call sendEmail when email exists', async () => {
    let sentTo = null;
    const mockSend = async ({ to }) => {
      sentTo = to;
    };
    const result = await authService.forgotPassword({ email: 'alice@example.com' }, mockSend);
    assert.match(result.message, /reset link was sent/i);
    assert.strictEqual(sentTo, 'alice@example.com');
  });

  it('should include a valid reset JWT in the reset URL', async () => {
    let capturedUrl = null;
    const mockSend = async ({ resetUrl }) => {
      capturedUrl = resetUrl;
    };
    await authService.forgotPassword({ email: 'alice@example.com' }, mockSend);
    assert.ok(capturedUrl, 'resetUrl should be set');
    const token = new URL(capturedUrl).searchParams.get('token');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.strictEqual(payload.username, 'alice');
    assert.strictEqual(payload.purpose, 'reset');
  });

  it('should throw 400 when email is missing', async () => {
    await assert.rejects(
      () => authService.forgotPassword({}),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /email is required/i);
        return true;
      },
    );
  });

  // NoSQL operator injection — an object like { $ne: null } must not select an arbitrary user
  it('should throw 400 and not send an email when email is a query operator object', async () => {
    let sendCalled = false;
    const mockSend = async () => {
      sendCalled = true;
    };
    await assert.rejects(
      () => authService.forgotPassword({ email: { $ne: null } }, mockSend),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
    assert.strictEqual(sendCalled, false, 'no reset email should be sent for a non-string email');
  });
});

// ---------------------------------------------------------------------------
// US-05 — Reset Password
// ---------------------------------------------------------------------------
describe('authService.resetPassword()', () => {
  let validToken;

  beforeEach(async () => {
    await authService.register({
      username: 'alice',
      password: STRONG_PASSWORD,
      email: 'alice@example.com',
      ...VALID_CONSENT,
    });
    validToken = jwt.sign({ username: 'alice', purpose: 'reset' }, process.env.JWT_SECRET, {
      expiresIn: '15m',
    });
  });

  it('should update password when token is valid', async () => {
    const result = await authService.resetPassword({ token: validToken, newPassword: 'newPass99' });
    assert.strictEqual(result.message, 'Password updated successfully');
  });

  it('should allow login with new password after reset', async () => {
    await authService.resetPassword({ token: validToken, newPassword: 'newPass99' });
    const { token } = await authService.login({ username: 'alice', password: 'newPass99' });
    assert.ok(token);
  });

  it('should throw 401 when token is expired', async () => {
    const expiredToken = jwt.sign({ username: 'alice', purpose: 'reset' }, process.env.JWT_SECRET, {
      expiresIn: '-1s',
    });
    await assert.rejects(
      () => authService.resetPassword({ token: expiredToken, newPassword: 'newPass99' }),
      (err) => {
        assert.strictEqual(err.status, 401);
        assert.match(err.message, /invalid or expired/i);
        return true;
      },
    );
  });

  it('should throw 401 when token has wrong purpose', async () => {
    const loginToken = jwt.sign({ username: 'alice', purpose: 'login' }, process.env.JWT_SECRET, {
      expiresIn: '15m',
    });
    await assert.rejects(
      () => authService.resetPassword({ token: loginToken, newPassword: 'newPass99' }),
      (err) => {
        assert.strictEqual(err.status, 401);
        assert.match(err.message, /invalid or expired/i);
        return true;
      },
    );
  });

  it('should throw 401 when token is malformed', async () => {
    await assert.rejects(
      () => authService.resetPassword({ token: 'not.a.token', newPassword: 'newPass99' }),
      (err) => {
        assert.strictEqual(err.status, 401);
        return true;
      },
    );
  });

  it('should throw 400 when newPassword is too short', async () => {
    await assert.rejects(
      () => authService.resetPassword({ token: validToken, newPassword: '1234567' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /at least 8 characters/i);
        return true;
      },
    );
  });

  it('should throw 400 when newPassword is too long', async () => {
    await assert.rejects(
      () => authService.resetPassword({ token: validToken, newPassword: 'a'.repeat(129) }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /at most 128/i);
        return true;
      },
    );
  });

  it('should throw 400 when token is missing', async () => {
    await assert.rejects(
      () => authService.resetPassword({ newPassword: 'newPass99' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /token and newPassword are required/i);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// updateLanguage
// ---------------------------------------------------------------------------
describe('authService.updateLanguage()', () => {
  it('should throw 400 when language is missing', async () => {
    const user = await authService.register({
      username: 'lng1',
      password: STRONG_PASSWORD,
      email: 'lng1@x.com',
      ...VALID_CONSENT,
    });
    await assert.rejects(
      () => authService.updateLanguage({ id: user.id, language: undefined }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when language is not supported', async () => {
    const user = await authService.register({
      username: 'lng2',
      password: STRONG_PASSWORD,
      email: 'lng2@x.com',
      ...VALID_CONSENT,
    });
    await assert.rejects(
      () => authService.updateLanguage({ id: user.id, language: 'fr' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /must be one of/i);
        return true;
      },
    );
  });

  it('should throw 404 when user does not exist', async () => {
    await assert.rejects(
      () => authService.updateLanguage({ id: '000000000000000000000001', language: 'en' }),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });

  it('should return a new JWT containing the updated language', async () => {
    const user = await authService.register({
      username: 'lng3',
      password: STRONG_PASSWORD,
      email: 'lng3@x.com',
      ...VALID_CONSENT,
    });
    const { token } = await authService.updateLanguage({ id: user.id, language: 'en' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.strictEqual(payload.language, 'en');
    assert.ok(payload.currency, 'token should also carry currency');
  });
});

// ---------------------------------------------------------------------------
// updateOdometer
// ---------------------------------------------------------------------------
describe('authService.updateOdometer()', () => {
  it('should update currentKm when value is greater than current', async () => {
    const user = await userModel.create({
      username: 'driver1',
      password: 'x',
      email: 'd1@test.com',
    });
    const result = await authService.updateOdometer({ id: user._id.toString(), currentKm: 1000 });
    assert.ok(result.token);
    const after = await userModel.findById(user._id);
    assert.strictEqual(after.currentKm, 1000);
  });

  it('should allow setting currentKm lower than existing', async () => {
    const user = await userModel.create({
      username: 'driver2',
      password: 'x',
      email: 'd2@test.com',
      currentKm: 500,
    });
    const result = await authService.updateOdometer({ id: user._id.toString(), currentKm: 100 });
    assert.strictEqual(result.currentKm, 100);
  });

  it('should throw 400 when currentKm is missing or invalid', async () => {
    const user = await userModel.create({
      username: 'driver3',
      password: 'x',
      email: 'd3@test.com',
    });
    await assert.rejects(
      () => authService.updateOdometer({ id: user._id.toString(), currentKm: -1 }),
      (err) => err.status === 400,
    );
  });
});

// ---------------------------------------------------------------------------
// updateCurrency
// ---------------------------------------------------------------------------
describe('authService.updateCurrency()', () => {
  it('should throw 400 when currency is missing', async () => {
    const user = await authService.register({
      username: 'cur1',
      password: STRONG_PASSWORD,
      email: 'cur1@x.com',
      ...VALID_CONSENT,
    });
    await assert.rejects(
      () => authService.updateCurrency({ id: user.id, currency: undefined }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when currency is not supported', async () => {
    const user = await authService.register({
      username: 'cur2',
      password: STRONG_PASSWORD,
      email: 'cur2@x.com',
      ...VALID_CONSENT,
    });
    await assert.rejects(
      () => authService.updateCurrency({ id: user.id, currency: 'XYZ' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /must be one of/i);
        return true;
      },
    );
  });

  it('should throw 404 when user does not exist', async () => {
    await assert.rejects(
      () => authService.updateCurrency({ id: '000000000000000000000001', currency: 'USD' }),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });

  it('should return a JWT containing both currency and language', async () => {
    const user = await authService.register({
      username: 'curr_lang',
      password: STRONG_PASSWORD,
      email: 'currlang@x.com',
      ...VALID_CONSENT,
    });
    const { token } = await authService.updateCurrency({ id: user.id, currency: 'USD' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.strictEqual(payload.currency, 'USD');
    assert.ok(payload.language, 'token should also carry language');
  });
});

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------
describe('authService.register() — email verification', () => {
  it('should create user with emailVerified=false and a verification token', async () => {
    await authService.register({
      username: 'evuser',
      password: STRONG_PASSWORD,
      email: 'evuser@x.com',
      ...VALID_CONSENT,
    });
    const user = await userModel.findByUsername('evuser');
    assert.strictEqual(user.emailVerified, false);
    assert.ok(user.emailVerificationToken, 'should have a verification token');
    assert.ok(user.emailVerificationExpiresAt > new Date(), 'expiry should be in the future');
  });

  it('should include emailVerified=false in the JWT payload on login', async () => {
    await authService.register({
      username: 'evjwt',
      password: STRONG_PASSWORD,
      email: 'evjwt@x.com',
      ...VALID_CONSENT,
    });
    const { token } = await authService.login({ username: 'evjwt', password: STRONG_PASSWORD });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.strictEqual(payload.emailVerified, false);
  });
});

describe('authService.verifyEmail()', () => {
  it('should set emailVerified=true and return a JWT with emailVerified=true', async () => {
    await authService.register({
      username: 'vf1',
      password: STRONG_PASSWORD,
      email: 'vf1@x.com',
      ...VALID_CONSENT,
    });
    const user = await userModel.findByUsername('vf1');
    const { token } = await authService.verifyEmail({ token: user.emailVerificationToken });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.strictEqual(payload.emailVerified, true);
    const updated = await userModel.findByUsername('vf1');
    assert.strictEqual(updated.emailVerified, true);
    assert.ok(!updated.emailVerificationToken, 'token should be cleared');
  });

  it('should throw 400 when token is missing', async () => {
    await assert.rejects(
      () => authService.verifyEmail({}),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should throw 400 when token does not match any user', async () => {
    await assert.rejects(
      () => authService.verifyEmail({ token: 'nonexistenttoken' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /invalid or expired/i);
        return true;
      },
    );
  });

  // NoSQL operator injection (account takeover) — { $ne: null } must not match "any user
  // with a verification token" and must not return a session JWT
  it('should throw 400 and not issue a token when token is a query operator object', async () => {
    await authService.register({
      username: 'takeover_target',
      password: STRONG_PASSWORD,
      email: 'takeover@x.com',
      ...VALID_CONSENT,
    });
    await assert.rejects(
      () => authService.verifyEmail({ token: { $ne: null } }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
    const target = await userModel.findByUsername('takeover_target');
    assert.strictEqual(target.emailVerified, false, 'target account must remain unverified');
  });

  it('should throw 400 when token is expired', async () => {
    await authService.register({
      username: 'expired1',
      password: STRONG_PASSWORD,
      email: 'expired1@x.com',
      ...VALID_CONSENT,
    });
    const user = await userModel.findByUsername('expired1');
    await userModel.setEmailVerificationToken(
      user._id,
      user.emailVerificationToken,
      new Date(Date.now() - 1000),
    );
    await assert.rejects(
      () => authService.verifyEmail({ token: user.emailVerificationToken }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /expired/i);
        return true;
      },
    );
  });

  it('should throw 400 when email is already verified', async () => {
    await authService.register({
      username: 'vf2',
      password: STRONG_PASSWORD,
      email: 'vf2@x.com',
      ...VALID_CONSENT,
    });
    const user = await userModel.findByUsername('vf2');
    await authService.verifyEmail({ token: user.emailVerificationToken });
    const user2 = await userModel.findByUsername('vf2');
    await assert.rejects(
      () => authService.verifyEmail({ token: user2.emailVerificationToken || 'any' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });
});

describe('authService.resendVerification()', () => {
  it('should generate a new token and update expiry', async () => {
    await authService.register({
      username: 'rsnd1',
      password: STRONG_PASSWORD,
      email: 'rsnd1@x.com',
      ...VALID_CONSENT,
    });
    const before = await userModel.findByUsername('rsnd1');
    const oldToken = before.emailVerificationToken;
    await authService.resendVerification({ userId: before._id.toString() });
    const after = await userModel.findByUsername('rsnd1');
    assert.notStrictEqual(after.emailVerificationToken, oldToken);
    assert.ok(after.emailVerificationExpiresAt > new Date());
  });

  it('should throw 400 when email is already verified', async () => {
    await authService.register({
      username: 'rsnd2',
      password: STRONG_PASSWORD,
      email: 'rsnd2@x.com',
      ...VALID_CONSENT,
    });
    const user = await userModel.findByUsername('rsnd2');
    await authService.verifyEmail({ token: user.emailVerificationToken });
    await assert.rejects(
      () => authService.resendVerification({ userId: user._id.toString() }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /already verified/i);
        return true;
      },
    );
  });

  it('should throw 404 when user not found', async () => {
    await assert.rejects(
      () => authService.resendVerification({ userId: '000000000000000000000001' }),
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Consent validation in register()
// ---------------------------------------------------------------------------
describe('authService.register() - consent', () => {
  it('should throw 400 when consent is missing', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'consentless',
          password: STRONG_PASSWORD,
          email: 'cl@example.com',
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /consent with policyVersion and acceptedAt is required/i);
        return true;
      },
    );
  });

  it('should throw 400 when consent.policyVersion is missing', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'consentless',
          password: STRONG_PASSWORD,
          email: 'cl@example.com',
          consent: { acceptedAt: new Date().toISOString() },
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /consent with policyVersion and acceptedAt is required/i);
        return true;
      },
    );
  });

  it('should throw 400 when consent.acceptedAt is missing', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'consentless',
          password: STRONG_PASSWORD,
          email: 'cl@example.com',
          consent: { policyVersion: POLICY_VERSION },
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /consent with policyVersion and acceptedAt is required/i);
        return true;
      },
    );
  });

  it('should throw 400 when policyVersion does not match POLICY_VERSION', async () => {
    await assert.rejects(
      () =>
        authService.register({
          username: 'consentmis',
          password: STRONG_PASSWORD,
          email: 'cm@example.com',
          consent: { policyVersion: '1970-01-01', acceptedAt: new Date().toISOString() },
        }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /policyVersion does not match current policy/i);
        return true;
      },
    );
  });

  it('should register successfully with valid consent', async () => {
    const result = await authService.register({
      username: 'consented',
      password: STRONG_PASSWORD,
      email: 'consented@example.com',
      consent: { policyVersion: POLICY_VERSION, acceptedAt: new Date().toISOString() },
    });
    assert.ok(result.id);
    assert.strictEqual(result.username, 'consented');
    const user = await userModel.findByUsername('consented');
    assert.strictEqual(user.consent.policyVersion, POLICY_VERSION);
    assert.ok(user.consent.acceptedAt instanceof Date);
    assert.ok(user.consent.ipHash, 'ipHash should be stored');
    assert.strictEqual(user.consent.ipHash.length, 16);
  });
});

// ---------------------------------------------------------------------------
// Phase B — invite gate wiring
// ---------------------------------------------------------------------------
describe('authService.register() - invite gate', () => {
  let originalInviteOnly;
  let originalInviteCodes;

  beforeEach(() => {
    originalInviteOnly = process.env.INVITE_ONLY;
    originalInviteCodes = process.env.INVITE_CODES;
  });

  afterEach(() => {
    if (originalInviteOnly === undefined) delete process.env.INVITE_ONLY;
    else process.env.INVITE_ONLY = originalInviteOnly;
    if (originalInviteCodes === undefined) delete process.env.INVITE_CODES;
    else process.env.INVITE_CODES = originalInviteCodes;
  });

  it('should throw 403 invite_required when INVITE_ONLY=true and inviteCode is missing/invalid', async () => {
    process.env.INVITE_ONLY = 'true';
    process.env.INVITE_CODES = 'GOOD-CODE';
    await assert.rejects(
      () =>
        authService.register({
          username: 'nogate',
          password: 'password1',
          email: 'nogate@example.com',
          ...VALID_CONSENT,
          inviteCode: 'WRONG-CODE',
        }),
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /invite_required/);
        return true;
      },
    );
  });

  it('should succeed when INVITE_ONLY=true and inviteCode is valid', async () => {
    process.env.INVITE_ONLY = 'true';
    process.env.INVITE_CODES = 'GOOD-CODE';
    const result = await authService.register({
      username: 'gatepass',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'gatepass@example.com',
      ...VALID_CONSENT,
      inviteCode: 'GOOD-CODE',
    });
    assert.ok(result.id);
    assert.strictEqual(result.username, 'gatepass');
  });

  it('should succeed without an inviteCode when INVITE_ONLY is unset/false', async () => {
    delete process.env.INVITE_ONLY;
    delete process.env.INVITE_CODES;
    const result = await authService.register({
      username: 'gateoff',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'gateoff@example.com',
      ...VALID_CONSENT,
    });
    assert.ok(result.id);
    assert.strictEqual(result.username, 'gateoff');
  });
});

describe('authService.googleLogin() - invite gate', () => {
  let originalInviteOnly;
  let originalInviteCodes;

  beforeEach(() => {
    originalInviteOnly = process.env.INVITE_ONLY;
    originalInviteCodes = process.env.INVITE_CODES;
  });

  afterEach(() => {
    if (originalInviteOnly === undefined) delete process.env.INVITE_ONLY;
    else process.env.INVITE_ONLY = originalInviteOnly;
    if (originalInviteCodes === undefined) delete process.env.INVITE_CODES;
    else process.env.INVITE_CODES = originalInviteCodes;
  });

  it('should throw 403 invite_required for a new-user Google sign-in with a bad/missing inviteCode', async () => {
    process.env.INVITE_ONLY = 'true';
    process.env.INVITE_CODES = 'GOOD-CODE';
    const fakeVerify = async () => fakePayload({ email: 'newgoogleuser@gmail.com' });
    await assert.rejects(
      () => authService.googleLogin({ idToken: 'tok' }, fakeVerify),
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /invite_required/);
        return true;
      },
    );
  });

  it('should succeed for an existing-user Google login (by googleId) with no inviteCode, gate is bypassed', async () => {
    const fakeVerify = async () => fakePayload();
    await authService.googleLogin({ idToken: 'tok' }, fakeVerify);

    process.env.INVITE_ONLY = 'true';
    process.env.INVITE_CODES = 'GOOD-CODE';
    const result = await authService.googleLogin({ idToken: 'tok' }, fakeVerify);
    assert.ok(result.token);
  });
});
