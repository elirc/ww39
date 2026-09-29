/**
 * What this file does: extracts the authenticated user from the session cookie.
 * What calls it: route handlers and withRole.
 * What it calls: session helpers and the session/user repositories.
 * Junior trap: trusting a cookie value before verifying it against the database.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/http/apiError";
import { getSessionTokenFromRequest, hashSessionToken } from "@/lib/auth/session";
import type { SessionRepository, UserRepository } from "@/repositories/contracts";

export type AuthContext = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: "ADMIN" | "MANAGER" | "AGENT" | "CUSTOMER";
    supportGroupId: string | null;
  };
};
export type AuthFailure = InstanceType<typeof NextResponse> & { error: unknown };

export async function withAuth(
  request: NextRequest,
  deps: {
    sessionRepository: SessionRepository;
    userRepository: UserRepository;
  }
) : Promise<AuthContext | AuthFailure> {
  const rawToken = getSessionTokenFromRequest(request);
  if (!rawToken) {
    return apiError("UNAUTHORIZED", "Missing session.", 401) as AuthFailure;
  }

  const session = await deps.sessionRepository.findByTokenHash(hashSessionToken(rawToken));
  if (!session || session.expiresAt <= new Date()) {
    // ⚠️ SENIOR NOTE: if we skip the expiry check here, revoked or expired cookies keep working.
    return apiError("UNAUTHORIZED", "Session is invalid or expired.", 401) as AuthFailure;
  }

  const user = await deps.userRepository.findById(session.userId);
  if (!user) {
    return apiError("UNAUTHORIZED", "Session user no longer exists.", 401) as AuthFailure;
  }

  return {
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      supportGroupId: user.supportGroupId
    }
  } satisfies AuthContext;
}
