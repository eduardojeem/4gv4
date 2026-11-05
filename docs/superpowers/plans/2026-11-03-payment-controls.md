# Payment Controls Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans task by task. La extracción local del 2026-11-05 autoriza un commit en feat/controles-de-pago; no push ni cambios remotos.

**Goal:** Two separate administration screens with persistent and enforced payment controls.
**Architecture:** Shared pure catalog and validation; uncached policy reads from existing platform features/organization modules; authenticated CAS updates; payment creation boundaries enforce policy. Bank transfer retains its existing settings source.
**Tech Stack:** Next.js, React, Supabase, Zod, Vitest, existing Expo clients.
**Spec:** docs/superpowers/specs/2026-11-03-payment-controls-design.md (approved by user).

## Global Constraints
- Extracción del 2026-11-05: commit local autorizado. Sin push, merge, deploy, migraciones remotas ni pruebas con pagos o datos reales.
- Disable only new operations; preserve confirmations, reversals, existing debit mandates and history.
- Platform writes require superadmin; tenant configuration requires owner/admin of the active organization.
- Existing data and credentials remain unchanged by defaults. No secret values in API responses.

## Review Focus
- A stale or concurrent form must not overwrite someone else's settings.
- A direct API request must not bypass disabled methods, including split/first-installment/store-credit payments.
- Missing credentials cannot be turned into a working integration by a toggle.
- Organization changes cannot write policy to another tenant.
- No method available must produce a clear empty state, not a fallback to a disabled method.

### Task 1: Policy and catalog
Files: src/lib/payments/control-contract.ts, control-store.ts, subscription-controls.ts; src/test/payment-controls.test.ts.
- [ ] Test normalization, defaults, disabled split payments and invalid input.
- [ ] Implement uncached read, versioned writes and safe errors with existing settings storage.
- [ ] Test absence versus read failure, CAS and unrelated-key preservation with fake DB.

### Task 2: Subscription administration and creation boundaries
Files: src/app/api/superadmin/payment-controls/route.ts; src/app/superadmin/billing/payment-methods/page.tsx; shared control panel; superadmin shell; Pagopar/Stripe checkout, autopay registration, subscription promo service and subscription UI/API consumers.
- [ ] Add catalog endpoint and versioned mutation with superadmin authentication and audit.
- [ ] Enforce policy before new checkout/mandate/promo, keeping confirmation/disable-card/cron paths unchanged.
- [ ] Expose effective availability to web/native consumers and handle all-disabled.
- [ ] Add route/service/UI tests with mocked providers; no live mutations.

### Task 3: Commerce configuration and boundaries
Files: src/app/api/admin/payment-controls/route.ts; src/app/admin/billing/payment-methods/page.tsx; existing admin navigation; POS, repair, credit, orders and customer-collection creation boundaries and client selectors.
- [ ] Add tenant-authorized catalog/mutation and share the visual panel.
- [ ] Check every new incoming payment component and funding source, not historical refunds.
- [ ] Compose website checkout visibility with general policy; retain web checkout-specific restrictions.
- [ ] Verify isolation, direct calls, empty availability and legacy method aliases.

### Task 4: Final verification
- [ ] TypeScript root/mobile, changed-file ESLint, focused Vitest, diff check.
- [ ] Independent review of both scopes and their actual mutation consumers.
- [ ] Responsive UI check using mocked data/read-only state. Record any unverified native UI or infrastructure requirement.

## Ledger histórico (2026-11-03)
- Design approved; executing within the established worktree.
- Ruling: use existing configuration rows rather than require a remote schema change; CAS protects writes from stale versions.
- Ruling: QR through a transfer channel requires QR and transfer enabled; a generic digital wallet is a separate web-only option.
- Completed: policy, two administrative screens, creation guards, availability consumers, partial bank-transfer toggle and per-organization navigation.
- Ruling: a local migration is necessary after discovering authenticated direct sales INSERT and stale JSON writers. The atomic service-role-only RPC, actor validation, CAS and legacy-writer triggers protect both scopes. Configuration writes require readiness version 2.
- Verified: 107 focused tests in one run; 5 panel/replay tests after the last async cleanup change (3 overlap); root/mobile tsc passed; changed-file ESLint passed. The local PostgreSQL embedded tests execute the real migration and test interleaved old company/platform settings writes.
- Independent review: initial JSON overwrite race resolved; re-review found no new serious issues.
- Visual: actual shared panel rendered with fake data/provider in a temporary isolated Vite harness, desktop and 390px wide; switch saved only in simulated memory. Preview server stopped. No live configuration mutations.
- Remote read-only preflight: project cel (cswtugmwazxdktntndpy), commerce_payment_controls_version is absent. No remote migration applied.
- Prerrequisito resuelto: la migración está en origin/main mediante PR #75 y el usuario confirmó que ya fue aplicada en producción. Esta extracción no la modifica ni la vuelve a aplicar.
- Semantics: exact committed customer-collection replays return the existing validated receipt. POS/repair capture retries after method disable return a disabled-method response; their receipt/history GETs remain usable. Existing subscription confirmations/refunds and recurring mandates remain untouched.

## Extracción a PR limpio (2026-11-05)

Base: origin/main `da07605c`, con PR #73, #74 y #75 incluidos. Rama: `feat/controles-de-pago`. Se aplican diferencias de controles de pago desde `396ae1fc` con merge de tres vías. Se conserva la RPC POS v6, su fallback condicionado a v5, las reglas de crédito y cuotas por monto de main. Se excluyen finanzas móvil, navegación inferior, notificaciones, categorías y cambios de tienda mayorista, hero y plantillas. La worktree fuente se mantiene intacta.

### Verificación de la extracción

- `npx --no-install tsc --noEmit`: raíz y mobile, exit 0.
- `npx --no-install eslint`: archivos web/móvil seleccionados y sus pruebas, exit 0.
- Vitest: 108 archivos y 702 pruebas, todos aprobados; incluye tests enfocados de pagos, `src/lib/credits`, `src/app/api/pos` y `src/app/dashboard/pos`, además de los tests modificados de reparaciones y suscripciones. PostgreSQL embebido PGlite; sin consultar ni escribir producción.
- Un conflicto textual en `src/app/api/pos/process-sale/route.ts`, resuelto agregando el guard antes de `atomicSaleArgs` y conservando RPC v6/fallback de main. Los otros archivos compartidos se fusionaron limpiamente.
- `git diff --check`: aprobado. Migración `20261103232929_commerce_payment_control_guards.sql` sin diferencias contra main (blob `6a68d4bdfd30e6f5b2321d2183f13e2497de9c50`).
- Worktree original: 116 archivos con cambios revisados por SHA-256, sin variaciones y con idéntico estado Git. Sin cambios en los archivos excluidos.
- Sin nuevas dependencias, archivos de entorno, pagos reales, push, merge ni deploy. Esta extracción no repite pruebas visuales ni pruebas en dispositivo físico.
