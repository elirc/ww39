/**
 * What this file does: owns ticket lifecycle rules and SLA-aware decision helpers.
 * What calls it: TicketService, EscalationService, and unit tests.
 * What it calls: only local constants and pure functions.
 * Junior trap: encoding status transitions inline in route handlers where they are easy to drift.
 */
import { TicketPriority, TicketStatus } from "@prisma/client";
import { ValidationDomainError } from "@/lib/errors/domainErrors";

export const VALID_TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: [TicketStatus.OPEN, TicketStatus.CLOSED],
  OPEN: [TicketStatus.PENDING, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  PENDING: [TicketStatus.OPEN, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  RESOLVED: [TicketStatus.OPEN, TicketStatus.CLOSED],
  CLOSED: [TicketStatus.OPEN]
};

export function assertValidTransition(from: TicketStatus, to: TicketStatus) {
  if (!VALID_TICKET_TRANSITIONS[from].includes(to)) {
    // ⚠️ SENIOR NOTE: this guard is the only thing stopping illegal lifecycle jumps from leaking into audit history.
    throw new ValidationDomainError(`Invalid ticket transition from ${from} to ${to}`);
  }
}

export function priorityWeight(priority: TicketPriority) {
  switch (priority) {
    case TicketPriority.LOW:
      return 1;
    case TicketPriority.NORMAL:
      return 2;
    case TicketPriority.HIGH:
      return 3;
    case TicketPriority.URGENT:
      return 4;
  }
}
