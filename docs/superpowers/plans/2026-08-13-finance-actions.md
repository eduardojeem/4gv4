# Finance Action Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the finance overview actionable, filters faster, and payroll workflow explicit.

**Architecture:** Extend existing presentational FinanceSummary, FinanceFilters, PayrollPanel, and FinancesSystem components. No finance API, schema, calculation, or permission contract changes.

**Tech Stack:** Next.js, React, TypeScript, date-fns, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Preserve financial values, existing fetch requests, and confirmation dialogs.
- Use text in addition to status color.
- Do not change backend APIs or Supabase data.

---

### Task 1: Actionable summary and quick periods

**Files:**
- Modify: `src/components/admin/finances/FinanceSummary.tsx`
- Modify: `src/components/admin/finances/FinanceFilters.tsx`
- Modify: `src/components/admin/finances/FinancesSystem.tsx`
- Test: `src/components/admin/finances/FinancesSystem.test.tsx`

- [ ] Write failing tests for action labels and date shortcut callbacks.
- [ ] Implement action panel and bounded date shortcuts.
- [ ] Run affected component tests.

### Task 2: Payroll progress hierarchy

**Files:**
- Modify: `src/components/admin/finances/PayrollPanel.tsx`
- Test: `src/components/admin/finances/FinanceOperations.test.tsx`

- [ ] Write failing test for draft review and approved payment stage text.
- [ ] Implement status badges and visible process steps.
- [ ] Run affected component tests.

### Task 3: Verification

- [ ] Run finance component tests, focused lint, typecheck, and diff check.
