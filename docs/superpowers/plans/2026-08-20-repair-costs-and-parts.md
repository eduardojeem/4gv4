# Repair Costs and Parts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tenant-safe, auditable repair-cost editor that separates fixed labor, inventory-backed parts and commercial adjustments, displays included VAT, and persists the server-calculated total atomically.

**Architecture:** A pure TypeScript calculator supplies instant UI previews and mirrors the database rules. A new service-role RPC locks the repair and relevant inventory, validates organization settings and administrator exceptions, replaces parts, creates an immutable financial revision, and returns the canonical summary; the repair route is a thin tenant-scoped adapter. The detail modal renders that summary and opens a responsive two-step editor with inventory search and confirmation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase/PostgreSQL, Zod, Tailwind CSS, Radix UI, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-20-repair-costs-and-parts-design.md`

## Global Constraints

- Fixed labor amount only; do not add hours or hourly-rate fields.
- Entered prices already include VAT; expose the tax breakdown without adding VAT again.
- Initial maximum discount is 20%, configurable per organization.
- A below-cost part or above-limit discount requires an administrator and a reason of at least 5 characters.
- `unit_price` remains the customer charge and `unit_cost` remains the internal inventory cost.
- Inventory changes when repair parts are saved, not when the device is delivered.
- `status = entregado` remains independent from `payment_status`.
- The server and database recalculate all financial totals; never trust totals from the browser.
- Preserve tenant and branch scoping and unrelated worktree changes.

---

## File Structure

- `src/lib/repairs/cost-breakdown.ts`: pure money, included-VAT and validation model shared by UI and route tests.
- `src/lib/repairs/cost-breakdown.test.ts`: unit coverage for calculations and rule violations.
- `supabase/migrations/20260821013000_repair_cost_revisions.sql`: settings, product/part tax snapshots, immutable revisions, RLS and atomic RPC.
- `src/lib/repairs/cost-revision-migration.test.ts`: executable SQL contract checks.
- `src/lib/repairs/save-cost-revision.ts`: typed RPC adapter and stable error mapping.
- `src/lib/repairs/save-cost-revision.test.ts`: adapter payload/error tests.
- `src/app/api/repairs/[id]/costs/route.ts`: tenant-aware GET history and POST confirmation endpoint.
- `src/app/api/repairs/[id]/costs/route.test.ts`: authentication, scope and HTTP contract tests.
- `src/app/api/repairs/inventory/search/route.ts`: branch-scoped inventory suggestions with price, cost, stock and VAT.
- `src/app/api/repairs/inventory/search/route.test.ts`: cost visibility and tenant isolation tests.
- `src/types/repairs.ts`: financial summary, revision and enriched part types.
- `src/utils/repair-mapping.ts`: maps canonical cost snapshots returned with repairs.
- `src/components/dashboard/repairs/RepairCostsEditorDialog.tsx`: responsive editor and preview step.
- `src/components/dashboard/repairs/RepairPartsEditor.tsx`: desktop table/mobile cards and inventory search.
- `src/components/dashboard/repairs/RepairCostSummary.tsx`: reusable prominent financial summary and history.
- `src/components/dashboard/repairs/RepairDetailDialog.tsx`: replaces the existing finance-tab markup and old quick-price entry point.
- Corresponding component tests under `src/components/dashboard/repairs/__tests__/`.

---

### Task 1: Canonical cost and included-VAT calculator

**Files:**
- Create: `src/lib/repairs/cost-breakdown.ts`
- Create: `src/lib/repairs/cost-breakdown.test.ts`
- Modify: `src/lib/repairs/pricing.ts`
- Modify: `src/lib/repairs/pricing.test.ts`

**Interfaces:**
- Produces: `calculateRepairCost(input: RepairCostInput): RepairCostSummary`.
- Produces: `validateRepairCost(input, policy): RepairCostViolation[]`.
- Keeps `calculateRepairPricing` as a compatibility wrapper until all callers migrate.

- [ ] **Step 1: Write failing calculation tests**

```ts
it('keeps VAT inside labor and mixed-rate parts', () => {
  const result = calculateRepairCost({
    currency: 'PYG', laborAmount: 110_000, laborTaxRate: 10,
    parts: [
      { key: 'a', quantity: 2, unitPrice: 55_000, unitCost: 40_000, discountAmount: 10_000, taxRate: 10 },
      { key: 'b', quantity: 1, unitPrice: 105_000, unitCost: 80_000, discountAmount: 0, taxRate: 5 },
    ],
    additionalCharges: 5_000, deductions: 0, discountAmount: 20_000, paidAmount: 100_000,
  })
  expect(result.partsSubtotal).toBe(205_000)
  expect(result.finalTotal).toBe(300_000)
  expect(result.balance).toBe(200_000)
  expect(result.taxBreakdown.map(row => row.rate)).toEqual([5, 10])
})
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `npm test -- src/lib/repairs/cost-breakdown.test.ts`

