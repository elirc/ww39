# Core concepts

*Time: about 30 minutes.*

Boundary exercises should use fixed dates. Include a case below the threshold and exactly at the threshold, then answer the question of which clock is active. Add a wrong-group target and a missing group to distinguish invalid input from a valid no-op. Finally model a lost compare-and-set write. These cases have different audit expectations and show why domain invariants belong in services and repositories rather than only in a dashboard form.

An SLA has first response and resolution clocks. Before a public staff reply, the earliest available overdue deadline is active. Once `firstResponseAt` exists, first response is complete and only resolution remains. `overdueMinutes` floors complete minutes and clamps future values to zero. Escalation rules become eligible when `afterMins <= breachedMinutes`; the service picks the greatest eligible threshold and breaks ties by id. A ticket is claimed once because `escalatedAt` is a durable one-escalation policy. Assignment treats undefined and null differently: omitted `assigneeId` preserves the current user, while null clears it. A group-only move clears an assignee whose support group would become incompatible. Before: `{ supportGroupId: "g2" }` leaves a g1 assignee attached. After: the service sends `assigneeId: null`. Before: a first response update always writes the new timestamp. After: the repository requires `firstResponseAt: null`, so the first writer wins. These are domain invariants, not UI preferences. They belong in services and repositories because every route, job, and future worker must share them. Practice by changing the escalation fixture from a future resolution deadline to an overdue one while keeping first response answered; the expected result changes only when the active clock is breached. Explain which predicate protects each invariant before running the tests.

Here are the three predicates that carry those invariants, so you can see them side by side:

```ts
// one escalation per ticket, and only from the status the sweep saw
where: { id: input.ticketId, escalatedAt: null, ...(input.expectedStatus ? { status: input.expectedStatus } : {}) }

// the first public staff reply wins the first-response clock
where: { id: input.ticketId, firstResponseAt: null }

// an assignment only lands on the ticket the caller actually read
where: { id: input.ticketId, firstResponseAt: input.expectedFirstResponseAt ?? null,
         ...(input.expectedStatus ? { status: input.expectedStatus } : {}),
         ...(input.expectedSupportGroupId ? { supportGroupId: input.expectedSupportGroupId } : {}) }
```

All three are in `src/repositories/ticketRepository.ts`. Read each one as a sentence: "change this row **only if** the world still looks the way I thought it did."
