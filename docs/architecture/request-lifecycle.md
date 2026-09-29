# Request Lifecycle

Request: Create a new ticket from the dashboard
1. `src/components/dashboard/Dashboard.tsx` - the create form submits to the `useCreateTicket()` mutation.
2. `src/hooks/useTickets.ts` - `useCreateTicket()` sends `POST /api/tickets` with the form body.
3. `src/app/api/tickets/route.ts` - `POST()` calls `withRole()` and parses the body with `createTicketSchema.safeParse()`.
4. `src/lib/middleware/withRole.ts` - `withAuth()` verifies the session, then `hasCapability()` checks `ticket:create`.
5. `src/lib/validation/ticketSchemas.ts` - `createTicketSchema` validates subject, description, email, priority, and support-group id.
6. `src/services/ticketService.ts` - `TicketService.createTicket()` resolves the assignment rule, chooses the final group, loads the SLA policy, and creates the ticket.
7. `src/repositories/assignmentRuleRepository.ts` and `src/repositories/slaPolicyRepository.ts` - `findBestMatch()` and `findByGroupAndPriority()` resolve routing and timing inputs.
8. `src/repositories/ticketRepository.ts` and `src/repositories/auditLogRepository.ts` - `create()` persists the ticket and `create()` persists the audit event.
9. Returns `201` with `{ ticket }`

Request: Resolve a ticket from the detail view
1. `src/components/dashboard/TicketCard.tsx` - clicking Resolve calls `useUpdateTicketStatus(ticket.id)`.
2. `src/hooks/useTickets.ts` - `useUpdateTicketStatus()` sends `PATCH /api/tickets/:ticketId`.
3. `src/app/api/tickets/[ticketId]/route.ts` - `PATCH()` calls `withRole(..., "ticket:update:any")` and parses the body with `updateTicketStatusSchema`.
4. `src/lib/validation/ticketSchemas.ts` - the schema checks that the status is a valid enum value and that the state is reachable.
5. `src/services/ticketService.ts` - `TicketService.updateTicketStatus()` calls `assertValidTransition()`, stamps timestamps, and writes an audit row.
6. `src/domain/ticketDomain.ts` - `assertValidTransition()` rejects invalid lifecycle jumps.
7. `src/repositories/ticketRepository.ts` - `updateStatus()` persists the new state.
8. Returns `200` with `{ ticket }`

Request: Customer tries to assign a ticket
1. `src/components/dashboard/TicketCard.tsx` - the Assign button calls `useAssignTicket(ticket.id)`.
2. `src/hooks/useTickets.ts` - `useAssignTicket()` sends `POST /api/tickets/:ticketId/assign`.
3. `src/app/api/tickets/[ticketId]/assign/route.ts` - `POST()` calls `withRole(..., "ticket:assign")` before reading the body.
4. `src/lib/middleware/withRole.ts` - `hasCapability()` fails for `Role.CUSTOMER`, so the request is rejected immediately.
5. Returns `403` with `{ error: { code: "FORBIDDEN", message: ... } }`

Request: Background escalation sweep
1. `src/app/api/cron/escalations/route.ts` - `POST()` checks `x-cron-secret` and calls `createEscalationService().runSweep()`.
2. `src/services/escalationService.ts` - `EscalationService.runSweep()` loads overdue tickets and evaluates escalation rules.
3. `src/repositories/ticketRepository.ts` - `listOverdueForEscalation()` fetches active tickets with breached due dates.
4. `src/repositories/escalationRuleRepository.ts` - `findApplicable()` returns the candidate rules for the ticket's group and priority.
5. `src/repositories/ticketRepository.ts` - `markEscalated()` moves the ticket and stores the escalation timestamp.
6. `src/repositories/auditLogRepository.ts` - `create()` records the escalation event for operators.
7. Returns `200` with `{ checked, escalated }`

