/**
 * What this file does: validates assignment and escalation rule payloads.
 * What calls it: rule route handlers and tests.
 * What it calls: zod.
 * Junior trap: letting rules omit target information and then failing at runtime.
 */
import { TicketPriority } from "@prisma/client";
import { z } from "zod";

export const assignmentRuleSchema = z.object({
  name: z.string().min(2).max(120),
  groupId: z.string().min(1),
  category: z.string().min(1).max(80).optional().nullable(),
  priority: z.nativeEnum(TicketPriority).optional().nullable(),
  targetGroupId: z.string().min(1).optional().nullable(),
  targetUserId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().default(true)
}).refine((value) => Boolean(value.targetGroupId || value.targetUserId), {
  message: "Assignment rules must target a group or a user."
}).refine((value) => Boolean(value.targetGroupId) !== Boolean(value.targetUserId), {
  // ⚠ SENIOR NOTE: exact-one targeting avoids ambiguous rule resolution later in the service.
  message: "Assignment rules must target exactly one destination."
});

export const escalationRuleSchema = z.object({
  name: z.string().min(2).max(120),
  groupId: z.string().min(1),
  priority: z.nativeEnum(TicketPriority).optional().nullable(),
  afterMins: z.number().int().positive(),
  targetGroupId: z.string().min(1).optional().nullable(),
  targetUserId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().default(true)
}).refine((value) => Boolean(value.targetGroupId || value.targetUserId), {
  message: "Escalation rules must target a group or a user."
}).refine((value) => Boolean(value.targetGroupId) !== Boolean(value.targetUserId), {
  // ⚠ SENIOR NOTE: escalation should route to a single destination so the sweep can be deterministic.
  message: "Escalation rules must target exactly one destination."
});
