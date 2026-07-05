'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo } = require('../../helpers/mongo');
const rateLimitModel = require('../../../lib/models/rateLimit.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await rateLimitModel._reset());

describe('rateLimitModel.incrementWindow()', () => {
  it('should start a fresh window at count 1 for a new key', async () => {
    const { count } = await rateLimitModel.incrementWindow('login:1.2.3.4', 60_000);
    assert.strictEqual(count, 1);
  });

  it('should increment the count on repeated calls within the same window', async () => {
    await rateLimitModel.incrementWindow('login:1.2.3.4', 60_000);
    await rateLimitModel.incrementWindow('login:1.2.3.4', 60_000);
    const { count } = await rateLimitModel.incrementWindow('login:1.2.3.4', 60_000);
    assert.strictEqual(count, 3);
  });

  it('should keep counters isolated per key', async () => {
    await rateLimitModel.incrementWindow('login:1.2.3.4', 60_000);
    await rateLimitModel.incrementWindow('login:1.2.3.4', 60_000);
    const { count } = await rateLimitModel.incrementWindow('login:9.9.9.9', 60_000);
    assert.strictEqual(count, 1);
  });

  it('should reset to count 1 once the window has gone stale', async () => {
    await rateLimitModel.incrementWindow('login:1.2.3.4', 50);
    await new Promise((resolve) => setTimeout(resolve, 70));
    const { count } = await rateLimitModel.incrementWindow('login:1.2.3.4', 50);
    assert.strictEqual(count, 1);
  });

  it('should handle concurrent first-time increments on the same key without dropping any', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => rateLimitModel.incrementWindow('login:race', 60_000)),
    );
    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    assert.deepStrictEqual(counts, [1, 2, 3, 4, 5]);
  });
});
