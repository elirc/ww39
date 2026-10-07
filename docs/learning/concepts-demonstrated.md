# Concepts Demonstrated

## Service layer
Where to look: `src/services/ticketService.ts` - `createTicket()`, `updateTicketStatus()`, `assignTicket()`, and `addComment()` own the ticket business rules.
Also see: `src/services/ruleService.ts` for rule creation and `src/services/escalationService.ts` for background escalation work.
Risk if wrong: business logic leaks into handlers or components and becomes unreviewable.

## Repository pattern
Where to look: `src/repositories/ticketRepository.ts` - `listVisible()`, `create()`, `updateStatus()`, and `markEscalated()` issue Prisma queries.
Also see: `src/repositories/contracts.ts` for the interface boundary the services depend on.
Risk if wrong: the service layer becomes coupled to Prisma and becomes hard to unit test.
Worth noticing: the write methods are compare-and-set `updateMany` calls that return `null` when the expected state no longer matches (`src/repositories/ticketRepository.ts:50-59`, `:63-70`, `:86-90`, `:110-118`), and services turn that `null` into a retryable `422`. `src/server/container.ts:21-29` wires one instance of each repository per process.

## Zod validation boundary
Where to look: `src/lib/validation/ticketSchemas.ts` - `createTicketSchema`, `updateTicketStatusSchema`, and `assignTicketSchema` parse request bodies.
Also see: `src/lib/validation/slaSchemas.ts` and `src/lib/validation/ruleSchemas.ts` for rule-specific payload checks.
Risk if wrong: malformed payloads reach the service layer and create confusing production errors.
Worth noticing: routes read the body with `readJsonBody()` (`src/lib/http/requestBody.ts:1-7`), which turns invalid JSON into `null`, so a broken body becomes a clean `400 INVALID_INPUT` instead of a 500. The status schema validates only the enum (`src/lib/validation/ticketSchemas.ts:20-24`); reachability is a service rule.

## Auth/session flow
Where to look: `src/services/authService.ts` - `login()` and `logout()` issue and revoke opaque sessions.
Also see: `src/lib/auth/session.ts` and `src/lib/middleware/withAuth.ts` for cookie hashing and session verification.
Risk if wrong: expired or forged sessions can reach protected routes.
Worth noticing: only the SHA-256 of the token is stored (`src/lib/auth/session.ts:17-19`), expiry is checked on every request (`src/lib/middleware/withAuth.ts:36-40`), and logout deletes the row. Expired rows are never cleaned up, and there is no login rate limiting.

## Role-based access control
Where to look: `src/lib/auth/permissions.ts` - `roleCapabilities` and `hasCapability()` define what each role may do.
Also see: `src/lib/middleware/withRole.ts` for the enforcement point before the handler runs.
Risk if wrong: the wrong role can hit assignment, SLA, or rule endpoints.
Worth noticing: six declared capabilities (`ticket:read:any`, `ticket:read:own`, `ticket:update:own`, `ticket:comment:any`/`own`, `audit:read`) are never checked anywhere; reads and comments are authorized by row-level code in `src/services/ticketService.ts` instead. `RuleService` checks the capability but not that the manager belongs to the rule's group (`src/services/ruleService.ts:69-76`).

## Status or state transitions
Where to look: `src/domain/ticketDomain.ts` - `VALID_TICKET_TRANSITIONS` and `assertValidTransition()` define legal ticket lifecycle moves.
Also see: `src/services/ticketService.ts` for where the transition is enforced before the repository write.
Risk if wrong: tickets can jump into impossible lifecycle states and pollute reporting.
Worth noticing: the repository write also carries the expected status (`src/repositories/ticketRepository.ts:51`), so the table check and the write cannot be separated by a concurrent update. Reopening keeps the old `resolvedAt`/`closedAt` (`src/services/ticketService.ts:152-153`).

## Audit logging
Where to look: `src/services/ticketService.ts` - audit writes happen after create/status/assignment/comment changes.
Also see: `src/services/ruleService.ts` and `src/services/escalationService.ts` for rule and escalation audit trails.
Risk if wrong: operators lose the breadcrumb trail needed for debugging and compliance.
Worth noticing: only escalation writes its audit row in the same transaction as the state change (`src/repositories/ticketRepository.ts:121-143`). Ticket create, status, assignment and comment audits are separate inserts after the write, so a failure between them leaves an unaudited change.

## Background job design
Where to look: `src/services/escalationService.ts` - `runSweep()` processes overdue tickets in a cron-style workflow.
Also see: `src/app/api/cron/escalations/route.ts` for the secret-protected entrypoint.
Risk if wrong: overdue tickets never escalate, or they escalate without an audit trail.
Worth noticing: a ticket can escalate only once (`escalatedAt: null` in `src/repositories/ticketRepository.ts:98`, `:124`), and a group-only rule writes `assigneeId: null`, unassigning the current agent (`src/services/escalationService.ts:59`). The sweep processes tickets sequentially in one request with no batching or time limit.

## Multi-tenancy
Where to look: `src/lib/middleware/withAuth.ts` and `src/domain/ticketVisibility.ts` for the current support-group scoping model.
Also see: `docs/architecture/auth-and-permissions.md` for the explicit note on what would need to change to add tenant boundaries.
Risk if wrong: the team could assume tenant isolation exists when the code only enforces support-group scope.

