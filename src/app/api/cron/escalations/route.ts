/**
 * What this file does: runs the escalation sweep on a cron-like schedule.
 * What calls it: an external scheduler or an operator.
 * What it calls: EscalationService and a shared secret check.
 * Junior trap: exposing the job endpoint without a secret because it is "just internal".
 */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/http/apiError";
import { createEscalationService } from "@/server/container";

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return apiError("MISCONFIGURED", "CRON_SECRET is not set.", 500);
  }

  const actual = request.headers.get("x-cron-secret");
  if (actual !== expected) {
    return apiError("UNAUTHORIZED", "Invalid cron secret.", 401);
  }

  const result = await createEscalationService().runSweep();
  return NextResponse.json(result, { status: 200 });
}

