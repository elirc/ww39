import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { withRole } from "@/lib/middleware/withRole";
import { hasCapability } from "@/lib/auth/permissions";
import { hashSessionToken } from "@/lib/auth/session";
import type { SessionRepository, UserRepository } from "@/repositories/contracts";

class FakeSessionRepository implements SessionRepository {
  constructor(private readonly sessionTokenHash: string) {}

  async create(): Promise<any> {
    throw new Error("not used") as never;
  }

  async findByTokenHash(tokenHash: string) {
    if (tokenHash !== this.sessionTokenHash) {
      return null;
    }

    return {
      id: "session-1",
      userId: "user-1",
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000)
    };
  }

  async revokeByTokenHash() {}
}

class FakeUserRepository implements UserRepository {
  async findById() {
    return {
      id: "user-1",
      email: "agent@atlas.local",
      displayName: "Agent",
      role: Role.CUSTOMER,
      supportGroupId: "group-1",
      passwordHash: "hash"
    };
  }

  async findByEmail() {
    return null;
  }

  async listAssignableAgentsByGroup() {
    return [];
  }
}

describe("withRole", () => {
  it("fails closed for an unknown runtime role", () => {
    expect(() => hasCapability({ id: "u", role: "OWNER" as Role, supportGroupId: null, email: "x", displayName: "x" }, "ticket:read:any")).not.toThrow();
    expect(hasCapability({ id: "u", role: "OWNER" as Role, supportGroupId: null, email: "x", displayName: "x" }, "ticket:read:any")).toBe(false);
  });
  it.each(["constructor", "toString", "__proto__"])("fails closed for inherited role key %s", (role) => {
    expect(() => hasCapability({ id: "u", role: role as Role, supportGroupId: null, email: "x", displayName: "x" }, "ticket:read:any")).not.toThrow();
    expect(hasCapability({ id: "u", role: role as Role, supportGroupId: null, email: "x", displayName: "x" }, "ticket:read:any")).toBe(false);
  });
  it("rejects a customer before they reach the assignment handler", async () => {
    // This test matters because a permission bug here would expose a mutating endpoint to the wrong role.
    const rawToken = "session-token";
    const request = new NextRequest("http://localhost/api/tickets/abc/assign", {
      method: "POST",
      headers: { cookie: `ticket_session=${rawToken}` }
    });

    const result = await withRole(
      request,
      {
        sessionRepository: new FakeSessionRepository(hashSessionToken(rawToken)),
        userRepository: new FakeUserRepository()
      },
      "ticket:assign"
    );

    expect(result instanceof Response).toBe(true);
    expect((result as Response).status).toBe(403);
  });
});
