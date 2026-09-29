/**
 * What this file does: lists and creates escalation rules.
 * What calls it: operations/admin tooling.
 * What it calls: withRole, escalation validation, and RuleService.
 * Junior trap: creating escalation rules that point nowhere or point at customers.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRepositories, createRuleService } from "@/server/container";
import { withRole } from "@/lib/middleware/withRole";
import { apiError } from "@/lib/http/apiError";
import { handleServiceError } from "@/lib/http/handleServiceError";
import { readJsonBody } from "@/lib/http/requestBody";
import { escalationRuleSchema } from "@/lib/validation/ruleSchemas";

export async function POST(request: NextRequest) {
  const repos = createRepositories();
  const auth = await withRole(request, repos, "rule:write");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);
  const parsed = escalationRuleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Invalid escalation rule payload.", 400, parsed.error.flatten());
  }

  try {
    const rule = await createRuleService().createEscalationRule(auth.user, parsed.data);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return handleServiceError(error);
  }
}
