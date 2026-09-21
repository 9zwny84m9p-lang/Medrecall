import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe, also used as the deployment smoke test. */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "medrecall",
    milestone: 1,
    aiProvider: process.env.AI_PROVIDER ?? "deterministic",
    timestamp: new Date().toISOString(),
  });
}
