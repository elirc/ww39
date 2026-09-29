/**
 * What this file does: owns ticket lifecycle, assignment, and comment business rules.
 * What calls it: ticket routes and workflow routes.
 * What it calls: ticket, user, SLA, assignment, comment, and audit repositories.
 * Junior trap: making route handlers decide status transitions or assignment rules themselves.
 */
import { Role, TicketPriority, TicketStatus } from "@prisma/client";
import { assertValidTransition } from "@/domain/ticketDomain";
import { ForbiddenError, NotFoundError, ValidationDomainError } from "@/lib/errors/domainErrors";
import { hasCapability, mayReadTicket, type AuthUser } from "@/lib/auth/permissions";
import type {
  AssignmentRuleRepository,
  AuditLogRepository,
  SlaPolicyRepository,
  SupportGroupRepository,
  TicketCommentRepository,
  TicketRepository,
  UserRepository
} from "@/repositories/contracts";

function computeDueDate(now: Date, minutes: number) {
  return new Date(now.getTime() + minutes * 60_000);
}

export class TicketService {
  constructor(
    private readonly deps: {
      ticketRepository: TicketRepository;
      userRepository: UserRepository;
      slaPolicyRepository: SlaPolicyRepository;
      assignmentRuleRepository: AssignmentRuleRepository;
      ticketCommentRepository: TicketCommentRepository;
      auditLogRepository: AuditLogRepository;
      supportGroupRepository: SupportGroupRepository;
    }
  ) {}

  async listTickets(auth: AuthUser) {
    return this.deps.ticketRepository.listVisible({
      userId: auth.id,
      role: auth.role,
      supportGroupId: auth.supportGroupId
    });
  }

  async getTicket(auth: AuthUser, ticketId: string) {
    const ticket = await this.deps.ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (!mayReadTicket(auth, ticket.createdById, ticket.supportGroupId)) {
      throw new ForbiddenError("You cannot read this ticket");
    }

    return ticket;
  }

  async createTicket(
    auth: AuthUser,
    input: {
      subject: string;
      description: string;
      category: string;
      priority: TicketPriority;
      requesterName: string;
      requesterEmail: string;
      supportGroupId: string;
    }
  ) {
    if (auth.role === Role.CUSTOMER && auth.supportGroupId !== input.supportGroupId) {
      throw new ForbiddenError("Customers can only create tickets in their own support group");
    }

    const sourceGroup = await this.deps.supportGroupRepository.findById(input.supportGroupId);
    if (!sourceGroup) {
      throw new ValidationDomainError("Support group does not exist");
    }

    const assignmentRule = await this.deps.assignmentRuleRepository.findBestMatch({
      groupId: input.supportGroupId,
      category: input.category,
      priority: input.priority
    });

    let assigneeId: string | null = null;
    let finalGroupId = input.supportGroupId;

    if (assignmentRule?.targetUserId) {
      const targetUser = await this.deps.userRepository.findById(assignmentRule.targetUserId);
      if (!targetUser) {
        throw new NotFoundError("Assignment rule references a missing user");
      }
      if (targetUser.role === Role.CUSTOMER) {
        throw new ValidationDomainError("Assignment target user cannot be a customer");
      }
      if (targetUser.supportGroupId && targetUser.supportGroupId !== input.supportGroupId) {
        // ⚠️ SENIOR NOTE: silent cross-group assignment is a classic data-routing bug in support systems.
        throw new ValidationDomainError("Assignment target user must belong to the ticket's support group");
      }
      assigneeId = targetUser.id;
      finalGroupId = targetUser.supportGroupId ?? input.supportGroupId;
    } else if (assignmentRule?.targetGroupId) {
      const targetGroup = await this.deps.supportGroupRepository.findById(assignmentRule.targetGroupId);
      if (!targetGroup) throw new ValidationDomainError("Assignment rule references a missing support group");
      finalGroupId = assignmentRule.targetGroupId;
    }

    const slaPolicy = await this.deps.slaPolicyRepository.findByGroupAndPriority(finalGroupId, input.priority);

    const now = new Date();
    const ticket = await this.deps.ticketRepository.create({
      ...input,
      createdById: auth.id,
      supportGroupId: finalGroupId,
      assigneeId,
      slaPolicyId: slaPolicy?.id ?? null,
      firstResponseDueAt: slaPolicy ? computeDueDate(now, slaPolicy.firstResponseMins) : null,
      resolutionDueAt: slaPolicy ? computeDueDate(now, slaPolicy.resolutionMins) : null
    });

    await this.deps.auditLogRepository.create({
      actorId: auth.id,
      entityType: "ticket",
      entityId: ticket.id,
      action: "ticket.created",
      metadata: {
        priority: input.priority,
        supportGroupId: finalGroupId,
        assigneeId
      },
      ticketId: ticket.id
    });

    return ticket;
  }

