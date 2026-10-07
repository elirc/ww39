# Request Lifecycle

Request: Create a new ticket from the dashboard
1. `src/components/dashboard/Dashboard.tsx` - the create form submits to the `useCreateTicket()` mutation.
2. `src/hooks/useTickets.ts` - `useCreateTicket()` sends `POST /api/tickets` with the form body.
3. `src/app/api/tickets/route.ts:31-50` - `POST()` calls `withRole(request, repos, "ticket:create")` first, then `readJsonBody()` and `createTicketSchema.safeParse()`; a failed parse returns `400 INVALID_INPUT` with `error.flatten()` details (`:40-42`).
4. `src/lib/middleware/withRole.ts:13-32` - `withAuth()` verifies the session cookie, then `hasCapability()` checks `ticket:create` (all four roles have it).
5. `src/lib/validation/ticketSchemas.ts:10-18` - subject 4–200 chars, description 10–10,000, category 2–80, priority enum defaulting to `NORMAL`, requester name and email, non-empty `supportGroupId`.
6. `src/services/ticketService.ts:59-136` - `TicketService.createTicket()`:
   - customers may only use their own group (`:71-73`); the group must exist (`:75-78`);
   - `assignmentRuleRepository.findBestMatch()` picks a routing rule (`:80-84`);
   - a user target must exist, not be a customer, and belong to the source group (`:89-102`); a group target must exist (`:103-107`);
   - the SLA policy is looked up for the **final** group and priority (`:109`) and due dates are computed from now (`:111-119`);
   - the ticket is created (`:112-120`) and a `ticket.created` audit row written separately (`:122-133`).
7. Returns `201` with `{ ticket }`.

Request: Resolve a ticket from the detail view
1. `src/components/dashboard/TicketCard.tsx` - clicking Resolve calls `useUpdateTicketStatus(ticket.id)`.
2. `src/hooks/useTickets.ts` - `useUpdateTicketStatus()` sends `PATCH /api/tickets/:ticketId`.
3. `src/app/api/tickets/[ticketId]/route.ts:34-54` - `PATCH()` calls `withRole(..., "ticket:update:any")` and parses the body with `updateTicketStatusSchema`.
4. `src/lib/validation/ticketSchemas.ts:20-24` - the schema checks only that `status` is a `TicketStatus` enum value and that an optional `note` is 1–2000 chars. Reachability is **not** checked here; the comment at `:22` says so.
5. `src/services/ticketService.ts:138-179` - `updateTicketStatus()` re-checks the capability (`:143-145`), loads the ticket through `getTicket()` so group visibility applies (`:147`), calls `assertValidTransition()` (`:148`), and computes timestamps (`:150-153`).
6. `src/domain/ticketDomain.ts:10-23` - the transition table; e.g. `RESOLVED → OPEN | CLOSED`, `CLOSED → OPEN`.
7. `src/repositories/ticketRepository.ts:42-60` - `updateStatus()` uses `updateMany` with `status: expectedStatus` in the `where`; zero rows updated makes the service throw `ValidationDomainError` "Ticket changed before status update; retry the request" (`ticketService.ts:164`) → `422`.
8. An audit row `ticket.status_updated` with `from`, `to` and `note` follows (`:165-176`).
9. Returns `200` with `{ ticket }`.

Timestamp subtleties in step 5: any transition out of `NEW` stamps `firstResponseAt` if it is empty (`:151`), so `NEW → CLOSED` counts as a first response for SLA purposes. Reopening (`RESOLVED → OPEN`, `CLOSED → OPEN`) keeps the old `resolvedAt`/`closedAt` (`:152-153`), so those columns mean "last time resolved/closed", not "currently resolved".

Request: Customer tries to assign a ticket
1. `src/components/dashboard/TicketCard.tsx` - the Assign button calls `useAssignTicket(ticket.id)`.
2. `src/hooks/useTickets.ts` - `useAssignTicket()` sends `POST /api/tickets/:ticketId/assign`.
3. `src/app/api/tickets/[ticketId]/assign/route.ts:17-37` - `POST()` calls `withRole(..., "ticket:assign")` before reading the body.
4. `src/lib/middleware/withRole.ts:26-29` - `hasCapability()` fails for `Role.CUSTOMER`, so the request is rejected immediately.
5. Returns `403` with `{ error: { code: "FORBIDDEN", message: ... } }`.

Request: Agent comments on a ticket
1. `src/app/api/tickets/[ticketId]/comments/route.ts` - `withAuth()` only, then `addCommentSchema` (`body` 1–4000 chars, `isInternal` default `false`).
2. `TicketService.addComment()` (`src/services/ticketService.ts:261-304`): `getTicket()` visibility (`:266`), internal-note rule (`:267-269`), comment permission (`:271-279`), insert (`:281-286`).
3. If the comment is public, by staff, and the ticket has no `firstResponseAt`, `markFirstResponse()` stamps it with a `firstResponseAt: null` predicate (`:288-294`, `src/repositories/ticketRepository.ts:84-91`), so two concurrent first replies stamp once.
4. Audit `ticket.comment_added` (`:296-303`). Returns `201 { ok: true }`.

Request: Background escalation sweep
1. `src/app/api/cron/escalations/route.ts:11-24` - `POST()` returns `500 MISCONFIGURED` if `CRON_SECRET` is unset, `401` if `x-cron-secret` differs, then calls `createEscalationService().runSweep()`.
2. `src/repositories/ticketRepository.ts:93-106` - `listOverdueForEscalation()` returns NEW/OPEN/PENDING tickets with `escalatedAt: null` whose resolution deadline, or unanswered first-response deadline, is in the past.
3. `src/services/escalationService.ts:31-93` - for each ticket: choose the active deadline (`:37-44`; resolution after a first response, otherwise the earlier of the two), load rules for group and priority (`:46-49`), pick the rule with the largest `afterMins` not exceeding the breach (`:50-56`), resolve the target user or group and skip customers or missing targets (`:58-72`).
4. `src/repositories/ticketRepository.ts:121-143` - `markEscalatedWithAudit()` updates the ticket with `escalatedAt: null` and expected status in the `where` and inserts the `ticket.escalated` audit row in the same `$transaction`; if the conditional update matched nothing, no audit row is written. (`markEscalated()` plus a separate audit insert, `escalationService.ts:79-87`, is the fallback for repositories that do not implement the transactional method.)
5. Returns `200` with `{ checked, escalated }`.

Escalation consequences: a ticket escalates at most once, ever, because `escalatedAt` is never cleared. When the chosen rule targets only a group, `targetUserId` is `null` (`escalationService.ts:59`) and is written as `assigneeId: null`, which **unassigns** the current agent.

## Exercises
**Goal:** predict the result of `PATCH /api/tickets/:id` with `{"status":"PENDING"}` on a CLOSED ticket.
**Check:** `422 INVALID_STATE` from `assertValidTransition` (`ticketDomain.ts:15`, `:19-22`), not `400`; the schema accepted the enum value.

**Goal:** explain why two agents resolving the same ticket at once produce one success.
**Check:** both read OPEN; the first `updateMany` matches `status: OPEN`; the second matches nothing and returns `null`, so the service throws at `ticketService.ts:164`.
