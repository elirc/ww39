/**
 * What this file does: records auditable domain events for ticket operations.
 * What calls it: services after state changes.
 * What it calls: Prisma audit log inserts and ticket-scoped reads.
 * Junior trap: writing audit rows before the primary mutation succeeds.
 */
import { prisma } from "@/lib/prisma";
import type { AuditLogRepository } from "@/repositories/contracts";

export class PrismaAuditLogRepository implements AuditLogRepository {
  async create(input: { actorId?: string | null; entityType: string; entityId: string; action: string; metadata?: unknown; ticketId?: string | null }): Promise<void> {
    // ⚠️ SENIOR NOTE: write audit rows after the primary change so failed operations do not appear as successful events.
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        metadata: input.metadata as never,
        ticketId: input.ticketId ?? null
      }
    });
  }

  async listForTicket(ticketId: string) {
    return prisma.auditLog.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" }
    });
  }
}
