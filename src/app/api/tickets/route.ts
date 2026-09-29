/**
 * What this file does: lists visible tickets and creates new ones.
 * What calls it: the dashboard UI and API clients.
 * What it calls: withAuth/withRole, ticket schemas, and TicketService.
 * Junior trap: exposing every ticket to every authenticated user.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRepositories, createTicketService } from "@/server/container";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { apiError } from "@/lib/http/apiError";
import { handleServiceError } from "@/lib/http/handleServiceError";
import { readJsonBody } from "@/lib/http/requestBody";
import { createTicketSchema } from "@/lib/validation/ticketSchemas";

export async function GET(request: NextRequest) {
  const repos = createRepositories();
  const auth = await withAuth(request, repos);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const tickets = await createTicketService().listTickets(auth.user);
    return NextResponse.json({ tickets }, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const repos = createRepositories();
  const auth = await withRole(request, repos, "ticket:create");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Invalid ticket payload.", 400, parsed.error.flatten());
  }

  try {
    const ticket = await createTicketService().createTicket(auth.user, parsed.data);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return handleServiceError(error);
  }
}
