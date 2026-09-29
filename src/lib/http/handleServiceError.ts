/**
 * What this file does: maps domain errors to consistent API responses.
 * What calls it: route handlers after service calls fail.
 * What it calls: apiError.
 * Junior trap: leaking raw error messages and stack-ish details back to clients.
 */
import { apiError } from "@/lib/http/apiError";
import { AuthenticationError, ForbiddenError, NotFoundError, ValidationDomainError } from "@/lib/errors/domainErrors";

function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function handleServiceError(error: unknown) {
  if (isAuthenticationError(error)) {
    return apiError("UNAUTHORIZED", error.message, 401);
  }

  if (error instanceof ForbiddenError) {
    return apiError("FORBIDDEN", error.message, 403);
  }

  if (error instanceof NotFoundError) {
    return apiError("NOT_FOUND", error.message, 404);
  }

  if (error instanceof ValidationDomainError) {
    return apiError("INVALID_STATE", error.message, 422);
  }

  if (error instanceof Error) {
    return apiError("INTERNAL_ERROR", error.message, 500);
  }

  return apiError("INTERNAL_ERROR", "Unknown error", 500);
}
