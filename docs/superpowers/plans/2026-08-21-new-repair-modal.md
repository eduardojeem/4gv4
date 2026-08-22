# Synchronized New Repair Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the new-repair modal as a sectioned, review-before-submit flow that reads current branch catalog data and creates reusable services or parts without losing form state.

**Architecture:** Keep `RepairFormDialogV2` as the public container and extract navigation, catalog synchronization, quick creation, and review into focused modules. All remote access continues through authenticated Next.js APIs; the repair API remains authoritative for tenant scope, pricing, stock, and idempotency.

**Tech Stack:** Next.js 16, React 19, TypeScript, React Hook Form, Zod 4, Radix/shadcn UI, Tailwind CSS, Supabase/Postgres, Vitest, Testing Library, MSW.

**Spec:** `docs/superpowers/specs/2026-08-21-new-repair-modal-design.md`

## Global Constraints

- Synchronization means current clients, technicians, services, parts, prices, and branch stock; no draft autosave.
- New services and parts are reusable catalog records selected into the current repair after creation.
- Preserve organization/branch isolation, wholesale pricing, pricing modes, warranty, deposits, multi-device quick mode, and transactional stock consumption.
- The browser never writes directly to Supabase.
- Use the visible label "Equipo", not "Vehículo".
- Verify 320, 768, 1024, and 1440 pixel widths and 200 percent zoom.
- Do not claim user validation without participants and recorded results.

---

### Task 1: Define Section Contracts

**Files:**
- Create: `src/components/dashboard/repairs/new-repair/types.ts`
- Create: `src/components/dashboard/repairs/new-repair/repair-form-sections.ts`
- Test: `src/components/dashboard/repairs/new-repair/repair-form-sections.test.ts`

**Interfaces:** Consumes RHF error paths; produces `RepairFormSectionId`, `REPAIR_FORM_SECTIONS`, `sectionForField(path)`, and `buildSectionState(errors)`.

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
  ['existingCustomerId', 'customer'],
  ['devices.0.brand', 'device'],
  ['devices.0.issue', 'diagnosis'],
  ['parts.0.name', 'catalog'],
  ['laborCost', 'estimate'],
] as const)('maps %s to %s', (path, section) => expect(sectionForField(path)).toBe(section))

