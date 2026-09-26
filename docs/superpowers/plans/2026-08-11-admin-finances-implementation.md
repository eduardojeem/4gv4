# Admin Finances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tenant- and branch-safe `/admin/finances` module for expenses, recurring obligations, organization-wide payroll, commissions, net profit, and cash flow, then make `/admin/reports` consume its canonical financial results.

**Architecture:** PostgreSQL owns financial invariants, idempotency, auditability, and atomic cash posting. Protected Next.js API routes expose typed contracts; focused React feature modules consume those contracts. A pure calculation layer builds accrued P&L and cash-flow views from canonical sales, repairs, obligations, payroll, and payments without computing accounting totals in UI components.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase/PostgreSQL/RLS, Zod 4, SWR 2, Recharts 3, Vitest 4, Testing Library, Tailwind CSS.

## Global Constraints

- Every financial row is scoped by `organization_id`; operational rows also carry `branch_id` or an explicit organization-wide allocation.
- Store monetary amounts as `numeric(14,2)` and round only at payment or presentation boundaries.
- Separate accrued results from actual cash flow in API types, UI labels, exports, and tests.
- Never delete paid records; void them with a reason and a compensating entry.
- A cash-backed payment and its `cash_movements` row must commit atomically or both fail.
- Recurring generation is idempotent by organization, template, and accounting period.
- Approved payroll is immutable; corrections are append-only adjustments.
- General commission rules are overridden by employee-specific rules with effective-date history.
- Do not infer missing costs as zero: return coverage warnings and label results incomplete.
- Preserve unrelated work and existing `/admin/reports` operational analytics.

---

## File Structure

- `supabase/migrations/20260811190000_create_finance_foundation.sql`: schema, RLS, constraints, indexes, permissions, recurring generation, and atomic payment RPC.
- `supabase/migrations/20260811193000_create_payroll_commissions.sql`: compensation history, commission rules, earned commissions, payroll runs/entries/adjustments, migration bridge from technician payroll, and atomic approval/payment RPCs.
- `src/lib/finance/types.ts`: shared API/domain contracts.
- `src/lib/finance/schemas.ts`: Zod request validation.
- `src/lib/finance/calculations.ts`: pure accrued P&L, cash-flow, commission precedence, and coverage functions.
- `src/lib/finance/server.ts`: tenant-scoped database queries and command adapters.
- `src/app/api/admin/finances/*/route.ts`: protected HTTP resources for summary, obligations, payments, payroll, rules, and exports.
- `src/hooks/use-admin-finances.ts`: SWR data orchestration and mutations.
- `src/components/admin/finances/*`: focused UI for filters, summary, expenses, payroll, profitability, configuration, dialogs, alerts, and states.
- `src/app/admin/finances/page.tsx`: route composition and subscription gate.
- `src/config/admin-navigation.ts`: Finanzas navigation item.
- `src/hooks/use-admin-analytics.ts`: replace estimated profit with canonical finance summary.
- `src/components/admin/reports/analytics-dashboard.tsx`: label and coverage presentation changes only.

---

### Task 1: Financial domain contracts and calculation engine

**Files:**
- Create: `src/lib/finance/types.ts`
- Create: `src/lib/finance/schemas.ts`
- Create: `src/lib/finance/calculations.ts`
- Test: `src/lib/finance/calculations.test.ts`
- Test: `src/lib/finance/schemas.test.ts`

**Interfaces:**
- Produces: `FinanceFilters`, `FinanceSummary`, `FinancialSourceLine`, `CoverageWarning`, `resolveCommissionRule()`, `calculateFinancialSummary()`, `expenseInputSchema`, and `paymentInputSchema`.
- Consumes: no feature code; only Zod and standard TypeScript.

- [ ] **Step 1: Write failing calculation tests**

