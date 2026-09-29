/**
 * What this file does: standardizes JSON API error responses and status codes.
 * What calls it: route handlers and guard utilities.
 * What it calls: NextResponse from next/server.
 * Junior trap: returning inconsistent shapes that make client code branch on guesses.
 */
import { NextResponse } from "next/server";

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function apiError(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, details } } satisfies ApiError,
    { status }
  );
}