Expected: FAIL because `cost-breakdown.ts` does not exist.

- [ ] **Step 3: Implement exact domain types and formulas**

```ts
export type RepairCostPartInput = {
  key: string; quantity: number; unitPrice: number; unitCost: number
  discountAmount: number; taxRate: 0 | 5 | 10
}
export type RepairCostInput = {
  currency: string; laborAmount: number; laborTaxRate: 0 | 5 | 10
  parts: RepairCostPartInput[]; additionalCharges: number; deductions: number
  discountAmount: number; paidAmount: number
}
export type RepairCostPolicy = {
  maxDiscountPercent: number; isAdmin: boolean; overrideReason?: string | null
}
export type RepairCostViolationCode =
  | 'NEGATIVE_AMOUNT' | 'PART_DISCOUNT_EXCEEDS_GROSS' | 'DISCOUNT_EXCEEDS_SUBTOTAL'
  | 'DISCOUNT_LIMIT_EXCEEDED' | 'PART_BELOW_COST' | 'OVERRIDE_REASON_REQUIRED'
  | 'FINAL_BELOW_PAID_AMOUNT'
```

Use currency fraction digits for every subtotal. Allocate the general discount
proportionally across labor, parts and charges before deriving included VAT, so
the sum of tax buckets reconciles to the final total.

- [ ] **Step 4: Add boundary and permission tests**

Cover zero values, 20% exactly, 20.01%, below-cost parts, administrator override,
missing reason, negative totals, excessive per-part discounts and final below
paid amount. Assert violation codes rather than translated messages.

- [ ] **Step 5: Run calculator and legacy pricing tests**

Run: `npm test -- src/lib/repairs/cost-breakdown.test.ts src/lib/repairs/pricing.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the domain slice**

```bash
git add src/lib/repairs/cost-breakdown.ts src/lib/repairs/cost-breakdown.test.ts src/lib/repairs/pricing.ts src/lib/repairs/pricing.test.ts
git commit -m "feat: add canonical repair cost breakdown"
```

### Task 2: Database snapshots, immutable history and atomic write

**Files:**
- Create: `supabase/migrations/20260821013000_repair_cost_revisions.sql`
- Create: `src/lib/repairs/cost-revision-migration.test.ts`

**Interfaces:**
- Consumes: Task 1 field semantics and violation codes.
- Produces: `public.save_repair_cost_revision(...) returns jsonb` callable only by `service_role`.
- Produces: `repair_cost_revisions` and `repair_cost_revision_parts` immutable records.

- [ ] **Step 1: Write failing migration contract tests**

```ts
expect(sql).toContain('create table if not exists public.repair_cost_revisions')
expect(sql).toContain('create table if not exists public.repair_cost_revision_parts')
expect(sql).toMatch(/from public\.repairs[\s\S]+for update/)
expect(sql).toContain("raise exception 'REPAIR_DISCOUNT_LIMIT_EXCEEDED'")
expect(sql).toContain("raise exception 'REPAIR_PART_BELOW_COST'")
expect(sql).toContain('revoke all on function public.save_repair_cost_revision')
expect(sql).toContain('grant execute on function public.save_repair_cost_revision')
```

- [ ] **Step 2: Run the migration test and confirm it fails**

Run: `npm test -- src/lib/repairs/cost-revision-migration.test.ts`

Expected: FAIL because the migration is absent.

- [ ] **Step 3: Add configuration and snapshot columns**

The migration adds:

```sql
alter table public.organization_settings
  add column if not exists repair_max_discount_percent numeric(5,2) not null default 20,
  add column if not exists repair_labor_tax_rate numeric(5,2) not null default 10;
