# Repair Financial Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make repair delivery and later balance collection transactional, auditable, idempotent, and explicit about independent operational and payment states.

**Architecture:** Add an immutable `repair_payments` ledger and one service-role-only PostgreSQL RPC that locks the repair and atomically records delivery, payment, cash movement, warranty, history, and summary fields. Keep the existing HTTP routes as tenant-aware adapters, forbid delivery through the generic status route, and expose the remaining-balance action after delivery.

**Tech Stack:** Next.js 16 route handlers, TypeScript 5.9, React 19, Zod 4, Vitest 4, Supabase/PostgreSQL PL/pgSQL.

## Global Constraints

- Preserve `repairs.paid_amount` and `repairs.payment_status` as compatible summaries.
- Allow delivery with balance only after explicit confirmation.
- Freeze `final_cost` when the first delivery succeeds.
- Require `repairs.orders.update`, active organization, and active branch for every mutation.
- Do not trust client-provided totals, payment state, actor, organization, branch, or cash session.
- Do not include unrelated dirty product or finance files in commits.
- Do not claim deployment complete until the migration is applied and remotely exercised.

---

### Task 1: Domain contracts and route validation

**Files:**
- Create: `src/lib/repairs/financial-closure.ts`
- Create: `src/lib/repairs/financial-closure.test.ts`
- Modify: `src/types/repairs.ts`

**Interfaces:**
- Produces `parseRepairPaymentRequest(input)` and `parseRepairDeliveryRequest(input)`.
- Produces `getRepairPaymentSummary({ finalCost, estimatedCost, paidAmount })`.
- Produces `RepairPayment` and `RepairPaymentStatus` types used by mappings and UI.

- [ ] **Step 1: Write failing tests for boundary parsing and summaries**

```ts
it('requires explicit outstanding-balance consent when delivering without full payment', () => {
  expect(parseRepairDeliveryRequest({ outcome: 'repaired' }).success).toBe(false)
  expect(parseRepairDeliveryRequest({ outcome: 'repaired', allowOutstandingBalance: true }).success).toBe(true)
})

it('derives a partial financial state independently from delivery', () => {
  expect(getRepairPaymentSummary({ finalCost: 100_000, estimatedCost: 0, paidAmount: 40_000 }))
    .toEqual({ total: 100_000, paid: 40_000, balance: 60_000, status: 'parcial' })
})
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx vitest run src/lib/repairs/financial-closure.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict Zod schemas and summary calculation**

```ts
const paymentSchema = z.object({
  method: z.enum(['cash', 'card', 'transfer', 'credit']),
  amount: z.number().finite().positive(),
  reference: z.string().trim().max(120).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
}).strict()

