/**
 * What this file does: adds customer-visible or internal comments to a ticket.
 * What calls it: ticket detail UI.
 * What it calls: withAuth, comment validation, and TicketService.
 * Junior trap: forgetting to keep internal notes out of customer workflows.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRepositories, createTicketService } from "@/server/container";
import { withAuth } from "@/lib/middleware/withAuth";
import { apiError } from "@/lib/http/apiError";
import { handleServiceError } from "@/lib/http/handleServiceError";
import { readJsonBody } from "@/lib/http/requestBody";
import { addCommentSchema } from "@/lib/validation/ticketSchemas";

type RouteParams = { params: Promise<{ ticketId: string }> };

export async function POST(request: NextRequest, context: RouteParams) {
  const repos = createRepositories();
  const auth = await withAuth(request, repos);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);
  const parsed = addCommentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Invalid comment payload.", 400, parsed.error.flatten());
  }

  try {
    const { ticketId } = await context.params;
    await createTicketService().addComment(auth.user, ticketId, parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleServiceError(error);
  }
}
