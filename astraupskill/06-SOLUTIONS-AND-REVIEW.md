# Solutions and review

*Time: about 45 minutes. Do not open this chapter until you have written your predictions in `05-PRACTICE.md`.*

Review both negative paths: an invalid target is skipped before `markEscalated`, while a concurrent loser reaches it and receives null. Both produce no audit for different reasons. Test both because refactors often audit rejected targets or turn normal races into noisy errors.

## Exercise one — which clock is active

The first exercise escalates only when the active deadline is overdue by at least the rule threshold. With current time 12:00, first response due 11:30 and a 30-minute rule, `overdueMinutes` returns exactly 30 and `afterMins <= breachedMinutes` is true, so the sweep escalates. Moving first response to 11:20 gives 40 breached minutes — still one escalation, now with slack above the threshold. Setting `firstResponseAt` to 11:45 answers the first-response clock, so `runSweep` switches to `resolutionDueAt` (13:00), which is in the future, and nothing escalates:

```ts
// src/services/escalationService.ts:37-43
const dueAt = ticket.firstResponseAt
  ? ticket.resolutionDueAt
  : [ticket.firstResponseDueAt, ticket.resolutionDueAt]
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => a.getTime() - b.getTime())[0];
if (!dueAt || dueAt > now) {
  continue;
}
```

An answered ticket ignores its first response deadline, so a future resolution deadline produces no escalation.

## Exercise two — rule selection

The second exercise chooses the 30-minute rule. The service filters eligible rules and sorts descending by threshold, then by id:

```ts
// src/services/escalationService.ts:51-53
const rule = rules
  .filter((candidate) => candidate.afterMins <= breachedMinutes)
  .sort((a, b) => b.afterMins - a.afterMins || a.id.localeCompare(b.id))[0];
```

The id tie-break matters because two rules with the same `afterMins` would otherwise be ordered by whatever the database happened to return, so the same ticket could route to different groups on two runs over identical data. A deterministic tie-break makes the sweep reproducible — and makes a failing test reproducible too.

## Exercise three — omitted versus explicit null

The third exercise preserves the current assignee when the field is omitted and clears it when null is explicit. The repository turns that distinction directly into the Prisma `data` object: `undefined` means "leave this column alone", `null` means "write NULL".

```ts
// src/repositories/ticketRepository.ts:62-70
const result = await prisma.ticket.updateMany({
  where: { id: input.ticketId, firstResponseAt: input.expectedFirstResponseAt ?? null, ... },
  data: {
    assigneeId: (input.assigneeId === undefined ? undefined : input.assigneeId) as any,
    supportGroupId: (input.supportGroupId === undefined ? undefined : input.supportGroupId) as any
  }
});
return result.count ? this.findById(input.ticketId) as Promise<RepoTicket> : null;
```

`{ reason: "keep" }` therefore reaches `assign` with `assigneeId: undefined` and the column is untouched. `{ assigneeId: null, reason: "clear" }` reaches it with `assigneeId: null` and the column is cleared. The two `as any` casts are explained in `03-WORKED-CHANGE.md`.

## Exercise four — incompatible assignee

The fourth clears an incompatible assignee because a ticket cannot point to a user outside its resulting group. Moving to `g2` while the assignee belongs to `g1` would leave routing state that no group-scoped list query returns, so `TicketService.assignTicket` sends `assigneeId: null` along with the group move.

## Exercise five — the lost conditional write

The fifth raises a `ValidationDomainError` after a null conditional write and does not write an assignment audit. `assign` returns `null` when `result.count === 0`, and the service converts that null into the domain error (`src/services/ticketService.ts:243`). This is the point of compare-and-set: the loser of a race learns it lost from the row count, not from an exception raised by the database.

## Exercise six — the permission fix

The shipped solution is deliberately not the obvious one:

```ts
// src/lib/auth/permissions.ts:61-67
export function hasCapability(user: AuthUser, capability: Capability) {
  if (!Object.prototype.hasOwnProperty.call(roleCapabilities, user.role)) {
    return false;
  }
  const capabilities = roleCapabilities[user.role];
  return Array.isArray(capabilities) && capabilities.includes(capability);
}
```

The tempting one-liner is `roleCapabilities[user.role]?.includes(capability) ?? false`, and it is **wrong**. `roleCapabilities` is an ordinary object literal, so it inherits from `Object.prototype`. A session carrying `role: "constructor"` makes `roleCapabilities["constructor"]` resolve to the `Object` constructor function — not `undefined` — so the optional chain does not short-circuit and `.includes` throws a `TypeError`, which the route turns into a 500 instead of a 403. `role: "toString"` behaves the same way. That is exactly what `src/tests/permissions.test.ts:58` pins down with `it.each(["constructor", "toString", "__proto__"])`: the helper must *not throw*, and must return `false`.

`Object.prototype.hasOwnProperty.call(...)` asks whether the key is an own property of the map, which inherited keys are not; the `Array.isArray` guard means even a map corrupted at runtime cannot produce a truthy capability list. Do not replace either guard with a broad "staff" default, because that turns a typo into access. Keep capability names centralized and let the middleware decide the HTTP response.

## Solution review checklist

A strong solution has five observable properties. It selects the earliest still-active deadline, ignores first-response deadlines after a response exists, and chooses only a rule whose threshold has been reached. It validates the target user or group before any write. It includes `escalatedAt: null` and the expected status in the conditional claim. Finally, the real Prisma adapter writes the ticket and audit row in one transaction.

Review the test's independence. A test that sets `claimed = true` and then calls the same fake twice proves only that the fake remembers a boolean. It is useful for service control flow, but it is not database concurrency evidence. A stronger fake models conditional update count and keeps a snapshot for rollback. The same caution applies to the rollback test at `src/tests/escalation-service.test.ts:31`: that fake throws before it commits anything, so it proves the service propagates the error and records no escalation — it does not prove that PostgreSQL rolled anything back. State the remaining limitation whenever you quote the test.

Review questions to answer from the code rather than from this text: where is the target group existence checked? Which fields are included in the escalation compare-and-set? Why does `markFirstResponse` use `firstResponseAt: null`? The answers are in `src/services/escalationService.ts` and `src/repositories/ticketRepository.ts`, not in the route. The one-escalation policy is intentional because the schema has only `escalatedAt`; multi-tier escalation would need rule identity or a separate event table.
