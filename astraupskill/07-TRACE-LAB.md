# Trace lab

*Time: about 45 minutes. Open the six files named below in six tabs before you start.*

The lab follows one request — a manual assignment — across every boundary it crosses, then repeats the exercise for the escalation sweep. Write the state before and after each write: escalation changes group and timestamp and adds one audit; assignment may change group and assignee and records the reason; a comment adds a row and may set first response. This table makes accidental updates to unrelated fields visible and gives code review a concrete account.

## Boundary 1 — the client component

`src/components/dashboard/TicketCard.tsx:85-94`. The dashboard's assignment control is a plain controlled input plus a button. Note what it sends when the field is empty:

```tsx
assignTicket.mutate({
  assigneeId: assignmentTarget || null,
  reason: "Manual reassignment from dashboard"
});
```

`assignmentTarget || null` means the UI can only ever send a string or an explicit `null` — it never omits the key. So the "omitted preserves the current assignee" path exists for API clients and tests, not for this screen. Knowing which of two semantics your UI can actually produce is the kind of thing that decides a bug report.

## Boundary 2 — the client data layer

`src/hooks/useTickets.ts:68-80`. The mutation hook serializes the object and names the endpoint:

```ts
export function useAssignTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { assigneeId?: string | null; supportGroupId?: string | null; reason: string }) =>
      apiJson<{ ticket: Ticket }>(`/api/tickets/${ticketId}/assign`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tickets"] }); }
  });
}
```

Two things to record: `JSON.stringify` drops a key whose value is `undefined` but keeps one whose value is `null` — that is the wire-level reason the two cases differ at all. And `invalidateQueries` is the only thing that makes the list refresh, so a successful write with a missing invalidation looks like a failed write to the user.

## Boundary 3 — the HTTP route

`src/app/api/tickets/[ticketId]/assign/route.ts:17-36`. The order of the first four statements is the lesson:

```ts
export async function POST(request: NextRequest, context: RouteParams) {
  const repos = createRepositories();
  const auth = await withRole(request, repos, "ticket:assign");
  if (auth instanceof Response) return auth;          // 401 or 403, nothing read yet

  const body = await readJsonBody(request);
  const parsed = assignTicketSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Invalid assignment payload.", 400, parsed.error.flatten());
  }
  // ... service call inside try/catch
}
```

Authorization runs before the body is even read; validation runs before the service is constructed. `readJsonBody` returns `null` for malformed JSON rather than throwing, so a broken body becomes a 400 from the schema instead of a 500 from the parser. `context.params` is a Promise in Next 15 and is awaited inside the `try` — that async-params migration was part of this delivery.

## Boundary 4 — authorization and validation

`src/lib/middleware/withRole.ts:13-31` resolves the session, then asks the capability map:

```ts
if (!hasCapability(auth.user, capability)) {
  return apiError("FORBIDDEN", "You do not have permission to perform this action.", 403) as AuthFailure;
}
```

`src/lib/validation/ticketSchemas.ts:31-37` is the shape gate:

```ts
export const assignTicketSchema = z.object({
  assigneeId: z.string().min(1).nullable().optional(),
  supportGroupId: z.string().min(1).nullable().optional(),
  reason: z.string().min(1).max(2000)
}).refine((value) => Boolean(value.assigneeId || value.supportGroupId), {
  message: "Provide either an assignee or a target group."
});
```

`.nullable().optional()` is precisely the "three meanings" encoding: absent, `null`, or a non-empty id. The `refine` rejects a request that changes nothing. What the schema does **not** do is check that the ids exist or that the actor may use them — that is the next boundary's job, and confusing the two is how validation layers grow into accidental authorization layers.

## Boundary 5 — the service policy

`src/services/ticketService.ts:181-242`. In order: capability re-check (defence in depth — the service is also called from tests and could later be called by a worker), read the ticket through `getTicket` (which applies read visibility), group-ownership check, target group existence, target user existence and "not a customer", cross-group assignee rejection for non-admins, then the incompatible-pair clear:

```ts
if (input.supportGroupId && nextAssigneeId) {
  const currentAssignee = await this.deps.userRepository.findById(nextAssigneeId);
  if (currentAssignee?.supportGroupId && currentAssignee.supportGroupId !== nextGroupId) {
    nextAssigneeId = null;      // a ticket may not point at a user outside its group
  }
}
```

Each rejection here throws a different domain error class, which is what lets the route answer 403 / 404 / 422 without the service knowing anything about HTTP.

## Boundary 6 — the repository, and back out

`src/services/ticketService.ts:235-243` hands the repository both the new values **and** the state it expected to still be true:

```ts
const updated = await this.deps.ticketRepository.assign({
  ticketId,
  assigneeId: nextAssigneeId,
  supportGroupId: nextGroupId,
  expectedFirstResponseAt: ticket.firstResponseAt,
  expectedStatus: ticket.status,
  expectedSupportGroupId: ticket.supportGroupId
});
if (!updated) throw new ValidationDomainError("Ticket changed before assignment; retry the request");
```

`src/repositories/ticketRepository.ts:62-70` turns those expectations into the `where` clause of an `updateMany` and returns `null` on a zero count. **This is where stale state is rejected** — not in the route, not in the service. The service only supplies the values it read; the database decides whether they are still true.

On the way back out, the audit row is written (`ticket.assigned`, with the reason), the route wraps the ticket in `NextResponse.json({ ticket }, { status: 200 })`, and any thrown domain error passes through `src/lib/http/handleServiceError.ts`, which maps `ForbiddenError`→403, `NotFoundError`→404, `ValidationDomainError`→422 and anything else→500. Note the consequence: a lost race surfaces to the client as **422**, not 409 — worth arguing about in review, and worth knowing before you debug one.

## Second trace: the escalation sweep

Start at `src/app/api/cron/escalations/route.ts`. The shared secret is checked before the container constructs `EscalationService`: no secret configured → 500, wrong secret → 401, and only then `createEscalationService().runSweep()`. The service asks `PrismaTicketRepository.listOverdueForEscalation` for active, un-escalated tickets. For each ticket it computes the deadline from response state, resolves an eligible rule, checks the destination, and calls `markEscalatedWithAudit`.

Open `src/repositories/ticketRepository.ts:120-143` and follow the transaction callback. The update predicate is the concurrency boundary; the audit insert is inside the same callback; the returned ticket is read through `tx`, which prevents the transaction from returning a value another request changed after the commit point. A failed audit rejects the callback and rolls back both writes.

Before: two workers both read the same overdue ticket, both call `update({where:{id}})`, both "succeed", and two audit rows appear for one escalation. After: only the first `updateMany` with `escalatedAt: null` gets count one; the loser gets zero, returns `null`, and skips the audit entirely.

Trace a comment the same way: the service validates visibility and internal-note policy, adds the comment, and conditionally marks first response only for a public staff reply — `markFirstResponse` carries `firstResponseAt: null` in its predicate, so the first public reply wins and later ones change nothing.

## What to write down

For each hop record: the input it received, the decision it made, the side effect it caused, and the status code it would produce on failure. Then repeat the assignment trace as a *stale writer*: imagine another agent moved the ticket between your boundary-5 read and your boundary-6 write, and name the exact predicate that rejects you. If a route test fails, classify the failure first — authentication, capability, schema, domain validation, conditional update, or audit persistence. That classification makes the repair smaller and keeps error responses truthful.
