/**
 * What this file does: revokes the caller's session and clears the cookie.
 * What calls it: the client logout action.
 * What it calls: AuthService and session cookie helpers.
 * Junior trap: deleting the cookie without revoking the server-side session row.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAuthService } from "@/server/container";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await createAuthService().logout(token);
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    expires: new Date(0)
  });
  return response;
}
