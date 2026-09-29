/**
 * What this file does: verifies credentials and issues/revokes sessions.
 * What calls it: auth route handlers and login tests.
 * What it calls: user/session repositories and password/session helpers.
 * Junior trap: mixing session creation with password verification inside route handlers.
 */
import { hashSessionToken, createSessionToken } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { AuthenticationError } from "@/lib/errors/domainErrors";
import type { SessionRepository, UserRepository } from "@/repositories/contracts";

export class AuthService {
  constructor(
    private readonly deps: {
      userRepository: UserRepository;
      sessionRepository: SessionRepository;
    }
  ) {}

  async login(input: { email: string; password: string }) {
    const user = await this.deps.userRepository.findByEmail(input.email);
    if (!user) {
      throw new AuthenticationError("Invalid credentials");
    }

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) {
      throw new AuthenticationError("Invalid credentials");
    }

    const rawToken = createSessionToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    // ⚠️ SENIOR NOTE: keep the session token opaque; the DB should never need to know the raw cookie value.
    await this.deps.sessionRepository.create({
      userId: user.id,
      tokenHash: hashSessionToken(rawToken),
      expiresAt
    });

    return {
      rawToken,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        supportGroupId: user.supportGroupId
      }
    };
  }

  async logout(token: string) {
    await this.deps.sessionRepository.revokeByTokenHash(hashSessionToken(token));
  }
}
