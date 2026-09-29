/**
 * What this file does: validates credentials and sets the session cookie.
 * What calls it: the login page and API clients.
 * What it calls: AuthService, login schema validation, and cookie serialization.
 * Junior trap: returning the user without setting a real session cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation/authSchemas";
import { apiError } from "@/lib/http/apiError";
import { handleServiceError } from "@/lib/http/handleServiceError";
import { readJsonBody } from "@/lib/http/requestBody";
import { serializeSessionCookie } from "@/lib/auth/session";
import { createAuthService } from "@/server/container";

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Invalid login payload.", 400, parsed.error.flatten());
  }

  try {
    const authService = createAuthService();
    const result = await authService.login(parsed.data);
    const response = NextResponse.json({ user: result.user }, { status: 200 });
    response.cookies.set(serializeSessionCookie(result.rawToken, result.expiresAt));
    return response;
  } catch (error) {
    return handleServiceError(error);
  }
}

