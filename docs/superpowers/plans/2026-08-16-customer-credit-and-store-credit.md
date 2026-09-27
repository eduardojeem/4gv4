# Customer Credit And Store Credit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make store-credit redemption part of the atomic POS sale and make customer credit balances auditable from the customer detail.

**Architecture:** Add a versioned PostgreSQL wrapper around the existing atomic sale RPC. Pass store credit through the existing POS request, then render the immutable ledger in a focused customer component.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Supabase PostgreSQL.

## Global Constraints

- Purchase financing and store credit remain separate.
- Store credit is payment tender, not a discount.
- Preserve unrelated dirty work.
- No remote-deployment claim without applying and querying the migration.

---

### Task 1: Atomic POS store-credit contract

**Files:**
- Create: `supabase/migrations/20260816153000_atomic_pos_store_credit.sql`
- Create: `src/app/api/pos/process-sale/store-credit-contract.test.ts`
- Modify: `src/app/api/pos/process-sale/route.ts`
- Modify: `src/app/dashboard/pos/page.tsx`

**Interfaces:**
- Consumes: `process_pos_sale_atomic_v3(...)`.
- Produces: `process_pos_sale_atomic_v4(..., p_store_credit_amount numeric) returns jsonb`.

- [ ] Write SQL/API contract tests for customer matching, row locking, idempotency, grants, and request validation.
- [ ] Run the focused test and confirm it fails because v4 and the new parameter are absent.
- [ ] Add the migration and pass the amount through the API and both POS checkout paths.
- [ ] Run the focused test and confirm it passes.

### Task 2: Customer store-credit history

**Files:**
- Modify: `src/app/api/customers/[id]/store-credit/route.ts`
- Modify: `src/components/dashboard/customers/StoreCreditCard.tsx`
- Create: `src/components/dashboard/customers/StoreCreditCard.test.tsx`

**Interfaces:**
- Consumes: `GET /api/customers/:id/store-credit?page=&pageSize=`.
- Produces: `{ balance, movements, pagination }` with server-calculated full balance.

- [ ] Write component/API tests for full balance, history, retry, origin and signed amounts.
- [ ] Run the focused tests and confirm the missing states fail.
- [ ] Implement server pagination with an independent full-ledger balance and accessible history UI.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Verification

- [ ] Run focused Vitest files.
- [ ] Run ESLint for touched TypeScript files.
- [ ] Run TypeScript checking and `git diff --check`.
- [ ] Report migration deployment separately from local verification.
