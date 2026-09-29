# Build Journal

## Stage Log
1. Project summary and architecture decision: built a support ticketing platform with explicit roles, SLAs, escalation, and assignment rules because those are the real backend patterns a junior-to-mid engineer needs to practice.
2. Stack choice: used Next.js App Router, TypeScript, Prisma, Zod, Tailwind, and React Query because they support a realistic CRUD product without hiding the backend boundary.
3. Domain model design: modeled users, support groups, tickets, comments, SLA policies, assignment rules, escalation rules, sessions, and audit logs because those entities explain the product and the learning flow.
4. Auth and permissions design: chose opaque cookie sessions plus capability-based RBAC because that makes the auth boundary explicit and testable.
5. API and validation design: used REST route handlers plus Zod schemas because it keeps request parsing, permission checks, and business logic reviewable.
6. Core workflows and background sweep: built ticket lifecycle, assignment, SLA stamping, escalation, and cron-style sweep logic because those are the load-bearing behaviors in a support product.
7. UI shell and query layer: added a small dashboard and login form with React Query so the front end demonstrates the flows without hosting business rules.
8. Tests and docs: added targeted tests for auth, validation, state transitions, and data isolation, then wrote code-anchored docs to make the codebase teachable.

## PR Slices

### Slice 1 - Scaffold and domain foundation
Purpose: establish the TypeScript/Next/Prisma skeleton and the core domain rules before any request handler exists.
Files with novel logic:
- `prisma/schema.prisma`
- `src/domain/ticketDomain.ts`
- `src/domain/ticketVisibility.ts`
- `src/lib/prisma.ts`
Reviewer focus:
- `prisma/schema.prisma`: verify the support-group relationships and the compound SLA key near the model definitions.
- `src/domain/ticketDomain.ts`: verify the transition map and the exception path around `assertValidTransition()`.
- `src/domain/ticketVisibility.ts`: verify the fail-closed branch for missing support-group context.
Junior reviewer blind spot: approving the schema without checking how the visibility helper turns ownership into a query filter.

### Slice 2 - Auth and permission boundary
Purpose: build session login/logout plus capability enforcement before the rest of the app can trust identity.
Files with novel logic:
- `src/lib/auth/session.ts`
- `src/lib/auth/password.ts`
- `src/lib/auth/permissions.ts`
- `src/lib/middleware/withAuth.ts`
- `src/lib/middleware/withRole.ts`
- `src/services/authService.ts`
- `src/repositories/sessionRepository.ts`
- `src/repositories/userRepository.ts`
Reviewer focus:
- `src/services/authService.ts`: verify the raw token is created once and only the hash is persisted.
- `src/lib/middleware/withAuth.ts`: verify the session expiry check and the DB-backed lookup happen before the request is trusted.
- `src/lib/auth/permissions.ts`: verify the role-capability map matches the product roles.
Junior reviewer blind spot: approving the login flow because the cookie exists, without verifying the hashed session lookup.

### Slice 3 - Ticket lifecycle and request handlers
Purpose: implement create/read/update/assign/comment flows for tickets and keep business rules in the service layer.
Files with novel logic:
- `src/services/ticketService.ts`
- `src/repositories/ticketRepository.ts`
- `src/repositories/ticketCommentRepository.ts`
- `src/repositories/supportGroupRepository.ts`
- `src/app/api/tickets/route.ts`
- `src/app/api/tickets/[ticketId]/route.ts`
- `src/app/api/tickets/[ticketId]/assign/route.ts`
- `src/app/api/tickets/[ticketId]/comments/route.ts`
Reviewer focus:
- `src/services/ticketService.ts`: verify status transitions, assignment checks, and the first-response timestamp branch.
- `src/repositories/ticketRepository.ts`: verify visibility scoping and the separate timing write helper.
- `src/repositories/supportGroupRepository.ts`: verify the repository is used to fail closed on invalid group ids.
- `src/app/api/tickets/[ticketId]/assign/route.ts`: verify the permission gate fires before the payload is handed to the service.
Junior reviewer blind spot: approving the UI and route handlers while missing the ownership filter in the repository.

### Slice 4 - Rules, SLA, and escalation automation
Purpose: add the operational controls that change future ticket routing and process overdue work.
Files with novel logic:
- `src/services/ruleService.ts`
- `src/services/escalationService.ts`
- `src/repositories/assignmentRuleRepository.ts`
- `src/repositories/slaPolicyRepository.ts`
- `src/repositories/escalationRuleRepository.ts`
- `src/app/api/rules/assignment/route.ts`
- `src/app/api/rules/escalation/route.ts`
- `src/app/api/slas/route.ts`
- `src/app/api/cron/escalations/route.ts`
Reviewer focus:
- `src/services/ruleService.ts`: verify target-user validation and the permission gates on rule creation.
- `src/repositories/assignmentRuleRepository.ts`: verify the explicit scoring logic instead of enum-order guessing.
- `src/services/escalationService.ts`: verify the breach-time calculation and audit logging.
Junior reviewer blind spot: approving the automation endpoints without checking that rule creation cannot target invalid users or groups.

### Slice 5 - UI and React Query wiring
Purpose: present the flows in a minimal dashboard without pushing business rules into React.
Files with novel logic:
- `src/hooks/apiClient.ts`
- `src/hooks/useAuth.ts`
- `src/hooks/useTickets.ts`
- `src/components/auth/LoginPanel.tsx`
- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/TicketCard.tsx`
- `src/app/providers.tsx`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/login/page.tsx`
Reviewer focus:
- `src/hooks/useTickets.ts`: verify the query key and mutation URLs line up with the API routes.
- `src/components/dashboard/TicketCard.tsx`: verify hooks are isolated per ticket row, not created in a loop.
- `src/components/dashboard/Dashboard.tsx`: verify the form only pre-fills from session data and does not duplicate backend rules.
Junior reviewer blind spot: approving a UI that looks right while letting it silently call the wrong endpoint shape.

### Slice 6 - Tests and documentation
Purpose: codify the highest-risk behaviors and then document the code paths that implement them.
Files with novel logic:
- `src/tests/permissions.test.ts`
- `src/tests/validation.test.ts`
- `src/tests/status-transition.test.ts`
- `src/tests/dataIsolation.test.ts`
- `docs/architecture/*`
- `docs/learning/*`
Reviewer focus:
- `src/tests/status-transition.test.ts`: verify the fake repository actually drives the service path that matters.
- `src/tests/dataIsolation.test.ts`: verify the visibility helper matches the repository contract.
- `docs/learning/flow-traces.md`: verify each trace matches real file/function names, not a conceptual summary.
Junior reviewer blind spot: treating the docs as a postscript instead of checking that they match the actual code.
