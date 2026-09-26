# Public Order Store Credit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated storefront customers reserve store credit on an order, consume it when the order is confirmed, release it when cancelled or expired, and see the resulting covered and outstanding amounts everywhere the order appears.

**Architecture:** Extend the immutable customer store-credit ledger with an order-reservation table and versioned PostgreSQL functions for create, confirm, cancel, and expiry transitions. Server routes resolve customer identity from the authenticated profile, while public and dashboard components consume normalized financial fields without calculating authoritative balances in the browser.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest, Supabase PostgreSQL and RLS.

## Global Constraints

- Store credit is a payment tender, never a discount.
- Guest checkout remains available but cannot use or inspect store credit.
- The browser never supplies the authoritative customer identity.
- Reservation, stock mutation, promotion use, and order creation commit or roll back together.
- Confirmation consumes once; cancellation and expiry release once.
- Existing orders default to zero reserved and zero applied.
- Preserve unrelated dirty work in the shared working tree.
- Do not claim remote completion until the migration is applied and queried.

---

### Task 1: Reservation schema and state transitions

**Files:**
- Create: `supabase/migrations/20260816190000_public_order_store_credit_reservations.sql`
- Create: `src/lib/orders/public-store-credit-contract.test.ts`

**Interfaces:**
- Consumes: `customer_store_credits`, `customer_orders`, `create_public_order_with_customer_account_atomic`, and `cancel_customer_order_atomic`.
- Produces: `customer_store_credit_reservations`, `create_public_order_with_store_credit_atomic(...)`, `confirm_customer_order_store_credit_atomic(...)`, and a cancellation implementation that releases active reservations.

- [ ] **Step 1: Write a failing SQL contract test**

Assert that the migration defines the three reservation states, a unique organization/order constraint, customer-row `for update`, available balance as ledger minus active reservations, a ledger debit with `source_type = 'order'`, and revoke/grant statements.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx vitest run src/lib/orders/public-store-credit-contract.test.ts`

Expected: FAIL because the migration and RPC names do not exist.

- [ ] **Step 3: Implement the migration**

Create an append-safe reservation table with `amount numeric(14,2) check (amount > 0)`, status timestamps, RLS, and indexes. Add versioned transactional functions that validate organization/profile/customer ownership, serialize on the customer row, calculate available balance, reserve during order creation, consume on `CONFIRMED`, and release on `CANCELLED` or expiry.

- [ ] **Step 4: Run the contract test and verify GREEN**

Run: `npx vitest run src/lib/orders/public-store-credit-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the database contract**

```bash
git add supabase/migrations/20260816190000_public_order_store_credit_reservations.sql src/lib/orders/public-store-credit-contract.test.ts
git commit -m "feat: reserve store credit for public orders"
```

### Task 2: Authenticated public balance and order creation API

**Files:**
- Create: `src/app/api/public/store-credit/route.ts`
- Create: `src/app/api/public/store-credit/route.test.ts`
- Modify: `src/app/api/public/orders/route.ts`
- Modify: `src/app/api/public/orders/public-order-store-credit.test.ts`

**Interfaces:**
- Consumes: authenticated Supabase user and the storefront organization resolver.
- Produces: `GET /api/public/store-credit` returning `{ ledgerBalance, reservedBalance, availableBalance, movements, reservations }`; `POST /api/public/orders` accepts optional `storeCreditAmount` but resolves the customer from `profile_id` server-side.

- [ ] **Step 1: Write failing route tests**

Cover unauthenticated `401`, organization scoping, ignored browser customer ids, positive finite amount validation, and mappings for `STORE_CREDIT_EXCEEDS_AVAILABLE` and `STORE_CREDIT_PROFILE_REQUIRED`.

- [ ] **Step 2: Run route tests and verify RED**

Run: `npx vitest run src/app/api/public/store-credit/route.test.ts src/app/api/public/orders/public-order-store-credit.test.ts`

Expected: FAIL because the route and request field do not exist.

- [ ] **Step 3: Implement server routes**

Resolve `auth.getUser()`, storefront organization, and customer by `profile_id`. Return only the current tenant’s ledger/reservations. Route order creation through `create_public_order_with_store_credit_atomic` and return normalized `store_credit_reserved`, `store_credit_applied`, and `amount_due`.

- [ ] **Step 4: Run route tests and verify GREEN**