alter table public.products add column if not exists tax_rate numeric(5,2);
alter table public.repair_parts
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists tax_rate numeric(5,2) not null default 10;
alter table public.repairs
  add column if not exists additional_charges numeric(14,2) not null default 0,
  add column if not exists deductions numeric(14,2) not null default 0,
  add column if not exists current_cost_revision_id uuid;
```

Add checks for nonnegative monetary fields and rates limited to `0, 5, 10`.
Backfill product and part tax from the organization default without changing
existing totals.

- [ ] **Step 4: Create immutable revision tables and RLS**

Store organization, branch, repair, actor, reason, labor, adjustments,
subtotals, total, paid snapshot, balance, tax breakdown JSON, policy snapshot,
authorization metadata and idempotency key. Store each part's product ID,
description, quantity, internal cost, charged price, discount, tax rate and
subtotal. Allow tenant-scoped SELECT; revoke direct INSERT/UPDATE/DELETE from
authenticated users; add a trigger that rejects UPDATE and DELETE.

- [ ] **Step 5: Implement the locked RPC**

The RPC accepts intent fields, not calculated totals:

```sql
public.save_repair_cost_revision(
  p_repair_id uuid, p_organization_id uuid, p_branch_id uuid, p_actor_id uuid,
  p_labor_amount numeric, p_parts jsonb, p_additional_charges numeric,
  p_deductions numeric, p_discount_amount numeric, p_override_reason text,
  p_idempotency_key text
) returns jsonb
```

It locks the repair, settings, referenced products and branch inventory; derives
the actor role from organization membership; rejects terminal repairs; resolves
current product cost/tax; validates stock, discount and below-cost exceptions;
replaces parts and inventory movements exactly once; calculates included VAT;
inserts revision/header parts; updates canonical repair totals and current
revision; and returns revision plus summary. Replays with the same organization
and idempotency key return the original result only when the intent hash matches.

- [ ] **Step 6: Run migration contract and existing inventory tests**

Run: `npm test -- src/lib/repairs/cost-revision-migration.test.ts src/lib/repairs/replace-parts.test.ts src/test/integration/repairs-inventory.integration.test.tsx`

Expected: PASS. If no local Supabase is available, explicitly record that SQL
execution remains unverified; static string tests are not deployment proof.

- [ ] **Step 7: Commit the persistence slice**

```bash
git add supabase/migrations/20260821013000_repair_cost_revisions.sql src/lib/repairs/cost-revision-migration.test.ts
git commit -m "feat: add atomic repair cost revisions"
```

### Task 3: RPC adapter and tenant-aware cost API

**Files:**
- Create: `src/lib/repairs/save-cost-revision.ts`
- Create: `src/lib/repairs/save-cost-revision.test.ts`
- Create: `src/app/api/repairs/[id]/costs/route.ts`
- Create: `src/app/api/repairs/[id]/costs/route.test.ts`
- Modify: `src/app/api/repairs/[id]/route.ts`

**Interfaces:**
- Consumes: `save_repair_cost_revision` from Task 2.
- Produces: `saveRepairCostRevision(client, scope, intent)` and `RepairCostRpcError`.
- Produces: `GET/POST /api/repairs/[id]/costs`.

- [ ] **Step 1: Write failing adapter tests**

```ts
expect(rpc).toHaveBeenCalledWith('save_repair_cost_revision', {
  p_repair_id: 'repair-1', p_organization_id: 'org-1', p_branch_id: 'branch-1',
  p_actor_id: 'user-1', p_labor_amount: 110000, p_parts: parts,
  p_additional_charges: 0, p_deductions: 0, p_discount_amount: 20000,
  p_override_reason: null, p_idempotency_key: 'cost-edit-1',
})
```

Test mappings for `REPAIR_DISCOUNT_LIMIT_EXCEEDED`, `REPAIR_PART_BELOW_COST`,
`REPAIR_OVERRIDE_REASON_REQUIRED`, `REPAIR_STOCK_CHANGED` and
`REPAIR_COST_CONFLICT`, including HTTP 403/409/422.

- [ ] **Step 2: Run adapter tests and confirm failure**

Run: `npm test -- src/lib/repairs/save-cost-revision.test.ts`

Expected: FAIL because the adapter is absent.

- [ ] **Step 3: Implement the typed adapter**

Define `RepairCostSaveIntent`, call only the new RPC, parse database codes into
Spanish actionable messages, and return `{ revision, summary, parts }` without
performing a second write.

- [ ] **Step 4: Write route tests before the route**

Cover unauthenticated access, missing permission, wrong organization/branch,
valid save, stable error bodies (`{ error, code, details? }`), and GET history
ordered newest first. Assert that `finalTotal` supplied by a malicious client is
ignored rather than forwarded.

- [ ] **Step 5: Implement GET and POST**

Use `resolveRepairRouteContext(request, 'repairs.orders.update')`. POST parses a
strict Zod intent, generates/accepts an idempotency key, calls the adapter and
then `fetchRepairById`; return `{ success: true, repair, revision, summary }`.
GET verifies the repair in scope and returns tenant-scoped revisions with parts.

- [ ] **Step 6: Remove the split price/parts write path**

Change `PATCH /api/repairs/[id]` to reject cost fields or `parts` with code
`USE_REPAIR_COSTS_ENDPOINT`, while continuing to handle notes, images and other
repair metadata. This prevents the old non-atomic path from bypassing history.

- [ ] **Step 7: Run focused backend tests**

Run: `npm test -- src/lib/repairs/save-cost-revision.test.ts src/app/api/repairs/[id]/costs/route.test.ts src/app/api/repairs/[id]/route.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the API slice**

