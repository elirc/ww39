# Practice

*Time: about an hour. Write every prediction down **before** running anything, and do not open `06-SOLUTIONS-AND-REVIEW.md` until you have.*

Record predictions first, run the focused tests, then inspect the repository arguments before changing any assertion. If a prediction differs from the result, trace the service branch and the repository predicate — never edit the assertion to make it pass.

Run the exercises against:

```bash
npx vitest run src/tests/escalation-service.test.ts src/tests/assignment-service.test.ts
```

## Exercise one — which clock is active

Set current time to 12:00, `firstResponseDueAt` to 11:30, `resolutionDueAt` to 13:00, no `firstResponseAt`, and one rule with `afterMins: 30`. Predict whether the sweep escalates. Then move `firstResponseDueAt` to 11:20 and predict again. Then set `firstResponseAt` to 11:45 while leaving resolution at 13:00 and predict a third time.

## Exercise two — rule selection

Add two eligible rules with thresholds 10 and 30 and different targets. Predict which target is selected, and write one sentence on why a stable id tie-break matters when two rules share a threshold.

## Exercise three — omitted versus explicit null

Assign a ticket with `{ reason: "keep" }`, then with `{ assigneeId: null, reason: "clear" }`. Predict the exact arguments that reach `TicketRepository.assign` in each case, and what the `data` object sent to Prisma contains.

## Exercise four — incompatible assignee

Move a ticket to group `g2` while its assignee belongs to `g1`. Predict what happens to the assignee and name the line of `ticketService.ts` that decides it.

## Exercise five — the lost conditional write

Have the fake repository return `null` from `assign`. Predict the error class the service throws, the HTTP status the route would return, and whether an audit row is created.

## Exercise six — rejected destinations

Add a negative case with an eligible rule targeting a `CUSTOMER`, then a second with an eligible rule targeting a group id that does not exist. Predict no mutation and an empty audit list in both. A rejected destination is not an escalation event — this is what keeps an operations report from counting failed automation as completed work. Then say, in one sentence each, *why* the two cases are rejected at different points in `runSweep`.

## Exercise seven — write the rollback test yourself

Write a repository fake that stores one open ticket and exposes `markEscalatedWithAudit`. Its method should compare `escalatedAt` and the expected status, apply the new group only after the comparison succeeds, then append an audit record. Add a switch that makes the audit append throw; on that branch restore the ticket object and rethrow. Your test should call the service with a breached first-response deadline, assert the thrown error, and compare the complete ticket snapshot before and after. Then disable the failure and run the sweep again: the claim should win and exactly one audit record should exist.

Compare your fake with the one shipped at `src/tests/escalation-service.test.ts:31`. The shipped fake throws *before* it commits anything, so it never exercises the restore branch. Yours should. Be honest in your notes about what each version proves — neither proves that PostgreSQL rolled anything back.

## Exercise eight — the permission edge

Write a test that passes `{ role: "OWNER" as Role }` to `hasCapability`. The expected result is `false` with no exception. Then write a second one for `role: "constructor"` and predict, before running it, whether the naive `roleCapabilities[user.role]?.includes(capability) ?? false` implementation would pass it. Explain in your own words why a compile-time enum is not runtime validation. For a route-level extension, send the same malformed session to the assignment handler and expect a controlled 403 (see `src/tests/route-unknown-role.test.ts`).

## Rules for all exercises

Include imports from the real project files and place new tests under `src/tests`. Do not create a fictional ORM client or copy the deadline-selection logic into your test — the exercise is about the contract the service already calls. Keep dates deterministic (fixed `new Date("...")` values, never `Date.now()`).

Finish by running the full suite and the type check:

```bash
npm test
npx tsc --noEmit
```

A successful practice session ends with executed tests (not a source count), at least one non-empty positive escalation case, and a compile-clean repository contract.
