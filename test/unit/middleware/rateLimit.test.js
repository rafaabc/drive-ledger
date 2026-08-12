'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo } = require('../../helpers/mongo');
const rateLimitModel = require('../../../lib/models/rateLimit.model');
const {
  createRateLimiter,
  clientIp,
  withRateLimitedHandler,
} = require('../../../lib/middleware/rateLimit.js');

// RFC 5737 documentation-range IPs — not real hosts, safe for test fixtures
const IP_A = '192.0.2.1';
const IP_B = '192.0.2.2';
const IP_C = '192.0.2.3';

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await rateLimitModel._reset());

function makeReq(forwardedFor) {
  return { headers: { get: (h) => (h === 'x-forwarded-for' ? forwardedFor : null) } };
}

describe('clientIp()', () => {
  it('should return the first IP from x-forwarded-for', () => {
    assert.strictEqual(clientIp(makeReq(`${IP_A}, ${IP_B}`)), IP_A);
  });

  it('should return null when x-forwarded-for is absent', () => {
    assert.strictEqual(clientIp(makeReq(null)), null);
  });
});

describe('createRateLimiter()', () => {
  it('should allow a request under the limit', async () => {
    const limiter = createRateLimiter({ max: 5, windowMs: 60_000, key: 'k1' });
    assert.strictEqual((await limiter.consume(IP_A)).allowed, true);
  });

  it('should block the request when limit is exceeded', async () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000, key: 'k2' });
    await limiter.consume(IP_A);
    await limiter.consume(IP_A);
    await limiter.consume(IP_A);
    assert.strictEqual((await limiter.consume(IP_A)).allowed, false);
  });

  it('should count requests per IP independently', async () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000, key: 'k3' });
    await limiter.consume(IP_A);
    await limiter.consume(IP_A);
    assert.strictEqual((await limiter.consume(IP_A)).allowed, false);
    assert.strictEqual((await limiter.consume(IP_B)).allowed, true);
  });

  it('should reset after the window expires', async () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 50, key: 'k4' });
    await limiter.consume(IP_A);
    assert.strictEqual((await limiter.consume(IP_A)).allowed, false);
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.strictEqual((await limiter.consume(IP_A)).allowed, true);
  });

  it('should include retryAfterMs in blocked response', async () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, key: 'k5' });
    await limiter.consume(IP_C);
    const result = await limiter.consume(IP_C);
    assert.strictEqual(result.allowed, false);
    assert.ok(result.retryAfterMs > 0, 'retryAfterMs should be positive');
  });

  it('should allow all requests when ip is null (no x-forwarded-for)', async () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, key: 'k6' });
    for (let i = 0; i < 5; i++) {
      assert.strictEqual((await limiter.consume(null)).allowed, true);
    }
  });

  it('should bypass rate limit for loopback IPs (Next.js injects socket.remoteAddress)', async () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, key: 'k7' });
    // NOSONAR — testing loopback bypass
    for (const loopback of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      for (let i = 0; i < 5; i++) {
        assert.strictEqual(
          (await limiter.consume(loopback)).allowed,
          true,
          `should bypass for ${loopback}`,
        );
      }
    }
  });

  it('should NOT bypass loopback IPs when NODE_ENV is production (anti x-forwarded-for spoofing)', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const limiter = createRateLimiter({ max: 1, windowMs: 60_000, key: 'k8' });
      assert.strictEqual((await limiter.consume('127.0.0.1')).allowed, true);
      assert.strictEqual(
        (await limiter.consume('127.0.0.1')).allowed,
        false,
        'loopback IP must be rate-limited like any other IP in production',
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('should isolate counters across different limiter instances (different keys)', async () => {
    const loginLimiter = createRateLimiter({ max: 2, windowMs: 60_000, key: 'login' });
    const registerLimiter = createRateLimiter({ max: 2, windowMs: 60_000, key: 'register' });

    await loginLimiter.consume(IP_A);
    await loginLimiter.consume(IP_A);
    assert.strictEqual((await loginLimiter.consume(IP_A)).allowed, false);
    assert.strictEqual((await registerLimiter.consume(IP_A)).allowed, true);
  });

  it('should persist counters in Mongo, not process memory (survives across serverless instances)', async () => {
    const limiter = createRateLimiter({ max: 5, windowMs: 60_000, key: 'persisted' });
    await limiter.consume(IP_A);
    await limiter.consume(IP_A);

    // A separate process/instance would have no in-memory state at all — the only
    // way it can see this count is by reading it back from Mongo directly.
    const { count } = await rateLimitModel.incrementWindow(`persisted:${IP_A}`, 60_000);
    assert.strictEqual(
      count,
      3,
      'counter must live in Mongo so any instance can read/increment it',
    );
  });
});

describe('withRateLimitedHandler()', () => {
  it('should call handler when under limit', async () => {
    const limiter = createRateLimiter({ max: 5, windowMs: 60_000, key: 'h1' });
    const handler = async () => new Response('ok', { status: 200 });
    const wrapped = withRateLimitedHandler(limiter, handler);
    const res = await wrapped(makeReq(IP_A));
    assert.strictEqual(res.status, 200);
  });

  it('should return 429 when limit exceeded', async () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, key: 'h2' });
    const handler = async () => new Response('ok', { status: 200 });
    const wrapped = withRateLimitedHandler(limiter, handler);
    await wrapped(makeReq(IP_B));
    const res = await wrapped(makeReq(IP_B));
    assert.strictEqual(res.status, 429);
    assert.ok(res.headers.get('Retry-After'), 'should set Retry-After header');
  });

  it('should bypass limit when ip is null or loopback', async () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, key: 'h3' });
    const handler = async () => new Response('ok', { status: 200 });
    const wrapped = withRateLimitedHandler(limiter, handler);
    for (const ip of [null, '127.0.0.1', '::1']) {
      for (let i = 0; i < 3; i++) {
        const res = await wrapped(makeReq(ip));
        assert.strictEqual(res.status, 200, `should bypass for ${ip}`);
      }
    }
  });
});
