/**
 * What this file does: lists and creates assignment rules.
 * What calls it: the operations/admin UI.
 * What it calls: withRole, rule validation, and RuleService.
 * Junior trap: letting anyone edit automation rules that affect future ticket routing.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRepositories, createRuleService } from "@/server/container";
import { withRole } from "@/lib/middleware/withRole";
import { apiError } from "@/lib/http/apiError";
import { handleServiceError } from "@/lib/http/handleServiceError";
import { readJsonBody } from "@/lib/http/requestBody";
import { assignmentRuleSchema } from "@/lib/validation/ruleSchemas";

export async function GET(request: NextRequest) {
  const repos = createRepositories();
  const auth = await withRole(request, repos, "rule:write");
  if (auth instanceof Response) {
    return auth;
  }

  const groupId = request.nextUrl.searchParams.get("groupId");
  if (!groupId) {
    return apiError("INVALID_INPUT", "groupId is required.", 400);
  }

  try {
    const rules = await createRuleService().listAssignmentRules(auth.user, groupId);
    return NextResponse.json({ rules }, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const repos = createRepositories();
  const auth = await withRole(request, repos, "rule:write");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);
  const parsed = assignmentRuleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Invalid assignment rule payload.", 400, parsed.error.flatten());
  }

  try {
    const rule = await createRuleService().createAssignmentRule(auth.user, parsed.data);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return handleServiceError(error);
  }
}
