import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth } from '@/lib/auth.mjs';
import authService from '@/lib/services/auth.service';
import { createRateLimiter, withRateLimitedHandler } from '@/lib/middleware/rateLimit';
import { reportHandlerError } from '@/lib/sentry.mjs';

// Full-account data export is a heavier read than typical routes — rate-limited to
// keep it from being an unmetered cost-abuse vector even though it's auth-gated.
const limiter = createRateLimiter({ max: 5, windowMs: 60 * 60_000, key: 'export' });

// connectDB() must resolve before the rate limiter's first Mongo-backed consume()
// call in this process — see app/api/auth/login/route.js for why.
export const GET = async (req) => {
  await connectDB();
  return withRateLimitedHandler(
    limiter,
    withAuth(async (req, ctx, user) => {
      try {
        const result = await authService.exportUserData({ userId: user.id });
        return NextResponse.json(result);
      } catch (err) {
        return NextResponse.json(
          { message: err.message },
          { status: reportHandlerError(err, { route: '/api/auth/me/export', method: 'GET' }) },
        );
      }
    }),
  )(req);
};
