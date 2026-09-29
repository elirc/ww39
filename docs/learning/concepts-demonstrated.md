# Concepts Demonstrated

## Service layer
Where to look: `src/services/ticketService.ts` - `createTicket()`, `updateTicketStatus()`, `assignTicket()`, and `addComment()` own the ticket business rules.
Also see: `src/services/ruleService.ts` for rule creation and `src/services/escalationService.ts` for background escalation work.
Risk if wrong: business logic leaks into handlers or components and becomes unreviewable.

## Repository pattern
Where to look: `src/repositories/ticketRepository.ts` - `listVisible()`, `create()`, `updateStatus()`, and `markEscalated()` issue Prisma queries.
Also see: `src/repositories/contracts.ts` for the interface boundary the services depend on.
Risk if wrong: the service layer becomes coupled to Prisma and becomes hard to unit test.

## Zod validation boundary
Where to look: `src/lib/validation/ticketSchemas.ts` - `createTicketSchema`, `updateTicketStatusSchema`, and `assignTicketSchema` parse request bodies.
Also see: `src/lib/validation/slaSchemas.ts` and `src/lib/validation/ruleSchemas.ts` for rule-specific payload checks.
Risk if wrong: malformed payloads reach the service layer and create confusing production errors.

## Auth/session flow
Where to look: `src/services/authService.ts` - `login()` and `logout()` issue and revoke opaque sessions.
Also see: `src/lib/auth/session.ts` and `src/lib/middleware/withAuth.ts` for cookie hashing and session verification.
Risk if wrong: expired or forged sessions can reach protected routes.

## Role-based access control
Where to look: `src/lib/auth/permissions.ts` - `roleCapabilities` and `hasCapability()` define what each role may do.
Also see: `src/lib/middleware/withRole.ts` for the enforcement point before the handler runs.
Risk if wrong: the wrong role can hit assignment, SLA, or rule endpoints.

## Status or state transitions
Where to look: `src/domain/ticketDomain.ts` - `VALID_TICKET_TRANSITIONS` and `assertValidTransition()` define legal ticket lifecycle moves.
Also see: `src/services/ticketService.ts` for where the transition is enforced before the repository write.
Risk if wrong: tickets can jump into impossible lifecycle states and pollute reporting.

## Audit logging
Where to look: `src/services/ticketService.ts` - audit writes happen after create/status/assignment/comment changes.
Also see: `src/services/ruleService.ts` and `src/services/escalationService.ts` for rule and escalation audit trails.
Risk if wrong: operators lose the breadcrumb trail needed for debugging and compliance.

## Background job design
Where to look: `src/services/escalationService.ts` - `runSweep()` processes overdue tickets in a cron-style workflow.
Also see: `src/app/api/cron/escalations/route.ts` for the secret-protected entrypoint.
Risk if wrong: overdue tickets never escalate, or they escalate without an audit trail.

## Multi-tenancy
Where to look: `src/lib/middleware/withAuth.ts` and `src/domain/ticketVisibility.ts` for the current support-group scoping model.
Also see: `docs/architecture/auth-and-permissions.md` for the explicit note on what would need to change to add tenant boundaries.
Risk if wrong: the team could assume tenant isolation exists when the code only enforces support-group scope.

