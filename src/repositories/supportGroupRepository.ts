/**
 * What this file does: looks up support groups so routing and rule creation can validate them.
 * What calls it: TicketService and RuleService.
 * What it calls: Prisma support-group queries.
 * Junior trap: trusting raw group ids from the client without confirming the group exists.
 */
import { prisma } from "@/lib/prisma";
import type { SupportGroupRepository } from "@/repositories/contracts";

export class PrismaSupportGroupRepository implements SupportGroupRepository {
  async findById(id: string) {
    // ⚠ SENIOR NOTE: a missing group lookup should fail the request, not silently become an orphaned route target.
    return prisma.supportGroup.findUnique({
      where: { id },
      select: { id: true, name: true }
    });
  }

  async listAll() {
    return prisma.supportGroup.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
  }
}
