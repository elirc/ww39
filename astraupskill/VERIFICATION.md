# Verification

*Time: about 20 minutes.*

This chapter is the learner-facing checklist: the commands you can run from the delivered project folder, the numbers you should see, and — just as important — what these checks do **not** prove.

## Commands

| Check | Command | What a pass looks like |
|---|---|---|
| Full suite | `npm test -- --reporter=verbose` | 7 test files, 20 passing tests, exit code 0 |
| Type check | `npx tsc --noEmit` | no output, exit code 0 |
| Focused escalation + permissions | `npx vitest run src/tests/escalation-service.test.ts src/tests/permissions.test.ts` | 2 files, 11 passing tests |
| Focused escalation + assignment | `npx vitest run src/tests/escalation-service.test.ts src/tests/assignment-service.test.ts` | 2 files, 9 passing tests |

Counting note, because these numbers are easy to get wrong: `src/tests/` holds **seven** files (`assignment-service`, `dataIsolation`, `escalation-service`, `permissions`, `route-unknown-role`, `status-transition`, `validation`). The focused escalation + permissions command runs **11** tests, not 8 — six escalation cases plus five permission cases, where the five come from three `it` call sites because `it.each(["constructor","toString","__proto__"])` expands to three. Always read the runner's summary line rather than counting `it(` strings in the source.

Before the first run, generate the Prisma client for this project's own schema: `npx prisma generate`. Never copy a generated client from another project — the model names from a different schema can make wrong code appear to compile.

On a slow machine, Vitest's default worker pool can time out during module transform (`Timeout calling "fetch" with "/@vite/env"`). That is an environment symptom, not a test failure; re-run with a single worker:

```bash
npx vitest run --pool=forks --poolOptions.forks.maxForks=1 --poolOptions.forks.minForks=1
```

Run the type check after **any** repository contract change, because the fakes in `src/tests` and the Prisma adapter are both consumers of `src/repositories/contracts.ts`. A fake left on the old return type should fail compilation; if it does not, the contract is not actually shared.

## What these checks establish

The unit suite establishes deadline selection, threshold equality, invalid-target handling, terminal and no-deadline skips, conditional winner behavior, the audit-failure contract, and unknown-role fail-closed behavior at both the helper and the route.

## What they do not establish

A unit suite using repository fakes proves service decisions and how the service handles a conditional write that touched no rows. It does **not** prove PostgreSQL transaction rollback, isolation, or cross-process locking. The rollback test's fake raises its error before committing anything, so it demonstrates the service's behavior on failure, not the database's. Nothing here runs the app end to end against a real database.

A production-readiness review should add, against a disposable PostgreSQL database:

- a concurrency test that starts two sweeps on the same overdue ticket and asserts exactly one update count and exactly one audit row;
- a rollback test that forces the `auditLog` insert to fail inside `markEscalatedWithAudit`, then re-reads the ticket row and asserts `escalatedAt IS NULL` and the original `supportGroupId`;
- a test that races the same claim from two processes, not two promises in one process.

## Debugging a failed check

A failed type check is actionable: open `src/repositories/contracts.ts` next to `src/repositories/ticketRepository.ts` and the fake that broke, and change all three together. A failed test is actionable too: print the arguments the fake received and compare them with the predicate the real adapter would send — most failures here are a missing `expectedStatus`, or an `undefined` where the test meant `null`.

Do not replace a failing check with a source-text count or with a note of what you expected to happen. Report the count the terminal printed, and keep the distinction between mocked persistence and database behavior visible in anything you write down.
