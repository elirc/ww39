/**
 * What this file does: defines the shared domain error types used by services.
 * What calls it: services and route handlers.
 * What it calls: nothing.
 * Junior trap: using plain Error for everything and then guessing the HTTP status later.
 */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationDomainError";
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}
