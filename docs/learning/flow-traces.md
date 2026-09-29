# Flow Traces

## Flow: Create ticket with automatic routing and SLA stamping
1. `src/components/dashboard/Dashboard.tsx` - `Dashboard()` submits the create form and calls `useCreateTicket().mutate(form)`.
2. `src/hooks/useTickets.ts` - `useCreateTicket()` sends `POST /api/tickets` through `apiJson()`.
3. `src/app/api/tickets/route.ts` - `POST()` calls `withRole()` and parses the body with `createTicketSchema.safeParse()`.
4. `src/lib/middleware/withRole.ts` - `withAuth()` verifies the session, then `hasCapability()` checks `ticket:create`.
5. `src/services/ticketService.ts` - `TicketService.createTicket()` resolves the assignment rule, chooses the final group, loads the SLA policy, and creates the ticket.
6. `src/repositories/assignmentRuleRepository.ts` - `findBestMatch()` ranks active rules for the group/category/priority.
7. `src/repositories/slaPolicyRepository.ts` - `findByGroupAndPriority()` selects the timing policy for the final group.
8. `src/repositories/ticketRepository.ts` - `create()` persists the ticket row.
9. `src/repositories/auditLogRepository.ts` - `create()` records `ticket.created`.
10. Returns `201` with `{ ticket }`

## Flow: Resolve a ticket and write an audit event
1. `src/components/dashboard/TicketCard.tsx` - `TicketCard()` calls `useUpdateTicketStatus(ticket.id).mutate({ status: "RESOLVED" })`.
2. `src/hooks/useTickets.ts` - `useUpdateTicketStatus()` sends `PATCH /api/tickets/:ticketId`.
3. `src/app/api/tickets/[ticketId]/route.ts` - `PATCH()` calls `withRole(..., "ticket:update:any")` and parses `updateTicketStatusSchema`.
4. `src/lib/middleware/withRole.ts` - role authorization happens before the service call.
5. `src/services/ticketService.ts` - `TicketService.updateTicketStatus()` loads the ticket, calls `assertValidTransition()`, stamps `resolvedAt`, and emits an audit row.
6. `src/domain/ticketDomain.ts` - `assertValidTransition()` rejects invalid lifecycle jumps.
7. `src/repositories/ticketRepository.ts` - `updateStatus()` writes the new state.
8. `src/repositories/auditLogRepository.ts` - `create()` records `ticket.status_updated`.
9. Returns `200` with `{ ticket }`

## Flow: Add a comment and stamp first response time
1. `src/components/dashboard/TicketCard.tsx` - `TicketCard()` calls `useAddComment(ticket.id).mutate({ body, isInternal: false })`.
2. `src/hooks/useTickets.ts` - `useAddComment()` sends `POST /api/tickets/:ticketId/comments`.
3. `src/app/api/tickets/[ticketId]/comments/route.ts` - `POST()` calls `withAuth()` and parses `addCommentSchema`.
4. `src/services/ticketService.ts` - `TicketService.addComment()` verifies visibility, stores the comment, and stamps `firstResponseAt` if this is the first public staff reply.
5. `src/repositories/ticketCommentRepository.ts` - `add()` creates the comment row with the `isInternal` flag preserved.
6. `src/repositories/ticketRepository.ts` - `markFirstResponse()` writes the SLA timestamp without pretending the ticket status changed.
7. `src/repositories/auditLogRepository.ts` - `create()` records `ticket.comment_added`.
8. Returns `201` with `{ ok: true }`

## Flow: Permission rejection on ticket assignment
1. `src/components/dashboard/TicketCard.tsx` - `TicketCard()` calls `useAssignTicket(ticket.id).mutate(...)`.
2. `src/hooks/useTickets.ts` - `useAssignTicket()` sends `POST /api/tickets/:ticketId/assign`.
3. `src/app/api/tickets/[ticketId]/assign/route.ts` - `POST()` calls `withRole(..., "ticket:assign")`.
4. `src/lib/middleware/withAuth.ts` - the session is verified first.
5. `src/lib/middleware/withRole.ts` - `hasCapability()` fails for `Role.CUSTOMER`, so the handler returns `403` before the service runs.
6. Returns `403` with `{ error: { code: "FORBIDDEN", ... } }`

## Flow: Cron escalation sweep
1. `src/app/api/cron/escalations/route.ts` - `POST()` checks `x-cron-secret` and calls `createEscalationService().runSweep()`.
2. `src/services/escalationService.ts` - `EscalationService.runSweep()` fetches overdue tickets and evaluates escalation rules.
3. `src/repositories/ticketRepository.ts` - `listOverdueForEscalation()` returns only active, breached tickets.
4. `src/repositories/escalationRuleRepository.ts` - `findApplicable()` returns the candidate rules for the group and priority.
5. `src/repositories/ticketRepository.ts` - `markEscalated()` moves routing and stamps `escalatedAt`.
6. `src/repositories/auditLogRepository.ts` - `create()` records the escalation breadcrumb.
7. Returns `200` with `{ checked, escalated }`

