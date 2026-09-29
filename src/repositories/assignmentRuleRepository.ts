/**
 * What this file does: resolves and persists assignment rules for incoming tickets.
 * What calls it: TicketService and rule management routes.
 * What it calls: Prisma assignment rule queries.
 * Junior trap: forgetting that null category or priority should act like wildcards.
 */
import { TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AssignmentRuleRepository } from "@/repositories/contracts";

export class PrismaAssignmentRuleRepository implements AssignmentRuleRepository {
  async findBestMatch(input: { groupId: string; category: string; priority: TicketPriority }) {
    // ⚠️ SENIOR NOTE: explicit scoring is safer than relying on enum sort order for rule priority.
    const rules = await prisma.assignmentRule.findMany({
      where: {
        groupId: input.groupId,
        isActive: true,
        AND: [
          {
            OR: [{ category: null }, { category: input.category }]
          },
          {
            OR: [{ priority: null }, { priority: input.priority }]
          }
        ]
      },
      orderBy: [{ createdAt: "asc" }]
    });

    return rules
      .map((rule) => {
        const categoryScore = rule.category === null ? 0 : rule.category === input.category ? 2 : -1;
        const priorityScore = rule.priority === null ? 0 : rule.priority === input.priority ? 2 : -1;
        return { rule, score: categoryScore + priorityScore };
      })
      .filter(({ score }) => score >= 0)
      .sort((left, right) => right.score - left.score)
      .at(0)?.rule ?? null;
  }

  async listByGroup(groupId: string) {
    // ⚠️ SENIOR NOTE: rules must remain group-bound or one team's automation will steer another team's tickets.
    return prisma.assignmentRule.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(input: {
    name: string;
    groupId: string;
    category?: string | null;
    priority?: TicketPriority | null;
    targetGroupId?: string | null;
    targetUserId?: string | null;
    isActive: boolean;
  }) {
    return prisma.assignmentRule.create({ data: input });
  }
}