  async updateTicketStatus(
    auth: AuthUser,
    ticketId: string,
    input: { status: TicketStatus; note?: string }
  ) {
    if (!hasCapability(auth, "ticket:update:any")) {
      throw new ForbiddenError("Only staff can change ticket status");
    }

    const ticket = await this.getTicket(auth, ticketId);
    assertValidTransition(ticket.status, input.status);

    const now = new Date();
    const firstResponseAt = ticket.firstResponseAt ?? (ticket.status === TicketStatus.NEW ? now : null);
    const resolvedAt = input.status === TicketStatus.RESOLVED ? now : ticket.resolvedAt;
    const closedAt = input.status === TicketStatus.CLOSED ? now : ticket.closedAt;

    const updated = await this.deps.ticketRepository.updateStatus({
      ticketId,
      status: input.status,
      expectedStatus: ticket.status,
      firstResponseAt,
      resolvedAt,
      closedAt
    });

    if (!updated) throw new ValidationDomainError("Ticket changed before status update; retry the request");
    await this.deps.auditLogRepository.create({
      actorId: auth.id,
      entityType: "ticket",
      entityId: ticketId,
      action: "ticket.status_updated",
      metadata: {
        from: ticket.status,
        to: input.status,
        note: input.note ?? null
      },
      ticketId
    });

    return updated;
  }

  async assignTicket(
    auth: AuthUser,
    ticketId: string,
    input: { assigneeId?: string | null; supportGroupId?: string | null; reason: string }
  ) {
    if (!hasCapability(auth, "ticket:assign")) {
      throw new ForbiddenError("You cannot assign tickets");
    }

    const ticket = await this.getTicket(auth, ticketId);
    const isAdmin = auth.role === Role.ADMIN;
    const sameGroup = auth.supportGroupId && auth.supportGroupId === ticket.supportGroupId;
    if (!isAdmin && !sameGroup) {
      throw new ForbiddenError("You can only assign tickets in your own support group");
    }

    if (input.supportGroupId) {
      const nextGroup = await this.deps.supportGroupRepository.findById(input.supportGroupId);
      if (!nextGroup) {
        throw new ValidationDomainError("Target support group does not exist");
      }
    }

    let nextAssigneeId = input.assigneeId === undefined ? ticket.assigneeId : input.assigneeId;
    let nextGroupId = input.supportGroupId ?? ticket.supportGroupId;

    if (input.assigneeId) {
      const assignee = await this.deps.userRepository.findById(input.assigneeId);
      if (!assignee) {
        throw new NotFoundError("Assignee not found");
      }
      if (assignee.role === Role.CUSTOMER) {
        throw new ValidationDomainError("Assignee cannot be a customer");
      }

      if (!isAdmin && assignee.supportGroupId !== ticket.supportGroupId) {
        throw new ForbiddenError("Assignee must belong to the ticket's support group");
      }

      nextGroupId = assignee.supportGroupId ?? nextGroupId;
      nextAssigneeId = assignee.id;
    }

    if (input.supportGroupId && nextAssigneeId) {
      const currentAssignee = await this.deps.userRepository.findById(nextAssigneeId);
      if (currentAssignee?.supportGroupId && currentAssignee.supportGroupId !== nextGroupId) {
        nextAssigneeId = null;
      }
    }

    if (input.supportGroupId && !isAdmin && input.supportGroupId !== ticket.supportGroupId) {
      throw new ForbiddenError("Only admins can move a ticket to a different group");
    }

    const updated = await this.deps.ticketRepository.assign({
      ticketId,
      assigneeId: nextAssigneeId,
      supportGroupId: nextGroupId,
      expectedFirstResponseAt: ticket.firstResponseAt,
      expectedStatus: ticket.status,
      expectedSupportGroupId: ticket.supportGroupId
    });
    if (!updated) throw new ValidationDomainError("Ticket changed before assignment; retry the request");

    await this.deps.auditLogRepository.create({
      actorId: auth.id,
      entityType: "ticket",
      entityId: ticketId,
      action: "ticket.assigned",
      metadata: {
        reason: input.reason,
        assigneeId: nextAssigneeId,
        supportGroupId: nextGroupId
      },
      ticketId
    });

    return updated;
  }

  async addComment(
    auth: AuthUser,
    ticketId: string,
    input: { body: string; isInternal: boolean }
  ) {
    const ticket = await this.getTicket(auth, ticketId);
    if (input.isInternal && auth.role === Role.CUSTOMER) {
      throw new ForbiddenError("Customers cannot add internal notes");
    }

    const isCustomerOwnTicket = auth.role === Role.CUSTOMER && auth.id === ticket.createdById;
    const isStaffInGroup =
      auth.role !== Role.CUSTOMER &&
      auth.supportGroupId !== null &&
      auth.supportGroupId === ticket.supportGroupId;

    if (!isCustomerOwnTicket && !isStaffInGroup && auth.role !== Role.ADMIN) {
      throw new ForbiddenError("You cannot comment on this ticket");
    }

    await this.deps.ticketCommentRepository.add({
      ticketId,
      authorId: auth.id,
      body: input.body,
      isInternal: input.isInternal
    });

    if (!input.isInternal && auth.role !== Role.CUSTOMER && !ticket.firstResponseAt) {
      // ⚠️ SENIOR NOTE: the first staff reply is part of SLA math, so we set it at the service boundary.
      await this.deps.ticketRepository.markFirstResponse({
        ticketId,
        firstResponseAt: new Date()
      });
    }

    await this.deps.auditLogRepository.create({
      actorId: auth.id,
      entityType: "ticket_comment",
      entityId: ticketId,
      action: "ticket.comment_added",
      metadata: { isInternal: input.isInternal },
      ticketId
    });
  }
}

export { ForbiddenError, NotFoundError };
