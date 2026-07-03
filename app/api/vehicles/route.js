import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth, withVerifiedUser } from '@/lib/auth.mjs';
import vehiclesService from '@/lib/services/vehicles.service';
import { reportHandlerError } from '@/lib/sentry.mjs';

export const GET = withAuth(async (_req, _ctx, user) => {
  await connectDB();
  try {
    const result = await vehiclesService.listVehicles(user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/vehicles' }) },
    );
  }
});

export const POST = withVerifiedUser(async (req, _ctx, user) => {
  await connectDB();
  try {
    const body = await req.json();
    const result = await vehiclesService.createVehicle(user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/vehicles' }) },
    );
  }
});
