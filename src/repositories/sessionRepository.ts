/**
 * What this file does: persists opaque auth sessions and token hashes.
 * What calls it: AuthService, withAuth, and logout handlers.
 * What it calls: Prisma session table queries.
 * Junior trap: checking a session token without hashing it first.
 */
import { prisma } from "@/lib/prisma";
import type { RepoSession, SessionRepository } from "@/repositories/contracts";

export class PrismaSessionRepository implements SessionRepository {
  async create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RepoSession> {
    return prisma.session.create({ data: input });
  }

  async findByTokenHash(tokenHash: string) {
    // ⚠️ SENIOR NOTE: the lookup must stay on the hash, not the raw token, so a DB dump cannot mint sessions.
    return prisma.session.findUnique({ where: { tokenHash } });
  }

  async revokeByTokenHash(tokenHash: string) {
    await prisma.session.deleteMany({ where: { tokenHash } });
  }
}
