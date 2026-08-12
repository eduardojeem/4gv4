# Task 3 report: protected expenses and payments API

## Status

Implemented the protected admin finance API for obligation listing/creation,
unpaid obligation updates, atomic void/payment commands, category reads, and
organization-scoped recurrence generation.

## Files changed

- `src/lib/finance/server.ts`
  - Adds tenant-scoped service adapters, explicit super-admin organization
    resolution, strict branch authorization, paginated obligation reads,
    category reads, expense creation/update, authenticated void/payment RPC
    calls, and stable public error mapping.
- `src/app/api/admin/finances/obligations/route.ts`
  - Adds protected, Zod-validated `GET` and `POST` endpoints.
- `src/app/api/admin/finances/obligations/[id]/route.ts`
  - Adds protected, Zod-validated `PATCH` and atomic `DELETE`/void endpoints.
- `src/app/api/admin/finances/obligations/[id]/payments/route.ts`
  - Requires an exact `x-idempotency-key`, validates it, and forwards it as
    `p_idempotency_key` to `pay_finance_obligation_atomic`.
- `src/app/api/admin/finances/categories/route.ts`
  - Adds protected organization-shared category reads.
- `src/app/api/admin/finances/recurrences/generate/route.ts`
  - Calls only the authenticated scoped
    `generate_recurring_finance_obligations(date, organizationId)` RPC.
- `src/test/admin-finance-api-contract.test.ts`
  - Adds static contracts for auth, Zod, tenant/branch scope, RPC selection,
    idempotency, status mapping, and database error sanitization.

## Security and contract decisions

- Every route is wrapped with `withAdminAuth`.
- Regular admins remain bound to `context.organizationId`; super-admin support
  mode must provide a valid explicit organization through
  `x-organization-id` or `organizationId`.
- All finance-table service queries include `organization_id`; branch-scoped
  mutations also include `branch_id` and run only after strict shared branch
  resolution.
- Service-role access is limited to server CRUD. Payment, void, and recurrence
  RPCs use the authenticated server client so `auth.uid()`, database finance
  permissions, and branch checks remain effective.
- Cash movements are never inserted by HTTP/server code. Cash payments and
  reversals remain delegated to Task 2 database triggers/RPCs.
- The payment endpoint accepts only a nonblank, nonreserved, 128-character
  maximum stable header key and forwards the exact validated string without
  trimming or regeneration.
- Exact payment replay remains idempotent in the RPC; key reuse and stale
  overpayment map to `409`, invalid lifecycle/cash state maps to `422`, and
  missing permission/branch access maps to `403`.
- Raw PostgREST/PostgreSQL messages are used only for internal classification
  and are replaced with stable public messages before an API response.

## Strict TDD evidence

### Initial RED

Command:

```powershell
cmd /c "node_modules\.bin\vitest.cmd run src\test\admin-finance-api-contract.test.ts --reporter=dot"
```

Result: exit 1; 7/7 tests failed with `ENOENT` because the adapter and routes
did not exist.

### Incremental GREEN

- After adding the server adapter: 2 passed, 5 failed because routes remained.
- After obligation/category routes: 4 passed, 3 failed because dynamic payment,
  void/update, and recurrence routes remained.
- After all routes: 7/7 passed.

### Security review RED/GREEN

An eighth contract was added after review to prohibit raw database errors from
reaching API responses. The RED run exited 1 with 1 failed/7 passed because
`rawMessage` was returned. After stable public error mapping, 8/8 passed.

## Verification

Required API/auth regression command:

```powershell
cmd /c "node_modules\.bin\vitest.cmd run src\test\admin-finance-api-contract.test.ts src\test\admin-role-scope.test.ts src\test\branch-access-contract.test.ts --reporter=dot"
```

Targeted lint:

```powershell
cmd /c "node_modules\.bin\eslint.cmd src\lib\finance\server.ts src\app\api\admin\finances src\test\admin-finance-api-contract.test.ts"
```

Global typecheck:

