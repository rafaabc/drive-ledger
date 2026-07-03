import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db.mjs';
import { withAuth } from '@/lib/auth.mjs';
import vehiclesService from '@/lib/services/vehicles.service';
import { reportHandlerError } from '@/lib/sentry.mjs';

export const GET = withAuth(async (_req, ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  try {
    const result = await vehiclesService.getVehicle(user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/vehicles/[id]' }) },
    );
  }
});

export const PATCH = withAuth(async (req, ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const result = await vehiclesService.updateVehicle(user.id, id, body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/vehicles/[id]' }) },
    );
  }
});

export const DELETE = withAuth(async (_req, ctx, user) => {
  await connectDB();
  const { id } = await ctx.params;
  try {
    await vehiclesService.deleteVehicle(user.id, id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: reportHandlerError(err, { route: '/api/vehicles/[id]' }) },
    );
  }
});
