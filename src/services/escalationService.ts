/**
 * What this file does: scans overdue tickets and applies escalation rules.
 * What calls it: the cron route or an operator-only admin endpoint.
 * What it calls: ticket, escalation rule, user, support-group, and audit repositories.
 * Junior trap: escalating tickets without writing an audit trail or re-checking the target group.
 */
import { Role } from "@prisma/client";
import type {
  AuditLogRepository,
  EscalationRuleRepository,
  SupportGroupRepository,
  TicketRepository,
  UserRepository
} from "@/repositories/contracts";

function overdueMinutes(dueAt: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / 60_000));
}

export class EscalationService {
  constructor(
    private readonly deps: {
      ticketRepository: TicketRepository;
      escalationRuleRepository: EscalationRuleRepository;
      userRepository: UserRepository;
      auditLogRepository: AuditLogRepository;
      supportGroupRepository: SupportGroupRepository;
    }
  ) {}

  async runSweep(now = new Date()) {
    const overdueTickets = await this.deps.ticketRepository.listOverdueForEscalation(now);
    const escalated: Array<{ ticketId: string; target: string }> = [];

    for (const ticket of overdueTickets) {
      if (!["NEW", "OPEN", "PENDING"].includes(ticket.status)) continue;
      const dueAt = ticket.firstResponseAt
        ? ticket.resolutionDueAt
        : [ticket.firstResponseDueAt, ticket.resolutionDueAt]
            .filter((value): value is Date => Boolean(value))
            .sort((a, b) => a.getTime() - b.getTime())[0];
      if (!dueAt || dueAt > now) {
        continue;
      }

      const rules = await this.deps.escalationRuleRepository.findApplicable({
        groupId: ticket.supportGroupId,
        priority: ticket.priority
      });
      const breachedMinutes = overdueMinutes(dueAt, now);
      const rule = rules
        .filter((candidate) => candidate.afterMins <= breachedMinutes)
        .sort((a, b) => b.afterMins - a.afterMins || a.id.localeCompare(b.id))[0];
      if (!rule) {
        continue;
      }

      let targetGroupId = rule.targetGroupId ?? ticket.supportGroupId;
      let targetUserId = rule.targetUserId ?? null;

      if (targetUserId) {
        const targetUser = await this.deps.userRepository.findById(targetUserId);
        if (!targetUser || targetUser.role === Role.CUSTOMER) {
          continue;
        }
        targetGroupId = targetUser.supportGroupId ?? targetGroupId;
      }

      const targetGroup = await this.deps.supportGroupRepository.findById(targetGroupId);
      if (!targetGroup) {
        continue;
      }

      const audit = {
        actorId: null,
        action: "ticket.escalated",
        metadata: { fromGroupId: ticket.supportGroupId, toGroupId: targetGroupId, targetUserId }
      };
      const updated = this.deps.ticketRepository.markEscalatedWithAudit
        ? await this.deps.ticketRepository.markEscalatedWithAudit({ ticketId: ticket.id, expectedStatus: ticket.status, supportGroupId: targetGroupId, assigneeId: targetUserId, escalatedAt: now, audit })
        : await this.deps.ticketRepository.markEscalated({ ticketId: ticket.id, expectedStatus: ticket.status, supportGroupId: targetGroupId, assigneeId: targetUserId, escalatedAt: now });

      // ⚠ SENIOR NOTE: escalation is a data-routing event; the audit row is the only durable breadcrumb.
      if (!updated) continue;
      if (!this.deps.ticketRepository.markEscalatedWithAudit) {
        await this.deps.auditLogRepository.create({ actorId: null, entityType: "ticket", entityId: ticket.id, action: audit.action, metadata: audit.metadata, ticketId: ticket.id });
      }

      escalated.push({ ticketId: updated.id, target: targetUserId ?? targetGroupId });
    }

    return { checked: overdueTickets.length, escalated };
  }
}
