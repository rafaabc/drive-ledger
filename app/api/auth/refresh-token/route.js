import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth } from '@/lib/auth.mjs';
import authService from '@/lib/services/auth.service';
import { reportHandlerError } from '@/lib/sentry.mjs';

export const POST = withAuth(async (_req, _ctx, user) => {
  await connectDB();
  try {
    const result = await authService.refreshToken({ id: user.id });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/auth/refresh-token', method: 'POST' }) },
    );
  }
});
