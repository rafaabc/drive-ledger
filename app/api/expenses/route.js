import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth, withVerifiedUser } from '@/lib/auth.mjs';
import expensesService from '@/lib/services/expenses.service';
import { reportHandlerError } from '@/lib/sentry.mjs';

export const GET = withAuth(async (req, _ctx, user) => {
  await connectDB();
  const { searchParams } = new URL(req.url);
  try {
    const result = await expensesService.listExpenses(user.id, {
      category: searchParams.get('category'),
      year: searchParams.get('year'),
      month: searchParams.get('month'),
      vehicleId: searchParams.get('vehicleId'),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/expenses' }) },
    );
  }
});

export const POST = withVerifiedUser(async (req, _ctx, user) => {
  await connectDB();
  try {
    const body = await req.json();
    const result = await expensesService.createExpense(user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/expenses' }) },
    );
  }
});
