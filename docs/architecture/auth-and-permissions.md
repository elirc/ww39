# Auth and Permissions
Session auth starts in `src/services/authService.ts` and is verified on every protected request in `src/lib/middleware/withAuth.ts`. Role capability checks happen in `src/lib/middleware/withRole.ts` and are backed by the role-to-capability map in `src/lib/auth/permissions.ts`. Row-level rules (which ticket, which group) live in `TicketService`.

## Session Flow
- `src/app/api/auth/login/route.ts` calls `loginSchema.safeParse()` from `src/lib/validation/authSchemas.ts`, then `AuthService.login()`.
- `AuthService.login()` (`src/services/authService.ts:20-51`) looks the user up by email, verifies the password with bcrypt (`src/lib/auth/password.ts:13-15`; hashes use cost 12, `:9-11`), and returns the same `"Invalid credentials"` message for an unknown email and a wrong password (`:22-29`). It then creates 32 random bytes as a hex token (`src/lib/auth/session.ts:13-15`), stores only its SHA-256 hash (`:17-19`) with a 7-day expiry (`authService.ts:31-38`).
- The login route writes the raw token into the `ticket_session` cookie with `serializeSessionCookie()` (`src/lib/auth/session.ts:25-36`): `httpOnly`, `sameSite: "lax"`, `secure` only when `NODE_ENV === "production"`.
- `withAuth()` (`src/lib/middleware/withAuth.ts:24-57`) reads the cookie, hashes it, loads the session by hash, rejects a missing or expired row (`:36-40`), loads the user (`:42-45`), and returns an `AuthContext` built from the database row — role and group never come from the request.
- Logout deletes the session row by hash (`src/repositories/sessionRepository.ts:20-22`). Expired rows are rejected but never deleted; nothing in `src/` prunes them.

Review notes: the unknown-email path returns without running bcrypt, so response time still distinguishes "no such user" from "wrong password" even though the messages match. There is no login rate limit.

## Capability map
`src/lib/auth/permissions.ts:22-51`:

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER |
|---|---|---|---|---|
| `ticket:read:any`, `ticket:update:any`, `ticket:assign`, `ticket:comment:any` | yes | yes | yes | — |
| `ticket:create` | yes | yes | yes | yes |
| `rule:write`, `sla:write`, `audit:read` | yes | yes | — | — |
| `ticket:read:own`, `ticket:update:own`, `ticket:comment:own` | — | — | — | yes |

`hasCapability()` (`:61-67`) fails closed for a role string that is not a key of the map; `src/tests/permissions.test.ts:54` and `src/tests/route-unknown-role.test.ts:15` pin that. Several capabilities are declared but never checked anywhere: `ticket:read:any`, `ticket:read:own`, `ticket:update:own`, `ticket:comment:*` and `audit:read`. Reads and comments are authorized by the row-level helpers below instead.

## Where each rule is enforced
- `withRole(..., capability)` (`src/lib/middleware/withRole.ts:13-32`) runs `withAuth()` and returns `403` before the body is read. Used by: ticket create (`ticket:create`), status PATCH (`ticket:update:any`), assign (`ticket:assign`), assignment and escalation rules (`rule:write`), SLAs (`sla:write`).
- `withAuth` only (no capability): ticket list, ticket detail, comments. These rely on service checks.
- **Single-ticket read:** `TicketService.getTicket()` calls `mayReadTicket()` (`src/services/ticketService.ts:46-57`; rule at `src/lib/auth/permissions.ts:69-79`): ADMIN always; MANAGER/AGENT only for their own group; CUSTOMER only for tickets they created **and** whose group equals their own.
- **List:** `buildVisibleTicketWhere()` (`src/domain/ticketVisibility.ts:10-25`): ADMIN everything; MANAGER/AGENT their group, or nothing if they have no group (`:16-19`); CUSTOMER `createdById` only.
- **Create:** a CUSTOMER may only create in their own group (`ticketService.ts:71-73`).
- **Assign:** non-admins must be in the ticket's group (`:191-195`), may only pick assignees from it (`:216-218`) and may not move the ticket to another group (`:231-233`).
- **Comment:** customers on their own tickets, staff in the ticket's group, or admins (`:271-279`); customers cannot post internal notes (`:267-269`).

## Gaps a reviewer should raise
- **List and detail disagree for customers.** The list filter ignores group (`ticketVisibility.ts:24`) but `mayReadTicket` requires it (`permissions.ts:78`). When an assignment rule routes a new ticket to another group (`ticketService.ts:101-106`), or an admin or escalation moves it, the customer still sees the ticket in their list but gets `403` on the detail view and cannot comment.
- **Rule management is not group-scoped.** `RuleService` checks `rule:write`/`sla:write` and that the group exists (`src/services/ruleService.ts:69-76`, `:121-128`, `:153-160`) but never compares `input.groupId` with `auth.supportGroupId`. A MANAGER can create routing, escalation and SLA rules for any group.
- **Cron secret comparison** uses `!==` (`src/app/api/cron/escalations/route.ts:17-20`). It correctly fails closed with `500` when `CRON_SECRET` is unset (`:12-15`).
- **500 responses echo internal messages.** `handleServiceError()` returns `error.message` for any unexpected `Error` (`src/lib/http/handleServiceError.ts:31-33`), which can expose Prisma error text to clients.

## Multi-Tenancy
Multi-tenancy is not included. The app is scoped by support group and ownership, not by tenant. Adding it would require `tenantId` on tenant-owned models in `prisma/schema.prisma`, on `AuthContext` (`src/lib/middleware/withAuth.ts:12-21`), in `buildVisibleTicketWhere()` and every repository query, and a split between platform-level and tenant-level roles.

## Exercises
**Goal:** reproduce the customer list/detail mismatch on paper.
**Check:** your sequence creates an assignment rule (as a MANAGER) whose `targetGroupId` differs from the source group, then has a customer create a ticket in the source group; you show `GET /api/tickets` includes it and `GET /api/tickets/:id` returns `403`.

**Goal:** decide whether a MANAGER of group A can change group B's SLA.
**Check:** yes — `POST /api/slas` with `groupId` of B passes `sla:write` and `ruleService.ts:121-128`; you name the missing comparison.
