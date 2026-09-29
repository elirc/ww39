/**
 * What this file does: builds the app's repositories and services in one place.
 * What calls it: route handlers and tests that want the real composition graph.
 * What it calls: Prisma repository adapters and service constructors.
 * Junior trap: instantiating the same dependencies differently in every route file.
 */
import { AuthService } from "@/services/authService";
import { TicketService } from "@/services/ticketService";
import { RuleService } from "@/services/ruleService";
import { EscalationService } from "@/services/escalationService";
import { PrismaSessionRepository } from "@/repositories/sessionRepository";
import { PrismaUserRepository } from "@/repositories/userRepository";
import { PrismaTicketRepository } from "@/repositories/ticketRepository";
import { PrismaTicketCommentRepository } from "@/repositories/ticketCommentRepository";
import { PrismaSlaPolicyRepository } from "@/repositories/slaPolicyRepository";
import { PrismaAssignmentRuleRepository } from "@/repositories/assignmentRuleRepository";
import { PrismaEscalationRuleRepository } from "@/repositories/escalationRuleRepository";
import { PrismaAuditLogRepository } from "@/repositories/auditLogRepository";
import { PrismaSupportGroupRepository } from "@/repositories/supportGroupRepository";

const sessionRepository = new PrismaSessionRepository();
const userRepository = new PrismaUserRepository();
const ticketRepository = new PrismaTicketRepository();
const ticketCommentRepository = new PrismaTicketCommentRepository();
const slaPolicyRepository = new PrismaSlaPolicyRepository();
const assignmentRuleRepository = new PrismaAssignmentRuleRepository();
const escalationRuleRepository = new PrismaEscalationRuleRepository();
const auditLogRepository = new PrismaAuditLogRepository();
const supportGroupRepository = new PrismaSupportGroupRepository();

export function createAuthService() {
  return new AuthService({ sessionRepository, userRepository });
}

export function createTicketService() {
  return new TicketService({
    ticketRepository,
    userRepository,
    slaPolicyRepository,
    assignmentRuleRepository,
    ticketCommentRepository,
    auditLogRepository,
    supportGroupRepository
  });
}

export function createRuleService() {
  return new RuleService({
    assignmentRuleRepository,
    escalationRuleRepository,
    slaPolicyRepository,
    userRepository,
    auditLogRepository,
    supportGroupRepository
  });
}

export function createEscalationService() {
  return new EscalationService({
    ticketRepository,
    escalationRuleRepository,
    userRepository,
    auditLogRepository,
    supportGroupRepository
  });
}

export function createRepositories() {
  return {
    sessionRepository,
    userRepository,
    ticketRepository,
    ticketCommentRepository,
    slaPolicyRepository,
    assignmentRuleRepository,
    escalationRuleRepository,
    auditLogRepository,
    supportGroupRepository
  };
}
