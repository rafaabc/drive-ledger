import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import notificationsService from '@/lib/services/notifications.service';
import { reportHandlerError } from '@/lib/sentry.mjs';

export const GET = async (request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  try {
    const result = await notificationsService.runReminderDigest(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/cron/reminders' }) },
    );
  }
};
