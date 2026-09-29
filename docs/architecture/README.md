# Architecture Overview
Atlas Support is a Next.js App Router application with a thin UI, REST API routes, a service layer for business rules, and Prisma-backed repositories for data access. The code is deliberately split so request handling, validation, permissions, and persistence are easy to trace in separate files.

## Top-Level Map
- `src/app/` holds pages and API routes.
  - Example page: `src/app/page.tsx` renders the dashboard shell.
  - Example route: `src/app/api/tickets/route.ts` handles list/create ticket requests.
- `src/components/` holds client components that only orchestrate hooks and forms.
  - Example: `src/components/dashboard/Dashboard.tsx` renders the ticket console.
  - Example: `src/components/auth/LoginPanel.tsx` renders the sign-in form.
- `src/hooks/` holds React Query wrappers over the REST API.
  - Example: `src/hooks/useTickets.ts` centralizes ticket queries and mutations.
- `src/services/` holds business logic.
  - Example: `src/services/ticketService.ts` owns ticket lifecycle, assignment, and comment rules.
  - Example: `src/services/escalationService.ts` owns the cron-style escalation sweep.
- `src/repositories/` holds Prisma adapters and query boundaries.
  - Example: `src/repositories/ticketRepository.ts` scopes ticket reads and writes.
  - Example: `src/repositories/assignmentRuleRepository.ts` resolves routing rules.
- `src/lib/` holds shared technical primitives.
  - Example: `src/lib/middleware/withAuth.ts` verifies the session cookie.
  - Example: `src/lib/validation/ticketSchemas.ts` defines request payload boundaries.
- `src/domain/` holds pure policy helpers that are easier to test than database code.
  - Example: `src/domain/ticketDomain.ts` defines valid lifecycle transitions.
  - Example: `src/domain/ticketVisibility.ts` builds the visibility filter used by ticket lists.
- `prisma/` holds schema and seed data.
  - Example: `prisma/schema.prisma` defines the data model.
  - Example: `prisma/seed.ts` seeds users, groups, SLAs, and automation rules.
- `docs/` contains the code-anchored learning material you are reading now.

## How A Request Moves
The request path is intentionally linear:
`src/app/api/.../route.ts` parses HTTP input, `src/lib/middleware/withAuth.ts` or `withRole.ts` verifies identity and capability, `src/lib/validation/*.ts` parses payloads, `src/services/*.ts` enforces business rules, and `src/repositories/*.ts` issues Prisma queries.

This separation matters because it lets you review a request in layers:
transport, auth, validation, domain rule, and persistence.

