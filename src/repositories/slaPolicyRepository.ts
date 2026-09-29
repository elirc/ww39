/**
 * What this file does: owns SLA policy reads and writes.
 * What calls it: RuleService and TicketService.
 * What it calls: Prisma SLA policy queries.
 * Junior trap: picking the first policy by group without considering priority specificity.
 */
import { TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SlaPolicyRepository } from "@/repositories/contracts";

export class PrismaSlaPolicyRepository implements SlaPolicyRepository {
  async findByGroupAndPriority(groupId: string, priority: TicketPriority) {
    // ⚠️ SENIOR NOTE: the compound lookup keeps SLA selection deterministic for a given group and priority pair.
    return prisma.slaPolicy.findUnique({
      where: {
        groupId_priority: { groupId, priority }
      }
    });
  }

  async listByGroup(groupId: string) {
    // ⚠️ SENIOR NOTE: list views should stay group-scoped so ops users only see the policies they can actually edit.
    return prisma.slaPolicy.findMany({
      where: { groupId },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
    });
  }

  async create(input: {
    name: string;
    groupId: string;
    priority: TicketPriority;
    firstResponseMins: number;
    resolutionMins: number;
    isActive: boolean;
  }) {
    return prisma.slaPolicy.create({ data: input });
  }
}