```bash
git add src/lib/repairs/save-cost-revision.ts src/lib/repairs/save-cost-revision.test.ts src/app/api/repairs/[id]/costs src/app/api/repairs/[id]/route.ts src/app/api/repairs/[id]/route.test.ts
git commit -m "feat: expose audited repair cost API"
```

### Task 4: Inventory-backed part search

**Files:**
- Create: `src/app/api/repairs/inventory/search/route.ts`
- Create: `src/app/api/repairs/inventory/search/route.test.ts`

**Interfaces:**
- Produces: `GET /api/repairs/inventory/search?q=<text>&limit=20`.
- Returns: `{ items: Array<{ productId; sku; name; availableStock; unitCost; unitPrice; taxRate; version }> }`.

- [ ] **Step 1: Write failing endpoint tests**

Test minimum two-character query, active-branch stock, organization isolation,
maximum 20 results, inactive-product exclusion and purchase-cost visibility.
Because this editor needs margin validation, cost is returned only to users who
hold the repair update permission; no public or customer route may expose it.

- [ ] **Step 2: Run the endpoint tests and confirm failure**

Run: `npm test -- src/app/api/repairs/inventory/search/route.test.ts`

Expected: FAIL because the route is absent.

- [ ] **Step 3: Implement branch-scoped search**

Resolve the tenant with `resolveRepairRouteContext`, search normalized name/SKU,
join or query the active branch inventory, and compute `version` from the product
and inventory update timestamps. Use `product.tax_rate ?? organization default`.

- [ ] **Step 4: Run search tests and lint the route**

Run: `npm test -- src/app/api/repairs/inventory/search/route.test.ts`

Run: `npx eslint src/app/api/repairs/inventory/search/route.ts src/app/api/repairs/inventory/search/route.test.ts`

Expected: both PASS.

- [ ] **Step 5: Commit the search slice**

```bash
git add src/app/api/repairs/inventory/search
git commit -m "feat: add repair inventory part search"
```

### Task 5: Repair types and canonical mapping

**Files:**
- Modify: `src/types/repairs.ts`
- Modify: `src/utils/repair-mapping.ts`
- Modify: `src/utils/repair-mapping.test.ts`
- Modify: `src/app/api/repairs/_lib.ts`

**Interfaces:**
- Consumes: Task 1 `RepairCostSummary` semantics and Task 2 snapshots.
- Produces: `Repair.costSummary`, enriched `RepairPart` and `RepairCostRevision`.

- [ ] **Step 1: Write a failing mapping test**

```ts
expect(mapped.costSummary).toMatchObject({
  laborAmount: 110000, partsSubtotal: 205000, finalTotal: 300000,
  paidAmount: 100000, balance: 200000,
})
expect(mapped.parts[0]).toMatchObject({ discountAmount: 10000, taxRate: 10 })
```

- [ ] **Step 2: Run the mapping test and confirm failure**

