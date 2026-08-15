# Global Payment Cash-Session Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquear todos los pagos operativos internos cuando la sucursal no tenga una caja abierta y ofrecer una apertura guiada sin perder el formulario.

**Architecture:** Una función SQL central resolverá y bloqueará la sesión abierta válida dentro de la misma transacción que crea cada pago. Las APIs propagarán un código estable y los formularios consumirán un hook y panel visual compartidos para consultar, bloquear, abrir y revalidar la caja.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest/Testing Library, Zod, Supabase/PostgreSQL y RPC transaccionales.

## Global Constraints

- Todo pago positivo iniciado por personal requiere caja abierta, incluidos efectivo, tarjeta, transferencia, mixto y `other`.
- Una venta totalmente a crédito y sin adelanto no es un pago y no requiere caja; su cobro posterior sí.
- Webhooks, suscripciones automáticas y pedidos públicos que solo declaran un método quedan excluidos.
- La sesión debe pertenecer a la misma organización y sucursal y debe seguir abierta al confirmar.
- La protección autoritativa debe ejecutarse en servidor/base de datos; la UI es una ayuda adicional.
- El error público estable es `OPEN_CASH_SESSION_REQUIRED`.
- Los formularios deben conservar monto, método, referencia, notas y contexto después de abrir caja o recibir el error estable.
- No modificar ni incluir en commits los cambios concurrentes existentes de `src/components/admin/finances/*` o `src/test/setup.ts` salvo coordinación explícita; antes de cada edición volver a ejecutar `git status --short`.
- No afirmar despliegue completo hasta aplicar y verificar la migración en el proyecto Supabase enlazado.

---

### Task 1: Shared cash-session contract and reusable UI guard

**Files:**
- Create: `src/lib/payments/cash-session-guard.ts`
- Create: `src/lib/payments/cash-session-guard.test.ts`
- Create: `src/hooks/use-payment-cash-session.ts`
- Create: `src/hooks/use-payment-cash-session.test.tsx`
- Create: `src/components/payments/PaymentCashSessionGuard.tsx`
- Create: `src/components/payments/PaymentCashSessionGuard.test.tsx`
- Reuse: `src/hooks/useCashRegister.ts`
- Reuse: `src/app/dashboard/pos/components/OpenCashRegisterDialog.tsx`

**Interfaces:**
- Produces: `OPEN_CASH_SESSION_REQUIRED`, `isOpenCashSessionRequired(error)`, `PaymentCashSessionState`, `usePaymentCashSession({ active, registerId })`, and `<PaymentCashSessionGuard state onOpenCashRegister canOpenRegister />`.
- Consumes: `useCashRegister().checkOpenSession`, `openRegister` and the existing guided opening dialog.

- [ ] **Step 1: Write failing contract tests**

```ts
expect(isOpenCashSessionRequired({ code: 'OPEN_CASH_SESSION_REQUIRED' })).toBe(true)
expect(isOpenCashSessionRequired(new Error('open_cash_session_not_found'))).toBe(true)
expect(isOpenCashSessionRequired({ error: 'validation_failed' })).toBe(false)
```

The hook test must open with `active: true`, expose `checking`, resolve to `closed` for `null`, preserve its state while the opening dialog is active, and expose `refresh()` that changes it to `open` when `checkOpenSession` returns `{ id: 'session-1' }`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/lib/payments/cash-session-guard.test.ts src/hooks/use-payment-cash-session.test.tsx`

Expected: FAIL because the module and hook do not exist.

- [ ] **Step 3: Implement the minimal shared contract and hook**

```ts
export const OPEN_CASH_SESSION_REQUIRED = 'OPEN_CASH_SESSION_REQUIRED' as const
export type PaymentCashSessionState = 'idle' | 'checking' | 'open' | 'closed'

