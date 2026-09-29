import { describe, expect, it } from "vitest";
import { slaPolicySchema } from "@/lib/validation/slaSchemas";

describe("validation boundary", () => {
  it("rejects an SLA payload whose resolution window is shorter than first response", () => {
    // This test matters because an inverted SLA would silently corrupt every due-date calculation.
    const parsed = slaPolicySchema.safeParse({
      name: "Bad SLA",
      groupId: "group-1",
      priority: "HIGH",
      firstResponseMins: 120,
      resolutionMins: 60,
      isActive: true
    });

    expect(parsed.success).toBe(false);
  });
});

