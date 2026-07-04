'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('lib/sentry.mjs reportWebhookConfigError()', () => {
  it('reports when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    const { reportWebhookConfigError } = await import('../../../lib/sentry.mjs');

    const captured = [];
    const isConfigIssue = reportWebhookConfigError(
      new Error('No signatures found matching the expected signature'),
      {
        webhookSecretConfigured: false,
        context: { route: '/api/billing/webhook', method: 'POST' },
        capture: (message, opts) => captured.push({ message, opts }),
      },
    );

    assert.strictEqual(isConfigIssue, true);
    assert.strictEqual(captured.length, 1);
    assert.strictEqual(captured[0].message, 'Stripe webhook misconfigured');
    assert.strictEqual(captured[0].opts.level, 'error');
    assert.strictEqual(captured[0].opts.extra.reason, 'missing STRIPE_WEBHOOK_SECRET');
    assert.strictEqual(captured[0].opts.extra.route, '/api/billing/webhook');
  });

  it('reports when getStripe() throws billing_not_configured (missing STRIPE_SECRET_KEY)', async () => {
    const { reportWebhookConfigError } = await import('../../../lib/sentry.mjs');

    const captured = [];
    const err = new Error('billing_not_configured');
    err.status = 500;
    const isConfigIssue = reportWebhookConfigError(err, {
      webhookSecretConfigured: true,
      context: { route: '/api/billing/webhook', method: 'POST' },
      capture: (message, opts) => captured.push({ message, opts }),
    });

    assert.strictEqual(isConfigIssue, true);
    assert.strictEqual(captured.length, 1);
    assert.strictEqual(captured[0].opts.extra.reason, 'billing_not_configured');
  });

  it('does NOT report on a genuinely bad/spoofed signature when the secret is configured', async () => {
    const { reportWebhookConfigError } = await import('../../../lib/sentry.mjs');

    const captured = [];
    const isConfigIssue = reportWebhookConfigError(
      new Error('No signatures found matching the expected signature'),
      {
        webhookSecretConfigured: true,
        context: { route: '/api/billing/webhook', method: 'POST' },
        capture: (message, opts) => captured.push({ message, opts }),
      },
    );

    assert.strictEqual(isConfigIssue, false);
    assert.strictEqual(captured.length, 0);
  });
});
