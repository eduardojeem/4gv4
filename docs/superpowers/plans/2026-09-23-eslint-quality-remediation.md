# ESLint Quality Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir las 3.328 incidencias de ESLint en `src` a cero sin desactivar reglas, perder cambios locales ni introducir regresiones funcionales.

**Architecture:** El trabajo se ejecuta en entregables independientes ordenados por riesgo: primero la línea base y los defectos funcionales, después hooks/accesibilidad/imágenes, y finalmente código muerto y tipado por dominios. Cada lote genera su propio inventario, prueba enfocada, verificación TypeScript y commit; el cierre global no depende de ocultar advertencias.

**Tech Stack:** Next.js 16, React 19, TypeScript, ESLint flat config, `eslint-config-next`, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-23-eslint-quality-remediation-design.md`

## Global Constraints

- No desactivar reglas ni excluir código de producción.
- No reemplazar `any` por assertions inseguras; usar tipos concretos o `unknown` con narrowing.
- Preservar cambios locales preexistentes y revisar `git status --short` antes de cada tarea.
- No eliminar estados, funciones o componentes completos sin buscar consumidores.
- Cada cambio observable requiere una prueba de regresión.
- El cierre exige lint sin incidencias, typecheck, pruebas globales y `git diff --check`.

## Review Focus

- Un cambio de categoría durante el autoplay debe mostrar la primera oferta sin intervalo fuera de rango ni render en cascada.
- Un callback de hook debe leer el estado más reciente sin entrar en bucle por identidades inestables.
- Datos externos malformados deben permanecer `unknown` hasta validarse y producir una respuesta controlada.
- Una imagen remota o sin dimensiones conocidas debe conservar proporción, texto alternativo y carga correcta.
- Retirar una variable aparentemente muerta no debe eliminar una acción, permiso o mensaje que el usuario todavía necesita.

---

### Task 1: Inventario reproducible de lint

**Files:**
- Create: `scripts/lint-inventory.mjs`
- Create: `src/test/lint-inventory.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `summarizeLintResults(results): { errors: number; warnings: number; byRule: Record<string, number>; byFile: Array<{ file: string; errors: number; warnings: number }> }`
- Produces: script `npm run lint:inventory` que imprime JSON determinista.

- [ ] **Step 1: Write the failing inventory test**

```ts
import { describe, expect, it } from 'vitest'
import { summarizeLintResults } from '../../scripts/lint-inventory.mjs'

it('counts severities and rules without losing files', () => {
  const summary = summarizeLintResults([{ filePath: 'src/a.ts', messages: [
    { severity: 2, ruleId: 'rule-a' }, { severity: 1, ruleId: 'rule-b' },
  ] }])
  expect(summary).toMatchObject({ errors: 1, warnings: 1, byRule: { 'rule-a': 1, 'rule-b': 1 } })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/test/lint-inventory.test.ts`
Expected: FAIL because `scripts/lint-inventory.mjs` does not exist.

- [ ] **Step 3: Implement the inventory script** using ESLint's Node API, normalize paths relative to `process.cwd()`, sort rules/files, print JSON, and set `process.exitCode = 1` only when errors exist.

- [ ] **Step 4: Add the script**