```ts
it('separates accrued net profit from paid cash flow', () => {
  const result = calculateFinancialSummary({
    revenue: [{ amount: 1_000_000, cashAmount: 800_000, hasCost: true }],
    directCosts: [{ amount: 400_000, paidAmount: 400_000 }],
    expenses: [{ amount: 200_000, paidAmount: 0 }],
    payroll: [{ amount: 150_000, paidAmount: 50_000 }],
  })
  expect(result.accrued.netProfit).toBe(250_000)
  expect(result.cash.netCashFlow).toBe(350_000)
  expect(result.complete).toBe(true)
})

it('marks the result incomplete when a sold item has no cost', () => {
  const result = calculateFinancialSummary({
    revenue: [{ amount: 100_000, cashAmount: 100_000, hasCost: false }],
    directCosts: [], expenses: [], payroll: [],
  })
  expect(result.complete).toBe(false)
  expect(result.coverageWarnings[0].code).toBe('MISSING_DIRECT_COST')
})
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx vitest run src/lib/finance/calculations.test.ts src/lib/finance/schemas.test.ts`
Expected: FAIL because the finance modules do not exist.

- [ ] **Step 3: Implement exact contracts and formulas**

```ts
export type FinancePaymentMethod = 'cash' | 'bank_transfer' | 'other'
export interface FinanceSummary {
  accrued: { revenue: number; directCosts: number; grossProfit: number; operatingExpenses: number; payrollCost: number; netProfit: number }
  cash: { collected: number; paid: number; netCashFlow: number }
  complete: boolean
  coverageWarnings: CoverageWarning[]
}
export function resolveCommissionRule(rules: CommissionRule[], input: CommissionContext): CommissionRule | null
export function calculateFinancialSummary(input: FinancialSummaryInput): FinanceSummary
```

Define `expenseInputSchema` with positive amount, UUID branch/category, `accountingDate`, optional due date/vendor/notes, and recurrence data; define `paymentInputSchema` with positive amount, payment method, branch, payment date, and required cash session for `cash`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx vitest run src/lib/finance/calculations.test.ts src/lib/finance/schemas.test.ts`
Expected: PASS for formulas, incomplete coverage, rule precedence, and validation.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance
git commit -m "feat(finance): define financial contracts and calculations"
```

### Task 2: Expense, recurrence, audit, and atomic payment database foundation

**Files:**
- Create: `supabase/migrations/20260811190000_create_finance_foundation.sql`
- Test: `src/test/admin-finance-schema.test.ts`

**Interfaces:**
- Consumes: status and payment-method literals from Task 1.
- Produces: `finance_categories`, `finance_expense_templates`, `finance_obligations`, `finance_payments`, `finance_audit_events`, `generate_recurring_finance_obligations(date, uuid)`, and `pay_finance_obligation_atomic(...)`.

- [ ] **Step 1: Write the failing migration contract test**

```ts
expect(sql).toContain('create table if not exists public.finance_obligations')
expect(sql).toContain('unique (organization_id, template_id, recurrence_period)')
expect(sql).toContain('function public.generate_recurring_finance_obligations')
expect(sql).toContain('function public.pay_finance_obligation_atomic')
expect(sql).toContain('insert into public.cash_movements')
expect(sql).toContain("has_org_permission(p_organization_id, 'finances.pay')")
expect(sql).toContain('organization_id = public.current_organization_id()')
```

- [ ] **Step 2: Run the schema test and confirm RED**

Run: `npx vitest run src/test/admin-finance-schema.test.ts`
Expected: FAIL because the migration is absent.

- [ ] **Step 3: Implement schema and invariants**

Create organization/branch foreign keys, non-negative checks, status constraints, unique recurrence keys, private receipt path metadata, RLS policies, indexes by organization/branch/due date/status, and append-only audit triggers. Seed the approved expense categories per organization through an idempotent helper.

Implement `generate_recurring_finance_obligations(p_generation_date date, p_organization_id uuid default null)` using `insert ... on conflict do nothing`. Implement `pay_finance_obligation_atomic` with row locking, permission and branch validation, overpayment rejection, cash-session validation, payment insert, optional cash movement insert, and obligation status update in one transaction.

