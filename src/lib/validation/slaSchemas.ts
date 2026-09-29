/**
 * What this file does: validates SLA policy payloads.
 * What calls it: SLA route handlers and tests.
 * What it calls: zod.
 * Junior trap: allowing negative response windows or mismatched group references.
 */
import { TicketPriority } from "@prisma/client";
import { z } from "zod";

export const slaPolicySchema = z.object({
  name: z.string().min(2).max(120),
  groupId: z.string().min(1),
  priority: z.nativeEnum(TicketPriority),
  firstResponseMins: z.number().int().positive(),
  resolutionMins: z.number().int().positive(),
  isActive: z.boolean().default(true)
}).refine((value) => value.resolutionMins > value.firstResponseMins, {
  // ⚠ SENIOR NOTE: if resolution is shorter than first response, the policy is unusable before it reaches the database.
  message: "Resolution SLA must be longer than first response SLA."
});
