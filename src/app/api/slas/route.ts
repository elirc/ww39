/**
 * What this file does: lists and creates SLA policies.
 * What calls it: the operations/admin UI.
 * What it calls: withRole, SLA validation, and RuleService.
 * Junior trap: creating SLAs with impossible timing relationships.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRepositories, createRuleService } from "@/server/container";
import { withRole } from "@/lib/middleware/withRole";
import { apiError } from "@/lib/http/apiError";
import { handleServiceError } from "@/lib/http/handleServiceError";
import { readJsonBody } from "@/lib/http/requestBody";
import { slaPolicySchema } from "@/lib/validation/slaSchemas";

export async function GET(request: NextRequest) {
  const repos = createRepositories();
  const auth = await withRole(request, repos, "sla:write");
  if (auth instanceof Response) {
    return auth;
  }

  const groupId = request.nextUrl.searchParams.get("groupId");
  if (!groupId) {
    return apiError("INVALID_INPUT", "groupId is required.", 400);
  }

  try {
    const policies = await createRuleService().listSlaPolicies(auth.user, groupId);
    return NextResponse.json({ policies }, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const repos = createRepositories();
  const auth = await withRole(request, repos, "sla:write");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);
  const parsed = slaPolicySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Invalid SLA payload.", 400, parsed.error.flatten());
  }

  try {
    const policy = await createRuleService().createSlaPolicy(auth.user, parsed.data);
    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    return handleServiceError(error);
  }
}
