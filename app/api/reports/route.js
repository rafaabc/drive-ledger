import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth } from '@/lib/auth.mjs';
import reportsService from '@/lib/services/reports.service';
import { reportHandlerError } from '@/lib/sentry.mjs';

export const GET = withAuth(async (req, _ctx, user) => {
  await connectDB();
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
});