- [ ] **Step 4: Run schema tests and SQL formatting checks**

Run: `npx vitest run src/test/admin-finance-schema.test.ts src/test/dashboard-financial-workflows.test.ts`
Expected: PASS without weakening existing cash workflow contracts.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260811190000_create_finance_foundation.sql src/test/admin-finance-schema.test.ts
git commit -m "feat(finance): add tenant-safe expense ledger"
```

### Task 3: Protected expenses and payments API

**Files:**
- Create: `src/lib/finance/server.ts`
- Create: `src/app/api/admin/finances/obligations/route.ts`
- Create: `src/app/api/admin/finances/obligations/[id]/route.ts`
- Create: `src/app/api/admin/finances/obligations/[id]/payments/route.ts`
- Create: `src/app/api/admin/finances/categories/route.ts`
- Create: `src/app/api/admin/finances/recurrences/generate/route.ts`
- Test: `src/test/admin-finance-api-contract.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas/types and Task 2 RPCs.
- Produces: `listObligations()`, `createObligation()`, `updateUnpaidObligation()`, `voidObligation()`, `payObligation()`, and JSON endpoints under `/api/admin/finances`.

- [ ] **Step 1: Write failing API contract tests**

```ts
expect(obligationsRoute).toContain('withAdminAuth')
expect(obligationsRoute).toContain('expenseInputSchema.safeParse')
expect(server).toContain(".eq('organization_id', organizationId)")
expect(paymentRoute).toContain("'pay_finance_obligation_atomic'")
expect(paymentRoute).not.toContain(".from('cash_movements').insert")
```

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run src/test/admin-finance-api-contract.test.ts`
Expected: FAIL because routes and server adapter do not exist.

- [ ] **Step 3: Implement tenant-safe routes**

Require an organization context for regular admins, resolve explicit organization for super-admin support mode, validate every body/query with Task 1 schemas, scope every select/update by organization, and delegate cash payment only to the atomic RPC. Return `409` for stale/duplicate payment, `422` for invalid state, and `403` for missing branch access.

- [ ] **Step 4: Run API and auth regression tests**

Run: `npx vitest run src/test/admin-finance-api-contract.test.ts src/test/admin-role-scope.test.ts src/test/branch-access-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/server.ts src/app/api/admin/finances src/test/admin-finance-api-contract.test.ts
git commit -m "feat(finance): expose expense and payment APIs"
```

### Task 4: Organization-wide payroll and commission database

**Files:**
- Create: `supabase/migrations/20260811193000_create_payroll_commissions.sql`
- Test: `src/test/admin-payroll-schema.test.ts`

**Interfaces:**
- Consumes: Task 2 payment/audit conventions and existing `technician_compensation`/`technician_payments` data.
- Produces: `employee_compensation`, `commission_rules`, `earned_commissions`, `payroll_runs`, `payroll_entries`, `payroll_adjustments`, `calculate_earned_commissions(...)`, `generate_payroll_run_atomic(...)`, `approve_payroll_run_atomic(...)`, and `pay_payroll_entry_atomic(...)`.

- [ ] **Step 1: Write failing payroll migration tests**

```ts
expect(sql).toContain('create table if not exists public.employee_compensation')
expect(sql).toContain("scope_type in ('role', 'employee')")
expect(sql).toContain('function public.generate_payroll_run_atomic')
expect(sql).toContain('function public.pay_payroll_entry_atomic')
expect(sql).toContain('from public.technician_compensation')
expect(sql).toContain('legacy_source_id')
```

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run src/test/admin-payroll-schema.test.ts`
Expected: FAIL because the payroll migration is absent.

- [ ] **Step 3: Implement payroll, precedence, and legacy bridge**

