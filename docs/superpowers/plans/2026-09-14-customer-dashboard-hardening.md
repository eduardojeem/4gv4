# Customer Dashboard Hardening Implementation Plan

> **For Codex:** Execute this plan inline in thin, tested slices. Do not modify unrelated dirty work.

**Goal:** Correct customer identity/status drift, close tenant authorization gaps, and reduce duplicate work and mobile friction in `/dashboard/customers`.

**Architecture:** Introduce a small pure customer-contract module shared by API and UI. Normalize database aliases only at boundaries. Keep existing API shapes additive. Protect subresources with the existing tenant guard and organization filters. Reuse the dashboard's already-computed metrics instead of refetching them in child views.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgREST, Zod, Vitest, Tailwind CSS.

---

### Task 1: Canonical customer contract

**Files:** `src/lib/customers/customer-contract.ts`, its tests, `src/hooks/use-customer-state.ts`, and `src/app/api/customers/route.ts`.

1. Write failing tests for status aliases and synchronized identity/company/type payloads.
2. Implement the shared normalization contract and use it at API/UI boundaries.
3. Run focused tests.

### Task 2: Tenant-safe credit and deletion routes

**Files:** `src/app/api/customers/[id]/credits/route.ts`, `src/app/api/customers/route.ts`, and focused route tests.

1. Test tenant permission, ownership, and organization filters.
2. Replace legacy staff-only auth and fail closed on history lookup errors.
3. Run route-focused tests.

### Task 3: Correct create/edit classification

**Files:** customer create/edit forms and focused tests.

1. Capture and submit split names, business name, type, and compatible segment.
2. Preserve every supported type and normalized status on edit.
3. Run focused tests.

### Task 4: Remove duplicate loading and improve mobile use

**Files:** customer dashboard/list, metrics hook, and focused tests.

1. Remove duplicate spend loading and lazy-load credits.
2. Keep one search, use cards on mobile, and expose row actions on touch.
3. Scope analytics by active organization.
4. Run focused tests.

### Task 5: Verification and review

1. Run customer tests, TypeScript, targeted lint, and `git diff --check`.
2. Inspect the full diff for tenant leaks and secrets.
3. Run a production build and authenticated browser check when available.
