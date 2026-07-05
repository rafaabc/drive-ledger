import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import authService from '@/lib/services/auth.service';
import { createRateLimiter, withRateLimitedHandler } from '@/lib/middleware/rateLimit';
import { isBotRequest } from '@/lib/middleware/botid';
import { reportHandlerError } from '@/lib/sentry.mjs';

const limiter = createRateLimiter({ max: 5, windowMs: 60 * 60_000, key: 'register' });

// connectDB() must resolve before the rate limiter's first Mongo-backed consume()
// call in this process — otherwise that query has nothing to buffer against and
// hangs on a cold instance. Connect here, before the rate-limited handler runs.
export const POST = async (req) => {
  await connectDB();
  return withRateLimitedHandler(limiter, async (req) => {
    try {
      if (await isBotRequest()) {
        return NextResponse.json({ message: 'Access denied' }, { status: 403 });
      }
      const body = await req.json();
      const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '')
        .split(',')[0]
        .trim();
      const result = await authService.register({ ...body, ip });
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      return NextResponse.json(
        { message: err.message },
        { status: reportHandlerError(err, { route: '/api/auth/register', method: 'POST' }) },
      );
    }
  })(req);
};
