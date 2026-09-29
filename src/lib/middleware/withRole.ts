/**
 * What this file does: enforces capability checks after authentication succeeds.
 * What calls it: route handlers that need role-based access control.
 * What it calls: withAuth and apiError.
 * Junior trap: checking role after the handler already started mutating state.
 */
import { NextRequest } from "next/server";
import { apiError } from "@/lib/http/apiError";
import { hasCapability, type Capability } from "@/lib/auth/permissions";
import { withAuth, type AuthFailure } from "@/lib/middleware/withAuth";
import type { SessionRepository, UserRepository } from "@/repositories/contracts";

export async function withRole(
  request: NextRequest,
  deps: {
    sessionRepository: SessionRepository;
    userRepository: UserRepository;
  },
  capability: Capability
) {
  const auth = await withAuth(request, deps);
  if (auth instanceof Response) {
    return auth;
  }

  if (!hasCapability(auth.user, capability)) {
    // ⚠️ SENIOR NOTE: authorization must fail before we read or mutate any ticket rows.
    return apiError("FORBIDDEN", "You do not have permission to perform this action.", 403) as AuthFailure;
  }

  return auth;
}
