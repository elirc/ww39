/**
 * What this file does: stores comments against tickets.
 * What calls it: TicketService and comment route handlers.
 * What it calls: Prisma ticket comment inserts.
 * Junior trap: letting internal comments slip into customer-visible surfaces without a flag.
 */
import { prisma } from "@/lib/prisma";
import type { TicketCommentRepository } from "@/repositories/contracts";

export class PrismaTicketCommentRepository implements TicketCommentRepository {
  async add(input: { ticketId: string; authorId: string; body: string; isInternal: boolean }): Promise<void> {
    // ⚠️ SENIOR NOTE: the internal flag is part of the contract with the UI; dropping it would leak private notes.
    await prisma.ticketComment.create({ data: input });
  }
}
