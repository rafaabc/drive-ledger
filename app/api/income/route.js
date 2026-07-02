import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth, withVerifiedUser } from '@/lib/auth.mjs';
import incomeService from '@/lib/services/income.service';
import { reportHandlerError } from '@/lib/sentry.mjs';

export const GET = withAuth(async (req, _ctx, user) => {
  await connectDB();
  const { searchParams } = new URL(req.url);
  try {
    const result = await incomeService.listIncome(user.id, {
      year: searchParams.get('year'),
      month: searchParams.get('month'),
      vehicleId: searchParams.get('vehicleId'),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/income' }) },
    );
  }
});

export const POST = withVerifiedUser(async (req, _ctx, user) => {
  await connectDB();
  try {
    const body = await req.json();
    const result = await incomeService.createIncome(user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/income' }) },
    );
  }
});
