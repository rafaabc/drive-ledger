'use strict';

// Mock Resend before any service modules are loaded so the email.service
// singleton picks up MockResend instead of the real client.
const sentPayloads = [];
const MockResend = function () {
  this.emails = {
    send: async (payload) => {
      sentPayloads.push(payload);
    },
  };
};

const resendPath = require.resolve('resend');
const emailSvcPath = require.resolve('../../../lib/services/email.service');

require.cache[resendPath] = {
  id: resendPath,
  filename: resendPath,
  loaded: true,
  exports: { Resend: MockResend },
};
// Force fresh load so it picks up the mocked Resend
delete require.cache[emailSvcPath];

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-key';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const authService = require('../../../lib/services/auth.service');
const emailService = require('../../../lib/services/email.service');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => {
  await resetMongo();
  sentPayloads.splice(0);
});

const VALID_CONSENT = { policyVersion: '2026-05-20', acceptedAt: new Date().toISOString() };
const USER = {
  username: 'bob',
  password: 'Zx7Qw2vNp9Lm4Rk8',
  email: 'bob@example.com',
  consent: VALID_CONSENT,
};

describe('Email service integration — register sends verification email', () => {
  it('should send a verification email on register', async () => {
    await authService.register(USER);
    assert.strictEqual(sentPayloads.length, 1);
    assert.strictEqual(sentPayloads[0].to, USER.email);
    assert.ok(sentPayloads[0].html.includes('verify-email?token='), 'html must contain verify URL');
  });
});

describe('Email service integration — forgotPassword without injection', () => {
  it('should call sendPasswordResetEmail with a reset URL when email is registered', async () => {
    await authService.register(USER);
    sentPayloads.splice(0); // clear verification email

    await authService.forgotPassword({ email: USER.email });

    assert.strictEqual(sentPayloads.length, 1);
    assert.strictEqual(sentPayloads[0].to, USER.email);
    assert.ok(
      sentPayloads[0].html.includes('reset-password?token='),
      'html must contain the reset URL',
    );
  });

  it('should not call sendPasswordResetEmail when email is not registered', async () => {
    await authService.forgotPassword({ email: 'nobody@example.com' });
    assert.strictEqual(sentPayloads.length, 0);
  });
});

describe('emailService.sendPasswordResetEmail — direct call', () => {
  it('should send an email with the correct to, from and subject', async () => {
    await emailService.sendPasswordResetEmail({
      to: 'user@example.com',
      resetUrl: 'http://localhost:3000/reset-password?token=abc',
    });

    assert.strictEqual(sentPayloads.length, 1);
    const p = sentPayloads[0];
    assert.strictEqual(p.to, 'user@example.com');
    assert.match(p.from, /Norevify/i);
    assert.ok(typeof p.subject === 'string' && p.subject.length > 0);
  });

  it('should embed the reset URL in the html body', async () => {
    const resetUrl = 'http://localhost:3000/reset-password?token=xyz';
    await emailService.sendPasswordResetEmail({ to: 'u@example.com', resetUrl });
    assert.ok(sentPayloads[0].html.includes(resetUrl));
  });
});