Use effective date ranges for salary and rules. Enforce one approved employee-specific rule over role rules for the same operation and date. Materialize commissions with a unique origin key so retries cannot duplicate earnings. Import technician compensation/payments with `legacy_source_id` uniqueness and exclude imported rows from double counting. Lock approved runs and require append-only adjustments. Reuse the atomic cash-posting pattern for payroll payments.

- [ ] **Step 4: Run payroll and technician regression tests**

Run: `npx vitest run src/test/admin-payroll-schema.test.ts && npx tsc --noEmit --skipLibCheck`
Expected: PASS, including type compatibility with the existing `src/lib/technician/earnings-server.ts` adapter.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260811193000_create_payroll_commissions.sql src/test/admin-payroll-schema.test.ts
git commit -m "feat(finance): add organization payroll and commissions"
```

### Task 5: Payroll, compensation, and commission APIs

**Files:**
- Create: `src/app/api/admin/finances/employees/route.ts`
- Create: `src/app/api/admin/finances/compensation/route.ts`
- Create: `src/app/api/admin/finances/commission-rules/route.ts`
- Create: `src/app/api/admin/finances/payroll/route.ts`
- Create: `src/app/api/admin/finances/payroll/[id]/approve/route.ts`
- Create: `src/app/api/admin/finances/payroll/[id]/payments/route.ts`
- Modify: `src/lib/finance/server.ts`
- Modify: `src/lib/finance/schemas.ts`
- Test: `src/test/admin-payroll-api-contract.test.ts`

**Interfaces:**
- Consumes: Task 4 RPCs and Task 1 validation conventions.
- Produces: employee compensation CRUD, rule CRUD, payroll preview/generation/approval, adjustments, and partial payment endpoints.

- [ ] **Step 1: Write failing route-contract tests**

Assert every mutation uses `withAdminAuth`, organization scoping, Zod validation, server-side employee membership validation, and an atomic RPC for approval/payment. Assert approved payroll update routes reject direct amount replacement.

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run src/test/admin-payroll-api-contract.test.ts`
Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement payroll endpoints**

Return deterministic previews with salary, earned commissions, bonuses, discounts, advances, gross pay, and net pay. Require an idempotency key when generating a run. Map domain conflicts to `409`, invalid transitions to `422`, and unauthorized branch access to `403`.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npx vitest run src/test/admin-payroll-api-contract.test.ts src/lib/finance/calculations.test.ts && npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/finances src/lib/finance src/test/admin-payroll-api-contract.test.ts
git commit -m "feat(finance): expose payroll and commission APIs"
```

### Task 6: Canonical financial summary, profitability, and exports

**Files:**
- Create: `src/app/api/admin/finances/summary/route.ts`
- Create: `src/app/api/admin/finances/profitability/route.ts`
- Create: `src/app/api/admin/finances/export/route.ts`
- Modify: `src/lib/finance/server.ts`
- Test: `src/test/admin-finance-summary.test.ts`

**Interfaces:**
- Consumes: Task 1 calculations plus canonical sales, sale items, products, repairs, parts, obligations, payroll, and payment records.
- Produces: `getFinanceSummary(filters): Promise<FinanceSummary>`, profitability rows by sale/repair/product/employee/branch, and CSV exports that share the same filter contract.

- [ ] **Step 1: Write failing aggregation tests**

Cover completed sales only, cancelled repairs exclusion, sold-unit purchase costs, used repair parts, accrued unpaid rent, approved payroll, partial payments, branch filtering, previous-period comparison, and missing-cost coverage warnings.

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run src/test/admin-finance-summary.test.ts`
Expected: FAIL because summary services do not exist.

- [ ] **Step 3: Implement bounded server aggregation**

Fetch only the selected and comparison periods, chunk large ID filters with `chunkQueryValues`, compute with Task 1 pure functions, and return `generatedAt`, `filters`, `accrued`, `cash`, `comparison`, `coverageWarnings`, `upcomingDue`, and `overdue`. Exports must call the same service instead of duplicating formulas.

