'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { validateRequiredEnv } = require('../../lib/validateEnv');

const VALID_ENV = {
  JWT_SECRET: 'a-sufficiently-long-test-secret',
  MONGODB_URI: 'mongodb://localhost:27017/test',
  CRON_SECRET: 'some-cron-secret',
};

describe('validateRequiredEnv()', () => {
  it('does not throw when all required vars are present and long enough', () => {
    assert.doesNotThrow(() => validateRequiredEnv(VALID_ENV));
  });

  it('throws when JWT_SECRET is missing', () => {
    const env = { ...VALID_ENV, JWT_SECRET: undefined };
    assert.throws(() => validateRequiredEnv(env), /JWT_SECRET/);
  });

  it('throws when JWT_SECRET is below the minimum length', () => {
    const env = { ...VALID_ENV, JWT_SECRET: 'short' };
    assert.throws(() => validateRequiredEnv(env), /JWT_SECRET/);
  });

  it('throws when MONGODB_URI is missing', () => {
    const env = { ...VALID_ENV, MONGODB_URI: undefined };
    assert.throws(() => validateRequiredEnv(env), /MONGODB_URI/);
  });

  it('reports every missing required var in a single error', () => {
    const env = { ...VALID_ENV, JWT_SECRET: undefined, MONGODB_URI: undefined };
    assert.throws(
      () => validateRequiredEnv(env),
      /JWT_SECRET.*MONGODB_URI|MONGODB_URI.*JWT_SECRET/,
    );
  });

  it('does not throw when CRON_SECRET is missing — it is recommended, not required', () => {
    const env = { ...VALID_ENV, CRON_SECRET: undefined };
    assert.doesNotThrow(() => validateRequiredEnv(env));
  });

  it('reports a missing CRON_SECRET via the callback instead of throwing', () => {
    const env = { ...VALID_ENV, CRON_SECRET: undefined };
    const reported = [];
    validateRequiredEnv(env, (key) => reported.push(key));
    assert.deepStrictEqual(reported, ['CRON_SECRET']);
  });

  it('does not report anything when CRON_SECRET is present', () => {
    const reported = [];
    validateRequiredEnv(VALID_ENV, (key) => reported.push(key));
    assert.deepStrictEqual(reported, []);
  });
});