it('counts nested errors', () => {
  const state = buildSectionState({ devices: [{ issue: { message: 'Requerido' } }] })
  expect(state.diagnosis.errorCount).toBe(1)
})
```

- [ ] **Step 2: Run `npm test -- src/components/dashboard/repairs/new-repair/repair-form-sections.test.ts`; expect FAIL because the module is missing.**
- [ ] **Step 3: Implement six stable IDs (`customer`, `device`, `diagnosis`, `catalog`, `estimate`, `review`), labels, recursive error flattening, and mapping for every current schema field.**
- [ ] **Step 4: Run the same test; expect PASS.**
- [ ] **Step 5: Commit with `git commit -m "feat: define new repair form sections"`.**

### Task 2: Synchronize Branch Catalog Searches

**Files:**
- Create: `src/components/dashboard/repairs/new-repair/useRepairCatalogSearch.ts`
- Test: `src/components/dashboard/repairs/new-repair/useRepairCatalogSearch.test.tsx`
- Modify: `src/components/dashboard/repair-form-dialog-v2.tsx`

**Interfaces:** Consumes `/api/products`, `branchHeaders`, and `CatalogItemKind`; produces `useRepairCatalogSearch({ kind, branchId, open, query }) -> { items, status, error, retry, refresh }`.

- [ ] **Step 1: Write MSW tests for branch headers, `strict_branch_stock=true` for parts, service classification, aborted superseded searches, error/retry, refresh, and branch-change clearing.**
- [ ] **Step 2: Run `npm test -- src/components/dashboard/repairs/new-repair/useRepairCatalogSearch.test.tsx`; expect missing-hook FAIL.**
- [ ] **Step 3: Implement `AbortController`, 250 ms debounce, `cache: 'no-store'`, branch headers, a refresh counter, and `idle | loading | success | empty | error` states.**
- [ ] **Step 4: Replace only the duplicated inventory/service fetch effects in the current dialog.**
- [ ] **Step 5: Run the hook test plus `src/lib/repairs/service-pricing-selection.test.ts`; expect PASS.**
- [ ] **Step 6: Commit with `git commit -m "feat: synchronize repair catalog searches"`.**

### Task 3: Create Reusable Catalog Items Inline

**Files:**
- Create: `src/components/dashboard/repairs/new-repair/catalog-quick-create.ts`
- Create: `src/components/dashboard/repairs/new-repair/CatalogQuickCreateDialog.tsx`
- Test: `src/components/dashboard/repairs/new-repair/catalog-quick-create.test.ts`
- Test: `src/components/dashboard/repairs/new-repair/CatalogQuickCreateDialog.test.tsx`
- Modify: `src/app/api/products/route.ts` only if response normalization needs it.

**Interfaces:** Consumes authenticated `POST /api/products`; produces `CatalogQuickCreateInput`, `toProductCreatePayload(input, branchId)`, and `onCreated(product)`.

- [ ] **Step 1: Write mapper tests asserting services send `unit_measure: 'servicio'`, stock 0, retail/wholesale/cost and branch; parts send `unidad`, initial stock and reject negative amounts.**
- [ ] **Step 2: Run `npm test -- src/components/dashboard/repairs/new-repair/catalog-quick-create.test.ts`; expect missing-mapper FAIL.**
- [ ] **Step 3: Implement a Zod discriminated union and mapper, keeping API snake_case at the boundary and all current product-schema defaults.**
- [ ] **Step 4: Write dialog tests for contextual validation, branch scope, disabled double submit, HTTP 403/402, API field errors, retained values on failure, and `onCreated` after 201.**
- [ ] **Step 5: Implement persistent labels, first-error focus, permission-aware buttons, and parsing of `{ success, data, error, details }`; close only on unambiguous success.**
- [ ] **Step 6: Run both quick-create test files; expect PASS.**
- [ ] **Step 7: Commit with `git commit -m "feat: create repair catalog items inline"`.**

### Task 4: Build the Catalog Section

**Files:**
- Create: `src/components/dashboard/repairs/new-repair/RepairCatalogSection.tsx`
- Test: `src/components/dashboard/repairs/new-repair/RepairCatalogSection.test.tsx`
- Modify: `src/components/dashboard/repair-form-dialog-v2.tsx`

**Interfaces:** Consumes search hook, quick-create dialog, RHF controls, wholesale state, and `resolveServicePricingSelection`; produces controlled parts/labor/final-cost updates.

- [ ] **Step 1: Write tests for service/part filtering, branch stock, unavailable-part blocking, wholesale prices, both create buttons, selection and refresh after creation, and state retention after failure.**
- [ ] **Step 2: Run the section test; expect missing-component FAIL.**
- [ ] **Step 3: Extract current catalog markup without copying pricing formulas; show loading, empty, permission, error and retry states.**
- [ ] **Step 4: On `onCreated`, normalize through the same adapter, select immediately, call `refresh()`, and use the refreshed item afterward.**
- [ ] **Step 5: Run the section, service-pricing, and RepairCostCalculator tests; expect PASS.**
- [ ] **Step 6: Commit with `git commit -m "feat: add synchronized repair catalog section"`.**

### Task 5: Make Repair Creation Idempotent

**Files:**
- Create via CLI: Supabase migration named `add_repair_creation_idempotency`
- Create: `src/lib/repairs/create-repair-idempotency.ts`
- Test: `src/lib/repairs/create-repair-idempotency.test.ts`
- Modify: `src/lib/repairs/create-repair-input.ts`
- Modify/Test: `src/app/api/repairs/route.ts` and `src/app/api/repairs/route.test.ts`
- Modify: `src/contexts/RepairsContext.tsx`

**Interfaces:** Consumes `idempotency_key`, organization ID and normalized input; produces `fingerprintRepairCreateInput`, HTTP 200 replay, HTTP 201 creation, and HTTP 409 changed-payload conflict.

- [ ] **Step 1: Run `npx supabase --version` and `npx supabase migration new add_repair_creation_idempotency`; use the generated path without renaming it.**
- [ ] **Step 2: Write tests for nullable key, required hash when keyed, tenant-scoped partial uniqueness, stable key-order hashes, changed financial/inventory hashes, same-payload replay, changed-payload conflict, and concurrent contention.**
- [ ] **Step 3: Run the idempotency and route tests; expect FAIL because the contract is absent.**
- [ ] **Step 4: Validate keys with `z.string().trim().min(8).max(120)`; add repair key/hash columns, a consistency check and partial unique index without permissive RLS or a public definer function.**
- [ ] **Step 5: Before insert compare stored hash; replay equal data, return `IDEMPOTENCY_KEY_REUSED` for changed data, and re-read after unique contention.**
- [ ] **Step 6: Generate one key per modal session, retain it after timeout/network errors, and replace it only after confirmed success or a fresh session.**
- [ ] **Step 7: Run create-input, idempotency, route, and branch-access tests; expect PASS. Run `npx supabase migration list --local` and report local/remote limits honestly.**
- [ ] **Step 8: Commit with `git commit -m "feat: make repair creation idempotent"`.**

### Task 6: Add Section Navigation and Final Review

**Files:**
- Create/Test: `RepairFormSectionNav.tsx`, `RepairFormSectionNav.test.tsx`, `RepairReview.tsx`, `RepairReview.test.tsx`, and `RepairFieldHelp.tsx` under `src/components/dashboard/repairs/new-repair/`
- Modify: `src/components/dashboard/repair-form-dialog-v2.tsx`

**Interfaces:** Consumes section state, watched values, calculated pricing, wholesale state and RHF focus/trigger; produces accessible navigation and review confirmation.

- [ ] **Step 1: Write tests for labels, `aria-current`, error counts, keyboard navigation, first-error focus, consolidated summary, and no submit before review confirmation.**
- [ ] **Step 2: Run navigation/review tests; expect missing-component FAIL.**
- [ ] **Step 3: Implement native-button navigation, visible completion/errors, `aria-live`, and a review that only formats totals already calculated by existing logic.**
- [ ] **Step 4: Move existing fields into the six sections without removing quick mode, multi-device, customer editing, checklist, images, notes, warranty, deposit, access or pricing modes.**
- [ ] **Step 5: Add focus-operable help for access, pricing, wholesale, warranty, deadline and service/part concepts. Replace direct save with Review; only Confirm invokes submit.**
- [ ] **Step 6: Run navigation, review and catalog-section tests; expect PASS.**
- [ ] **Step 7: Commit with `git commit -m "feat: add guided repair review flow"`.**

### Task 7: Integration, Accessibility, Responsive, and Human Protocol

**Files:**
- Create: `src/components/dashboard/repairs/new-repair/NewRepairDialog.integration.test.tsx`
- Create: `docs/qa/new-repair-usability-script.md`
- Modify: modal files only for reproduced integration defects.

- [ ] **Step 1: Write MSW/Testing Library scenarios for retail/wholesale, service/part creation, search retry, stale stock, timeout/idempotent retry, double click, branch change, keyboard-only completion, and `jest-axe` for main/create/review states.**
- [ ] **Step 2: Run the integration test; expect FAIL only for assembled-flow gaps.**
- [ ] **Step 3: Fix reproduced gaps: preserve form state, focus the relevant section, disable pending confirmation, announce remote state, and clear incompatible branch items.**
- [ ] **Step 4: Write a two-scenario usability protocol (existing item and new item) recording role, time, assistance, backtracks, misunderstood fields, blocking errors, viewport and observations; require three operators.**
- [ ] **Step 5: Run the app and verify authenticated layouts at 320x800, 768x1024, 1024x768 and 1440x900 plus 200 percent zoom; inspect clipping, actions, scroll, console, focus and an interrupted request.**
- [ ] **Step 6: Run the integration test; expect PASS and no covered axe violations.**
- [ ] **Step 7: Commit with `git commit -m "test: verify new repair modal workflows"`.**

### Task 8: Final Quality Gate

- [ ] **Step 1: Run focused tests:** `npm test -- src/components/dashboard/repairs/new-repair src/components/dashboard/repairs/__tests__/RepairCostCalculator.test.tsx src/lib/repairs src/app/api/repairs/route.test.ts src/test/branch-access-contract.test.ts`.
- [ ] **Step 2: Run `npm run typecheck`, focused ESLint over all changed TS/TSX files, and `git diff --check`; expect exit 0.**
- [ ] **Step 3: Run `npm test`; if unrelated baseline failures remain, list exact tests and retain green focused evidence.**
- [ ] **Step 4: Confirm no client Supabase write, browser secret, unvalidated tenant/branch ID, permissive RLS, unrelated changes, or remote-migration claim without evidence.**
- [ ] **Step 5: Record anonymized results only if three operators completed the protocol; otherwise mark real-user validation pending.**
- [ ] **Step 6: Commit only attributable final fixes with `git commit -m "fix: close new repair modal verification gaps"`; skip when none are needed.**
