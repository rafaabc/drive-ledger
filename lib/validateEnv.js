'use strict';

// Fatal at boot: the app cannot function safely without these. A missing
// JWT_SECRET/MONGODB_URI today fails safely at the first request that needs
// them (jwt.sign throws, connectDB rejects), but that's only discovered by
// the first real user, with no boot-time signal. Fail loudly instead.
const REQUIRED = [
  { key: 'JWT_SECRET', minLength: 16 },
  { key: 'MONGODB_URI', minLength: 1 },
];

// Non-fatal: lib/cronAuth.mjs already fails closed (returns false, routes 401)
// when CRON_SECRET is unset — that's a safe default for environments that simply
// don't run the cron (local dev, some CI jobs), not a boot-blocking condition.
const RECOMMENDED = ['CRON_SECRET'];

function validateRequiredEnv(env = process.env, reportMissingRecommended = () => {}) {
  const missing = REQUIRED.filter(({ key, minLength }) => {
    const value = env[key];
    return typeof value !== 'string' || value.length < minLength;
  });

  if (missing.length > 0) {
    const names = missing.map((m) => m.key).join(', ');
    throw new Error(
      `Missing or invalid required environment variable(s): ${names}. See .env.example.`,
    );
  }

  for (const key of RECOMMENDED) {
    if (!env[key]) reportMissingRecommended(key);
  }
}

module.exports = { validateRequiredEnv, REQUIRED, RECOMMENDED };
