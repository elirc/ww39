# Testing and debugging

*Time: about 50 minutes, including one run of the suite.*

When a suite appears to hang, inspect its command log and process handle before launching another run. Read the final exit code and summary. For a compile error, fix the shared contract rather than weakening production types. For a concurrency failure, inspect expected predicates and returned counts. These steps preserve the distinction between actual evidence and a plausible looking record. Keep every test fixture fresh and deterministic.

## How the suite is built

Vitest tests use fresh repository fakes. The escalation harness stores whether a ticket has already been claimed, which models the database update count across two sweep calls:

```ts
// src/tests/escalation-service.test.ts:14-21
function harness(ticket = base(), rules = [{ id: "r1", afterMins: 30, targetGroupId: "g2", targetUserId: null, isActive: true }]) {
  let claimed = false;
  const audit: unknown[] = [];
  const deps = {
    ticketRepository: {
      listOverdueForEscalation: async () => [ticket],
      markEscalated: async () => claimed ? null : (claimed = true, { ...ticket, escalatedAt: now, supportGroupId: "g2" }),
    },
    // ...
```

The second call returns `null`, which is what a real `updateMany` with `escalatedAt: null` gives the loser of a race: a count of zero. Assertions require a positive escalation result and an empty second result; a vacuous `every` assertion would not prove a claim happened:

```ts
// src/tests/escalation-service.test.ts:57-60
it("escalates an unanswered first response exactly at the rule threshold", async () => {
  const { service } = harness(base({ firstResponseDueAt: new Date(now.getTime() - 30 * 60_000) }));
  expect((await service.runSweep(now)).escalated).toHaveLength(1);
});
```

The suite covers answered and unanswered deadlines, exact threshold behavior, no deadline, terminal state, missing targets, no eligible rules, and repeated sweeps. Assignment tests cover omission preservation, clearing an incompatible assignee, and a lost conditional write. Existing tests cover validation, visibility, permissions, and status transitions. Before: assert only that `markEscalated` was called. After: assert the returned array length, target, and audit count.

A mocked repository cannot prove SQL transaction atomicity, so that limitation is stated in `VERIFICATION.md` rather than hidden. Use `npm test -- --reporter=verbose` to capture actual execution. Use `npx tsc --noEmit` to catch contract drift; a fake method with the old return type should fail compilation. When debugging, inspect the imported module path first, then reset state between cases. Do not infer test counts from file names or source annotations. For a future database check, use a disposable database and assert both ticket state and audit row after two concurrent workers.

## Testing the two failure edges

The permission map is a runtime boundary. TypeScript's `Role` type does not sanitize JSON, database drift, or a hand-built test object. `hasCapability` therefore checks that the role is an **own** key of the capability map and that the value is really an array:

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

It deliberately does **not** use `roleCapabilities[user.role]?.includes(capability)`. Optional chaining only short-circuits on `null`/`undefined`, and inherited keys such as `constructor` or `toString` resolve to functions, so `.includes` would throw and the route would answer 500 instead of 403. The route middleware converts the `false` result into a 403.

The regression in `src/tests/permissions.test.ts` casts an invented role to the enum type, calls the real helper, asserts that it does not throw, and asserts `false` — once for an unknown role and once per inherited key:

```ts
// src/tests/permissions.test.ts:54-61
it("fails closed for an unknown runtime role", () => {
  expect(() => hasCapability({ id: "u", role: "OWNER" as Role, ... }, "ticket:read:any")).not.toThrow();
  expect(hasCapability({ id: "u", role: "OWNER" as Role, ... }, "ticket:read:any")).toBe(false);
});
it.each(["constructor", "toString", "__proto__"])("fails closed for inherited role key %s", (role) => {
  expect(() => hasCapability({ id: "u", role: role as Role, ... }, "ticket:read:any")).not.toThrow();
  expect(hasCapability({ id: "u", role: role as Role, ... }, "ticket:read:any")).toBe(false);
});
```

This catches the common "unknown role becomes a 500" mistake. Note that `it.each` with three cases reports as three tests, which is why the file's five reported tests come from only three `it` call sites.

The escalation test at `src/tests/escalation-service.test.ts:31` uses a transaction-capable fake. It keeps a `committed` snapshot, builds the tentative post-claim state inside the fake, raises an audit exception instead of committing, and rethrows. The service test asserts the exception and verifies that `committed` still holds the original group and a null `escalatedAt`. Be precise about what that proves: the service propagates the failure and records no escalation, and the fallback `auditLogRepository.create` path is not taken. It does not prove PostgreSQL isolation or crash durability — those require a disposable PostgreSQL integration test with two workers.

## Running focused checks

From the project root, on any platform:

```bash
npx vitest run src/tests/escalation-service.test.ts src/tests/permissions.test.ts --maxWorkers=1 --minWorkers=1
```

On Windows `cmd.exe`, a `src/tests/*.test.ts` glob is not expanded by the shell, so name the files explicitly as above (or run the whole suite with `npm test`). Read the test summary rather than counting `it(` strings. When a test uses `as any`, explain what boundary the fake is modeling and keep at least one assertion on the actual production helper or adapter shape.