```powershell
cmd /c "node_modules\.bin\tsc.cmd --noEmit --skipLibCheck"
```

Whitespace validation:

```powershell
git diff --check
```

Final results are recorded in the task handoff after fresh post-report runs.

## Review

- Correctness: partial-payment retries use the Task 2 idempotency contract;
  unpaid updates add a concurrent paid/status predicate; recurrence cannot call
  the global service-only generator.
- Security: service-role reads/writes are explicitly scoped, branch access is
  checked before branch operations, RPCs retain the authenticated actor, and
  raw database diagnostics are not exposed.
- Architecture: request parsing stays in route handlers; finance persistence,
  organization/branch resolution, and domain error mapping stay in the server
  adapter.
- Performance: obligation reads are bounded to 100 rows per page and use the
  Task 2 organization/date indexes; category and branch validations are bounded
  point queries.

## Concerns and follow-up

- The Task 2 migration is not applied in this workspace, so no live PostgreSQL
  RPC or HTTP integration test was possible. Apply the migration in local or
  staging and exercise exact payment replay, conflicting-key reuse, cash
  payment, paid-obligation void compensation, and recurrence generation before
  production.
- Recurring expense creation writes the template and first obligation as two
  scoped service operations with compensating template deletion on failure;
  there is no Task 2 atomic creation RPC. A future migration can make that pair
  fully transactional if required.
- No remote Supabase project was changed.

## Fix round 1/5: recurring atomicity and unpaid PATCH semantics

### Findings resolved

- Recurring creation now defines its first obligation as the recurrence period
  at `startsOn`. A request whose original `accountingDate` precedes `startsOn`
  no longer consumes that first generated period; accounting and due dates are
  derived deterministically from `startsOn` and the validated due-day offset.
- Unpaid PATCH derives `pending` versus `overdue` from the effective due date
  and the current date. The existing paid/voided precondition and concurrent
  update predicates remain unchanged.
- PATCH accepts explicit `null` for `dueDate`, `vendor`, and `notes`; omitted
  fields remain untouched. Clearing a due date while changing accounting date
  does not validate against or reuse the former due date.
- Recurring template plus first obligation creation moved to the authenticated
  `create_recurring_finance_obligation_atomic(...)` RPC. It validates finance
  management permission, tenant branch/category scope, locks a tenant/branch/key
  advisory identity, writes both rows in one transaction, and supports exact
  replay. Reusing a key with a different normalized payload is a conflict.
- `finance_expense_templates.creation_idempotency_key` is required, unique by
  organization and branch, and immutable after creation.

### Interface changes

- `POST /api/admin/finances/obligations` requires `x-idempotency-key` when the
  validated body contains `recurrence`. The same validated header value is
  forwarded exactly as `p_idempotency_key`; non-recurring expense creation
  remains compatible without the header.
- New RPC:
  `create_recurring_finance_obligation_atomic(uuid, uuid, uuid, text, numeric,
  text, text, text, date, date, integer, text) -> jsonb`, executable only by
  `authenticated` after default/public/anon access is revoked.
- `finance_expense_templates` adds the required
  `creation_idempotency_key text` field and unique
  `(organization_id, branch_id, creation_idempotency_key)` contract.
- `ExpenseUpdateInput` distinguishes omission from explicit null for `dueDate`,
  `vendor`, and `notes`.

### Strict RED/GREEN evidence

- Initial review RED: the combined server/API/schema suite exited 1 with five
  failures: missing recurring header/RPC contracts, missing atomic SQL, and two
  missing PATCH behavior helpers.
- First GREEN: 3 files and 35 tests passed after the atomic RPC, authenticated
  adapter call, nullable PATCH contract, and overdue derivation were added.
- Review hardening RED: the schema suite exited 1 with one failure before the
  template idempotency key was made immutable.

### Verification and concerns

Fresh final verification is recorded in the handoff after the report update.
The Task 2 migration remains unapplied: SQL behavior is statically contract
tested but requires a real local/staging PostgreSQL apply before production.
No remote Supabase project was changed.
