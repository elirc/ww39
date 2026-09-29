# Codebase map

*Time: about 20 minutes.*

Use this map as a navigation exercise. Start at the route, inspect its imports, follow the service constructor in `src/server/container.ts`, and finish at the repository adapter. Then open the matching test and identify which fake method captures the write. The schema is part of the map: Ticket stores SLA dates and `escalatedAt`; AuditLog stores the reason. Because there is no escalation level field, repeated sweeps use one bounded claim. This workflow keeps route authorization, service policy, and database conditions distinct and reviewable.

The application is a Next.js support ticketing platform. Route handlers authenticate requests and parse JSON. Services own authorization and business policy. Repository adapters own Prisma reads and writes. The escalation route calls `EscalationService.runSweep`; the assignment route calls `TicketService.assignTicket`. This division prevents a handler from accidentally skipping group ownership or writing a ticket without an audit event. `src/repositories/contracts.ts` is the seam used by both production adapters and unit fakes. `src/repositories/ticketRepository.ts` contains compare-and-set predicates. `src/services/escalationService.ts` selects deadlines and rules before it asks the repository to claim a ticket. `src/services/ticketService.ts` validates assignment pairs and lifecycle updates. Before: a direct `update({ where: { id } })` trusts a stale read. After: `updateMany({ where: { id, expectedStatus, escalatedAt: null } })` returns a count that tells the caller whether it won. The system records the audit only after a successful claim. Trace a request with `rg "runSweep|assignTicket|markEscalated" src`. Then open the matching test and identify the fake method that stands in for Prisma. The architecture deliberately keeps route tests and service tests separate: permission tests prove entry-point rejection, while service tests prove routing and SLA decisions. A database integration test would add durability evidence later.

Where things live, in one table:

| Layer | Files | Owns |
|---|---|---|
| Route handlers | `src/app/api/**/route.ts` | authentication, capability check, JSON parsing, status codes |
| Middleware | `src/lib/middleware/withAuth.ts`, `withRole.ts` | session lookup and 401/403 |
| Validation | `src/lib/validation/ticketSchemas.ts` | request shape (Zod), 400 |
| Services | `src/services/ticketService.ts`, `escalationService.ts` | domain policy, which domain error to throw |
| Contracts | `src/repositories/contracts.ts` | the interface shared by the adapter and every test fake |
| Adapters | `src/repositories/ticketRepository.ts` | every Prisma call, all compare-and-set predicates |
| Error mapping | `src/lib/http/handleServiceError.ts` | domain error -> HTTP status |
| Tests | `src/tests/*.test.ts` (7 files, 20 tests) | service decisions against fakes |

The schema is part of the map: `Ticket` stores the SLA dates and `escalatedAt`; `AuditLog` stores the reason. Because there is no escalation-level field, repeated sweeps use one bounded claim.
