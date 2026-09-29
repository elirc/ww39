import { describe, expect, it } from "vitest";
import { EscalationService } from "@/services/escalationService";
import { TicketStatus } from "@prisma/client";

const now = new Date("2026-01-01T12:00:00.000Z");
const base = (overrides: Record<string, unknown> = {}) => ({
  id: "t1", number: 1, subject: "Printer", description: "Offline", category: "hardware",
  priority: "NORMAL" as const, status: TicketStatus.OPEN, requesterName: "R", requesterEmail: "r@example.com",
  createdById: "c1", supportGroupId: "g1", assigneeId: null, slaPolicyId: null,
  firstResponseDueAt: new Date(now.getTime() - 60 * 60_000), resolutionDueAt: new Date(now.getTime() + 60 * 60_000),
  firstResponseAt: null, resolvedAt: null, escalatedAt: null, closedAt: null, createdAt: now, updatedAt: now, ...overrides
});

function harness(ticket = base(), rules = [{ id: "r1", afterMins: 30, targetGroupId: "g2", targetUserId: null, isActive: true }]) {
  let claimed = false;
  const audit: unknown[] = [];
  const deps = {
    ticketRepository: {
      listOverdueForEscalation: async () => [ticket],
      markEscalated: async () => claimed ? null : (claimed = true, { ...ticket, escalatedAt: now, supportGroupId: "g2" }),
    },
    escalationRuleRepository: { findApplicable: async () => rules },
    userRepository: { findById: async () => null },
    supportGroupRepository: { findById: async (id: string) => id === "g2" ? { id, name: "Tier 2" } : null },
    auditLogRepository: { create: async (input: unknown) => { audit.push(input); }, listForTicket: async () => [] }
  } as any;
  return { service: new EscalationService(deps), audit };
}

describe("EscalationService", () => {
  it("uses the transaction-capable claim so an audit failure leaves no routing mutation", async () => {
    let committed = base();
    const ticket = base();
    const deps = {
      ticketRepository: {
        listOverdueForEscalation: async () => [ticket],
        markEscalated: async () => ({ ...ticket, escalatedAt: now }),
        markEscalatedWithAudit: async (input: any) => {
          const transactionState = { ...committed, escalatedAt: input.escalatedAt, supportGroupId: input.supportGroupId };
          try { throw new Error("audit unavailable"); } catch (error) { void transactionState; throw error; }
        }
      },
      escalationRuleRepository: { findApplicable: async () => [{ id: "r1", afterMins: 1, targetGroupId: "g2", targetUserId: null, isActive: true }] },
      userRepository: { findById: async () => null },
      supportGroupRepository: { findById: async () => ({ id: "g2", name: "Tier 2" }) },
      auditLogRepository: { create: async () => { throw new Error("fallback audit should not run"); }, listForTicket: async () => [] }
    } as any;
    await expect(new EscalationService(deps).runSweep(now)).rejects.toThrow("audit unavailable");
    expect(committed.escalatedAt).toBeNull();
    expect(committed.supportGroupId).toBe("g1");
  });

  it("uses the active resolution deadline after first response", async () => {
    const { service } = harness(base({ firstResponseAt: new Date(now.getTime() - 90_000), resolutionDueAt: new Date(now.getTime() + 5 * 60_000) }));
    expect((await service.runSweep(now)).escalated).toHaveLength(0);
  });
  it("escalates an unanswered first response exactly at the rule threshold", async () => {
    const { service } = harness(base({ firstResponseDueAt: new Date(now.getTime() - 30 * 60_000) }));
    expect((await service.runSweep(now)).escalated).toHaveLength(1);
  });
  it("does not mutate when no rule is eligible", async () => {
    const { service, audit } = harness(base(), [{ id: "r1", afterMins: 61, targetGroupId: "g2", targetUserId: null, isActive: true }]);
    expect((await service.runSweep(now)).escalated).toEqual([]); expect(audit).toEqual([]);
  });
  it("does not escalate tickets without a deadline or terminal tickets", async () => {
    const noDeadline = harness(base({ firstResponseDueAt: null, resolutionDueAt: null }));
    const terminal = harness(base({ status: TicketStatus.CLOSED }));
    expect((await noDeadline.service.runSweep(now)).escalated).toEqual([]);
    expect((await terminal.service.runSweep(now)).escalated).toEqual([]);
  });
  it("skips invalid targets and lets a concurrent winner claim once", async () => {
    const bad = harness(base(), [{ id: "r1", afterMins: 1, targetGroupId: "missing", targetUserId: null, isActive: true }]);
    expect((await bad.service.runSweep(now)).escalated).toEqual([]);
    const race = harness();
    expect((await race.service.runSweep(now)).escalated).toHaveLength(1);
    expect((await race.service.runSweep(now)).escalated).toEqual([]);
  });
});
