'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('lib/stripe.js getStripe()', () => {
  const ORIGINAL_KEY = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    delete require.cache[require.resolve('../../lib/stripe.js')];
  });

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = ORIGINAL_KEY;
  });

  it('throws billing_not_configured when STRIPE_SECRET_KEY is missing', () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = require('../../lib/stripe.js');
    assert.throws(
      () => getStripe(),
      (err) => {
        assert.strictEqual(err.status, 500);
        assert.strictEqual(err.message, 'billing_not_configured');
        return true;
      },
    );
  });

  it('returns a Stripe client instance when the key is set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    const { getStripe } = require('../../lib/stripe.js');
    const client = getStripe();
    assert.ok(client.checkout);
    assert.ok(client.billingPortal);
    assert.ok(client.webhooks);
  });
});
