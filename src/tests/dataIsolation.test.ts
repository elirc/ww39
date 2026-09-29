import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { mayReadTicket } from "@/lib/auth/permissions";
import { buildVisibleTicketWhere } from "@/domain/ticketVisibility";

describe("data isolation", () => {
  it("scopes agent visibility to the agent's support group instead of all tickets", () => {
    // This test matters because a wrong visibility filter can leak another team's tickets into the list view.
    const where = buildVisibleTicketWhere({
      userId: "agent-1",
      role: Role.AGENT,
      supportGroupId: "group-1"
    });

    expect(where).toEqual({ supportGroupId: "group-1" });
  });

  it("scopes customer visibility to tickets they created", () => {
    // This test matters because customer list endpoints must never return another customer's ticket history.
    const where = buildVisibleTicketWhere({
      userId: "customer-1",
      role: Role.CUSTOMER,
      supportGroupId: "group-2"
    });

    expect(where).toEqual({ createdById: "customer-1" });
  });

  it("blocks direct reads when a staff member is outside the ticket's support group", () => {
    // This test matters because direct ticket reads bypass the list filter, so the helper has to fail closed there too.
    const allowed = mayReadTicket(
      {
        id: "agent-1",
        email: "agent@atlas.local",
        displayName: "Agent",
        role: Role.AGENT,
        supportGroupId: "group-1"
      },
      "customer-2",
      "group-2"
    );

    expect(allowed).toBe(false);
  });
});
