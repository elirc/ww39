/**
 * What this file does: guards ticket creation, updates, assignment, and comments.
 * What calls it: ticket route handlers, services, and tests.
 * What it calls: zod.
 * Junior trap: validating shape but forgetting to validate lifecycle-safe transitions.
 */
import { TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().min(4).max(200),
  description: z.string().min(10).max(10_000),
  category: z.string().min(2).max(80),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.NORMAL),
  requesterName: z.string().min(2).max(120),
  requesterEmail: z.string().email(),
  supportGroupId: z.string().min(1)
});

export const updateTicketStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
  // ⚠ SENIOR NOTE: the current status transition is enforced in the service layer, where the old state is visible.
  note: z.string().min(1).max(2000).optional()
});

export const addCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  isInternal: z.boolean().default(false)
});

export const assignTicketSchema = z.object({
  assigneeId: z.string().min(1).nullable().optional(),
  supportGroupId: z.string().min(1).nullable().optional(),
  reason: z.string().min(1).max(2000)
}).refine((value) => Boolean(value.assigneeId || value.supportGroupId), {
  message: "Provide either an assignee or a target group."
});