- [ ] **Step 4: Run summary and existing analytics tests**

Run: `npx vitest run src/test/admin-finance-summary.test.ts src/test/query-batches.test.ts src/lib/repairs/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/server.ts src/app/api/admin/finances/summary src/app/api/admin/finances/profitability src/app/api/admin/finances/export src/test/admin-finance-summary.test.ts
git commit -m "feat(finance): add canonical profit and cash reporting"
```

### Task 7: Finance data hook and executive UI shell

**Files:**
- Create: `src/hooks/use-admin-finances.ts`
- Create: `src/app/admin/finances/page.tsx`
- Create: `src/components/admin/finances/FinancesSystem.tsx`
- Create: `src/components/admin/finances/FinanceFilters.tsx`
- Create: `src/components/admin/finances/FinanceSummary.tsx`
- Create: `src/components/admin/finances/FinanceStates.tsx`
- Test: `src/components/admin/finances/FinancesSystem.test.tsx`

**Interfaces:**
- Consumes: Task 6 summary API and existing branch/date UI components.
- Produces: global filter state, SWR cache keys, refresh/mutation helpers, executive metrics, accrued/cash switch, due alerts, and coverage warnings.

- [ ] **Step 1: Write failing component tests**

```tsx
expect(screen.getByRole('heading', { name: 'Finanzas' })).toBeInTheDocument()
expect(screen.getByRole('tab', { name: 'Resumen' })).toBeInTheDocument()
expect(screen.getByText('Ganancia neta devengada')).toBeInTheDocument()
expect(screen.getByText('Flujo de caja')).toBeInTheDocument()
expect(screen.getByRole('alert')).toHaveTextContent('Faltan costos')
```

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run src/components/admin/finances/FinancesSystem.test.tsx`
Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement accessible responsive shell**

Render tabs `Resumen`, `Gastos`, `Nómina`, `Rentabilidad`, `Configuración`; use global date/branch filters; show separate accrued and cash cards; provide non-color status text; expose retry and empty states; preserve keyboard navigation and mobile card fallbacks.

- [ ] **Step 4: Run component and accessibility tests**

Run: `npx vitest run src/components/admin/finances/FinancesSystem.test.tsx src/test/accessibility/accessibility.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-admin-finances.ts src/app/admin/finances src/components/admin/finances
git commit -m "feat(finance): build executive finances dashboard"
```

### Task 8: Expenses, payroll, profitability, and configuration screens

**Files:**
- Create: `src/components/admin/finances/ExpensesPanel.tsx`
- Create: `src/components/admin/finances/ExpenseDialog.tsx`
- Create: `src/components/admin/finances/PaymentDialog.tsx`
- Create: `src/components/admin/finances/PayrollPanel.tsx`
- Create: `src/components/admin/finances/PayrollRunDialog.tsx`
- Create: `src/components/admin/finances/ProfitabilityPanel.tsx`
- Create: `src/components/admin/finances/FinanceSettingsPanel.tsx`
- Modify: `src/components/admin/finances/FinancesSystem.tsx`
- Test: `src/components/admin/finances/FinanceOperations.test.tsx`

**Interfaces:**
- Consumes: Tasks 3, 5, 6, and 7 hooks/contracts.
- Produces: end-to-end admin workflows for expense creation/recurrence/payment, payroll preview/approval/partial payment, commission configuration, profitability exploration, and exports.

- [ ] **Step 1: Write failing interaction tests**

Test recurrence controls, required cash session when method is Cash, bank payment without cash session, payroll preview totals, approval confirmation, immutable approved amount fields, employee exception priority copy, mobile detail dialogs, and export filter propagation.

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run src/components/admin/finances/FinanceOperations.test.tsx`
Expected: FAIL because operational panels do not exist.

- [ ] **Step 3: Implement focused panels and dialogs**

