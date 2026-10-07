# Architecture Overview
Atlas Support is a Next.js App Router help desk with a thin UI, REST API routes, a service layer for business rules, and Prisma-backed repositories for data access. The code is deliberately split so request handling, validation, permissions, and persistence are easy to trace in separate files.

## Top-Level Map
- `src/app/` holds pages and API routes.
  - Example page: `src/app/page.tsx` renders the dashboard shell; `src/app/login/page.tsx` renders sign-in.
  - Example route: `src/app/api/tickets/route.ts` handles list/create ticket requests.
  - Eleven route files in total: auth (`login`, `logout`, `me`), tickets (list/create, detail/status, assign, comments), rules (`assignment`, `escalation`), `slas`, and `cron/escalations`.
- `src/components/` holds client components that only orchestrate hooks and forms.
  - Example: `src/components/dashboard/Dashboard.tsx` renders the ticket console.
  - Example: `src/components/auth/LoginPanel.tsx` renders the sign-in form.
- `src/hooks/` holds React Query wrappers over the REST API.
  - Example: `src/hooks/useTickets.ts` centralizes ticket queries and mutations.
- `src/services/` holds business logic as classes that receive their repositories through the constructor.
  - `src/services/ticketService.ts` owns ticket lifecycle, assignment, and comment rules.
  - `src/services/ruleService.ts` owns assignment-rule, escalation-rule and SLA-policy creation.
  - `src/services/escalationService.ts` owns the cron-style escalation sweep.
  - `src/services/authService.ts` owns login and logout.
- `src/repositories/` holds Prisma adapters. `src/repositories/contracts.ts` declares the interfaces the services depend on; each `Prisma*Repository` class implements one.
- `src/server/container.ts` is the composition root: it creates one instance of every repository at module load (`:21-29`) and exposes `create*Service()` factories (`:31-66`) plus `createRepositories()` (`:68-80`) for the auth middleware.
- `src/lib/` holds shared technical primitives: session hashing and cookies (`src/lib/auth/session.ts`), bcrypt (`src/lib/auth/password.ts`), the capability map (`src/lib/auth/permissions.ts`), middleware, Zod schemas, error types and HTTP helpers.
- `src/domain/` holds pure policy helpers that are easier to test than database code.
  - `src/domain/ticketDomain.ts` defines valid lifecycle transitions (`:10-16`).
  - `src/domain/ticketVisibility.ts` builds the visibility filter used by ticket lists (`:10-25`).
- `prisma/` holds `schema.prisma` and `seed.ts` (users, groups, SLAs, automation rules).
- `src/tests/` holds seven Vitest files, selected by `vitest.config.ts` (`include: ["src/tests/**/*.test.ts"]`).

## How A Request Moves
The request path is intentionally linear, but note the order: **auth runs before the body is parsed.**

```
route.ts
  ├─ createRepositories()                          src/server/container.ts:68-80
  ├─ withAuth / withRole(capability)               src/lib/middleware/withAuth.ts:24-57, withRole.ts:13-32
  │     (returns a Response on failure; the route returns it as-is)
  ├─ readJsonBody → schema.safeParse               src/lib/http/requestBody.ts:1-7, src/lib/validation/*.ts
  │     (invalid JSON becomes null and fails the schema → 400 INVALID_INPUT)
  ├─ create*Service().method(auth.user, ...)       src/services/*.ts
  │     └─ repositories → Prisma
  └─ catch → handleServiceError                    src/lib/http/handleServiceError.ts:14-36
        Authentication → 401, Forbidden → 403, NotFound → 404,
        ValidationDomainError → 422 INVALID_STATE, other Error → 500 with error.message
```

This separation lets you review a request in layers: transport, auth, validation, domain rule, and persistence.

## Concurrency strategy
Writes that depend on a previously read state use conditional `updateMany` calls and treat `count === 0` as "someone else changed it": status updates require the expected status (`src/repositories/ticketRepository.ts:50-51`), assignment requires the expected status, group and first-response timestamp (`:63-64`), first-response stamping requires `firstResponseAt: null` (`:86-87`), and escalation requires `escalatedAt: null` (`:110-111`, `:123-124`). Only escalation wraps its state change and audit row in one `$transaction` (`:121-143`); every other service writes its audit row in a separate call after the state change.

## Exercises
**Goal:** find where a request with malformed JSON is rejected.
**Check:** `readJsonBody` returns `null` (`src/lib/http/requestBody.ts:4-5`), so `safeParse(null)` fails and the route returns `400 INVALID_INPUT` — never a 500.

**Goal:** list every write that is protected by a compare-and-set predicate.
**Check:** four repository methods, with the line ranges above; you can say which one is also transactional.
