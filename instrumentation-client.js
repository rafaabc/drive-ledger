// https://docs.sentry.io/platforms/javascript/guides/nextjs/
const Sentry = require('@sentry/nextjs');
const { initBotId } = require('botid/client/core');

// Vercel BotID client challenge — opt-in via NEXT_PUBLIC_BOTID_ENABLED so local/CI
// runs (no real Vercel deployment in front) don't attach challenge headers the
// server-side gate isn't expecting. See lib/middleware/botid.js.
if (process.env.NEXT_PUBLIC_BOTID_ENABLED === 'true') {
  initBotId({
    protect: [
      { path: '/api/auth/login', method: 'POST' },
      { path: '/api/auth/register', method: 'POST' },
    ],
  });
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: 1,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: true,
  beforeSend(event, hint) {
    // AbortErrors are intentional fetch cancellations (component unmount / filter change).
    // They are caught and handled by callers — not actionable errors.
    const ex = hint?.originalException;
    if (!ex) return event;
    if (ex.name === 'AbortError') return null;
    // React 19 surfaces signal.reason directly; guard against string/Error reasons too.
    const msg = typeof ex === 'string' ? ex : ex.message;
    if (msg === 'signal is aborted without reason' || msg === 'Component unmounted') return null;
    return event;
  },
});

module.exports = {
  onRouterTransitionStart: Sentry.captureRouterTransitionStart,
};