Run: `npm test -- src/utils/repair-mapping.test.ts`

Expected: FAIL because the fields are not mapped.

- [ ] **Step 3: Add types and fetch/mapping fields**

Extend `RepairPart` with `discountAmount` and `taxRate`. Add
`RepairTaxBreakdown`, `RepairCostSummary` and `RepairCostRevision`. Update the
central repair SELECT to include additional charges, deductions, current
revision summary and part snapshots without exposing cross-tenant history.

- [ ] **Step 4: Run mapping and repair route tests**

Run: `npm test -- src/utils/repair-mapping.test.ts src/lib/repairs/mapping.test.ts src/app/api/repairs/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the mapping slice**

```bash
git add src/types/repairs.ts src/utils/repair-mapping.ts src/utils/repair-mapping.test.ts src/app/api/repairs/_lib.ts
git commit -m "feat: map repair cost summaries"
```

### Task 6: Responsive editor, preview and history UI

**Files:**
- Create: `src/components/dashboard/repairs/RepairPartsEditor.tsx`
- Create: `src/components/dashboard/repairs/RepairCostSummary.tsx`
- Create: `src/components/dashboard/repairs/RepairCostsEditorDialog.tsx`
- Create: `src/components/dashboard/repairs/__tests__/RepairPartsEditor.test.tsx`
- Create: `src/components/dashboard/repairs/__tests__/RepairCostSummary.test.tsx`
- Create: `src/components/dashboard/repairs/__tests__/RepairCostsEditorDialog.test.tsx`
- Modify: `src/components/dashboard/repairs/RepairDetailDialog.tsx`
- Modify: `src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`
- Delete after migration: `src/components/dashboard/repairs/RepairQuickPriceDialog.tsx`
- Delete after migration: `src/components/dashboard/repairs/__tests__/RepairQuickPriceDialog.test.tsx`

**Interfaces:**
- Consumes: inventory search from Task 4 and POST/GET cost API from Task 3.
- Produces: `RepairCostsEditorDialog({ repair, open, onOpenChange, onSaved })`.
- Produces: `RepairCostSummary({ summary, revisions, onEdit })`.

- [ ] **Step 1: Write failing interaction tests**

Test inventory selection prefill, quantity/price/discount edits, immediate
subtotals, add/edit/delete, below-cost warning, 20% limit, administrator reason,
preview transition, canonical server response, failed-save draft retention and
concurrency refresh. Use role/label queries rather than CSS selectors.

```ts
await user.click(screen.getByRole('button', { name: 'Agregar repuesto' }))
await user.type(screen.getByRole('combobox', { name: 'Buscar en inventario' }), 'pantalla')
await user.click(await screen.findByRole('option', { name: /Pantalla OLED/ }))
expect(screen.getByLabelText('Precio cobrado')).toHaveValue('550000')
expect(screen.getByText('Subtotal de repuestos')).toHaveTextContent('550.000')
```

- [ ] **Step 2: Run component tests and confirm missing-component failures**

Run: `npm test -- src/components/dashboard/repairs/__tests__/RepairPartsEditor.test.tsx src/components/dashboard/repairs/__tests__/RepairCostSummary.test.tsx src/components/dashboard/repairs/__tests__/RepairCostsEditorDialog.test.tsx`

Expected: FAIL because the components are absent.

- [ ] **Step 3: Implement `RepairPartsEditor`**

Desktop uses a semantic table; mobile uses cards under `md`. Debounce search,
cancel stale requests, prefill inventory data, display stock/cost/tax, and keep
stable client keys. Mark invalid rows with inline `role="alert"`; do not rely on
toast-only errors.

- [ ] **Step 4: Implement summary and history**

Render labor, parts, adjustments, bases and IVA buckets, final total, paid and
balance. Put the final total in a contrasting card with `aria-live="polite"`.
Render a collapsed history timeline containing timestamp, actor, reason and
before/after totals, with details loaded from the GET endpoint.

- [ ] **Step 5: Implement the two-step editor**

Step one edits components; step two displays the exact consolidated preview and
inventory impact. POST only the intent and an idempotency key. On 409, retain the
draft and show server differences with `Actualizar valores`; on success call
`onSaved(repair)` with the canonical returned repair.

- [ ] **Step 6: Replace the finance tab**

Replace lines around the current `Costos y Piezas` block in
`RepairDetailDialog.tsx` with `RepairCostSummary`. Preserve existing payment
calls to action and messages for undefined price, paid, partial and pending
repairs. Remove `RepairQuickPriceDialog` only when no imports remain.

- [ ] **Step 7: Add responsive and accessibility assertions**

Assert dialog title/description, labeled inputs, table headers, mobile cards,
keyboard-operable actions, alert association, focus on the first invalid field
and visible total/payment status text independent of color.

- [ ] **Step 8: Run the focused UI suite**

Run: `npm test -- src/components/dashboard/repairs/__tests__/RepairPartsEditor.test.tsx src/components/dashboard/repairs/__tests__/RepairCostSummary.test.tsx src/components/dashboard/repairs/__tests__/RepairCostsEditorDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit the UI slice**

