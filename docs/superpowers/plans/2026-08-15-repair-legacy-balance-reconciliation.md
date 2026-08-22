# Repair Legacy Balance Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir el cobro correcto y auditable de reparaciones historicas cuyo precio visible quedo desacoplado del calculo automatico.

**Architecture:** Un helper puro resuelve el precio cobrable sin debilitar el calculo usado al crear o editar reparaciones. La API usa ese helper y una migracion idempotente normaliza los datos persistidos, dejando una nota interna por cada reparacion cambiada.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Supabase/PostgreSQL.

## Global Constraints

- Preservar el alcance por organizacion y sucursal.
- No aceptar pagos superiores al saldo ni credito parcial.
- No crear pagos ni movimientos de caja durante la reconciliacion.
- Preservar cambios no relacionados del worktree.

---

### Task 1: Resolver saldo cobrable historico

**Files:**
- Create: `src/lib/repairs/collection-pricing.ts`
- Create: `src/lib/repairs/collection-pricing.test.ts`
- Modify: `src/app/api/repairs/[id]/payment/route.ts`
- Test: `src/app/api/repairs/[id]/payment/route.test.ts`

**Interfaces:**
- Produces: `resolveRepairCollectionPricing(input)` con `{ pricing, reconciledLegacyPrice }`.

- [x] Escribir pruebas que reproduzcan modo automatico, mano de obra cero, sin repuestos y `estimated_cost` positivo.
- [x] Ejecutar las pruebas y comprobar que fallan antes de implementar el helper.
- [x] Implementar el fallback conservador y usarlo en la ruta de pago.
- [x] Ejecutar pruebas de precios y ruta de pago.

### Task 2: Reconciliar datos con auditoria

**Files:**
- Create: `supabase/migrations/20260815230000_reconcile_legacy_repair_balances.sql`
- Modify: `src/lib/repairs/financial-closure-migration.test.ts`

**Interfaces:**
- Produces: reparaciones historicas consistentes en modo `budget` y notas internas idempotentes.

- [x] Agregar una prueba estructural para condiciones conservadoras, actualizacion y nota interna.
- [x] Ejecutar la prueba y comprobar que falla sin la migracion.
- [x] Crear la migracion con un CTE que actualice solo candidatos y registre auditoria.
- [x] Ejecutar la prueba de migracion.

### Task 3: Validacion final

**Files:**
- Verify: archivos modificados en Tasks 1 y 2.

**Interfaces:**
- Consumes: helper, ruta y migracion terminados.

- [x] Ejecutar las pruebas enfocadas de reparaciones.
- [x] Ejecutar ESLint sobre los archivos TypeScript tocados.
- [x] Ejecutar typecheck y `git diff --check`.
- [x] Revisar el diff para confirmar que no incluye trabajo ajeno.
