import { db } from "@redbot/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const count = await db.healthProbe.count();

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        healthProbeCount: count
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "disconnected",
        healthProbeCount: null
      },
      { status: 503 }
    );
  }
}
