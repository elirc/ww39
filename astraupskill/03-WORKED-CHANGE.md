# Worked change

*Time: about an hour. Keep `src/services/escalationService.ts` and `src/repositories/ticketRepository.ts` open beside this chapter.*

Placement matters. Deadline selection combines ticket state and time, so it belongs beside the sweep loop. The `escalatedAt` and expected-status predicates belong in the Prisma adapter because the database must apply them after the service read and before the mutation. Audit follows successful persistence. This separation lets a future queue worker reuse the same policy without copying route logic. Compare the exact method signatures in `src/repositories/contracts.ts` after every change.

## What changed, in order

The worked change repairs escalation selection and conditional persistence. The service first reads overdue active tickets. For an unanswered ticket it sorts first response and resolution deadlines and takes the earliest; for an answered ticket it uses resolution only. It finds matching active rules, filters by threshold, verifies a target group or non-customer target user, and calls the claim with the ticket status it observed. The repository adds `escalatedAt: null` and the expected status to the `updateMany` predicate. A zero count skips both the audit and the returned escalation result.

Here is the write before the change, taken byte-for-byte from `snapshots/ticketRepository.ts.original.txt:104-114`:

```ts
// BEFORE
async markEscalated(input: { ticketId: string; supportGroupId?: string | null; assigneeId?: string | null; escalatedAt: Date }): Promise<RepoTicket> {
  return prisma.ticket.update({
    where: { id: input.ticketId },
    data: {
      supportGroupId: input.supportGroupId === undefined ? undefined : input.supportGroupId,
      assigneeId: input.assigneeId === undefined ? undefined : input.assigneeId,
      escalatedAt: input.escalatedAt
    }
  });
}
```

`update({ where: { id } })` writes whatever the caller decided from a read that may already be stale, and it always returns a ticket, so the caller cannot tell a first claim from a second one. Here is the same method today (`src/repositories/ticketRepository.ts:108-119`):

```ts
// AFTER
async markEscalated(input: { ticketId: string; expectedStatus?: TicketStatus; supportGroupId?: string | null; assigneeId?: string | null; escalatedAt: Date }): Promise<RepoTicket | null> {
  const result = await prisma.ticket.updateMany({
    where: { id: input.ticketId, escalatedAt: null, ...(input.expectedStatus ? { status: input.expectedStatus } : {}) },
    data: {
      supportGroupId: (input.supportGroupId === undefined ? undefined : input.supportGroupId) as any,
      assigneeId: (input.assigneeId === undefined ? undefined : input.assigneeId) as any,
      escalatedAt: input.escalatedAt
    }
  });
  return result.count ? this.findById(input.ticketId) : null;
}
```

Three things moved: the return type is now `RepoTicket | null`, the `where` carries the state the service *expected to still be true*, and the row count decides whether anything happened. That is compare-and-set, expressed in Prisma.

Rule selection became deterministic at the same time (`src/services/escalationService.ts:49-53`):

```ts
const breachedMinutes = overdueMinutes(dueAt, now);
const rule = rules
  .filter((candidate) => candidate.afterMins <= breachedMinutes)
  .sort((a, b) => b.afterMins - a.afterMins || a.id.localeCompare(b.id))[0];
```

### About the two `as any` casts

`(input.assigneeId === undefined ? undefined : input.assigneeId) as any` looks like a shortcut and deserves an explanation, because this file is the one the course asks you to read carefully. Prisma's generated `TicketUpdateManyMutationInput` types a nullable relation scalar as a nested `{ set: ... }` shape in some positions, and TypeScript cannot narrow one expression that must produce *three* different meanings — "omit the key" (`undefined`), "write NULL" (`null`) and "write an id" (`string`). Astra widened the expression instead of restructuring the object. A cleaner fix, and a good exercise, is to build the `data` object conditionally so no cast is needed:

```ts
const data: Prisma.TicketUpdateManyMutationInput = { escalatedAt: input.escalatedAt };
if (input.supportGroupId !== undefined) data.supportGroupId = input.supportGroupId;
if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
```

Treat the shipped `as any` as a known wart, not as a pattern to copy: an `any` in an adapter silently disables exactly the contract checking that `npx tsc --noEmit` is supposed to give you.

## Three variations to run

Change one thing at a time in `src/tests/escalation-service.test.ts` and predict before you run.

