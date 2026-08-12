import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth } from '@/lib/auth.mjs';
import reportsService from '@/lib/services/reports.service';
import { createRateLimiter, withRateLimitedHandler } from '@/lib/middleware/rateLimit';
import { reportHandlerError } from '@/lib/sentry.mjs';

// PDF/CSV generation is CPU/memory work on Fluid Compute — rate-limited to
// keep it from being an unmetered cost-abuse vector even though it's auth-gated.
const limiter = createRateLimiter({ max: 20, windowMs: 60 * 60_000, key: 'reports' });

// connectDB() must resolve before the rate limiter's first Mongo-backed consume()
// call in this process — see app/api/auth/login/route.js for why.
export const GET = async (req) => {
  await connectDB();
  return withRateLimitedHandler(
    limiter,
    withAuth(async (req, _ctx, user) => {
      const { searchParams } = new URL(req.url);
      try {
        const result = await reportsService.generateReport(
          user.id,
          {
            year: searchParams.get('year'),
            month: searchParams.get('month'),
            vehicleId: searchParams.get('vehicleId'),
          },
          searchParams.get('format'),
        );
        return new Response(result.body, {
          status: 200,
          headers: {
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename="${result.filename}"`,
          },
        });
      } catch (err) {
        return NextResponse.json(
          { message: err.message },
          { status: reportHandlerError(err, { route: '/api/reports' }) },
        );
      }
    }),
  )(req);
};
