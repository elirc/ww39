import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashSessionToken } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";

const rawToken = "unknown-role-session";
vi.mock("@/server/container", () => ({
  createRepositories: () => ({
    sessionRepository: { findByTokenHash: async () => ({ id: "s1", userId: "u1", tokenHash: hashSessionToken(rawToken), expiresAt: new Date(Date.now() + 60_000) }) },
    userRepository: { findById: async () => ({ id: "u1", email: "x@example.com", displayName: "Unknown", role: "OWNER", supportGroupId: null, passwordHash: "x" }) }
  })
}));

describe("route permission boundary", () => {
  it("denies an unknown runtime role without a 500", async () => {
    expect(hasCapability({ id: "u1", email: "x", displayName: "x", role: "OWNER" as any, supportGroupId: null }, "ticket:update:any")).toBe(false);
    const { PATCH } = await import("@/app/api/tickets/[ticketId]/route");
    const request = new NextRequest("http://localhost/api/tickets/t1", {
      method: "PATCH", headers: { cookie: `ticket_session=${rawToken}`, "content-type": "application/json" }, body: "{}"
    });
    const response = await PATCH(request, { params: Promise.resolve({ ticketId: "t1" }) });
    expect(response.status).toBe(403);
  });
});
