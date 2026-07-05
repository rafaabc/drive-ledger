'use strict';

const rateLimitModel = require('../models/rateLimit.model');

// Next.js base-server.js sets x-forwarded-for to socket.remoteAddress when absent,
// so loopback IPs appear in local/CI. Vercel always sets a real client IP in prod.
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']); // NOSONAR — intentional loopback allowlist

function clientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

function createRateLimiter({ max, windowMs, key = 'default' }) {
  return {
    // Counter state lives in MongoDB (lib/models/rateLimit.model.js), not process
    // memory — Vercel Fluid Compute runs multiple instances of this app concurrently,
    // and a per-process store lets an attacker bypass the limit just by landing on a
    // fresh instance. A shared Mongo counter closes that gap.
    async consume(ip) {
      if (!ip || LOOPBACK_IPS.has(ip)) return { allowed: true };

      const storeKey = `${key}:${ip}`;
      const { count, windowStart } = await rateLimitModel.incrementWindow(storeKey, windowMs);

      if (count > max) {
        const retryAfterMs = windowMs - (Date.now() - windowStart);
        return { allowed: false, retryAfterMs };
      }

      return { allowed: true };
    },
  };
}

// Wraps a route handler with rate limiting. Returns 429 if limit exceeded.
function withRateLimitedHandler(limiter, handler) {
  return async function (req) {
    const rl = await limiter.consume(clientIp(req));
    if (!rl.allowed) {
      return Response.json(
        { message: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }
    return handler(req);
  };
}

module.exports = { createRateLimiter, clientIp, withRateLimitedHandler };
