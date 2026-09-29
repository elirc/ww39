/**
 * What this file does: builds the ticket list filter used to avoid data leakage.
 * What calls it: PrismaTicketRepository.listVisible and visibility tests.
 * What it calls: only local helpers.
 * Junior trap: writing visibility rules inline in a Prisma query where they are hard to test.
 */
import { Role, type Prisma } from "@prisma/client";
import type { VisibleTicketScope } from "@/repositories/contracts";

export function buildVisibleTicketWhere(scope: VisibleTicketScope): Prisma.TicketWhereInput {
  if (scope.role === Role.ADMIN) {
    return {};
  }

  if (scope.role === Role.MANAGER || scope.role === Role.AGENT) {
    if (!scope.supportGroupId) {
      // ⚠️ SENIOR NOTE: a missing supportGroupId on staff must fail closed, not leak all tickets.
      return { id: { equals: "__no_access__" } };
    }

    return { supportGroupId: scope.supportGroupId };
  }

  return { createdById: scope.userId };
}