export function isOpenCashSessionRequired(value: unknown): boolean {
  const text = value instanceof Error
    ? value.message
    : JSON.stringify(value ?? '')
  return text.includes(OPEN_CASH_SESSION_REQUIRED)
    || text.includes('open_cash_session_not_found')
}
```

The hook must keep `checkOpenSession` in a ref to avoid effect loops, reset to `idle` when inactive, and never turn a network error into a false success.

- [ ] **Step 4: Add a failing component test**

Assert that `checking` disables the payment action with “Consultando caja”; `closed` renders an alert, “Abrir caja”, and a disabled confirmation; `open` renders “Caja abierta”; and `canOpenRegister={false}` links to `/dashboard/pos/caja` with “Ir a Caja”.

- [ ] **Step 5: Implement the shared presentation**

The component receives only state and callbacks; it must not own payment form data. Use `role="status"` while checking/open and `role="alert"` while closed. Render the existing `OpenCashRegisterDialog` from the consuming modal so nested dialog state remains explicit.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run src/lib/payments/cash-session-guard.test.ts src/hooks/use-payment-cash-session.test.tsx src/components/payments/PaymentCashSessionGuard.test.tsx`

```bash
git add src/lib/payments/cash-session-guard.ts src/lib/payments/cash-session-guard.test.ts src/hooks/use-payment-cash-session.ts src/hooks/use-payment-cash-session.test.tsx src/components/payments/PaymentCashSessionGuard.tsx src/components/payments/PaymentCashSessionGuard.test.tsx
git commit -m "feat: add shared payment cash-session guard"
```

### Task 2: Authoritative PostgreSQL payment-session enforcement

**Files:**
- Create: `supabase/migrations/20260815160000_require_open_cash_session_for_internal_payments.sql`
- Create: `src/lib/payments/cash-session-migration.test.ts`
- Reference: `supabase/migrations/20260728213000_harden_dashboard_financial_workflows.sql`
- Reference: `supabase/migrations/20260811190000_create_finance_foundation.sql`
- Reference: `supabase/migrations/20260811193000_create_payroll_commissions.sql`
- Reference: `supabase/migrations/20260814235814_repair_financial_closure.sql`
- Reference: `supabase/migrations/20260815120000_unrepaired_repair_closeouts.sql`

**Interfaces:**
- Produces: `public.require_open_cash_session(uuid, uuid, uuid default null) returns uuid` and new-payment invariants for POS, repair, credit, finance, payroll and technician payment records.
- Consumes: `cash_closures(id, organization_id, branch_id, date)` where `date is null` means open.

- [ ] **Step 1: Write the failing migration contract test**

Read the migration as text and assert it contains:

```ts
expect(sql).toContain('function public.require_open_cash_session')
expect(sql).toContain("raise exception using errcode = 'P0001', message = 'OPEN_CASH_SESSION_REQUIRED'")
expect(sql).toContain('for update')
expect(sql).toContain('credit_payments_cash_session_id_fkey')
expect(sql).toContain('technician_payments_cash_session_id_fkey')
expect(sql).toContain('payment_method <>') // confirms old cash-only constraints are replaced
expect(sql).toContain('revoke all on function public.require_open_cash_session')
```

Also assert the migration references `register_credit_payment_atomic`, `record_finance_payment`, `record_payroll_payment`, `capture_repair_payment`, `close_unrepaired_repair`, and the POS atomic sale function currently called by `/api/pos/process-sale`.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/lib/payments/cash-session-migration.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create the central SQL resolver**

```sql
create or replace function public.require_open_cash_session(
  p_organization_id uuid,
  p_branch_id uuid,
  p_requested_session_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare resolved_id uuid;
begin
  select session.id into resolved_id
  from public.cash_closures session
  where session.organization_id = p_organization_id
    and session.branch_id = p_branch_id
    and session.date is null
    and (p_requested_session_id is null or session.id = p_requested_session_id)
  order by session.created_at desc
  limit 1
  for update;
  if resolved_id is null then
    raise exception using errcode = 'P0001', message = 'OPEN_CASH_SESSION_REQUIRED';
  end if;
  return resolved_id;
end;
$$;
```

Revoke execution from `public`, `anon`, and `authenticated`; grant only to `service_role` and to the security-definer RPCs that invoke it through their owner privileges.

- [ ] **Step 4: Extend payment tables compatibly**

