# Auth and Permissions
Session auth starts in `src/services/authService.ts` and is verified on every protected request in `src/lib/middleware/withAuth.ts`. Role capability checks happen in `src/lib/middleware/withRole.ts` and are backed by the role-to-capability map in `src/lib/auth/permissions.ts`.

## Session Flow
- `src/app/api/auth/login/route.ts` calls `loginSchema.safeParse()` from `src/lib/validation/authSchemas.ts`, then `AuthService.login()` in `src/services/authService.ts`.
- `AuthService.login()` verifies the password in `src/lib/auth/password.ts`, creates a raw session token, hashes it with `hashSessionToken()`, and stores the hash through `src/repositories/sessionRepository.ts`.
- The login route writes the raw token into the `ticket_session` cookie with `serializeSessionCookie()` from `src/lib/auth/session.ts`.
- `src/lib/middleware/withAuth.ts` reads the cookie, hashes it, looks up the session row, verifies expiry, then loads the user row.

## Permission Flow
- `src/lib/auth/permissions.ts` maps `Role.ADMIN`, `Role.MANAGER`, `Role.AGENT`, and `Role.CUSTOMER` to capabilities like `ticket:assign`, `rule:write`, and `sla:write`.
- `src/lib/middleware/withRole.ts` calls `withAuth()` first, then rejects the request with `403` if `hasCapability()` returns false.
- `src/app/api/tickets/[ticketId]/assign/route.ts` uses `withRole(..., "ticket:assign")` before it ever reaches `TicketService.assignTicket()`.
- `src/app/api/rules/assignment/route.ts` and `src/app/api/slas/route.ts` use `withRole(..., "rule:write" | "sla:write")` so only operations roles can change routing or SLA policy.

## Ticket Visibility
- `src/domain/ticketVisibility.ts` builds the Prisma `where` clause for list queries.
- `src/repositories/ticketRepository.ts` calls `buildVisibleTicketWhere()` inside `listVisible()` so the scope decision stays centralized.
- `src/services/ticketService.ts` calls `mayReadTicket()` inside `getTicket()` before returning a single ticket.

## Multi-Tenancy
Multi-tenancy is not included. The app is scoped by support group and ownership, not by tenant.

If we added multi-tenancy later, the minimum changes would be:
- add `tenantId` to the Prisma models in `prisma/schema.prisma`
- carry `tenantId` through `AuthContext` in `src/lib/middleware/withAuth.ts`
- include `tenantId` in `buildVisibleTicketWhere()` and every repository query that touches tenant-owned data
- separate platform-level roles from tenant-level roles, rather than reusing the current role map as-is

