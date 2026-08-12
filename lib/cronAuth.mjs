import crypto from 'node:crypto';

/**
 * Constant-time check that an incoming `Authorization` header matches the
 * configured cron secret. Returns false (never authenticates) when
 * CRON_SECRET is unset — a bare `authHeader !== \`Bearer ${undefined}\``
 * comparison would otherwise let a literal "Bearer undefined" header through
 * on a misconfigured deploy.
 */
export function isValidCronRequest(authHeader) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader);
  if (expected.length !== actual.length) return false;

  return crypto.timingSafeEqual(expected, actual);
}