Add nullable `cash_session_id` plus scoped foreign keys and indexes to `credit_payments` and `technician_payments` if absent. Keep historical rows nullable. Replace finance/payroll cash-only check constraints so every non-legacy new positive payment carries a session regardless of payment method. Do not backfill invented sessions.

- [ ] **Step 5: Redefine transactional writers**

Each writer must call `require_open_cash_session` after locking its business record and before inserting any payment, use the returned id in the new row, and use that same id for its audit/movement record. A fully financed POS sale with no positive payment splits must skip the resolver. No direct authenticated insert grant may bypass these writers.

- [ ] **Step 6: Verify static and local SQL checks**

Run:

```bash
npx vitest run src/lib/payments/cash-session-migration.test.ts src/test/dashboard-financial-workflows.test.ts src/test/admin-finance-schema.test.ts src/test/admin-payroll-schema.test.ts
npx supabase db lint --local --level warning
```

If local Supabase is unavailable, record that limitation and do not claim database execution.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260815160000_require_open_cash_session_for_internal_payments.sql src/lib/payments/cash-session-migration.test.ts
git commit -m "feat: require an open cash session for internal payments"
```

### Task 3: POS payment guard and credit-only exception

**Files:**
- Modify: `src/app/api/pos/process-sale/route.ts`
- Modify: `src/app/dashboard/pos/page.tsx`
- Modify: `src/app/dashboard/pos/components/CheckoutModal.tsx`
- Test: `src/app/api/pos/process-sale/route.test.ts`
- Test: `src/app/dashboard/pos/components/CheckoutModal.test.tsx`

**Interfaces:**
- Consumes: `OPEN_CASH_SESSION_REQUIRED`, current POS `currentSessionId`, and shared guard presentation.
- Produces: atomic POS rejection for every positive payment split without a valid open session while preserving a zero-payment credit sale.

- [ ] **Step 1: Add failing API tests**

Cover `cash`, `card`, `transfer`, and mixed positive splits with no session and expect HTTP 409 plus:

```json
{ "error": "OPEN_CASH_SESSION_REQUIRED", "code": "OPEN_CASH_SESSION_REQUIRED" }
```

Add a regression where `payment_method: "credit"`, financed amount equals total, and no positive payment split succeeds without a session.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/app/api/pos/process-sale/route.test.ts`

- [ ] **Step 3: Normalize the API error**

Map the PostgreSQL stable message to status 409 without exposing raw SQL. Keep validation errors at 400 and authorization errors unchanged.

- [ ] **Step 4: Add failing checkout interaction tests**

Assert that a closed register disables “Cobrar”, shows “Abrir caja”, preserves cart/payment fields after opening, and leaves a completely financed credit confirmation enabled. Simulate a stale open UI followed by the server code and assert the form remains populated while the guard becomes closed.

- [ ] **Step 5: Implement UI behavior using the shared guard**

