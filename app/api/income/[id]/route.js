import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth } from '@/lib/auth.mjs';
import incomeService from '@/lib/services/income.service';
import { reportHandlerError } from '@/lib/sentry.mjs';

export const GET = withAuth(async (_req, ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  try {
    const result = await incomeService.getIncome(user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/income/[id]' }) },
    );
  }
});

export const PUT = withAuth(async (req, ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const result = await incomeService.updateIncome(user.id, id, body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/income/[id]' }) },
    );
  }
});

export const DELETE = withAuth(async (_req, ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  try {
    await incomeService.deleteIncome(user.id, id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/income/[id]' }) },
    );
  }
});
