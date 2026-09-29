/**
 * What this file does: reassigns a ticket to a user or support group.
 * What calls it: agent and manager assignment actions.
 * What it calls: withRole, assignment schema, and TicketService.
 * Junior trap: allowing group changes without checking whether the actor is allowed to move across queues.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRepositories, createTicketService } from "@/server/container";
import { withRole } from "@/lib/middleware/withRole";
import { apiError } from "@/lib/http/apiError";
import { handleServiceError } from "@/lib/http/handleServiceError";
import { readJsonBody } from "@/lib/http/requestBody";
import { assignTicketSchema } from "@/lib/validation/ticketSchemas";

type RouteParams = { params: Promise<{ ticketId: string }> };

export async function POST(request: NextRequest, context: RouteParams) {
  const repos = createRepositories();
  const auth = await withRole(request, repos, "ticket:assign");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);
  const parsed = assignTicketSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Invalid assignment payload.", 400, parsed.error.flatten());
  }

  try {
    const { ticketId } = await context.params;
    const ticket = await createTicketService().assignTicket(auth.user, ticketId, parsed.data);
    return NextResponse.json({ ticket }, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}
