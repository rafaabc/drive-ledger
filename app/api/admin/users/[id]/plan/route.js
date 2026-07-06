import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth } from '@/lib/auth.mjs';
import adminService from '@/lib/services/admin.service';
import { reportHandlerError } from '@/lib/sentry.mjs';

export const PATCH = withAuth(async (req, ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const result = await adminService.setUserPlan(user.id, id, body.plan);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/admin/users/[id]/plan' }) },
    );
  }
});
