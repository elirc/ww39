import { describe, expect, it } from "vitest";
import { TicketStatus } from "@prisma/client";
import { TicketService } from "@/services/ticketService";
import { ValidationDomainError } from "@/lib/errors/domainErrors";
import type {
  AssignmentRuleRepository,
  AuditLogRepository,
  SlaPolicyRepository,
  SupportGroupRepository,
  TicketCommentRepository,
  TicketRepository,
  UserRepository
} from "@/repositories/contracts";

const ticket = {
  id: "ticket-1",
  number: 101,
  subject: "Problem",
  description: "Something broke",
  category: "General",
  priority: "NORMAL" as const,
  status: TicketStatus.CLOSED,
  requesterName: "Requester",
  requesterEmail: "requester@example.com",
  createdById: "user-1",
  supportGroupId: "group-1",
  assigneeId: null,
  slaPolicyId: null,
  firstResponseDueAt: null,
  resolutionDueAt: null,
  firstResponseAt: null,
  resolvedAt: null,
  escalatedAt: null,
  closedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
};

const ticketRepository: TicketRepository = {
  async create() {
    throw new Error("not used");
  },
  async findById() {
    return ticket;
  },
  async listVisible() {
    return [ticket];
  },
  async updateStatus() {
    throw new Error("not used");
  },
  async assign() {
    throw new Error("not used");
  },
  async updateDueDates() {
    throw new Error("not used");
  },
  async markFirstResponse() {
    throw new Error("not used");
  },
  async listOverdueForEscalation() {
    return [];
  },
  async markEscalated() {
    throw new Error("not used");
  }
};

const userRepository: UserRepository = {
  async findById() {
    return {
      id: "user-1",
      email: "agent@atlas.local",
      displayName: "Agent",
      role: "AGENT",
      supportGroupId: "group-1",
      passwordHash: "hash"
    };
  },
  async findByEmail() {
    return null;
  },
  async listAssignableAgentsByGroup() {
    return [];
  }
};

const slaPolicyRepository: SlaPolicyRepository = {
  async findByGroupAndPriority() {
    return null;
  },
  async listByGroup() {
    return [];
  },
  async create() {
    throw new Error("not used");
  }
};

const supportGroupRepository: SupportGroupRepository = {
  async findById() {
    return { id: "group-1", name: "Platform" };
  },
  async listAll() {
    return [{ id: "group-1", name: "Platform" }];
  }
};

const assignmentRuleRepository: AssignmentRuleRepository = {
  async findBestMatch() {
    return null;
  },
  async listByGroup() {
    return [];
  },
  async create() {
    throw new Error("not used");
  }
};

const ticketCommentRepository: TicketCommentRepository = {
  async add() {
    throw new Error("not used");
  }
};

const auditLogRepository: AuditLogRepository = {
  async create() {},
  async listForTicket() {
    return [];
  }
};

describe("ticket state transitions", () => {
  it("rejects an invalid closed-to-pending transition", async () => {
    // This test matters because lifecycle bugs create inconsistent ticket states that are painful to repair later.
    const service = new TicketService({
      ticketRepository,
      userRepository,
      slaPolicyRepository,
      assignmentRuleRepository,
      ticketCommentRepository,
      auditLogRepository,
      supportGroupRepository
    });

    await expect(
      service.updateTicketStatus(
        {
          id: "user-1",
          email: "agent@atlas.local",
          displayName: "Agent",
          role: "AGENT",
          supportGroupId: "group-1"
        },
        "ticket-1",
        { status: TicketStatus.PENDING }
      )
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });
});
