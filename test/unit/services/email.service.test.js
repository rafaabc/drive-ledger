'use strict';

// Inject a Resend mock into the require cache before loading email.service.
// The singleton (_resend) inside email.service will be initialized with MockResend
// on the first sendPasswordResetEmail call, so all tests share the same captured array.
const sentPayloads = [];

const MockResend = function (apiKey) {
  this._apiKey = apiKey;
  this.emails = {
    send: async (payload) => {
      sentPayloads.push(payload);
    },
  };
};

const resendPath = require.resolve('resend');
require.cache[resendPath] = {
  id: resendPath,
  filename: resendPath,
  loaded: true,
  exports: { Resend: MockResend },
};

const emailService = require('../../../lib/services/email.service');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

beforeEach(() => {
  sentPayloads.splice(0);
  process.env.RESEND_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe('emailService.sendPasswordResetEmail()', () => {
  it('should call Resend with correct from, to, and subject', async () => {
    await emailService.sendPasswordResetEmail({
      to: 'user@example.com',
      resetUrl: 'https://localhost:3000/reset-password?token=abc',
    });

    assert.strictEqual(sentPayloads.length, 1);
    const p = sentPayloads[0];
    assert.strictEqual(p.to, 'user@example.com');
    assert.match(p.from, /Norevify/i);
    assert.match(p.subject, /senha/i);
  });

  it('should embed the reset URL in the HTML body', async () => {
    const resetUrl = 'https://localhost:3000/reset-password?token=xyz123';
    await emailService.sendPasswordResetEmail({ to: 'user@example.com', resetUrl });

    const { html } = sentPayloads[0];
    assert.ok(typeof html === 'string', 'html must be a string');
    assert.ok(html.includes(resetUrl), 'html must contain the resetUrl');
  });

  it('should send one email per call and not batch', async () => {
    await emailService.sendPasswordResetEmail({
      to: 'a@example.com',
      resetUrl: 'https://x.com/r?t=1',
    });
    await emailService.sendPasswordResetEmail({
      to: 'b@example.com',
      resetUrl: 'https://x.com/r?t=2',
    });
    assert.strictEqual(sentPayloads.length, 2);
    assert.strictEqual(sentPayloads[0].to, 'a@example.com');
    assert.strictEqual(sentPayloads[1].to, 'b@example.com');
  });
});

describe('emailService.sendReminderDigest()', () => {
  it('should escape HTML in a reminder title instead of injecting it raw', async () => {
    await emailService.sendReminderDigest({
      to: 'user@example.com',
      overdue: [{ type: 'Other', title: '<a href="https://evil.example">click me</a>' }],
      dueSoon: [],
    });

    const { html } = sentPayloads[0];
    assert.ok(!html.includes('<a href="https://evil.example">'), 'raw anchor tag must not appear');
    assert.ok(
      html.includes('&lt;a href=&quot;https://evil.example&quot;&gt;click me&lt;/a&gt;'),
      'title must appear HTML-escaped',
    );
  });

  it('should still render reminders with no title', async () => {
    await emailService.sendReminderDigest({
      to: 'user@example.com',
      overdue: [{ type: 'Fuel', dueKm: 5000 }],
      dueSoon: [],
    });

    const { html } = sentPayloads[0];
    assert.ok(html.includes('Fuel'));
    assert.ok(html.includes('5000 km'));
  });
});
