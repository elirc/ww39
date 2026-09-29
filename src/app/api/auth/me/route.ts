/**
 * What this file does: returns the current authenticated user.
 * What calls it: the client shell and auth-aware pages.
 * What it calls: withAuth and the shared repositories.
 * Junior trap: trusting the presence of a cookie instead of verifying the session row.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { createRepositories } from "@/server/container";

export async function GET(request: NextRequest) {
  const repos = createRepositories();
  const auth = await withAuth(request, repos);
  if (auth instanceof Response) {
    return auth;
  }

  return NextResponse.json({ user: auth.user }, { status: 200 });
}
