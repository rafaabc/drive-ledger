const Sentry = require('@sentry/nextjs');
const { validateRequiredEnv } = require('./lib/validateEnv');

async function register() {
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
