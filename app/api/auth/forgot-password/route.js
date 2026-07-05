import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import authService from '@/lib/services/auth.service';
import { createRateLimiter, withRateLimitedHandler } from '@/lib/middleware/rateLimit';
import { reportHandlerError } from '@/lib/sentry.mjs';

const limiter = createRateLimiter({ max: 3, windowMs: 60 * 60_000, key: 'forgot-password' });

// connectDB() must resolve before the rate limiter's first Mongo-backed consume()
// call in this process — otherwise that query has nothing to buffer against and
// hangs on a cold instance. Connect here, before the rate-limited handler runs.
export const POST = async (req) => {
  await connectDB();
  return withRateLimitedHandler(limiter, async (req) => {
    try {
      const body = await req.json();
      const result = await authService.forgotPassword(body);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { message: err.message },
        { status: reportHandlerError(err, { route: '/api/auth/forgot-password', method: 'POST' }) },
      );
    }
  })(req);
};
