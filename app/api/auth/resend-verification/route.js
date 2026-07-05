import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth } from '@/lib/auth.mjs';
import authService from '@/lib/services/auth.service';
import { createRateLimiter, withRateLimitedHandler } from '@/lib/middleware/rateLimit';
import { reportHandlerError } from '@/lib/sentry.mjs';

const limiter = createRateLimiter({ max: 3, windowMs: 60 * 60_000, key: 'resend-verification' });

// connectDB() must resolve before the rate limiter's first Mongo-backed consume()
// call in this process — otherwise that query has nothing to buffer against and
// hangs on a cold instance. Connect here, before the rate-limited handler runs.
export const POST = async (req, ctx) => {
  await connectDB();
  return withRateLimitedHandler(
    limiter,
    withAuth(async (req, _ctx, user) => {
      try {
        const result = await authService.resendVerification({ userId: user.id });
        return NextResponse.json(result);
      } catch (err) {
        return NextResponse.json(
          { message: err.message },
          {
            status: reportHandlerError(err, {
              route: '/api/auth/resend-verification',
              method: 'POST',
            }),
          },
        );
      }
    }),
  )(req, ctx);
};