```bash
git add src/components/dashboard/repairs src/types/repairs.ts
git commit -m "feat: redesign repair costs and parts editor"
```

### Task 7: Configuration UI and end-to-end verification

**Files:**
- Modify: `src/hooks/use-shared-settings.ts`
- Modify: `src/lib/validations/system-settings.ts`
- Modify: `src/app/api/settings/shared/route.ts`
- Modify: `src/app/api/admin/system/settings/route.ts`
- Modify: `src/app/admin/settings/page.tsx`
- Create: `src/lib/validations/system-settings.test.ts`
- Modify: relevant existing settings tests

**Interfaces:**
- Consumes: database settings from Task 2.
- Produces: `SharedSettings.repairMaxDiscountPercent` and `repairLaborTaxRate`.

- [ ] **Step 1: Write failing settings contract tests**

Assert default `20`, accepted range `0..100`, allowed labor rates `0|5|10`,
tenant-scoped read/write, and rejection for non-admin settings writes.

- [ ] **Step 2: Run the settings tests and confirm failure**

Run: `npm test -- src/test/admin-settings-contract.test.ts src/lib/validations/system-settings.test.ts`

Expected: FAIL on the new fields.

- [ ] **Step 3: Extend settings mapping, validation and UI**

Add `repairMaxDiscountPercent` and `repairLaborTaxRate` to the shared DTO, DB
mapper, validation allow-list and administrator form. Label the discount field
`Descuento máximo de reparaciones (%)` and the tax selector `IVA de mano de obra
(incluido)` with options Exento, 5% and 10%.

- [ ] **Step 4: Run all focused repair checks**

Run: `npm test -- src/lib/repairs/cost-breakdown.test.ts src/lib/repairs/cost-revision-migration.test.ts src/lib/repairs/save-cost-revision.test.ts src/app/api/repairs/[id]/costs/route.test.ts src/app/api/repairs/inventory/search/route.test.ts src/utils/repair-mapping.test.ts src/components/dashboard/repairs/__tests__/RepairCostsEditorDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx src/test/admin-settings-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Run static verification**

Run: `npx eslint` followed by the exact touched `.ts/.tsx` paths.

Run: `npm run typecheck`

Run: `git diff --check`

Expected: all PASS, or document pre-existing unrelated failures with their exact
file and command output.

- [ ] **Step 6: Verify migration and browser flow**

If Supabase CLI/local services are available, apply the migration locally and
exercise: normal edit, above-limit admin authorization, below-cost block,
concurrent stock change and history reload. Start the app and test desktop plus
mobile viewport in a signed-in repair detail modal. Record explicitly when an
authenticated browser or remote migration target is unavailable.

- [ ] **Step 7: Commit configuration and verification fixes**

```bash
git add src/hooks/use-shared-settings.ts src/lib/validations/system-settings.ts src/lib/validations/system-settings.test.ts src/app/api/settings/shared/route.ts src/app/api/admin/system/settings/route.ts src/app/admin/settings/page.tsx src/test/admin-settings-contract.test.ts
git commit -m "feat: configure repair pricing controls"
```

## Completion Gate

- Every cost change is represented by exactly one immutable revision.
- The current repair total equals the latest revision total.
- Inventory and financial revision commit or roll back together.
- The UI and API show the same total and included-VAT breakdown.
- Above-limit and below-cost exceptions require administrator plus reason.
- Delivered and payment states remain independent.
- No migration is reported as deployed without executing it against the target.
