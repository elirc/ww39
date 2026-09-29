/**
 * What this file does: persists escalation policy definitions and reads matching rules.
 * What calls it: RuleService and EscalationService.
 * What it calls: Prisma escalation rule queries.
 * Junior trap: allowing rules to exist with no target and then failing only when the SLA breach happens.
 */
import { TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EscalationRuleRepository } from "@/repositories/contracts";

export class PrismaEscalationRuleRepository implements EscalationRuleRepository {
  async findApplicable(input: { groupId: string; priority: TicketPriority }) {
    // ⚠️ SENIOR NOTE: the ordered list lets the service choose the earliest breached rule without extra DB work.
    return prisma.escalationRule.findMany({
      where: {
        groupId: input.groupId,
        isActive: true,
        OR: [{ priority: null }, { priority: input.priority }]
      },
      orderBy: [{ afterMins: "asc" }]
    });
  }

  async create(input: {
    name: string;
    groupId: string;
    priority?: TicketPriority | null;
    afterMins: number;
    targetGroupId?: string | null;
    targetUserId?: string | null;
    isActive: boolean;
  }) {
    return prisma.escalationRule.create({ data: input });
  }
}
