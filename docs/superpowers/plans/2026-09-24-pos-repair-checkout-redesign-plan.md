# POS Repair Checkout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a single, accessible POS checkout that safely charges repairs, separates payment from delivery, records repair payment provenance, and prints compact non-fiscal receipts for normal, credit, and mixed sales.

**Architecture:** Keep `/api/pos/process-sale` and `process_pos_sale_atomic_v5` as the transaction boundary, harden the repair-payment ledger around that sale, and expose tenant/branch-scoped repair search through the existing repairs API. Normalize repair state in a focused hook and pure domain helpers, then extract the oversized POS page into presentation components that consume shared checkout eligibility instead of owning business rules.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase/PostgreSQL PL/pgSQL, Radix UI, Tailwind CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-24-pos-repair-checkout-redesign.md`

## Global Constraints

- A repair with an outstanding balance may be charged before it is ready, but may not be delivered.
- `Cobrar y entregar` requires every selected repair to be ready and to have an approved quality check.
- Credit or mixed checkout settles the repair and transfers financed debt to the customer account.
- Internal receipts and the POS cart do not display IVA until an explicit fiscal-document mode exists.
- Preserve organization and branch scope in every read and write.
- Preserve one atomic outcome across sale, payments, credit, cash, inventory, repair ledger, and repair status.
- Preserve existing unrelated working-tree changes; stage only files named by the active task.
- Do not claim remote migration or authenticated-browser verification from local tests alone.

## Review Focus

- A stale browser shows balance due while another cashier just paid it: the server rejects the second charge atomically and the UI refreshes the balance without clearing unrelated cart items.
- A cart contains products plus repairs with cash and credit payments: repair ledger totals stay bounded by each repair balance and retain a `mixed` breakdown linked to the sale.
- A repair belongs to another branch or customer: search does not expose it and checkout rejects a forged ID/customer combination.
- Several repairs are selected and only one is not ready or lacks quality approval: payment remains possible, but delivery is disabled for the entire checkout with the offending ticket identified.
- Cash register closes after the cart is prepared: every checkout entry point becomes blocked with the same actionable reason while the cart remains intact.

---

## File map and boundaries

- `src/app/dashboard/pos/lib/repair-charge.ts`: pure balance, chargeability, readiness, quality, and delivery eligibility rules.
- `src/app/dashboard/pos/lib/checkout-eligibility.ts`: one pure source of truth for whether checkout can open/confirm and why not.
- `src/app/api/repairs/route.ts`: authenticated paginated repair search scoped through `resolveRepairRouteContext`.
- `src/app/dashboard/pos/hooks/usePOSRepairSearch.ts`: debounced paginated search state; never accesses Supabase directly.
- `src/app/dashboard/pos/hooks/usePOSRepairs.ts`: normalized selected-repair state, explicit delivery intent, and customer ownership.
- `src/app/dashboard/pos/components/POSRepairChargeModal.tsx`: search and selection presentation only.
- `src/app/api/pos/process-sale/route.ts`: request validation, quality preflight, error translation, and atomic RPC invocation.
- `supabase/migrations/20260924230000_harden_pos_repair_payment_ledger.sql`: immutable POS repair-payment provenance and idempotent payment breakdown.
- `src/app/dashboard/pos/components/CheckoutModal.tsx` and `components/checkout/*`: payment-mode presentation and repair delivery choice.
- `src/lib/receipt-utils.ts` and `src/components/pos/ReceiptGenerator.tsx`: receipt view model and non-fiscal conditional rendering.
- `src/app/dashboard/pos/components/POSWorkspace.tsx`, `POSSearchToolbar.tsx`, `POSCustomerSummary.tsx`, `POSMobileCartSheet.tsx`, `POSMobileCheckoutBar.tsx`: extracted POS layout surfaces.
- `src/app/dashboard/pos/page.tsx`: orchestration only after extraction.

### Task 1: Pin repair charge and delivery domain rules

**Files:**
- Modify: `src/app/dashboard/pos/lib/repair-charge.ts`
- Modify: `src/app/dashboard/pos/lib/__tests__/repair-charge.test.ts`

**Interfaces:**
- Consumes: `ChargeableRepair` cost fields plus `status`, `payment_status`, and `qualityCheck.result`.
- Produces: `getRepairBalanceDue(repair): number`, `getRepairChargeability(repair): { canCharge: boolean; balanceDue: number; reason?: string }`, and `getRepairDeliveryEligibility(repairs): { canDeliver: boolean; blockingTickets: string[]; reason?: string }`.

- [ ] **Step 1: Add failing balance and chargeability tests**

```ts
it('blocks a fully paid repair instead of falling back to gross cost', () => {
  expect(getRepairChargeability({ final_cost: 500, paid_amount: 500, status: 'listo' }))
    .toEqual({ canCharge: false, balanceDue: 0, reason: 'Sin saldo pendiente' })
})

it('allows charging an in-progress repair without making it deliverable', () => {
  expect(getRepairChargeability({ final_cost: 500, paid_amount: 100, status: 'reparacion' }).canCharge).toBe(true)
  expect(getRepairDeliveryEligibility([{ ticket_number: 'R-1', status: 'reparacion', qualityCheck: null }]).canDeliver).toBe(false)
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cmd /c npx vitest run src/app/dashboard/pos/lib/__tests__/repair-charge.test.ts`  
Expected: FAIL because the new eligibility exports do not exist.

- [ ] **Step 3: Implement normalized domain helpers**

```ts
const READY_STATUSES = new Set(['listo', 'ready_for_pickup', 'completed'])

export function getRepairChargeability(repair: PosChargeableRepair) {
  const balanceDue = getRepairBalanceDue(repair)
  return balanceDue > 0
    ? { canCharge: true, balanceDue }
    : { canCharge: false, balanceDue: 0, reason: 'Sin saldo pendiente' }
}

export function getRepairDeliveryEligibility(repairs: PosChargeableRepair[]) {
  const blocked = repairs.filter((repair) =>
    !READY_STATUSES.has(normalizeStatus(repair.status)) || normalizeQualityResult(repair.qualityCheck) !== 'approved'
  )
  return blocked.length === 0
    ? { canDeliver: repairs.length > 0, blockingTickets: [] }
    : { canDeliver: false, blockingTickets: blocked.map(repairTicket), reason: 'Falta estado Listo o control técnico aprobado' }
}
```

- [ ] **Step 4: Add tests for mixed ready states, quality rejection, zero/negative/NaN inputs, and empty selection**

```ts
expect(getRepairDeliveryEligibility([]).canDeliver).toBe(false)
expect(getRepairDeliveryEligibility([
  { ticket_number: 'A', status: 'listo', qualityCheck: { result: 'approved' } },
  { ticket_number: 'B', status: 'diagnostico', qualityCheck: { result: 'approved' } },
])).toMatchObject({ canDeliver: false, blockingTickets: ['B'] })
```

- [ ] **Step 5: Run focused tests and commit**

Run: `cmd /c npx vitest run src/app/dashboard/pos/lib/__tests__/repair-charge.test.ts`  
Expected: PASS.  
Commit: `git add src/app/dashboard/pos/lib/repair-charge.ts src/app/dashboard/pos/lib/__tests__/repair-charge.test.ts && git commit -m "fix: define POS repair charge eligibility"`

### Task 2: Harden atomic POS repair-payment provenance

**Files:**
- Create: `supabase/migrations/20260924230000_harden_pos_repair_payment_ledger.sql`
- Create: `src/lib/repairs/pos-payment-ledger-migration.test.ts`
- Modify: `src/app/api/pos/process-sale/pos-sale-hardening-contract.test.ts`
- Modify: `src/app/api/pos/process-sale/route.ts`

**Interfaces:**
- Consumes: existing `repair_payments`, `sale_payments`, `sales`, repair balance update, and sale idempotency key.
- Produces: one immutable `repair_payments` row per sale/repair with `source='pos'`, `sale_id`, aggregate `payment_method`, `payment_breakdown`, `immediate_amount`, `financed_amount`, and idempotency key `pos:<sale_id>:<repair_id>`.

- [ ] **Step 1: Write a migration contract test that describes the ledger extension**

```ts
expect(sql).toContain('add column if not exists payment_breakdown jsonb')
expect(sql).toContain('add column if not exists immediate_amount numeric')
expect(sql).toContain('add column if not exists financed_amount numeric')
expect(sql).toContain("'pos:' || resolved_sale_id::text || ':' || new.id::text")
expect(sql).toContain('on conflict (organization_id, idempotency_key) do nothing')
expect(sql).toContain('from public.sale_payments')
```

- [ ] **Step 2: Run the migration contract and confirm RED**

Run: `cmd /c npx vitest run src/lib/repairs/pos-payment-ledger-migration.test.ts`  
Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add ledger columns and recreate `capture_pos_repair_payment()`**

```sql
alter table public.repair_payments
  add column if not exists payment_breakdown jsonb not null default '[]'::jsonb,
  add column if not exists immediate_amount numeric(12,2) not null default 0 check (immediate_amount >= 0),
  add column if not exists financed_amount numeric(12,2) not null default 0 check (financed_amount >= 0);

-- In capture_pos_repair_payment(), aggregate sale_payments in payment_index order.
select coalesce(jsonb_agg(jsonb_build_object('method', payment_method, 'amount', amount) order by payment_index), '[]'::jsonb),
       coalesce(sum(amount) filter (where payment_method <> 'credit'), 0),
       coalesce(sum(amount) filter (where payment_method = 'credit'), 0)
into sale_breakdown, sale_immediate, sale_financed
from public.sale_payments
where organization_id = new.organization_id and sale_id = resolved_sale_id;
```

The function must cap the stored repair amounts at `payment_delta`; for a mixed sale allocate immediate first up to the repair delta, then financed, and store an adjusted two-part breakdown whose sum equals `payment_delta`.

- [ ] **Step 4: Add database invariants to the migration contract**

```ts
expect(sql).toContain('least(payment_delta, sale_immediate)')
expect(sql).toContain('payment_delta - resolved_immediate')
expect(sql).toContain('resolved_immediate + resolved_financed = payment_delta')
expect(sql).toContain("source, sale_id, created_by")
```

- [ ] **Step 5: Make route errors preserve stable repair codes**

```ts
['REPAIR_CUSTOMER_MISMATCH', 'La reparación seleccionada pertenece a otro cliente.', 409],
['REPAIR_QUALITY_CHECK_REQUIRED', 'La reparación necesita un control técnico aprobado antes de entregarse.', 409],
```

Add a preflight assertion that every selected repair has `customer_id === customerId` when it has an owner; return `REPAIR_CUSTOMER_MISMATCH` before the RPC for a forged request.

- [ ] **Step 6: Run focused contracts and commit**

Run: `cmd /c npx vitest run src/lib/repairs/pos-payment-ledger-migration.test.ts src/app/api/pos/process-sale/pos-sale-hardening-contract.test.ts src/app/api/pos/process-sale/store-credit-contract.test.ts`  
Expected: PASS.  
Commit `supabase/migrations/20260924230000_harden_pos_repair_payment_ledger.sql`, `src/lib/repairs/pos-payment-ledger-migration.test.ts`, `src/app/api/pos/process-sale/pos-sale-hardening-contract.test.ts`, and `src/app/api/pos/process-sale/route.ts` with message `fix: trace POS repair payments atomically`.

### Task 3: Make repair search server-side, paginated, and branch-scoped

**Files:**
- Modify: `src/app/api/repairs/route.ts`
- Modify: `src/app/api/repairs/route.test.ts`
- Create: `src/app/dashboard/pos/hooks/usePOSRepairSearch.ts`
- Create: `src/app/dashboard/pos/hooks/__tests__/usePOSRepairSearch.test.tsx`

**Interfaces:**
- Produces API: `GET /api/repairs?page=<n>&pageSize=20&search=<term>&chargeable=true` with `{ repairs, pagination }`.
- Produces hook: `usePOSRepairSearch({ open, branchId, search })` returning `{ repairs, pagination, status, error, retry, nextPage, previousPage }`.

- [ ] **Step 1: Add failing API tests for customer and phone search plus tenant/branch scope**

```ts
expect(query.eq).toHaveBeenCalledWith('organization_id', 'org-1')
expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
expect(orFilter).toContain('ticket_number.ilike.%ana%')
expect(orFilter).toContain('customer.name.ilike.%ana%')
expect(orFilter).toContain('customer.phone.ilike.%ana%')
```

- [ ] **Step 2: Run the API test and confirm RED**

Run: `cmd /c npx vitest run src/app/api/repairs/route.test.ts`  
Expected: FAIL because related-customer search and chargeable filtering are absent.

- [ ] **Step 3: Extend the existing GET without weakening `resolveRepairRouteContext`**

Parse and clamp `page` and `pageSize`; escape `%`, `_`, comma, and parentheses from the term before composing the PostgREST filter. Keep the existing organization/branch equality filters and add the customer relation fields already present in `REPAIR_SELECT_VARIANTS`. When `chargeable=true`, exclude delivered/cancelled rows but do not exclude non-ready rows.

- [ ] **Step 4: Add failing hook tests for branch headers, debounce, pagination, empty and error states**

```ts
expect(fetch).toHaveBeenCalledWith(
  expect.stringContaining('search=R-123'),
  expect.objectContaining({ headers: { 'x-branch-id': 'branch-1' } }),
)
expect(result.current.status).toBe('error')
act(() => result.current.retry())
expect(fetch).toHaveBeenCalledTimes(2)
```

- [ ] **Step 5: Implement the hook using `branchHeaders(branchId)` and `AbortController`**

```ts
export type RepairSearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'
export function usePOSRepairSearch(input: { open: boolean; branchId: string | null; search: string }): POSRepairSearchResult
```

Use a 250 ms debounce, reset to page 1 when search/branch changes, abort stale requests, and retain the prior successful list during retry.

- [ ] **Step 6: Run route/hook tests and commit**

Run: `cmd /c npx vitest run src/app/api/repairs/route.test.ts src/app/dashboard/pos/hooks/__tests__/usePOSRepairSearch.test.tsx`  
Expected: PASS.  
Commit: `git add src/app/api/repairs/route.ts src/app/api/repairs/route.test.ts src/app/dashboard/pos/hooks/usePOSRepairSearch.ts src/app/dashboard/pos/hooks/__tests__/usePOSRepairSearch.test.tsx && git commit -m "feat: add scoped POS repair search"`

### Task 4: Normalize repair selection, customer ownership, and explicit delivery intent

**Files:**
- Modify: `src/app/dashboard/pos/hooks/usePOSRepairs.ts`
- Create: `src/app/dashboard/pos/hooks/__tests__/usePOSRepairs.test.tsx`
- Modify: `src/app/dashboard/pos/components/POSRepairChargeModal.tsx`
- Create: `src/app/dashboard/pos/components/__tests__/POSRepairChargeModal.test.tsx`
- Modify: `src/app/dashboard/pos/page.tsx`

**Interfaces:**
- `PosCartRepair` includes `customer_id`, `customer_name`, `ticket_number`, `qualityCheck`, and charge/delivery eligibility.
- `addRepairToCart(repair)` returns `{ ok: true } | { ok: false; code: 'CUSTOMER_CONFLICT' | 'NO_BALANCE'; message: string }`.
- `markRepairDelivered` defaults to `false` and is forced false whenever delivery eligibility becomes false.

- [ ] **Step 1: Add hook tests for the hidden-true bug and normalized manual repairs**

```ts
expect(result.current.markRepairDelivered).toBe(false)
act(() => result.current.setMarkRepairDelivered(true))
rerender({ isCheckoutOpen: true, repairs: [{ status: 'reparacion' }] })
expect(result.current.markRepairDelivered).toBe(false)
expect(result.current.selectedRepairs[0].customer_id).toBe('customer-1')
```

- [ ] **Step 2: Run the hook test and confirm RED**

Run: `cmd /c npx vitest run src/app/dashboard/pos/hooks/__tests__/usePOSRepairs.test.tsx`  
Expected: FAIL because checkout opening currently auto-enables delivery.

- [ ] **Step 3: Replace render-time state synchronization with explicit effects/actions**

```ts
useEffect(() => {
  if (!isCheckoutOpen || !deliveryEligibility.canDeliver) setMarkRepairDelivered(false)
  if (!isCheckoutOpen) setDeliveryOutcome('repaired')
}, [isCheckoutOpen, deliveryEligibility.canDeliver])
```

Use one `repairsById` map for customer-loaded and search-selected rows. Remove `manualRepairs` as a second behavioral path or keep it only as an internal source feeding the same normalized map.

- [ ] **Step 4: Add modal interaction tests for zero balance, non-ready charge, branch request, retry and pagination**

```ts
expect(screen.getByText('Sin saldo pendiente')).toBeVisible()
expect(screen.getByRole('button', { name: /agregar reparación pagada/i })).toBeDisabled()
await user.click(screen.getByRole('button', { name: /cobrar saldo.*en reparación/i }))
expect(onAddRepairToCart).toHaveBeenCalledWith(expect.objectContaining({ price: 300 }))
```

- [ ] **Step 5: Rebuild modal rendering on `usePOSRepairSearch` and pure eligibility helpers**

Remove `createClient()` and the direct `.from('repairs')` fallback. Render separate loading skeleton, empty state, error/retry, results, and page controls. Keep non-ready repairs selectable for payment and describe `Se cobrará sin entregar`.

- [ ] **Step 6: Enforce repair customer ownership in page orchestration**

When the cart has no customer, select the repair owner before adding it. When a different customer is already selected, show a conflict dialog with `Cambiar cliente y vaciar carrito` and `Cancelar`; do not silently combine customers.

- [ ] **Step 7: Run focused tests and commit**

Run: `cmd /c npx vitest run src/app/dashboard/pos/hooks/__tests__/usePOSRepairs.test.tsx src/app/dashboard/pos/components/__tests__/POSRepairChargeModal.test.tsx src/app/dashboard/pos/lib/__tests__/repair-charge.test.ts`  
Expected: PASS.  
Commit the five named files with message `fix: make POS repair charging explicit`.

### Task 5: Centralize checkout eligibility and remove duplicate checkout actions

**Files:**
- Create: `src/app/dashboard/pos/lib/checkout-eligibility.ts`
- Create: `src/app/dashboard/pos/lib/__tests__/checkout-eligibility.test.ts`
- Modify: `src/app/dashboard/pos/page.tsx`
- Modify: `src/app/dashboard/pos/components/POSCart.tsx`
- Modify: `src/app/dashboard/pos/components/POSHeader.tsx`
- Modify: `src/app/dashboard/pos/components/POSShortcutsBar.tsx`

**Interfaces:**
- Produces `getCheckoutEligibility({ itemCount, hasOpenCashSession, isProcessing, customerRequired, customerSelected }): { canOpen: boolean; canConfirm: boolean; reason?: string }`.
- Every checkout trigger consumes the same object; no component recalculates eligibility.

- [ ] **Step 1: Add failing table-driven eligibility tests**

```ts
it.each([
  [{ itemCount: 0, hasOpenCashSession: true }, false, 'Agregá productos o una reparación'],
  [{ itemCount: 1, hasOpenCashSession: false }, false, 'Abrí la caja'],
  [{ itemCount: 1, hasOpenCashSession: true, customerRequired: true, customerSelected: false }, false, 'Seleccioná el cliente'],
])('returns one actionable reason', (input, canConfirm, reason) => {
  expect(getCheckoutEligibility(input)).toMatchObject({ canConfirm, reason })
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cmd /c npx vitest run src/app/dashboard/pos/lib/__tests__/checkout-eligibility.test.ts`  
Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the pure helper and replace `combinedCartItems.length > 0`**

Return the first reason in this order: processing, empty cart, closed cash register, missing required customer. Permit cart preparation while cash is closed, but set `canConfirm=false`.

- [ ] **Step 4: Remove duplicate desktop CTA behavior**

Keep the CTA inside `POSCart` for desktop, the bottom bar for mobile, and F4. Change the desktop header cart action to focus/expand `POSCart`; keep the editable sheet only below the mobile breakpoint. Pass the same `eligibility` object to all surfaces.

- [ ] **Step 5: Add component contract tests for identical disabled reason and semantic mobile trigger**

```ts
expect(screen.getAllByText('Abrí la caja para continuar').length).toBeGreaterThan(0)
expect(screen.getByRole('button', { name: /abrir carrito/i })).toHaveAttribute('aria-expanded')
```

- [ ] **Step 6: Run tests and commit**

Run: `cmd /c npx vitest run src/app/dashboard/pos/lib/__tests__/checkout-eligibility.test.ts src/app/dashboard/pos/components/__tests__/POSCheckoutActions.test.tsx`  
Expected: PASS.  
Commit the helper, test, page, and four components with message `refactor: unify POS checkout eligibility`.

### Task 6: Finish the checkout modal and receipt rules

**Files:**
- Modify: `src/app/dashboard/pos/components/CheckoutModal.tsx`
- Modify: `src/app/dashboard/pos/components/checkout/PaymentMethods.tsx`
- Modify: `src/app/dashboard/pos/components/checkout/SaleSummary.tsx`
- Modify: `src/app/dashboard/pos/components/checkout/SaleConfirmationDialog.tsx`
- Modify: `src/app/dashboard/pos/components/checkout/__tests__/CheckoutModal.confirmation-contract.test.ts`
- Modify: `src/app/dashboard/pos/components/checkout/__tests__/SaleSummary.mixed-credit.test.tsx`
- Modify: `src/app/dashboard/pos/components/checkout/__tests__/SaleConfirmationDialog.test.tsx`
- Modify: `src/lib/receipt-utils.ts`
- Modify: `src/lib/receipt-utils.summary.test.ts`
- Modify: `src/components/pos/ReceiptGenerator.tsx`
- Modify: `src/components/pos/__tests__/ReceiptGenerator.credit-date.test.tsx`
- Modify: `src/app/dashboard/pos/components/POSCart.tsx`

**Interfaces:**
- Produces `buildReceiptPaymentSummary(input): ReceiptPaymentSummary` with `cashPaid`, `nonCashPaid`, `change`, `financedPrincipal`, `financedTotal`, `installments`, and `firstDueDate`.
- Receipt rendering accepts `documentKind: 'internal' | 'fiscal'`, defaulting to `'internal'`; tax rows render only for `'fiscal'`.

- [ ] **Step 1: Update stale modal contract tests to assert the approved hierarchy**

```ts
expect(source).not.toContain('1. Cliente')
expect(source).not.toContain('2. Forma de cobro')
expect(source).not.toContain('3. Revisar y confirmar')
expect(source).toContain('Resumen de la venta')
```

- [ ] **Step 2: Add failing receipt-summary tests for credit, mixed, and cash change**

```ts
expect(buildReceiptPaymentSummary(creditSale).change).toBeNull()
expect(buildReceiptPaymentSummary(creditSale)).not.toHaveProperty('financedPercentage')
expect(buildReceiptPaymentSummary(mixedSale)).toMatchObject({ cashPaid: 100, financedPrincipal: 400 })
expect(buildReceiptPaymentSummary(cashSale).change).toBe(50)
```

- [ ] **Step 3: Run checkout/receipt tests and confirm RED**

Run: `cmd /c npx vitest run src/app/dashboard/pos/components/checkout/__tests__/CheckoutModal.confirmation-contract.test.ts src/lib/receipt-utils.summary.test.ts src/components/pos/__tests__/ReceiptGenerator.credit-date.test.tsx`  
Expected: at least the new summary/document-kind assertions fail.

- [ ] **Step 4: Implement one receipt view model and remove truthy numeric/boolean leakage**

Use explicit comparisons (`value > 0`, `Boolean(value)`) before rendering. Do not render expressions that can return `0`. Show change only when cash received exceeds the immediate cash requirement. Do not emit financed percentage.

- [ ] **Step 5: Make receipt content mode-specific and compact**

```tsx
{documentKind === 'fiscal' && taxAmount > 0 ? <TaxBreakdown amount={taxAmount} /> : null}
{summary.change !== null ? <ReceiptRow label="Vuelto" value={summary.change} /> : null}
```

Use 10–11 px product detail text, compact line height, wrapping item names, tabular amounts, and a contained financing block with `min-width:0`, `overflow-wrap:anywhere`, and no fixed width wider than the receipt.

- [ ] **Step 6: Remove the POS cart `Impuesto (10%)` row for internal mode**

Keep tax calculations in transaction data, but do not present them as a fiscal breakdown. Add a source/component test proving the row appears only when an explicit fiscal mode is passed.

- [ ] **Step 7: Make repair delivery action copy explicit**

When repairs are selected, show either `Cobrar sin entregar` or `Cobrar y entregar`. Render blocking tickets from `getRepairDeliveryEligibility` and reset the switch when eligibility changes.

- [ ] **Step 8: Run focused tests and commit**

Run: `cmd /c npx vitest run src/app/dashboard/pos/components/checkout/__tests__ src/lib/receipt-utils.summary.test.ts src/components/pos/__tests__/ReceiptGenerator.credit-date.test.tsx`  
Expected: PASS.  
Commit only the files listed in this task with message `fix: simplify POS checkout and receipts`.

### Task 7: Extract the POS workspace and improve responsive accessibility

**Files:**
- Create: `src/app/dashboard/pos/components/POSWorkspace.tsx`
- Create: `src/app/dashboard/pos/components/POSSearchToolbar.tsx`
- Create: `src/app/dashboard/pos/components/POSCustomerSummary.tsx`
- Create: `src/app/dashboard/pos/components/POSMobileCartSheet.tsx`
- Create: `src/app/dashboard/pos/components/POSMobileCheckoutBar.tsx`
- Create: `src/app/dashboard/pos/components/__tests__/POSWorkspace.test.tsx`
- Modify: `src/app/dashboard/pos/page.tsx`
- Modify: `src/app/dashboard/pos/components/ProductCard.tsx`
- Modify: `src/app/dashboard/pos/components/POSProductGrid.tsx`
- Modify: `src/app/dashboard/pos/components/ProductFilters.tsx`
- Modify: `src/app/dashboard/pos/loading.tsx`
- Modify: `src/app/dashboard/pos/pos.css`

**Interfaces:**
- `POSWorkspace` receives already-computed catalog/cart/customer/eligibility models and event callbacks; it does not fetch or calculate prices.
- `POSSearchToolbar` owns visible search/category/installment controls and emits advanced filter changes.
- Mobile surfaces consume the same cart and eligibility props as desktop.

- [ ] **Step 1: Add a failing workspace interaction test**

```tsx
render(<POSWorkspace {...fixture} />)
expect(screen.getByRole('region', { name: 'Catálogo' })).toBeVisible()
expect(screen.getByRole('complementary', { name: 'Carrito' })).toBeVisible()
expect(screen.getByRole('button', { name: 'Cobrar venta' })).toHaveAttribute('aria-disabled', 'true')
```

- [ ] **Step 2: Extract stateless layout components without moving domain state**

Move JSX in small commits: toolbar/customer summary first, catalog layout second, desktop cart third, mobile sheet/bar last. Keep hooks and callbacks in `page.tsx`; props must be typed and no component may import Supabase.

- [ ] **Step 3: Compact advanced filters and preserve active-filter visibility**

Keep search, category, and installment condition visible. Move remaining filters into a popover/drawer and render removable chips for active values. Clearing filters must not clear search or cart.

- [ ] **Step 4: Raise mobile readability and touch targets**

Set secondary text to at least `text-[11px]`, primary card data to at least `text-[13px]`, and interactive controls to `min-h-10 min-w-10` (44 px where layout permits). Reduce columns at narrow widths rather than shrinking text below these floors.

- [ ] **Step 5: Add semantic and live-region coverage**

Replace clickable `div` triggers with `Button`/native `button`; give clear-search an `aria-label`; remove disabled/out-of-stock products from the tab sequence; announce add/remove, validation error, and sale success through the existing accessible status mechanism or a new `role="status" aria-live="polite"` region.

- [ ] **Step 6: Add stable loading and retry presentation**

Use `loading.tsx` and catalog skeleton cards matching final dimensions. Retry only the product request and retain cart/filter/customer state. Add tests that retry does not invoke `clearCart` or reset filters.

- [ ] **Step 7: Run component tests, focused lint, and commit**

Run: `cmd /c npx vitest run src/app/dashboard/pos/components/__tests__/POSWorkspace.test.tsx src/app/dashboard/pos/hooks/__tests__/usePOSSearch.catalog-view.test.ts`  
Run: `cmd /c npx eslint src/app/dashboard/pos/page.tsx src/app/dashboard/pos/components/POSWorkspace.tsx src/app/dashboard/pos/components/POSSearchToolbar.tsx src/app/dashboard/pos/components/POSCustomerSummary.tsx src/app/dashboard/pos/components/POSMobileCartSheet.tsx src/app/dashboard/pos/components/POSMobileCheckoutBar.tsx src/app/dashboard/pos/components/ProductCard.tsx src/app/dashboard/pos/components/POSProductGrid.tsx src/app/dashboard/pos/components/ProductFilters.tsx`  
Expected: PASS with no lint errors in touched files.  
Commit the files listed in this task with message `refactor: split responsive POS workspace`.

### Task 8: End-to-end regression and honest release verification

**Files:**
- Create: `docs/superpowers/verification/2026-09-24-pos-repair-checkout.md`
- Modify only when a regression is reproduced: the specific implementation or test file already listed in Tasks 1–7 that owns the failing contract

**Interfaces:**
- Consumes all prior task outputs.
- Produces a verification record separating local, database-remote, and authenticated-browser evidence.

- [ ] **Step 1: Run the complete focused POS/repair suite**

Run:

```powershell
cmd /c npx vitest run src/app/dashboard/pos/lib/__tests__ src/app/dashboard/pos/hooks/__tests__ src/app/dashboard/pos/components/__tests__ src/app/api/pos/process-sale src/app/api/repairs/route.test.ts src/lib/repairs/pos-payment-ledger-migration.test.ts src/lib/receipt-utils.summary.test.ts src/components/pos/__tests__/ReceiptGenerator.credit-date.test.tsx
```

Expected: PASS. Record exact file/test counts.

- [ ] **Step 2: Run touched-file lint and TypeScript**

Run: `cmd /c npx eslint src/app/api/pos/process-sale/route.ts src/app/api/repairs/route.ts src/app/dashboard/pos/page.tsx src/app/dashboard/pos/lib/repair-charge.ts src/app/dashboard/pos/lib/checkout-eligibility.ts src/app/dashboard/pos/hooks/usePOSRepairSearch.ts src/app/dashboard/pos/hooks/usePOSRepairs.ts src/app/dashboard/pos/components/POSRepairChargeModal.tsx src/app/dashboard/pos/components/POSCart.tsx src/app/dashboard/pos/components/POSHeader.tsx src/app/dashboard/pos/components/POSShortcutsBar.tsx src/app/dashboard/pos/components/CheckoutModal.tsx src/app/dashboard/pos/components/checkout/PaymentMethods.tsx src/app/dashboard/pos/components/checkout/SaleSummary.tsx src/app/dashboard/pos/components/checkout/SaleConfirmationDialog.tsx src/app/dashboard/pos/components/POSWorkspace.tsx src/app/dashboard/pos/components/POSSearchToolbar.tsx src/app/dashboard/pos/components/POSCustomerSummary.tsx src/app/dashboard/pos/components/POSMobileCartSheet.tsx src/app/dashboard/pos/components/POSMobileCheckoutBar.tsx src/app/dashboard/pos/components/ProductCard.tsx src/app/dashboard/pos/components/POSProductGrid.tsx src/app/dashboard/pos/components/ProductFilters.tsx src/lib/receipt-utils.ts src/components/pos/ReceiptGenerator.tsx`  
Run: `cmd /c npm run typecheck`  
Expected: PASS, or document pre-existing failures separately with exact files and prove no new failures in touched files.

- [ ] **Step 3: Run migration verification**

Run: `cmd /c npx supabase migration list`  
Run: `cmd /c npx supabase db push --dry-run`  
Expected: the linked project is explicit and only `20260924230000_harden_pos_repair_payment_ledger.sql` is pending from this change. Apply with `cmd /c npx supabase db push` only when deployment to that linked project is authorized, then query the new columns and trigger/function definition and execute one idempotent POS sale fixture. If CLI, binding, credentials, or deployment approval are unavailable, mark remote database verification as blocked rather than passed.

- [ ] **Step 4: Exercise the authenticated browser matrix**

Verify desktop and mobile for: normal cash with/without change; full credit; mixed; non-ready repair charged without delivery; ready+approved repair charged and delivered; paid repair disabled; customer conflict; closed register; API retry; receipt width. Capture screenshots and console/network failures.

- [ ] **Step 5: Run repository hygiene checks**

Run: `git diff --check`  
Run: `git status --short`  
Expected: no whitespace errors; list unrelated dirty files without modifying or staging them.

- [ ] **Step 6: Write the verification record**

Use headings `Focused tests`, `Lint`, `TypeScript`, `Remote migration`, `Authenticated browser`, `Known pre-existing issues`, and `Unrelated working-tree changes`, with exact commands and outcomes.

- [ ] **Step 7: Commit verification evidence**

Commit: `git add docs/superpowers/verification/2026-09-24-pos-repair-checkout.md && git commit -m "docs: verify POS repair checkout"`

## Self-review result

- Spec coverage: financial atomicity, repair search/selection, customer ownership, delivery gating, checkout hierarchy, receipt rules, duplicate CTA removal, mobile/accessibility, page decomposition, and verification are each owned by a task.
- Placeholder scan: implementation steps specify concrete contracts, tests, files, commands, and expected outcomes without deferred names.
- Type consistency: `getRepairChargeability`, `getRepairDeliveryEligibility`, `usePOSRepairSearch`, `getCheckoutEligibility`, and `buildReceiptPaymentSummary` are defined once and consumed by later tasks with the same names.
- Review focus: all five failure modes have explicit tests or browser scenarios in Tasks 2–8.
