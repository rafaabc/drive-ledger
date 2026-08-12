import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import recurringService from '@/lib/services/recurring.service';
import { reportHandlerError } from '@/lib/sentry.mjs';
import { isValidCronRequest } from '@/lib/cronAuth.mjs';

export const GET = async (request) => {
  const authHeader = request.headers.get('authorization');
  if (!isValidCronRequest(authHeader)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  try {
    const result = await recurringService.runCatchUpAllUsers(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/cron/recurring' }) },
    );
  }
};
