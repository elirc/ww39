import { describe, expect, it } from "vitest";
import { TicketService } from "@/services/ticketService";
import { ValidationDomainError } from "@/lib/errors/domainErrors";
import { TicketStatus } from "@prisma/client";

const ticket = { id: "t1", number: 1, subject: "x", description: "x", category: "general", priority: "NORMAL" as const, status: TicketStatus.OPEN, requesterName: "R", requesterEmail: "r@e.test", createdById: "c", supportGroupId: "g1", assigneeId: "u1", slaPolicyId: null, firstResponseDueAt: null, resolutionDueAt: null, firstResponseAt: null, resolvedAt: null, escalatedAt: null, closedAt: null, createdAt: new Date(), updatedAt: new Date() };
const auth = { id: "u2", email: "a@e.test", displayName: "Agent", role: "AGENT" as const, supportGroupId: "g1" };
function service(overrides: Record<string, unknown> = {}) {
  const assigned: unknown[] = [];
  const deps: any = {
    ticketRepository: { findById: async () => ticket, listVisible: async () => [], assign: async (x: unknown) => (assigned.push(x), ticket), updateStatus: async () => ticket, create: async () => ticket, updateDueDates: async () => ticket, markFirstResponse: async () => ticket, listOverdueForEscalation: async () => [], markEscalated: async () => ticket },
    userRepository: { findById: async (id: string) => id === "u1" ? { id, email: "u1@e.test", displayName: "Agent", role: "AGENT", supportGroupId: "g1", passwordHash: "x" } : null },
    supportGroupRepository: { findById: async (id: string) => id === "g1" || id === "g2" ? { id, name: id } : null, listAll: async () => [] },
    slaPolicyRepository: { findByGroupAndPriority: async () => null, listByGroup: async () => [], create: async () => ({ id: "s" }) },
    assignmentRuleRepository: { findBestMatch: async () => null, listByGroup: async () => [], create: async () => ({ id: "r" }) },
    ticketCommentRepository: { add: async () => {} }, auditLogRepository: { create: async () => {}, listForTicket: async () => [] }, ...overrides
  };
  return { service: new TicketService(deps), assigned };
}

describe("assignment state and target invariants", () => {
  it("preserves the assignee when only a group is omitted", async () => {
    const h = service(); await h.service.assignTicket(auth, "t1", { reason: "keep" });
    expect((h.assigned[0] as any).assigneeId).toBe("u1");
  });
  it("clears an incompatible assignee on a group move", async () => {
    const h = service(); await h.service.assignTicket({ ...auth, role: "ADMIN", supportGroupId: null }, "t1", { supportGroupId: "g2", reason: "move" });
    expect((h.assigned[0] as any).assigneeId).toBeNull();
  });
  it("rejects a conditional write lost to a concurrent update", async () => {
    const h = service({ ticketRepository: { findById: async () => ticket, assign: async () => null } });
    await expect(h.service.assignTicket(auth, "t1", { reason: "retry" })).rejects.toBeInstanceOf(ValidationDomainError);
  });
});