```json
"lint:inventory": "node scripts/lint-inventory.mjs"
```

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/test/lint-inventory.test.ts`, `npm run lint:inventory`.
Commit: `test: add reproducible eslint inventory`

### Task 2: Repair the offers carousel state transition

**Files:**
- Modify: `src/components/public/inicio/StoreOffersPromoShowcase.tsx`
- Modify: `src/test/store-offers-promo-showcase.test.tsx`

**Interfaces:**
- Consumes: existing `selectedCategory`, `carouselIndex`, category buttons and autoplay timer.
- Produces: `handleCategoryChange(categoryId: string): void`, which updates category and resets the carousel in one event.

- [ ] **Step 1: Add a regression test** with two categories, advance fake timers to the second slide, select the other category, and assert its first product is active.
- [ ] **Step 2: Run** `npm test -- src/test/store-offers-promo-showcase.test.tsx`; expected FAIL before the event-level reset.
- [ ] **Step 3: Implement** a `useCallback` handler that calls `setSelectedCategory(categoryId)` and `setCarouselIndex(0)`, replace all category setters with it, and remove the reset effect.
- [ ] **Step 4: Remove the unused `Check` and `MapPin` imports only after `rg -n "Check|MapPin"` confirms no JSX consumer.
- [ ] **Step 5: Verify** focused test and `npx eslint src/components/public/inicio/StoreOffersPromoShowcase.tsx src/test/store-offers-promo-showcase.test.tsx`.
- [ ] **Step 6: Commit** `fix: reset offers carousel during category selection`.

### Task 3: Correct category control flow and isolated accessibility findings

**Files:**
- Modify: `src/app/dashboard/categories/page.tsx`
- Modify: `src/components/admin/inventory/inventory-management.tsx`
- Modify: `src/components/profile/avatar-upload-demo.tsx`
- Modify: or create the nearest existing tests for these three components.

**Interfaces:**
- Produces unchanged bulk operation counts with explicit `if (res.success) successCount += 1; else failCount += 1`.
- Produces sortable table semantics with `aria-sort` on the column header rather than the button.

- [ ] **Step 1: Add tests** asserting mixed bulk results report exact success/failure counts, avatar preview has accessible alt text, and sortable headers expose `aria-sort` legally.
- [ ] **Step 2: Run the three focused tests** and confirm the new assertions fail.
- [ ] **Step 3: Replace both ternary expression statements** in categories with explicit branches.
- [ ] **Step 4: Move `aria-sort` to the owning header element** and give the avatar image meaningful alt text derived from the visible label/user.
- [ ] **Step 5: Verify tests, focused ESLint, and focused accessibility test.**
- [ ] **Step 6: Commit** `fix: clarify category counts and accessibility semantics`.

### Task 4: Repair POS and cash-monitor hook dependencies

**Files:**
- Modify: `src/app/admin/cash-monitor/hooks/useCashMonitor.ts`
- Modify: `src/app/dashboard/pos/components/CashRegisterDetailsModal.tsx`
- Modify: `src/app/dashboard/pos/contexts/POSCustomerContext.tsx`
- Modify: `src/app/dashboard/pos/hooks/usePerformanceMonitor.ts`
- Modify: `src/app/dashboard/pos/page.tsx`
- Test: existing POS/cash tests under `src/test` and `src/test/integration/pos-workflow.test.tsx`

**Interfaces:** Preserve existing exported hooks/components; no public signature change.

- [ ] **Step 1: Add regression assertions** for refreshed cash report callbacks, latest cart/repair selection, promotion callbacks, suggestion reset and performance alerts.
- [ ] **Step 2: Run focused POS/cash tests** and record the failing assertions.
- [ ] **Step 3: Stabilize callback producers with `useCallback`**, memoize `alerts`, hoist module constants out of dependency arrays, and remove only proven unnecessary dependencies.
- [ ] **Step 4: Add every value read by an effect/callback to its dependency list** unless a functional state updater or ref removes that read.
- [ ] **Step 5: Run focused tests, ESLint on the five files, and `npm run typecheck`.**
- [ ] **Step 6: Commit** `fix: stabilize pos and cash monitor hooks`.

### Task 5: Repair remaining hook dependency warnings

**Files:**
- Modify the 23 files reported by `lint:inventory` under repairs inventory, analytics, backup, customers, product forms, public UI, superadmin UI, shared UI and `src/hooks`.
- Test: colocated or nearest tests for each touched hook/component.

**Interfaces:** Existing exported signatures remain stable.

- [ ] **Step 1: Split the inventory by file** and process one component family at a time: repairs, analytics/backup, customer/product UI, public/superadmin UI, shared hooks.
- [ ] **Step 2: For each family, add a test that rerenders with changed inputs** and asserts the effect/callback sees the latest value.
- [ ] **Step 3: Run that family test and confirm the stale-value assertion fails where applicable.**
- [ ] **Step 4: Apply the correct pattern:** memoize callback producers, move object creation into `useMemo`, use functional updates, or remove truly unnecessary dependencies.
- [ ] **Step 5: Run the family tests and focused ESLint before moving to the next family.**
- [ ] **Step 6: Remove the two now-unused `react-hooks/set-state-in-effect` disable comments in finance panels.**
- [ ] **Step 7: Run `npm run lint:inventory` and require zero `react-hooks/*` or unused-disable findings.**
- [ ] **Step 8: Commit** `fix: make shared hook dependencies explicit`.

### Task 6: Migrate production images safely

**Files:**
- Modify: every non-test file listed under `@next/next/no-img-element` by `lint:inventory`.
- Modify: affected Next image host configuration only if an already-used remote host is missing.
- Test: nearest rendering tests for each public/auth/dashboard image component.

**Interfaces:** Preserve source URL, alt text, sizing mode, lazy/priority intent and click behavior.

- [ ] **Step 1: Classify each finding** as fixed-size, responsive `fill`, dynamic external URL, or test mock.
- [ ] **Step 2: Add rendering assertions** for alt text and image source; add layout-class assertions for responsive images.
- [ ] **Step 3: Replace production `<img>` elements** with `Image`, providing `width`/`height` or a positioned parent plus `fill` and `sizes`.
- [ ] **Step 4: For tests that intentionally mock images**, add a line-local disable with a comment stating that the mock represents `next/image`; do not change global config.
- [ ] **Step 5: Run affected tests and require zero production `no-img-element` findings.**
- [ ] **Step 6: Browser-check public/auth pages at 320, 768, 1024 and 1440 px.**
- [ ] **Step 7: Commit** `perf: use optimized images in production views`.

### Task 7: Remove dead imports, parameters, state and stubs

**Files:**
- Modify: files reported under `@typescript-eslint/no-unused-vars`, in batches of at most 25 files.
- Test: nearest tests for any file where more than an import or unused parameter is removed.

**Interfaces:** No exported API may be removed unless `rg` proves no consumer and tests cover its containing module.

- [ ] **Step 1: Generate the ordered file list** with `npm run lint:inventory`, highest count first.
- [ ] **Step 2: For each batch, remove only unused imports and locals that have no side effects.** For unused caught errors, omit the binding (`catch {}`). For required callback parameters, use the library-compatible signature and an underscore only if the configured rule permits it.
- [ ] **Step 3: Before removing state/functions/components**, run `rg -n "<symbol>" src` and inspect dynamic/export consumers.
- [ ] **Step 4: Add a regression test when a removal changes a render branch, request, permission check or user action.**
- [ ] **Step 5: Run focused ESLint, relevant tests and typecheck after every batch.**
- [ ] **Step 6: Require zero `no-unused-vars` findings, then commit each domain batch** using `refactor(<domain>): remove unused code`.

### Task 8: Replace `any` at API and business boundaries

**Files:**
- Modify: `src/app/api/**/*.ts`, then finance/cash/sales/inventory/repairs files listed by `lint:inventory`.
- Modify/Create: domain type guards next to their owning modules rather than one global catch-all type file.
- Test: affected API route and business-operation tests.

**Interfaces:** Inputs from `request.json()`, Supabase responses and external errors enter as `unknown`; guards return `value is DomainType`.

- [ ] **Step 1: Add malformed-input tests** for each API family, including null, arrays, missing IDs and wrong numeric/string types; expect controlled 4xx responses.
- [ ] **Step 2: Run the tests and confirm unsafe cases fail or are untyped.**
- [ ] **Step 3: Replace boundary `any` with `unknown`**, add minimal domain guards/schemas, and narrow caught errors with `error instanceof Error` plus a safe fallback.
- [ ] **Step 4: Replace database mapping `any` with generated Supabase row/insert/update types where available.**
- [ ] **Step 5: Run route tests, focused ESLint and typecheck for each domain.**
- [ ] **Step 6: Require zero API and core-business `no-explicit-any` findings; commit by domain** with `refactor(<domain>): enforce typed boundaries`.

### Task 9: Replace remaining `any` in UI, services, hooks and tests

**Files:**
- Modify: remaining files reported under `@typescript-eslint/no-explicit-any` in `src/components`, `src/hooks`, `src/lib`, `src/services`, `src/types`, `src/test` and `src/tests`.

**Interfaces:** Reuse React event types, component prop types, library exports, `MockedFunction<T>`, `unknown`, and narrowly scoped structural types.

- [ ] **Step 1: Process by category:** React events/refs, callbacks, library adapters, JSON values, mocks, external shims.
- [ ] **Step 2: Add compile-time fixtures or runtime tests** where narrowing changes control flow.
- [ ] **Step 3: Replace each `any` with the narrowest honest type;** do not use `as unknown as T` or index signatures containing `any`.
- [ ] **Step 4: For declaration shims, expose only the members actually consumed and type unknown payloads as `unknown`.**
- [ ] **Step 5: Run focused tests, ESLint and typecheck after each category.**
- [ ] **Step 6: Require zero `no-explicit-any` findings and commit category batches** using `refactor(types): narrow <category> types`.

### Task 10: Resolve residual rules and close globally

**Files:**
- Modify: `src/lib/auth/roles-permissions.ts`
- Modify: any residual files reported by `lint:inventory`.
- Modify: documentation only if final commands or known blockers must be recorded.

**Interfaces:** Preserve the default export value by assigning it to a named constant before export.

- [ ] **Step 1: Replace the anonymous default export** with a named constant and add/import-test it.
- [ ] **Step 2: Run `npm run lint:inventory`** and resolve every residual rule without changing severities or ignores.
- [ ] **Step 3: Run `npm run lint`; expected exit 0 with zero errors and zero warnings.**
- [ ] **Step 4: Run `npm run typecheck`; expected exit 0.**
- [ ] **Step 5: Run `npm test`; expected all suites pass.**
- [ ] **Step 6: Run `git diff --check`, inspect `git status --short`, and review the complete diff for secrets and unrelated changes.**
- [ ] **Step 7: Run browser smoke checks for the carousel, public image pages and changed operational flows.**
- [ ] **Step 8: Commit** `chore: complete eslint quality remediation`.

### Task 11: Independent final review

**Files:** Review all files changed since the specification commit.

- [ ] **Step 1: Review correctness, readability, architecture, security and performance**, prioritizing hook behavior, boundary validation and removed UI actions.
- [ ] **Step 2: Re-run the exact global verification commands after addressing review findings.**
- [ ] **Step 3: Produce a final report** with before/after counts, commits, tests, browser checks, and any independently demonstrated pre-existing blocker.

