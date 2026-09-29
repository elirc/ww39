/**
 * What this file does: owns all Prisma reads and writes for tickets.
 * What calls it: TicketService, EscalationService, and ticket-related route handlers indirectly.
 * What it calls: Prisma ticket queries and mutations.
 * Junior trap: forgetting support-group scoping on list queries and leaking cross-group data.
 */
import { TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RepoTicket, TicketRepository, VisibleTicketScope } from "@/repositories/contracts";
import { buildVisibleTicketWhere } from "@/domain/ticketVisibility";

export class PrismaTicketRepository implements TicketRepository {
  async create(input: {
    subject: string;
    description: string;
    category: string;
    priority: TicketPriority;
    requesterName: string;
    requesterEmail: string;
    createdById: string;
    supportGroupId: string;
    assigneeId?: string | null;
    slaPolicyId?: string | null;
    firstResponseDueAt?: Date | null;
    resolutionDueAt?: Date | null;
  }): Promise<RepoTicket> {
    return prisma.ticket.create({ data: input });
  }

  async findById(id: string): Promise<RepoTicket | null> {
    return prisma.ticket.findUnique({ where: { id } });
  }

  async listVisible(scope: VisibleTicketScope): Promise<RepoTicket[]> {
    // ⚠️ SENIOR NOTE: every caller relies on this helper to avoid leaking tickets across ownership boundaries.
    return prisma.ticket.findMany({
      where: buildVisibleTicketWhere(scope),
      orderBy: [{ updatedAt: "desc" }, { number: "desc" }]
    });
  }

  async updateStatus(input: {
    ticketId: string;
    status: TicketStatus;
    expectedStatus?: TicketStatus;
    firstResponseAt?: Date | null;
    resolvedAt?: Date | null;
    closedAt?: Date | null;
  }): Promise<RepoTicket | null> {
    const result = await prisma.ticket.updateMany({
      where: { id: input.ticketId, ...(input.expectedStatus ? { status: input.expectedStatus } : {}) },
      data: {
        status: input.status,
        firstResponseAt: input.firstResponseAt,
        resolvedAt: input.resolvedAt,
        closedAt: input.closedAt
      }
    });
    return result.count ? this.findById(input.ticketId) as Promise<RepoTicket> : null;
  }

  async assign(input: { ticketId: string; assigneeId?: string | null; supportGroupId?: string | null; expectedFirstResponseAt?: Date | null; expectedStatus?: TicketStatus; expectedSupportGroupId?: string }): Promise<RepoTicket | null> {
    const result = await prisma.ticket.updateMany({
      where: { id: input.ticketId, firstResponseAt: input.expectedFirstResponseAt ?? null, ...(input.expectedStatus ? { status: input.expectedStatus } : {}), ...(input.expectedSupportGroupId ? { supportGroupId: input.expectedSupportGroupId } : {}) },
      data: {
        assigneeId: (input.assigneeId === undefined ? undefined : input.assigneeId) as any,
        supportGroupId: (input.supportGroupId === undefined ? undefined : input.supportGroupId) as any
      }
    });
    return result.count ? this.findById(input.ticketId) as Promise<RepoTicket> : null;
  }

  async updateDueDates(input: { ticketId: string; firstResponseDueAt?: Date | null; resolutionDueAt?: Date | null; expectedStatus?: TicketStatus }): Promise<RepoTicket | null> {
    const result = await prisma.ticket.updateMany({
      where: { id: input.ticketId, escalatedAt: null, ...(input.expectedStatus ? { status: input.expectedStatus } : {}) },
      data: {
        firstResponseDueAt: input.firstResponseDueAt === undefined ? undefined : input.firstResponseDueAt,
        resolutionDueAt: input.resolutionDueAt === undefined ? undefined : input.resolutionDueAt
      }
    });
    return result.count ? this.findById(input.ticketId) as Promise<RepoTicket> : null;
  }

  async markFirstResponse(input: { ticketId: string; firstResponseAt: Date }): Promise<RepoTicket | null> {
    // ⚠️ SENIOR NOTE: keep SLA timing writes separate from status writes so comment flows do not fake a lifecycle change.
    const result = await prisma.ticket.updateMany({
      where: { id: input.ticketId, firstResponseAt: null },
      data: { firstResponseAt: input.firstResponseAt }
    });
    return result.count ? this.findById(input.ticketId) : null;
  }

  async listOverdueForEscalation(now: Date): Promise<RepoTicket[]> {
    // ⚠️ SENIOR NOTE: this query intentionally narrows to active work items; closed tickets should never be swept.
    return prisma.ticket.findMany({
      where: {
        status: { in: [TicketStatus.NEW, TicketStatus.OPEN, TicketStatus.PENDING] },
        escalatedAt: null,
        OR: [
          { resolutionDueAt: { lt: now } },
          { firstResponseAt: null, firstResponseDueAt: { lt: now } }
        ]
      },
      orderBy: [{ resolutionDueAt: "asc" }, { firstResponseDueAt: "asc" }]
    });
  }

  async markEscalated(input: { ticketId: string; expectedStatus?: TicketStatus; supportGroupId?: string | null; assigneeId?: string | null; escalatedAt: Date }): Promise<RepoTicket | null> {
    // ⚠️ SENIOR NOTE: escalation mutates routing and must leave a durable timestamp for audits and ops reporting.
    const result = await prisma.ticket.updateMany({
      where: { id: input.ticketId, escalatedAt: null, ...(input.expectedStatus ? { status: input.expectedStatus } : {}) },
      data: {
        supportGroupId: (input.supportGroupId === undefined ? undefined : input.supportGroupId) as any,
        assigneeId: (input.assigneeId === undefined ? undefined : input.assigneeId) as any,
        escalatedAt: input.escalatedAt
      }
    });
    return result.count ? this.findById(input.ticketId) : null;
  }

  async markEscalatedWithAudit(input: { ticketId: string; expectedStatus?: TicketStatus; supportGroupId?: string | null; assigneeId?: string | null; escalatedAt: Date; audit: { actorId?: string | null; action: string; metadata?: unknown } }): Promise<RepoTicket | null> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.ticket.updateMany({
        where: { id: input.ticketId, escalatedAt: null, ...(input.expectedStatus ? { status: input.expectedStatus } : {}) },
        data: {
          supportGroupId: (input.supportGroupId === undefined ? undefined : input.supportGroupId) as any,
          assigneeId: (input.assigneeId === undefined ? undefined : input.assigneeId) as any,
          escalatedAt: input.escalatedAt
        }
      });
      if (result.count !== 1) return null;
      await tx.auditLog.create({
        data: {
          actorId: input.audit.actorId ?? null,
          entityType: "ticket",
          entityId: input.ticketId,
          action: input.audit.action,
          metadata: input.audit.metadata as never,
          ticketId: input.ticketId
        }
      });
      return tx.ticket.findUnique({ where: { id: input.ticketId } });
    });
  }
}
