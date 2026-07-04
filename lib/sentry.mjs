import * as Sentry from '@sentry/nextjs';

export function reportHandlerError(err, context = {}) {
  const status = err.status || 500;
  if (status >= 500 || !err.status) {
    Sentry.captureException(err, { extra: context });
  }
  return status;
}

// A missing/misconfigured STRIPE_WEBHOOK_SECRET (or a missing STRIPE_SECRET_KEY,
// surfaced by lib/stripe.js's getStripe() as a 'billing_not_configured' error) means
// EVERY Stripe webhook request will 400 forever — silently blocking plan upgrades
// for paying customers, with zero alerting signal. Report that config-detectable
// condition to Sentry. Genuinely bad/spoofed signatures (the common case — an
// attacker probing the endpoint) intentionally do NOT alert here, to avoid a
// per-request Sentry-quota DoS vector.
//
// `capture` is injectable (defaults to Sentry.captureMessage) so this can be unit
// tested without mocking the @sentry/nextjs ESM module namespace.
export function reportWebhookConfigError(
  err,
  { webhookSecretConfigured, context = {}, capture = Sentry.captureMessage } = {},
) {
  const isConfigIssue = !webhookSecretConfigured || err?.message === 'billing_not_configured';
  if (isConfigIssue) {
    capture('Stripe webhook misconfigured', {
      level: 'error',
      extra: {
        ...context,
        reason: !webhookSecretConfigured ? 'missing STRIPE_WEBHOOK_SECRET' : err.message,
      },
    });
  }
  return isConfigIssue;
}