Keep each panel below a single responsibility, use labeled inputs and associated errors, disable duplicate submission, refresh only affected SWR keys, show server conflict messages, and require explicit confirmation for approval/void actions.

- [ ] **Step 4: Run UI tests, lint, and typecheck**

Run: `npx vitest run src/components/admin/finances/FinanceOperations.test.tsx src/components/admin/finances/FinancesSystem.test.tsx && npx eslint src/components/admin/finances src/hooks/use-admin-finances.ts src/app/admin/finances/page.tsx && npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/finances src/hooks/use-admin-finances.ts
git commit -m "feat(finance): add expense payroll and profitability workflows"
```

### Task 9: Navigation, reports integration, automation, and final verification

**Files:**
- Modify: `src/config/admin-navigation.ts`
- Modify: `src/hooks/use-admin-analytics.ts`
- Modify: `src/components/admin/reports/analytics-dashboard.tsx`
- Create: `src/test/admin-finance-navigation.test.ts`
- Create: `src/test/admin-reports-finance-integration.test.ts`
- Modify: `supabase/migrations/20260811190000_create_finance_foundation.sql` to install an idempotent daily `pg_cron` schedule for recurrence generation.

**Interfaces:**
- Consumes: Task 6 finance summary API and Task 2 recurrence generator.
- Produces: visible Finanzas navigation, canonical financial cards in reports, scheduled recurrence/alert generation, and verified browser behavior.

- [ ] **Step 1: Write failing integration tests**

Assert the navigation contains `/admin/finances`; reports no longer calculate `visibleExpenses` from withdrawals; reports call the canonical finance summary; incomplete coverage is visible; the schedule invokes only the idempotent recurrence generator.

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run src/test/admin-finance-navigation.test.ts src/test/admin-reports-finance-integration.test.ts`
Expected: FAIL before integration.

- [ ] **Step 3: Integrate navigation, reports, and schedule**

Add a `WalletCards` Finanzas item under Administración with `finances.read`. Replace the report hook's estimated expense/profit formula with the finance summary contract while retaining inventory, customers, repairs, and rankings. Configure the generator once per day and keep on-demand catch-up idempotent.

- [ ] **Step 4: Run the complete focused verification set**

Run: `npx vitest run src/lib/finance src/test/admin-finance-schema.test.ts src/test/admin-payroll-schema.test.ts src/test/admin-finance-api-contract.test.ts src/test/admin-payroll-api-contract.test.ts src/test/admin-finance-summary.test.ts src/test/admin-finance-navigation.test.ts src/test/admin-reports-finance-integration.test.ts src/components/admin/finances`
Expected: PASS.

Run: `npx eslint src/lib/finance src/app/api/admin/finances src/hooks/use-admin-finances.ts src/components/admin/finances src/app/admin/finances/page.tsx src/config/admin-navigation.ts src/hooks/use-admin-analytics.ts src/components/admin/reports/analytics-dashboard.tsx`
Expected: PASS.

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS or a documented pre-existing failure with all finance paths clean in filtered output.

- [ ] **Step 5: Verify in a real browser**

Start the app and test `/admin/finances` at 320, 768, 1024, and 1440 px. Create a one-time expense and a recurring rent, generate a payroll preview, test Cash and Bank payment paths, inspect accrued versus cash totals, switch branches, export a period, then open `/admin/reports`. Confirm no critical console errors, failed finance requests, horizontal overflow, inaccessible controls, tenant leakage, duplicated obligations, or duplicated cash movements.

- [ ] **Step 6: Run final repository hygiene and commit**

Run: `git diff --check`
Expected: no whitespace errors.

```bash
git add src/config/admin-navigation.ts src/hooks/use-admin-analytics.ts src/components/admin/reports/analytics-dashboard.tsx src/test/admin-finance-navigation.test.ts src/test/admin-reports-finance-integration.test.ts supabase/migrations/20260811190000_create_finance_foundation.sql
git commit -m "feat(finance): integrate financial management across admin"
```
