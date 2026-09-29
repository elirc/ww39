# Support desk course

This nine chapter course follows a support ticket through the Next.js route, validation boundary, service policy, Prisma repository, and audit trail. Read the chapters in order and run the commands from the delivered project folder. The examples are based on the actual files and tests in this project. Before editing, record the current behavior with `npm test -- --reporter=verbose`; after editing, repeat it and compare the executed count. The course covers the decisions that are easiest to get subtly wrong: unanswered first response deadlines, deterministic escalation thresholds, valid routing targets, omitted versus explicit null assignment fields, and stale writes. The snippets in the chapters are excerpts with their file and line numbers; the complete tested code lives under `src/services`, `src/repositories`, and `src/tests`. Learners should finish able to explain why a zero-row conditional update is a normal concurrency result and why an audit row must only follow a successful claim.

## Prerequisites

You should be comfortable with: TypeScript basics (types, `async`/`await`, optional chaining), reading an HTTP route handler, and running `npm` scripts. You do **not** need prior Prisma, Next.js App Router or SLA-domain knowledge — all three are introduced here. If you have never written a test with Vitest or Jest, read `04-TESTING-AND-DEBUGGING.md` before `03-WORKED-CHANGE.md`.

## Reading order and time

| Chapter | What you get | Time |
|---|---|---|
| [01 code map](01-CODEBASE-MAP.md) | where routes, services, repositories and tests live | 20 min |
| [02 concepts](02-CONCEPTS.md) | SLA clocks, escalation rules, the `undefined` vs `null` trap | 30 min |
| [03 worked change](03-WORKED-CHANGE.md) | before/after of the conditional write and the transaction | 60 min |
| [04 testing](04-TESTING-AND-DEBUGGING.md) | how the fakes are built, the two failure-edge tests | 50 min |
| [05 practice](05-PRACTICE.md) | six prediction exercises — write answers before reading 06 | 60 min |
| [06 solutions](06-SOLUTIONS-AND-REVIEW.md) | the answers, with code, plus a review checklist | 45 min |
| [07 trace lab](07-TRACE-LAB.md) | follow one request end to end, six boundaries | 45 min |
| [VERIFICATION](VERIFICATION.md) | commands, expected counts, and the honest limits | 20 min |

Total: roughly two sittings of two and a half hours.

## Setup

Toolchain used for the delivered runs: **Node 22.16.0**, npm 10, **PostgreSQL 16 or newer** (the schema uses only standard types, so any supported server works).

```bash
npm ci                       # install exactly the locked dependency versions
npx prisma generate          # generate the Prisma client from THIS project's schema
```

The unit suite (`npm test`) needs nothing else — every test uses repository fakes, not a database. To run the **app** and observe the flows the trace lab describes, you also need a database:

```bash
# 1. create a database (psql, on the default port 5432)
psql -U postgres -c "CREATE DATABASE ww39_support;"

# 2. point the app at it, in a .env file at the project root
#    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ww39_support"
#    CRON_SECRET="local-dev-secret"

# 3. create the tables and load demo data
npx prisma migrate dev --name init
npx tsx prisma/seed.ts        # package.json has no "prisma.seed" entry, so run it directly

# 4. run the app (http://localhost:3000)
npm run dev
```

With the app running, the escalation sweep the course traces is a POST with the shared secret header:

```bash
curl -i -X POST http://localhost:3000/api/cron/escalations -H "x-cron-secret: local-dev-secret"
# 200 {"checked":N,"escalated":[...]}   correct secret
# 401 {"error":{"code":"UNAUTHORIZED"}} wrong secret
# 500 {"error":{"code":"MISCONFIGURED"}} CRON_SECRET not set at all
```

Use `npx tsc --noEmit` to check that service fakes still implement repository contracts. A real PostgreSQL integration environment is required to prove transaction rollback and cross-process behavior; these unit checks deliberately state that limitation in `VERIFICATION.md`.

## Glossary

- **SLA** — service level agreement: the promised times for a first reply (*first response*) and for finishing the ticket (*resolution*). Each is stored as a due timestamp on the ticket.
- **First response clock / resolution clock** — the two deadlines. Once `firstResponseAt` is set, the first-response clock has stopped and only resolution can be breached.
- **Breach** — the current time has passed a due timestamp.
- **Escalation** — moving a breached ticket to another support group or agent, recorded by setting `escalatedAt` and writing an audit row.
- **Sweep** — one pass of `EscalationService.runSweep` over all overdue tickets; normally triggered by a scheduled POST to the cron route.
- **Compare-and-set (optimistic concurrency)** — writing with a `where` clause that also names the state you expected to still be true, then checking how many rows changed. Zero rows means someone else got there first; that is a normal outcome, not an error.
- **Conditional update / `updateMany`** — the Prisma call that makes compare-and-set possible, because it returns `{ count }` instead of throwing when nothing matched.
- **Transaction (`$transaction`)** — a block of writes that all commit or all roll back together.
- **Audit row** — an `AuditLog` record describing who changed what; here it must only exist if the claim succeeded.
- **Repository / adapter** — the class that owns all Prisma calls for one entity, so services never talk to the database directly.
- **Contract** — the TypeScript interface in `src/repositories/contracts.ts` that both the real adapter and the test fakes must satisfy.
- **Fake** — a hand-written stand-in for a repository used in tests; unlike a mock it holds real state.
- **Capability** — a named permission such as `ticket:assign`; roles map to lists of capabilities in `src/lib/auth/permissions.ts`.
- **Fail closed** — when input is unrecognized, deny rather than allow (and answer 403, not 500).
- **Prototype key** — a property such as `constructor` or `toString` that every plain JavaScript object inherits; a common source of permission bugs (see chapter 06).

## Habits worth keeping

Keep a notebook of observed input, selected deadline, chosen rule, persistence predicate, and side effects. This makes a vague ticketing bug reproducible and gives code review a concrete decision record. When a contract changes, update the production adapter and every fake before trusting the test output.

## Files

Navigation: [code map](01-CODEBASE-MAP.md), [concepts](02-CONCEPTS.md), [worked change](03-WORKED-CHANGE.md), [testing](04-TESTING-AND-DEBUGGING.md), [practice](05-PRACTICE.md), [solutions](06-SOLUTIONS-AND-REVIEW.md), [trace lab](07-TRACE-LAB.md), and [verification](VERIFICATION.md). The implementation is in [EscalationService](../src/services/escalationService.ts), [TicketService](../src/services/ticketService.ts), [TicketRepository](../src/repositories/ticketRepository.ts) and the [ticket tests](../src/tests/escalation-service.test.ts). The evidence for the claimed counts is the output of the commands in [VERIFICATION](VERIFICATION.md), which you can reproduce yourself — that is the only record this course asks you to trust.

Original before-change snapshots are preserved as exact bytes for comparison: [escalation service](snapshots/escalationService.ts.original.txt), [ticket service](snapshots/ticketService.ts.original.txt), [ticket repository](snapshots/ticketRepository.ts.original.txt), and [permissions](snapshots/permissions.ts.original.txt). These `.txt` snapshots are teaching artifacts and are excluded from TypeScript compilation. Chapter 03 ends with a red-first drill that uses them: restore a snapshot, watch the tests fail, then put the fix back.

When you diff a snapshot against the current file, use `diff --strip-trailing-cr -w` (or `git diff -w`) — whole-file line-ending and formatting churn can otherwise hide a four-line change.