Do not duplicate opening form markup. The POS already owns `OpenCashRegisterDialog`; wire the shared status panel to the existing state and ensure all positive split methods require `currentSessionId`.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run src/app/api/pos/process-sale/route.test.ts src/app/dashboard/pos/components/CheckoutModal.test.tsx`

```bash
git add src/app/api/pos/process-sale/route.ts src/app/dashboard/pos/page.tsx src/app/dashboard/pos/components/CheckoutModal.tsx src/app/api/pos/process-sale/route.test.ts src/app/dashboard/pos/components/CheckoutModal.test.tsx
git commit -m "feat: block POS payments when cash session is closed"
```

### Task 4: Align every repair payment and refund flow

**Files:**
- Modify: `src/app/api/repairs/[id]/payment/route.ts`
- Modify: `src/app/api/repairs/[id]/delivery/route.ts`
- Modify: `src/lib/repairs/financial-closure-rpc.ts`
- Modify: `src/lib/repairs/unrepaired-closeout-rpc.ts`
- Modify: `src/components/dashboard/repairs/RepairPaymentDialog.tsx`
- Modify: `src/components/dashboard/repairs/RepairDeliveryDialog.tsx`
- Modify: `src/components/dashboard/repair-form-dialog-v2.tsx`
- Test: existing colocated repair route, RPC and dialog tests.

**Interfaces:**
- Consumes: shared error detector and guard UI; authoritative SQL resolver.
- Produces: identical caja behavior for cash, card, transfer, deposits, delivery collection, unrepaired settlement payments and refunds.

- [ ] **Step 1: Extend failing repair tests**

Parameterize methods `cash`, `card`, and `transfer`; every positive payment/refund without an open session must fail with `OPEN_CASH_SESSION_REQUIRED`. Assert credit/store-credit creation without money movement remains allowed. Add dialog assertions that the selected method no longer changes whether caja is required.

- [ ] **Step 2: Verify RED**

Run the payment, delivery, RPC and dialog repair suites explicitly.

- [ ] **Step 3: Update adapters and routes**

Always pass the current `cashSessionId` for a positive settlement, regardless of method. Normalize the database error to `{ error, code }` with HTTP 409. Preserve the idempotency key and existing tenant/branch checks.

- [ ] **Step 4: Consolidate repair UI behavior**

Replace method-specific caja conditions with `amount > 0` or refund settlement. Reuse the shared guard presentation and existing guided dialog. On stale-session errors, retain the delivery outcome, part resolution, charge choice, amount, method and reference.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npx vitest run "src/app/api/repairs/[id]/payment/route.test.ts" "src/app/api/repairs/[id]/delivery/route.test.ts" src/lib/repairs/financial-closure-rpc.test.ts src/lib/repairs/unrepaired-closeout-rpc.test.ts src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx
```

Commit only the listed repair files with message `feat: require open cash session for repair settlements`.

### Task 5: Credit installment payment guard

**Files:**
- Modify: `src/app/api/credits/route.ts`
- Modify: `src/hooks/use-credit-system.ts`
- Modify: `src/components/dashboard/credits/CreditPaymentDialog.tsx`
- Modify: `src/app/dashboard/credits/page.tsx`
- Modify: `src/components/pos/CustomerCreditHistory.tsx`
- Test: `src/app/api/credits/route.test.ts`
- Test: `src/components/dashboard/credits/CreditPaymentDialog.test.tsx`

**Interfaces:**
- Consumes: branch ID, shared guard hook/presentation and `register_credit_payment_atomic`.
- Produces: one atomic, caja-linked payment command per credit collection and stable stale-session handling.

- [ ] **Step 1: Write failing API tests**

