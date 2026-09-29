/**
 * What this file does: loads users for auth, assignment, and permission-aware lookups.
 * What calls it: AuthService, withAuth, TicketService, and rule services.
 * What it calls: Prisma user queries.
 * Junior trap: returning users from the wrong support group when checking assignment targets.
 */
import { prisma } from "@/lib/prisma";
import type { RepoUser, UserRepository } from "@/repositories/contracts";

export class PrismaUserRepository implements UserRepository {
  async findById(id: string): Promise<RepoUser | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<RepoUser | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async listAssignableAgentsByGroup(groupId: string): Promise<RepoUser[]> {
    // ⚠️ SENIOR NOTE: assignment targets must stay inside the same support group unless an admin changes the group.
    return prisma.user.findMany({
      where: {
        supportGroupId: groupId,
        role: { in: ["ADMIN", "MANAGER", "AGENT"] }
      },
      orderBy: { displayName: "asc" }
    });
  }
}
