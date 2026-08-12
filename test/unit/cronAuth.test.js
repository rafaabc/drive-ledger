'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

let isValidCronRequest;

let originalCronSecret;

beforeEach(async () => {
  originalCronSecret = process.env.CRON_SECRET;
  ({ isValidCronRequest } = await import('../../lib/cronAuth.mjs'));
});

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe('isValidCronRequest()', () => {
  it('returns true when the header matches the configured secret', () => {
    process.env.CRON_SECRET = 'my-secret';
    assert.strictEqual(isValidCronRequest('Bearer my-secret'), true);
  });

  it('returns false when the header does not match', () => {
    process.env.CRON_SECRET = 'my-secret';
    assert.strictEqual(isValidCronRequest('Bearer wrong-secret'), false);
  });

  it('returns false when CRON_SECRET is unset, even for a literal "Bearer undefined" header', () => {
    delete process.env.CRON_SECRET;
    assert.strictEqual(isValidCronRequest('Bearer undefined'), false);
  });

  it('returns false when CRON_SECRET is unset and header is null', () => {
    delete process.env.CRON_SECRET;
    assert.strictEqual(isValidCronRequest(null), false);
  });

  it('returns false when header is null but CRON_SECRET is set', () => {
    process.env.CRON_SECRET = 'my-secret';
    assert.strictEqual(isValidCronRequest(null), false);
  });

  it('returns false when header is empty string', () => {
    process.env.CRON_SECRET = 'my-secret';
    assert.strictEqual(isValidCronRequest(''), false);
  });

  it('returns false for a header of a different length than expected (no crash)', () => {
    process.env.CRON_SECRET = 'my-secret';
    assert.strictEqual(isValidCronRequest('Bearer'), false);
    assert.strictEqual(isValidCronRequest('Bearer my-secret-but-longer'), false);
  });
});