Run: `npx vitest run src/app/api/public/store-credit/route.test.ts src/app/api/public/orders/public-order-store-credit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the public API slice**

```bash
git add src/app/api/public/store-credit src/app/api/public/orders/route.ts src/app/api/public/orders/public-order-store-credit.test.ts
git commit -m "feat: expose authenticated storefront store credit"
```

### Task 3: Public profile and checkout experience

**Files:**
- Create: `src/components/public/customer/PublicStoreCreditCard.tsx`
- Create: `src/components/public/customer/PublicStoreCreditCard.test.tsx`
- Create: `src/components/public/cart/PublicStoreCreditPayment.tsx`
- Create: `src/components/public/cart/PublicStoreCreditPayment.test.tsx`
- Modify: `src/components/public/cart/CartPageClient.tsx`
- Modify: `src/app/(public)/perfil/profile-client.tsx`

**Interfaces:**
- Consumes: `GET /api/public/store-credit` and checkout total.
- Produces: controlled `storeCreditAmount: number` passed into the order request and a profile card showing ledger, reserved, available, movements, and retry states.

- [ ] **Step 1: Write failing component tests**

Cover guest invisibility, suggested `min(available,total)`, partial amount editing, full coverage, remaining amount, request failure preserving the cart, profile reserved/available labels, loading, empty, error, and retry.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npx vitest run src/components/public/customer/PublicStoreCreditCard.test.tsx src/components/public/cart/PublicStoreCreditPayment.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement focused components and integrate them**

Use existing card, button, input, checkbox and currency utilities. Keep the control keyboard-accessible, explain that store credit is a payment method, include `storeCreditAmount` in the existing order body, and clear the reservation UI only after a successful response.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npx vitest run src/components/public/customer/PublicStoreCreditCard.test.tsx src/components/public/cart/PublicStoreCreditPayment.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the storefront UI slice**

```bash
git add src/components/public/customer src/components/public/cart/PublicStoreCreditPayment.tsx src/components/public/cart/PublicStoreCreditPayment.test.tsx src/components/public/cart/CartPageClient.tsx src/components/profile
git commit -m "feat: apply store credit in public checkout"
```

### Task 4: Order confirmation, cancellation and financial presentation

**Files:**
- Modify: `src/app/api/orders/[id]/status/route.ts`
- Modify: `src/app/api/orders/[id]/payment/route.ts`
- Modify: `src/lib/orders/helpers.ts`
- Modify: `src/lib/orders/types.ts`
- Modify: `src/components/dashboard/orders/OrdersDashboard.tsx`
- Modify: `src/components/public/orders/TrackOrderClient.tsx`
- Modify: `src/components/profile/profile-orders.tsx`
- Create: `src/lib/orders/order-store-credit-display.test.ts`

**Interfaces:**
- Consumes: order fields `store_credit_reserved`, `store_credit_applied`, and derived `amount_due`.
- Produces: normalized order financial summary and administrative payment validation against the real remaining amount.

- [ ] **Step 1: Write failing transition and display tests**

Assert that `CONFIRMED` uses the consume RPC, `CANCELLED` uses the release-aware RPC, payment registration rejects amounts above `amount_due`, and all three order views contain distinct labels for covered, partial, reserved, applied, and remaining amounts.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/lib/orders/order-store-credit-display.test.ts`

Expected: FAIL because transitions and normalized fields are absent.

- [ ] **Step 3: Implement transitions and displays**

Route confirmation and cancellation through database functions, compute the payment button amount from the server-provided remainder, and render concise financial breakdowns in dashboard, tracking, and profile cards.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run src/lib/orders/order-store-credit-display.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the order-management slice**

```bash
git add src/app/api/orders src/lib/orders src/components/dashboard/orders/OrdersDashboard.tsx src/components/public/orders/TrackOrderClient.tsx src/components/profile/profile-orders.tsx
git commit -m "feat: show store credit coverage on orders"
```

### Task 5: Integrated verification

**Files:**
- Verify: `supabase/migrations/20260816190000_public_order_store_credit_reservations.sql`
- Verify: `src/app/api/public/store-credit/route.ts`
- Verify: `src/app/api/public/orders/route.ts`
- Verify: `src/components/public/cart/CartPageClient.tsx`
- Verify: `src/app/(public)/perfil/profile-client.tsx`
- Verify: `src/components/dashboard/orders/OrdersDashboard.tsx`

**Interfaces:**
- Consumes: all prior task contracts.
- Produces: verified local implementation with remote deployment status stated separately.

- [ ] **Step 1: Run all focused tests**

Run: `npx vitest run src/lib/orders/public-store-credit-contract.test.ts src/app/api/public/store-credit/route.test.ts src/app/api/public/orders/public-order-store-credit.test.ts src/components/public/customer/PublicStoreCreditCard.test.tsx src/components/public/cart/PublicStoreCreditPayment.test.tsx src/lib/orders/order-store-credit-display.test.ts`

- [ ] **Step 2: Run relevant existing order tests**

Run: `npx vitest run src/lib/orders src/components/dashboard/orders src/components/public/orders src/components/profile`

- [ ] **Step 3: Run static checks**

Run: `npm run typecheck`, focused ESLint over changed TypeScript files, and `git diff --check` limited to changed paths.

- [ ] **Step 4: Verify migration availability**

Run: `supabase --version`. If available, inspect migration status and test the functions against the configured development project. If unavailable, report that local code is complete but database deployment remains pending.

- [ ] **Step 5: Review scope and hand off**

Confirm guest checkout compatibility, tenant isolation, unchanged discount/tax totals, and that unrelated dirty files were not staged.
