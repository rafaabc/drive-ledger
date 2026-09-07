const Sentry = require('@sentry/nextjs');
const { validateRequiredEnv } = require('./lib/validateEnv');

async function register() {
  // Dev-only: Next 16.3 dev + Sentry's Node HTTP/OTel instrumentation attach more than
  // 10 'close' listeners per ServerResponse, tripping Node's default MaxListeners
  // warning on every request. Harmless noise (not an app-code leak — nothing here
  // attaches 'close' listeners), but it clutters the terminal.
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_RUNTIME === 'nodejs') {
    require('events').EventEmitter.defaultMaxListeners = 20;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config.mjs');
    validateRequiredEnv(process.env, (key) =>
      Sentry.captureMessage(`Missing recommended environment variable: ${key}`, 'warning'),
    );
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config.mjs');
  }
}

module.exports = {
  register,
  onRequestError: Sentry.captureRequestError,
};
