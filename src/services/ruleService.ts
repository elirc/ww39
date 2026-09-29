/**
 * What this file does: manages assignment, SLA, and escalation rule creation/listing.
 * What calls it: rule and SLA API routes.
 * What it calls: rule repositories, user repository, support-group lookup, and audit logs.
 * Junior trap: treating rule management as simple CRUD and missing target validation.
 */
import { Role, TicketPriority } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationDomainError } from "@/lib/errors/domainErrors";
import { hasCapability, type AuthUser } from "@/lib/auth/permissions";
import type {
  AssignmentRuleRepository,
  AuditLogRepository,
  EscalationRuleRepository,
  SlaPolicyRepository,
  SupportGroupRepository,
  UserRepository
} from "@/repositories/contracts";

export class RuleService {
  constructor(
    private readonly deps: {
      assignmentRuleRepository: AssignmentRuleRepository;
      escalationRuleRepository: EscalationRuleRepository;
      slaPolicyRepository: SlaPolicyRepository;
      userRepository: UserRepository;
      auditLogRepository: AuditLogRepository;
      supportGroupRepository: SupportGroupRepository;
    }
  ) {}

  async listAssignmentRules(auth: AuthUser, groupId: string) {
    if (!hasCapability(auth, "rule:write")) {
      throw new ForbiddenError("You cannot manage rules");
    }

    const group = await this.deps.supportGroupRepository.findById(groupId);
    if (!group) {
      throw new ValidationDomainError("Assignment rule group does not exist");
    }

    return this.deps.assignmentRuleRepository.listByGroup(groupId);
  }

  async listSlaPolicies(auth: AuthUser, groupId: string) {
    if (!hasCapability(auth, "sla:write")) {
      throw new ForbiddenError("You cannot manage SLA policies");
    }

    const group = await this.deps.supportGroupRepository.findById(groupId);
    if (!group) {
      throw new ValidationDomainError("SLA policy group does not exist");
    }

    return this.deps.slaPolicyRepository.listByGroup(groupId);
  }

  async createAssignmentRule(
    auth: AuthUser,
    input: {
      name: string;
      groupId: string;
      category?: string | null;
      priority?: TicketPriority | null;
      targetGroupId?: string | null;
      targetUserId?: string | null;
      isActive: boolean;
    }
  ) {
    if (!hasCapability(auth, "rule:write")) {
      throw new ForbiddenError("You cannot manage rules");
    }

    const group = await this.deps.supportGroupRepository.findById(input.groupId);
    if (!group) {
      throw new ValidationDomainError("Assignment rule group does not exist");
    }

    if (input.targetUserId) {
      const targetUser = await this.deps.userRepository.findById(input.targetUserId);
      if (!targetUser) {
        throw new NotFoundError("Target user not found");
      }
      if (targetUser.role === Role.CUSTOMER) {
        // ⚠ SENIOR NOTE: a customer-targeted rule would eventually route work to someone who cannot receive work.
        throw new ValidationDomainError("Assignment rules cannot target customers");
      }
      if (targetUser.supportGroupId && targetUser.supportGroupId !== input.groupId) {
        throw new ValidationDomainError("Assignment rules must target a user in the same support group");
      }
    }

    if (input.targetGroupId) {
      const targetGroup = await this.deps.supportGroupRepository.findById(input.targetGroupId);
      if (!targetGroup) {
        throw new NotFoundError("Target group not found");
      }
    }

    const rule = await this.deps.assignmentRuleRepository.create(input);
    await this.deps.auditLogRepository.create({
      actorId: auth.id,
      entityType: "assignment_rule",
      entityId: rule.id,
      action: "rule.created",
      metadata: input
    });
    return rule;
  }

  async createSlaPolicy(
    auth: AuthUser,
    input: {
      name: string;
      groupId: string;
      priority: TicketPriority;
      firstResponseMins: number;
      resolutionMins: number;
      isActive: boolean;
    }
  ) {
    if (!hasCapability(auth, "sla:write")) {
      throw new ForbiddenError("You cannot manage SLA policies");
    }

    const group = await this.deps.supportGroupRepository.findById(input.groupId);
    if (!group) {
      throw new ValidationDomainError("SLA policy group does not exist");
    }

    const policy = await this.deps.slaPolicyRepository.create(input);
    await this.deps.auditLogRepository.create({
      actorId: auth.id,
      entityType: "sla_policy",
      entityId: policy.id,
      action: "sla.created",
      metadata: input
    });
    return policy;
  }

  async createEscalationRule(
    auth: AuthUser,
    input: {
      name: string;
      groupId: string;
      priority?: TicketPriority | null;
      afterMins: number;
      targetGroupId?: string | null;
      targetUserId?: string | null;
      isActive: boolean;
    }
  ) {
    if (!hasCapability(auth, "rule:write")) {
      throw new ForbiddenError("You cannot manage rules");
    }

    const group = await this.deps.supportGroupRepository.findById(input.groupId);
    if (!group) {
      throw new ValidationDomainError("Escalation rule group does not exist");
    }

    if (input.targetUserId) {
      const targetUser = await this.deps.userRepository.findById(input.targetUserId);
      if (!targetUser) {
        throw new NotFoundError("Target user not found");
      }
      if (targetUser.role === Role.CUSTOMER) {
        throw new ValidationDomainError("Escalation rules cannot target customers");
      }
    }

    if (input.targetGroupId) {
      const targetGroup = await this.deps.supportGroupRepository.findById(input.targetGroupId);
      if (!targetGroup) {
        throw new NotFoundError("Target group not found");
      }
    }

    const rule = await this.deps.escalationRuleRepository.create(input);
    await this.deps.auditLogRepository.create({
      actorId: auth.id,
      entityType: "escalation_rule",
      entityId: rule.id,
      action: "escalation.created",
      metadata: input
    });
    return rule;
  }
}

export { ForbiddenError };
