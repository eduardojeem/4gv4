# Finance Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Finance expense and profitability tables for desktop and mobile without changing their data contracts.

**Architecture:** Keep fetching and mutations in the existing panels. Add presentational responsive markup in each panel, using semantic labels and existing Button/formatCurrency primitives.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Do not alter API calls, financial calculations, filters, export behavior, payment behavior, or void behavior.
- Use semantic tokens and text labels in addition to color.
- Preserve keyboard-accessible buttons and existing responsive behavior.

---

### Task 1: Expense table hierarchy

**Files:**
- Modify: `src/components/admin/finances/ExpensesPanel.tsx`
- Test: `src/components/admin/finances/FinanceOperations.test.tsx`

**Interfaces:**
- Consumes: existing `Obligation` fields.
- Produces: desktop and mobile views with the same payment and void callbacks.

- [ ] **Step 1: Write the failing component test**

```tsx
expect(screen.getByText('Pendiente')).toBeInTheDocument()
expect(screen.getByText('Importe')).toBeInTheDocument()
expect(screen.getByText('Pendiente de pago')).toBeInTheDocument()
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/components/admin/finances/FinanceOperations.test.tsx`

- [ ] **Step 3: Implement the presentational table and mobile card layout**

```tsx
<span className="rounded-full border px-2 py-1 text-xs font-medium">Pendiente</span>
<dl className="grid grid-cols-2 gap-3">...</dl>
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/components/admin/finances/FinanceOperations.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/finances/ExpensesPanel.tsx src/components/admin/finances/FinanceOperations.test.tsx
git commit -m "feat(finance): improve expense table hierarchy"
```

### Task 2: Profitability table hierarchy

**Files:**
- Modify: `src/components/admin/finances/ProfitabilityPanel.tsx`
- Test: `src/components/admin/finances/FinanceOperations.test.tsx`

**Interfaces:**
- Consumes: existing `Row` fields.
- Produces: desktop and mobile views showing complete/incomplete coverage with text.

- [ ] **Step 1: Write the failing component test**

```tsx
expect(screen.getByText('Ingresos')).toBeInTheDocument()
expect(screen.getByText('Utilidad bruta')).toBeInTheDocument()
expect(screen.getByText('Cobertura incompleta')).toBeInTheDocument()
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/components/admin/finances/FinanceOperations.test.tsx`

- [ ] **Step 3: Implement the presentational table and mobile card layout**

```tsx
<span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">Cobertura incompleta</span>
<dl className="grid grid-cols-3 gap-3">...</dl>
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/components/admin/finances/FinanceOperations.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/finances/ProfitabilityPanel.tsx src/components/admin/finances/FinanceOperations.test.tsx
git commit -m "feat(finance): improve profitability table hierarchy"
```

### Task 3: Final verification

**Files:**
- Verify: `src/components/admin/finances/ExpensesPanel.tsx`
- Verify: `src/components/admin/finances/ProfitabilityPanel.tsx`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/components/admin/finances/FinanceOperations.test.tsx`

- [ ] **Step 2: Run static checks**

Run: `npm run lint -- --file src/components/admin/finances/ExpensesPanel.tsx --file src/components/admin/finances/ProfitabilityPanel.tsx && npm run typecheck && git diff --check`

- [ ] **Step 3: Commit verified documentation**

```bash
git add docs/superpowers/specs/2026-08-13-finance-tables-design.md docs/superpowers/plans/2026-08-13-finance-tables.md
git commit -m "docs(finance): record finance table design"
```
