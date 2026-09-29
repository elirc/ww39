/**
 * What this file does: creates and validates opaque session tokens and cookies.
 * What calls it: AuthService, withAuth, login/logout route handlers.
 * What it calls: Node crypto helpers and NextRequest cookie APIs.
 * Junior trap: storing raw session tokens in the database or logging them in plain text.
 */
import crypto from "node:crypto";
import { NextRequest } from "next/server";

export const SESSION_COOKIE = "ticket_session";
const SESSION_BYTES = 32;

export function createSessionToken() {
  return crypto.randomBytes(SESSION_BYTES).toString("hex");
}

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getSessionTokenFromRequest(request: NextRequest) {
  return request.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export function serializeSessionCookie(token: string, expiresAt: Date) {
  const secure = process.env.NODE_ENV === "production";
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    expires: expiresAt,
    path: "/"
  };
}