1. **At the threshold.** Current time 12:00, `firstResponseDueAt` 11:30, no `firstResponseAt`, one rule with `afterMins: 30`. `overdueMinutes` returns exactly 30 and the filter is `afterMins <= breachedMinutes`, so the rule is eligible. Expected result: one escalation. (This is the shipped test at line 57.)
2. **Just under the threshold.** Move `firstResponseDueAt` to 11:45. Breached minutes is 15, no rule is eligible, `rule` is `undefined` and the loop `continue`s. Expected result: zero escalations, zero audit rows.
3. **Answered first response.** Restore 11:30 but set `firstResponseAt` to 11:45 and leave `resolutionDueAt` at 13:00. The service now reads the resolution clock only, which is in the future, so `dueAt > now` and the ticket is skipped. Expected result: zero escalations — even though the first-response deadline was missed, because that clock has already stopped.

Run the focused test file after each edit, then run the complete suite.

## Transaction boundary walkthrough

The production escalation adapter also exposes `markEscalatedWithAudit` (`src/repositories/ticketRepository.ts:120-143`):

```ts
async markEscalatedWithAudit(input: { ... }): Promise<RepoTicket | null> {
  return prisma.$transaction(async (tx) => {
    const result = await tx.ticket.updateMany({
      where: { id: input.ticketId, escalatedAt: null, ...(input.expectedStatus ? { status: input.expectedStatus } : {}) },
      data: { supportGroupId: ..., assigneeId: ..., escalatedAt: input.escalatedAt }
    });
    if (result.count !== 1) return null;
    await tx.auditLog.create({
      data: {
        actorId: input.audit.actorId ?? null,
        entityType: "ticket",
        entityId: input.ticketId,
        action: input.audit.action,
        metadata: input.audit.metadata as never,
        ticketId: input.ticketId
      }
    });
    return tx.ticket.findUnique({ where: { id: input.ticketId } });
  });
}
```

Read it as four decisions. The method opens one Prisma transaction. It updates only a ticket whose `escalatedAt` is still null and whose status matches the sweep's snapshot. A zero-row update is a normal race result — another worker already claimed the ticket — so the caller records no escalation and returns early *before* the audit insert. If the audit insert rejects, Prisma rolls the routing update back before the error reaches the sweep. The final read goes through `tx`, so the value returned cannot be one that another request changed after the commit point.

The service builds the audit metadata before calling the adapter, which keeps the old group, destination group and optional target user together with the claim (`src/services/escalationService.ts:72-79`):

```ts
const audit = {
  actorId: null,
  action: "ticket.escalated",
  metadata: { fromGroupId: ticket.supportGroupId, toGroupId: targetGroupId, targetUserId }
};
const updated = this.deps.ticketRepository.markEscalatedWithAudit
  ? await this.deps.ticketRepository.markEscalatedWithAudit({ ticketId: ticket.id, expectedStatus: ticket.status, ..., audit })
  : await this.deps.ticketRepository.markEscalated({ ticketId: ticket.id, expectedStatus: ticket.status, ... });
```

The service retains a compatibility fallback for isolated test doubles, while the container supplies the Prisma implementation. When changing a repository contract, update the concrete adapter and every fake together; a passing test that silently falls back to the non-atomic path is misleading — which is why the rollback test asserts that the fallback `auditLogRepository.create` is never reached.

Before: `markEscalated()` returned a ticket and the service called `auditLogRepository.create()` afterward, so a crash between the two left a routed ticket with no breadcrumb. After: the real adapter owns the pair as one unit. A useful review question is "what durable state remains if the second write fails?" For the production path the answer must be none.

## Red-first drill

The snapshots in `astraupskill/snapshots/` are byte-exact copies of the four files before the change. Use them to watch the tests fail first:

1. Copy `snapshots/ticketRepository.ts.original.txt` over `src/repositories/ticketRepository.ts` and `snapshots/escalationService.ts.original.txt` over `src/services/escalationService.ts`.
2. Run `npx vitest run src/tests/escalation-service.test.ts`. Expect compile/type errors and failing cases — write down which test names fail and what the messages say.
3. Restore both files (`git checkout -- src/` if the project is under version control, otherwise keep your own copies before step 1).
4. Re-run the same command and confirm the failures are gone.

Doing this once is worth more than reading the diff three times: it shows you which assertion each line of the change is holding up.
