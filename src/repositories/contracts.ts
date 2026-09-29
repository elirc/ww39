/**
 * What this file does: defines the repository contracts the services depend on.
 * What calls it: services, tests, and Prisma repository adapters.
 * What it calls: only shared domain types.
 * Junior trap: coupling services directly to Prisma so unit tests become integration tests.
 */
import { Role, TicketPriority, TicketStatus } from "@prisma/client";

export type RepoUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  supportGroupId: string | null;
  passwordHash: string;
};

export type RepoSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type RepoTicket = {
  id: string;
  number: number;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  requesterName: string;
  requesterEmail: string;
  createdById: string;
  supportGroupId: string;
  assigneeId: string | null;
  slaPolicyId: string | null;
  firstResponseDueAt: Date | null;
  resolutionDueAt: Date | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  escalatedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VisibleTicketScope = {
  userId: string;
  role: Role;
  supportGroupId: string | null;
};

export interface SessionRepository {
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RepoSession>;
  findByTokenHash(tokenHash: string): Promise<RepoSession | null>;
  revokeByTokenHash(tokenHash: string): Promise<void>;
}

export interface UserRepository {
  findById(id: string): Promise<RepoUser | null>;
  findByEmail(email: string): Promise<RepoUser | null>;
  listAssignableAgentsByGroup(groupId: string): Promise<RepoUser[]>;
}

export interface SupportGroupRepository {
  findById(id: string): Promise<{ id: string; name: string } | null>;
  listAll(): Promise<Array<{ id: string; name: string }>>;
}

export interface TicketRepository {
  create(input: {
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
  }): Promise<RepoTicket>;
  findById(id: string): Promise<RepoTicket | null>;
  listVisible(scope: VisibleTicketScope): Promise<RepoTicket[]>;
  updateStatus(input: { ticketId: string; status: TicketStatus; expectedStatus?: TicketStatus; firstResponseAt?: Date | null; resolvedAt?: Date | null; closedAt?: Date | null }): Promise<RepoTicket | null>;
  assign(input: { ticketId: string; assigneeId?: string | null; supportGroupId?: string | null; expectedFirstResponseAt?: Date | null; expectedStatus?: TicketStatus; expectedSupportGroupId?: string }): Promise<RepoTicket | null>;
  updateDueDates(input: { ticketId: string; firstResponseDueAt?: Date | null; resolutionDueAt?: Date | null; expectedStatus?: TicketStatus }): Promise<RepoTicket | null>;
  markFirstResponse(input: { ticketId: string; firstResponseAt: Date }): Promise<RepoTicket | null>;
  listOverdueForEscalation(now: Date): Promise<RepoTicket[]>;
  markEscalated(input: { ticketId: string; expectedStatus?: TicketStatus; supportGroupId?: string | null; assigneeId?: string | null; escalatedAt: Date }): Promise<RepoTicket | null>;
  markEscalatedWithAudit?(input: { ticketId: string; expectedStatus?: TicketStatus; supportGroupId?: string | null; assigneeId?: string | null; escalatedAt: Date; audit: { actorId?: string | null; action: string; metadata?: unknown } }): Promise<RepoTicket | null>;
}

export interface TicketCommentRepository {
  add(input: { ticketId: string; authorId: string; body: string; isInternal: boolean }): Promise<void>;
}

export interface SlaPolicyRepository {
  findByGroupAndPriority(groupId: string, priority: TicketPriority): Promise<{ id: string; firstResponseMins: number; resolutionMins: number; isActive: boolean } | null>;
  listByGroup(groupId: string): Promise<Array<{ id: string; name: string; priority: TicketPriority; firstResponseMins: number; resolutionMins: number; isActive: boolean }>>;
  create(input: { name: string; groupId: string; priority: TicketPriority; firstResponseMins: number; resolutionMins: number; isActive: boolean }): Promise<{ id: string }>;
}

export interface AssignmentRuleRepository {
  findBestMatch(input: { groupId: string; category: string; priority: TicketPriority }): Promise<{ id: string; targetGroupId: string | null; targetUserId: string | null; isActive: boolean } | null>;
  listByGroup(groupId: string): Promise<Array<{ id: string; name: string; isActive: boolean }>>;
  create(input: { name: string; groupId: string; category?: string | null; priority?: TicketPriority | null; targetGroupId?: string | null; targetUserId?: string | null; isActive: boolean }): Promise<{ id: string }>;
}

export interface EscalationRuleRepository {
  findApplicable(input: { groupId: string; priority: TicketPriority }): Promise<Array<{ id: string; afterMins: number; targetGroupId: string | null; targetUserId: string | null; isActive: boolean }>>;
  create(input: { name: string; groupId: string; priority?: TicketPriority | null; afterMins: number; targetGroupId?: string | null; targetUserId?: string | null; isActive: boolean }): Promise<{ id: string }>;
}

export interface AuditLogRepository {
  create(input: { actorId?: string | null; entityType: string; entityId: string; action: string; metadata?: unknown; ticketId?: string | null }): Promise<void>;
  listForTicket(ticketId: string): Promise<Array<{ id: string; action: string; entityType: string; entityId: string; metadata: unknown; createdAt: Date }>>;
}
