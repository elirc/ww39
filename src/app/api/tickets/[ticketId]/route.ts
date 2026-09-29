/**
 * What this file does: fetches a ticket and updates its status.
 * What calls it: ticket detail UI and operational tooling.
 * What it calls: withAuth/withRole, status validation, and TicketService.
 * Junior trap: letting a client jump directly to an arbitrary terminal status.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRepositories, createTicketService } from "@/server/container";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { apiError } from "@/lib/http/apiError";
import { handleServiceError } from "@/lib/http/handleServiceError";
import { readJsonBody } from "@/lib/http/requestBody";
import { updateTicketStatusSchema } from "@/lib/validation/ticketSchemas";

type RouteParams = { params: Promise<{ ticketId: string }> };

export async function GET(request: NextRequest, context: RouteParams) {
  const repos = createRepositories();
  const auth = await withAuth(request, repos);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const { ticketId } = await context.params;
    const ticket = await createTicketService().getTicket(auth.user, ticketId);
    return NextResponse.json({ ticket }, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  const repos = createRepositories();
  const auth = await withRole(request, repos, "ticket:update:any");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);
  const parsed = updateTicketStatusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Invalid status update.", 400, parsed.error.flatten());
  }

  try {
    const { ticketId } = await context.params;
    const ticket = await createTicketService().updateTicketStatus(auth.user, ticketId, parsed.data);
    return NextResponse.json({ ticket }, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}
