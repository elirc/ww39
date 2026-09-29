# Testing Rationale

## `src/tests/permissions.test.ts` - `withRole rejects a customer before they reach the assignment handler`
This test matters because the assignment endpoint is a high-risk mutation path, and a missing role gate would let the wrong actor re-route work. The test exercises the middleware boundary, which is exactly where a production auth bug should be stopped.

What a more thorough production suite would add:
- an integration test that hits the real `POST /api/tickets/:ticketId/assign` route with seeded auth cookies
- a second case for a manager or admin role to prove the positive path still works
- a check that the response body shape stays stable when the middleware rejects

## `src/tests/validation.test.ts` - `rejects an SLA payload whose resolution window is shorter than first response`
This test matters because a bad SLA definition would poison every ticket created after it. Catching the invariant in Zod prevents the service layer from receiving a policy that cannot possibly be correct.

What a more thorough production suite would add:
- route-level tests for `POST /api/slas` and `POST /api/rules/*`
- a matrix of good and bad SLA inputs around boundary values
- persistence tests to ensure the created policy is stored with the same values that were validated

## `src/tests/status-transition.test.ts` - `rejects an invalid closed-to-pending transition`
This test matters because lifecycle bugs are expensive to repair once they are in production data, reporting, and audit history. The service path is the right place to enforce this because the database will otherwise accept the update happily.

What a more thorough production suite would add:
- tests for every allowed transition, not just the invalid one
- a route test for `PATCH /api/tickets/:ticketId`
- an audit log assertion that the rejected transition does not create a success event

## `src/tests/dataIsolation.test.ts` - `scopes agent visibility to the agent's support group instead of all tickets`
This test matters because support systems leak data most often through list endpoints, not just by letting someone open one record directly. The helper-level test is valuable because it locks the actual query shape that the repository depends on.

What a more thorough production suite would add:
- a Prisma-backed integration test that seeds two groups and verifies only the scoped rows come back
- a direct assertion on the repository method, not just the helper, once a test database exists
- a customer case that proves ownership filtering does not regress when new ticket states are added

## `src/tests/dataIsolation.test.ts` - `scopes customer visibility to tickets they created`
This test matters because a customer should never see another customer’s case history, and a support dashboard often reuses the same list endpoint for both staff and customers. The ownership filter is the security boundary here.

What a more thorough production suite would add:
- a route test for `GET /api/tickets` with a customer session cookie
- assertions for pagination and search terms so filtering cannot bypass the ownership clause
- a case that proves internal notes still stay hidden even when the ticket itself is visible

## `src/tests/dataIsolation.test.ts` - `blocks direct reads when a staff member is outside the ticket's support group`
This test matters because direct record reads are the usual bypass after list-view filters look correct. The direct-read helper is the last line of defense for one-ticket lookups, so it deserves its own assertion.

What a more thorough production suite would add:
- an integration test for `GET /api/tickets/:ticketId` using two seeded support groups
- a manager case and an admin case so the team can see the intended exception paths
- coverage for the case where a ticket is reassigned into a different support group mid-lifecycle
