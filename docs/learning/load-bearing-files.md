# Load-Bearing Files

## `prisma/schema.prisma`
- What it does: defines the persistent data model and the enum boundaries for roles, statuses, priorities, and rule types.
- What calls it: Prisma Client generated code, `prisma/seed.ts`, and every repository in `src/repositories/`.
- What it calls: nothing directly, but it defines the relationship graph the repositories rely on.
- What would break or become insecure if wrong: wrong relations or uniqueness constraints would let the app leak data, misroute tickets, or accept impossible SLA/rule combinations.
- What a junior engineer would likely miswrite here: forgetting a unique compound key for `SlaPolicy` or confusing one-to-many and one-to-one relations.

## `src/lib/middleware/withAuth.ts`
- What it does: verifies the session cookie, session hash, expiry, and loaded user before protected routes run.
- What calls it: `src/app/api/auth/me/route.ts`, `src/app/api/tickets/*/route.ts`, and `src/lib/middleware/withRole.ts`.
- What it calls: `src/repositories/sessionRepository.ts`, `src/repositories/userRepository.ts`, and `src/lib/auth/session.ts`.
- What would break or become insecure if wrong: expired or forged sessions could access the app, and every protected endpoint would trust the wrong identity.
- What a junior engineer would likely miswrite here: checking only for a cookie without hitting the database.

## `src/lib/middleware/withRole.ts`
- What it does: applies capability checks after authentication succeeds.
- What calls it: route handlers for ticket updates, assignment, SLAs, and rules.
- What it calls: `withAuth()` and `hasCapability()` from `src/lib/auth/permissions.ts`.
- What would break or become insecure if wrong: customers could reach admin actions or staff could mutate data outside their role.
- What a junior engineer would likely miswrite here: checking role after the handler already started its work.

## `src/domain/ticketVisibility.ts`
- What it does: converts support-group and ownership rules into a Prisma `where` filter.
- What calls it: `src/repositories/ticketRepository.ts` and `src/tests/dataIsolation.test.ts`.
- What it calls: only shared enums and the `VisibleTicketScope` type.
- What would break or become insecure if wrong: list endpoints could leak another group’s or another customer’s tickets.
- What a junior engineer would likely miswrite here: returning a broad filter for all authenticated users.

## `src/repositories/supportGroupRepository.ts`
- What it does: verifies that a support group exists before tickets or rules route against it.
- What calls it: `src/services/ticketService.ts`, `src/services/ruleService.ts`, and `src/services/escalationService.ts`.
- What it calls: Prisma support-group queries.
- What would break or become insecure if wrong: rules and tickets could point at phantom groups, which would make routing and authorization inconsistent.
- What a junior engineer would likely miswrite here: treating group ids like opaque strings and skipping existence checks.

## `src/services/ticketService.ts`
- What it does: owns create, read, update, assign, and comment business rules for tickets.
- What calls it: ticket API routes and tests.
- What it calls: repositories for tickets, rules, SLAs, comments, users, and audit logs, plus `assertValidTransition()` from `src/domain/ticketDomain.ts`.
- What would break or become insecure if wrong: status transitions could be invalid, assignment could jump groups, or SLA timestamps could be wrong.
- What a junior engineer would likely miswrite here: putting lifecycle logic into route handlers or forgetting the audit log write.

## `src/repositories/ticketRepository.ts`
- What it does: issues the actual Prisma queries for ticket reads and writes.
- What calls it: `TicketService`, `EscalationService`, and tests through the visibility helper.
- What it calls: Prisma Client and `buildVisibleTicketWhere()` from `src/domain/ticketVisibility.ts`.
- What would break or become insecure if wrong: data isolation would fail, and timing mutations could accidentally masquerade as status changes.
- What a junior engineer would likely miswrite here: filtering by the wrong ownership column or mixing ticket comments into ticket lifecycle writes.

## `src/services/ruleService.ts`
- What it does: creates assignment, SLA, and escalation rules with explicit permission checks.
- What calls it: rule and SLA API routes.
- What it calls: rule repositories, user repository, and audit logs.
- What would break or become insecure if wrong: future tickets would route incorrectly or operations users could create invalid automation targets.
- What a junior engineer would likely miswrite here: validating only the shape of a rule and not the target user or group.

## `src/services/escalationService.ts`
- What it does: scans overdue tickets and applies escalation rules in a background workflow.
- What calls it: `src/app/api/cron/escalations/route.ts`.
- What it calls: `TicketRepository.listOverdueForEscalation()`, `EscalationRuleRepository.findApplicable()`, and `AuditLogRepository.create()`.
- What would break or become insecure if wrong: escalations would miss breached tickets, or worse, route them without an audit trail.
- What a junior engineer would likely miswrite here: using the wrong due-date field or forgetting to record the routing change.

## `src/lib/auth/session.ts`
- What it does: creates opaque session tokens, hashes them, and formats the cookie.
- What calls it: `src/services/authService.ts`, `src/lib/middleware/withAuth.ts`, and the auth routes.
- What it calls: Node crypto helpers and Next.js request cookie APIs.
- What would break or become insecure if wrong: raw token leakage would let a DB snapshot mint live sessions.
- What a junior engineer would likely miswrite here: storing the cookie value directly in the database.

## `src/components/dashboard/Dashboard.tsx`
- What it does: renders the operational dashboard and wires create-ticket form state to the API.
- What calls it: `src/app/page.tsx`.
- What it calls: `useMe()`, `useTickets()`, `useCreateTicket()`, and `TicketCard`.
- What would break or become insecure if wrong: the UI could become the place where business rules are duplicated or faked.
- What a junior engineer would likely miswrite here: making the component decide authorization or data-scoping rules instead of just calling hooks.