export function getRepairPaymentSummary(input: RepairPaymentSummaryInput) {
  const total = Math.max(0, Number(input.finalCost ?? input.estimatedCost) || 0)
  const paid = Math.min(total, Math.max(0, Number(input.paidAmount) || 0))
  return { total, paid, balance: total - paid, status: paid <= 0 ? 'pendiente' : paid >= total ? 'pagado' : 'parcial' }
}
```

- [ ] **Step 4: Run tests and commit the domain slice**

Run: `npx vitest run src/lib/repairs/financial-closure.test.ts src/lib/repairs/payment-limits.test.ts`
Commit: `feat(repairs): define financial closure contracts`

---

### Task 2: Immutable payment ledger and atomic PostgreSQL operation

**Files:**
- Create: the exact timestamped file printed by `supabase migration new repair_financial_closure` under `supabase/migrations/`
- Create: `src/lib/repairs/financial-closure-rpc.ts`
- Create: `src/lib/repairs/financial-closure-rpc.test.ts`

**Interfaces:**
- Consumes validated server input from Task 1.
- Produces `closeRepairAndRegisterPayment(client, input)`.
- Calls `close_repair_and_register_payment` with tenant, branch, actor, optional payment, delivery, warranty, and idempotency data.

- [ ] **Step 1: Discover the installed Supabase CLI command**

Run: `npx supabase --help` then `npx supabase migration new --help`.
If the CLI is unavailable, report the blocker before inventing a migration filename.

- [ ] **Step 2: Write the failing RPC-adapter tests**

```ts
it('passes only server-resolved scope and returns the canonical result', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { repair_id: 'r1', payment_id: 'p1' }, error: null })
  await closeRepairAndRegisterPayment({ rpc }, {
    repairId: 'r1', organizationId: 'o1', branchId: 'b1', actorId: 'u1',
    deliver: true, outcome: 'repaired', allowOutstandingBalance: false,
    payment: { method: 'cash', amount: 100, idempotencyKey: 'delivery-123' },
  })
  expect(rpc).toHaveBeenCalledWith('close_repair_and_register_payment', expect.objectContaining({
    p_repair_id: 'r1', p_organization_id: 'o1', p_branch_id: 'b1', p_actor_id: 'u1',
  }))
})
```

- [ ] **Step 3: Run the adapter test and confirm RED**

Run: `npx vitest run src/lib/repairs/financial-closure-rpc.test.ts`
Expected: FAIL because the adapter does not exist.

- [ ] **Step 4: Create the migration with ledger, RLS, grants, and RPC**

The migration must include these exact invariants:

```sql
create table if not exists public.repair_payments (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','card','transfer','credit')),
  idempotency_key text not null,
  source text not null check (source in ('repairs','delivery','pos','migration')),
  reference text, notes text, cash_session_id uuid, credit_id uuid, sale_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

alter table public.repair_payments enable row level security;
revoke insert, update, delete on public.repair_payments from anon, authenticated;
```

The RPC must lock `repairs FOR UPDATE`, verify membership/permission and branch, reject delivery unless current status is `listo`, reject overpayment, require outstanding consent, insert ledger/cash/history, derive payment status, set warranty and delivery fields, and return JSON. It must use `SECURITY DEFINER`, `SET search_path = ''`, explicit schema qualification, internal actor authorization, and revoked execution for public roles.

- [ ] **Step 5: Implement the thin typed RPC adapter and error mapping**

```ts
export async function closeRepairAndRegisterPayment(client: RpcClient, input: FinancialClosureRpcInput) {
  const { data, error } = await client.rpc('close_repair_and_register_payment', toRpcArgs(input))
  if (error) throw mapFinancialClosureRpcError(error)
  return data as FinancialClosureRpcResult
}
```

- [ ] **Step 6: Verify static SQL invariants and adapter GREEN**

Run: `npx vitest run src/lib/repairs/financial-closure-rpc.test.ts`
Run focused SQL text tests or `supabase db reset` when local Supabase is available.
Commit: `feat(repairs): add atomic payment ledger`

---

### Task 3: Make delivery and payment routes use the atomic operation

**Files:**
- Modify: `src/app/api/repairs/[id]/delivery/route.ts`
- Create: `src/app/api/repairs/[id]/delivery/route.test.ts`
- Modify: `src/app/api/repairs/[id]/payment/route.ts`
- Create: `src/app/api/repairs/[id]/payment/route.test.ts`
- Modify: `src/app/api/repairs/[id]/status/route.ts`
- Modify: `src/app/api/repairs/[id]/status/route.test.ts`

**Interfaces:**
- Consumes Task 1 parsers and Task 2 RPC adapter.
- Delivery response: `{ repair, payment, idempotent }`.
- Payment response: `{ repair, payment, credit, idempotent }`.

- [ ] **Step 1: Replace the stale status test with failing canonical-delivery tests**

```ts
it('rejects entregado through the generic status endpoint', async () => {
  const response = await PATCH(request({ stage: 'entregado' }), params('r1'))
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({ code: 'USE_DELIVERY_ENDPOINT' })
})
```

- [ ] **Step 2: Add failing delivery/payment route tests**

Cover invalid state, missing outstanding consent, full payment delivery, partial delivery, later balance payment, overpayment, credit full-balance rule, stable domain codes, and tenant/branch forwarding.

- [ ] **Step 3: Run route tests and confirm RED**

Run: `npx vitest run src/app/api/repairs/[id]/delivery/route.test.ts src/app/api/repairs/[id]/payment/route.test.ts src/app/api/repairs/[id]/status/route.test.ts`

- [ ] **Step 4: Implement route adapters**

The delivery route must send `deliver: true`; payment must send `deliver: false`. Remove direct `repairs.update`, `cash_movements.insert`, and `repair_notes.insert` financial writes from the routes. Preserve credit creation but pass `creditId` to the atomic operation and compensate only if the RPC fails before recording it.

- [ ] **Step 5: Run route tests and commit**

Run the Task 3 test command until GREEN.
Commit: `refactor(repairs): unify delivery and payment writes`

---

### Task 4: Align POS repair collection with the ledger

**Files:**
- Modify: the timestamped `repair_financial_closure.sql` migration created in Task 2
- Modify: `src/app/api/pos/process-sale/route.ts` only if the RPC argument contract changes
- Add or modify the closest POS process-sale route tests

**Interfaces:**
- POS continues calling `process_pos_sale_atomic_v3`.
- The POS transaction inserts one `repair_payments` row per charged repair with `source = 'pos'`, `sale_id`, and deterministic idempotency derived from sale key plus repair id.

- [ ] **Step 1: Add a failing SQL/contract test for POS ledger insertion**

Assert that partial repair balances are charged exactly once, ledger totals equal the repair delta, and `p_mark_repairs_delivered` applies the same delivery fields and state precondition.

- [ ] **Step 2: Confirm RED, then extend the atomic POS function**

Within the existing sale transaction, insert ledger rows before updating repair summaries. Reject already-paid repairs and invalid delivery states.

- [ ] **Step 3: Run focused POS and repair tests**

Run: `npx vitest run src/app/api/pos src/app/dashboard/pos/lib/repair-charge.test.ts`
Commit: `feat(pos): ledger repair balance collections`

---

### Task 5: Map payment history and expose balance actions after delivery

**Files:**
- Modify: `src/app/api/repairs/_lib.ts`
- Modify: `src/lib/repairs/mapping.ts`
- Modify: `src/utils/repair-mapping.ts`
- Modify: `src/types/repairs.ts`
- Modify: `src/components/dashboard/repairs/RepairDetailDialog.tsx`
- Modify: `src/components/dashboard/repairs/RepairRow.tsx`
- Modify: `src/components/dashboard/repairs/RepairCard.tsx`
- Modify: `src/components/dashboard/repairs/RepairCardsView.tsx`
- Modify: `src/components/dashboard/repairs/RepairList.tsx`
- Modify: `src/app/dashboard/repairs/page.tsx`
- Add focused component/mapping tests next to these modules.

**Interfaces:**
- `Repair.payments: RepairPayment[]`.
- `Repair.paymentStatus` remains compatible.
- `onQuickPay(repair)` is available for delivered repairs while balance is positive.

- [ ] **Step 1: Write failing mapping and component tests**

```tsx
it('shows Cobrar saldo for an delivered repair with balance', () => {
  render(
    <RepairDetailDialog
      open
      repair={deliveredPartialRepair}
      onClose={() => undefined}
      onQuickPay={onQuickPay}
    />
  )
  expect(screen.getByRole('button', { name: /cobrar saldo/i })).toBeEnabled()
  expect(screen.getByText(/entregado.*pago parcial/i)).toBeVisible()
})
```

Also assert that delivered unpaid is never labeled `PAGADO`, a paid repair has no charge action, and payment history displays method/date/amount/reference.

- [ ] **Step 2: Run component tests and confirm RED**

Run only the new mapping/detail/row/card tests.

- [ ] **Step 3: Add `payments:repair_payments(*)` to canonical selects and map it**

Sort payments newest first for display; do not expose internal part cost in new UI.

- [ ] **Step 4: Correct financial badges and enable later payment**

Use the financial summary, not `repair.status`, to render `PAGADO`. Keep `Entregar` exclusive to `listo`; show `Cobrar saldo` for any non-cancelled repair with positive balance, including `entregado`.

- [ ] **Step 5: Run focused tests and commit**

Commit: `feat(repairs): expose delivered balance collection`

---

### Task 6: Update the delivery dialog and client idempotency

**Files:**
- Modify: `src/components/dashboard/repairs/RepairDeliveryDialog.tsx`
- Modify: `src/components/dashboard/repairs/RepairPaymentDialog.tsx`
- Modify: `src/app/dashboard/repairs/page.tsx`
- Create or modify component tests for both dialogs.

**Interfaces:**
- Delivery payload always includes `allowOutstandingBalance`.
- Payment and delivery requests include one stable `idempotencyKey` per submission attempt.

- [ ] **Step 1: Write failing interaction tests**

Test total/paid/balance presentation, explicit consent, double-click protection, partial payment, and stable idempotency key across a network retry.

- [ ] **Step 2: Confirm RED and implement the client contract**

Generate the key when a dialog opens/submission starts and reuse it until success or the user changes the transaction. Disable submission while pending.

- [ ] **Step 3: Run dialog and page tests**

Commit: `feat(repairs): clarify delivery payment state`

---

### Task 7: Full review, migration proof, and authenticated flow

**Files:**
- Review all files changed by Tasks 1-6.
- Do not modify unrelated dirty files.

- [ ] **Step 1: Run focused test suite**

```powershell
cmd /c npx vitest run src/lib/repairs src/app/api/repairs src/components/dashboard/repairs
```

- [ ] **Step 2: Run static quality gates**

```powershell
cmd /c npm run typecheck
$repairLintFiles = git diff --name-only HEAD~6 -- '*.ts' '*.tsx'
cmd /c npx eslint $repairLintFiles
git diff --check
```

- [ ] **Step 3: Run database checks**

Use `supabase db advisors` or MCP advisors after applying the migration. Verify RLS, grants, function search path, ledger uniqueness, and a rollback-on-cash-failure scenario.

- [ ] **Step 4: Exercise the authenticated end-to-end scenario**

Create or select a `listo` repair, record its final cost, deliver with explicit outstanding balance, verify frozen cost and `pendiente`, register a partial payment, register the remaining payment, and verify `pagado`, two ledger entries, matching cash movements, warranty, delivery result, and no duplicate on retry.

- [ ] **Step 5: Request independent code review and address all Critical/Important findings**

Review correctness, tenant/branch authorization, RLS, transactionality, idempotency, POS compatibility, UI truthfulness, and test coverage.

- [ ] **Step 6: Report deployment truthfully**

If remote migration or authenticated browser verification cannot be performed, state those items as incomplete rather than claiming the workflow deployed.
