# Guided Reading Path

## Step 1 — `prisma/schema.prisma`
**Why read this:** This is the contract between the domain and the database, so it explains the whole shape of the system.
**What to look for:** The `Role`, `TicketPriority`, and `TicketStatus` enums plus the relationships among `User`, `SupportGroup`, `Ticket`, and the rule tables.
**What to trace:** `src/repositories/*Repository.ts` reads and writes these models; `src/services/ticketService.ts` and `src/services/ruleService.ts` consume them.
**What a junior would likely miss:** Compound uniqueness on `SlaPolicy` and the support-group relationships that make the app scope-aware.

## Step 2 — `src/lib/auth/permissions.ts`
**Why read this:** It is the central permission vocabulary for the app.
**What to look for:** The `roleCapabilities` map and the `hasCapability()` / `mayReadTicket()` helpers.
**What to trace:** `src/lib/middleware/withRole.ts` calls `hasCapability()`, and `src/services/ticketService.ts` calls `mayReadTicket()`.
**What a junior would likely miss:** Role checks are not enough by themselves; some data reads still need ownership or group checks.

## Step 3 — `src/lib/middleware/withAuth.ts`
**Why read this:** It is the session boundary for every protected route.
**What to look for:** Cookie extraction, session hash lookup, expiry verification, and user loading.
**What to trace:** `src/app/api/auth/me/route.ts`, `src/app/api/tickets/*/route.ts`, and `src/lib/middleware/withRole.ts` all depend on it.
**What a junior would likely miss:** The raw cookie value never becomes the database key; only the hash does.

## Step 4 — `src/domain/ticketVisibility.ts`
**Why read this:** It shows how a visibility rule becomes a Prisma filter.
**What to look for:** The branch that returns `{}` for admins, `supportGroupId` for staff, and `createdById` for customers.
**What to trace:** `src/repositories/ticketRepository.ts` calls `buildVisibleTicketWhere()`, and `src/tests/dataIsolation.test.ts` asserts it.
**What a junior would likely miss:** A query helper is often the real security boundary, not just a service method.

## Step 5 — `src/repositories/contracts.ts`
**Why read this:** It explains the service/repository boundary and the minimum surface each layer is allowed to use.
**What to look for:** The repository interfaces, especially `TicketRepository`, `SlaPolicyRepository`, and `AssignmentRuleRepository`.
**What to trace:** `src/services/*` depend on these interfaces, while `src/repositories/*` implements them.
**What a junior would likely miss:** The interface is part of the architecture, not just TypeScript plumbing.

## Step 6 — `src/repositories/supportGroupRepository.ts`
**Why read this:** It is the simplest example of a repository that exists purely to validate a trust boundary.
**What to look for:** `findById()` and `listAll()` and why the service layer insists on a real group row.
**What to trace:** `src/services/ticketService.ts`, `src/services/ruleService.ts`, and `src/services/escalationService.ts` call it.
**What a junior would likely miss:** Group ids are not just strings; they are a routing boundary.

## Step 7 — `src/repositories/ticketRepository.ts`
**Why read this:** It is the main data access layer for tickets.
**What to look for:** `listVisible()`, `updateStatus()`, `markFirstResponse()`, and `markEscalated()`.
**What to trace:** `src/services/ticketService.ts` and `src/services/escalationService.ts` call these methods.
**What a junior would likely miss:** Using the wrong repository method can accidentally mix lifecycle writes with timing writes.

## Step 8 — `src/services/authService.ts`
**Why read this:** It owns login and logout behavior without leaking session mechanics into routes.
**What to look for:** `login()` and `logout()`, especially how session tokens are hashed before persistence.
**What to trace:** `src/app/api/auth/login/route.ts` and `src/app/api/auth/logout/route.ts` call this service.
**What a junior would likely miss:** Returning a user object is not enough if you forget to create the session row.

## Step 9 — `src/services/ticketService.ts`
**Why read this:** It is the core product logic for create, read, update, assign, and comment flows.
**What to look for:** `createTicket()`, `updateTicketStatus()`, `assignTicket()`, and `addComment()`.
**What to trace:** `src/app/api/tickets/route.ts`, `src/app/api/tickets/[ticketId]/route.ts`, `src/app/api/tickets/[ticketId]/assign/route.ts`, and `src/app/api/tickets/[ticketId]/comments/route.ts`.
**What a junior would likely miss:** SLA timing, assignment routing, and permissions all interact here.

## Step 10 — `src/services/ruleService.ts`
**Why read this:** It owns the admin-level rules used to route and time future tickets.
**What to look for:** `createAssignmentRule()`, `createSlaPolicy()`, and `createEscalationRule()`.
**What to trace:** `src/app/api/rules/assignment/route.ts`, `src/app/api/slas/route.ts`, and `src/app/api/rules/escalation/route.ts`.
**What a junior would likely miss:** Rule creation needs target validation, not just shape validation.

## Step 11 — `src/services/escalationService.ts`
**Why read this:** It shows how a background workflow uses the same domain and repository boundaries as a request handler.
**What to look for:** `runSweep()` and the escalation decision loop.
**What to trace:** `src/app/api/cron/escalations/route.ts` calls it; it then calls `src/repositories/ticketRepository.ts`, `src/repositories/escalationRuleRepository.ts`, and `src/repositories/auditLogRepository.ts`.
**What a junior would likely miss:** Background work still needs auditability and scoping, even when no user is waiting on the response.

## Step 12 — `src/app/api/tickets/route.ts`
**Why read this:** It is the clearest example of the request pipeline from HTTP to service to persistence.
**What to look for:** The `GET()` and `POST()` handlers and the way they delegate everything important.
**What to trace:** `src/lib/middleware/withAuth.ts`, `src/lib/middleware/withRole.ts`, `src/lib/validation/ticketSchemas.ts`, and `src/services/ticketService.ts`.
**What a junior would likely miss:** The route handler should be thin enough that you can explain it in one sentence.

## Step 13 — `src/components/dashboard/Dashboard.tsx`
**Why read this:** It shows how the UI stays dumb and just wires hooks to forms.
**What to look for:** The `useMe()`, `useTickets()`, and `useCreateTicket()` hooks plus the form prefill effect.
**What to trace:** It calls `src/components/dashboard/TicketCard.tsx`, `src/hooks/useAuth.ts`, and `src/hooks/useTickets.ts`.
**What a junior would likely miss:** Front-end state should not duplicate server-side business rules.