For each payment method, expect 409 without a valid session, reject sessions from another branch, and verify the stable code. Verify a valid session reaches the RPC and returns the applied amount.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/app/api/credits/route.test.ts`

- [ ] **Step 3: Update API and payment orchestration**

Pass `p_cash_session_id` to the RPC. Update `recordPayment` so all FIFO installment calls reuse the same session and idempotency context; if any installment fails, the database-facing command must be redesigned as one batch RPC so a customer payment cannot be partially applied across installments.

- [ ] **Step 4: Write failing UI tests**

Assert closed/checking blocks confirm for all three methods, “Abrir caja” is visible, field values survive opening, and `OPEN_CASH_SESSION_REQUIRED` returned after submit restores the closed state.

- [ ] **Step 5: Implement shared guarded UI**

Keep receipt generation unchanged. The dialog receives the branch/session behavior through the shared hook and opens the existing guided dialog. Do not close or clear on server error.

- [ ] **Step 6: Verify and commit**

Run credit route, dialog and installment tests; commit with `feat: guard credit collections with cash sessions`.

### Task 6: Finance, payroll and technician disbursement guard

**Files:**
- Modify carefully after rechecking concurrent work: `src/components/admin/finances/PaymentDialog.tsx`
- Modify: `src/app/api/admin/finances/obligations/[id]/payments/route.ts`
- Modify: `src/app/api/admin/finances/payroll/[id]/payments/route.ts`
- Modify: `src/components/dashboard/technicians/detail/TechnicianPaymentsTab.tsx`
- Modify: `src/app/api/repairs/technicians/[id]/payments/route.ts`
- Create: `src/app/api/repairs/technicians/[id]/payments/route.test.ts`
- Modify tests: `src/components/admin/finances/FinanceOperations.test.tsx` only after confirming ownership of concurrent edits.

**Interfaces:**
- Consumes: shared guard UI and authoritative finance/payroll/technician RPCs.
- Produces: mandatory open-session linkage for every paid outgoing operation; `pendiente` technician records remain non-payments and are allowed.

- [ ] **Step 1: Resolve dirty-file ownership before editing**

Run `git status --short` and `git diff -- src/components/admin/finances/PaymentDialog.tsx src/components/admin/finances/FinanceOperations.test.tsx`. If concurrent changes overlap, stop this task and ask the user instead of overwriting them.

- [ ] **Step 2: Write failing server tests**

Finance and payroll `cash`, `bank_transfer`, and `other` payments must all require the session. Technician `status: pagado` with `efectivo`, `transferencia`, or `otro` must reject without it; `status: pendiente` must remain allowed and create neither payment movement nor caja linkage.

- [ ] **Step 3: Replace best-effort technician writes atomically**

Create/use a security-definer `record_technician_payment` RPC that locks the session, inserts the technician payment and its cash movement/audit record in one transaction. Delete the route’s current try/catch that silently skips the movement.

- [ ] **Step 4: Update finance/payroll APIs**

Require `cashSessionId` for every method, map the stable database error to 409, and preserve existing organization, branch, permission, idempotency and outstanding-balance validations.

- [ ] **Step 5: Add guarded forms**

Remove the manual free-text “Sesión de caja” input from Finance. Resolve it from the active branch via the shared hook, show the shared status panel, and provide the guided opening button. Apply the same behavior to technician payments when status is `pagado`; switch to `idle` and allow saving when status is `pendiente`.

- [ ] **Step 6: Verify and commit**

Run focused Finance, payroll-schema, technician route and technician UI tests. Stage only reviewed, scoped hunks and commit with `feat: guard operational disbursements with cash sessions`.

### Task 7: Remaining dashboard payment audit and release verification

**Files:**
- Audit: `src/app/api/orders/[id]/payment/route.ts`
- Audit: `src/app/api/sales/route.ts`
- Audit: every dashboard result from `rg -n "Registrar pago|Cobrar|payment_method|paymentMethod" src/app/dashboard src/components/dashboard src/components/pos`
- Create: `src/test/internal-payment-cash-session-contract.test.ts`
- Modify only if a real uncovered writer is found: its API, UI and focused test.

**Interfaces:**
- Consumes: all prior server/UI contracts.
- Produces: evidence that no internal payment writer bypasses the rule and that explicit external exceptions remain functional.

- [ ] **Step 1: Add a failing inventory test**

Maintain an explicit list of internal payment routes/RPC adapters and assert each imports the stable error contract or invokes an RPC covered by the new migration. Maintain a separate explicit exception list for Pagopar webhooks, subscription payments, and public order method declarations.

- [ ] **Step 2: Audit and close uncovered paths using TDD**

For each uncovered internal writer, first add a focused rejection test, watch it fail, then route it through the shared server and UI contracts. Do not infer that an order marked paid is safe merely because it has a payment method field.

- [ ] **Step 3: Run focused verification**

Run all newly added tests plus existing POS, repairs, credits, Finance, payroll and technician suites. Then run:

```bash
npm run typecheck
npx eslint <all-touched-ts-and-tsx-files>
git diff --check
```

- [ ] **Step 4: Run the full suite and classify failures**

Run: `npm test`

Report unrelated baseline/concurrent failures separately; do not describe the global control as fully green if an affected payment suite fails.

- [ ] **Step 5: Validate and apply Supabase migration**

Run:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Then execute authenticated smoke cases for one incoming and one outgoing payment with a closed and open session. If the project is not linked, stop and report that deployment remains pending.

- [ ] **Step 6: Final review and commit**

Review `git diff --stat`, `git diff --check`, staged content and secret patterns. Commit the audit/test increment as `test: cover global payment cash-session enforcement`. Do not stage unrelated Finance or test-setup changes.
