import { db } from "@redbot/db";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const count = await db.healthProbe.count();

  return NextResponse.json(
    {
      status: "ok",
      database: "connected",
      healthProbeCount: count
    },
    { status: 200 }
  );
}
