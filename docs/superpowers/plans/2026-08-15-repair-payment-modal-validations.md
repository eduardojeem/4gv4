# Repair Payment Modal Validations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquear cobros sin precio o sin saldo y dirigir al usuario desde el modal de pago hacia la edición del precio.

**Architecture:** `RepairPaymentDialog` derivará un estado financiero local a partir de total y saldo, renderizando una pantalla bloqueada antes del formulario. La página reutilizará su flujo existente de edición mediante un callback `onDefinePrice`, mientras la API seguirá siendo la barrera autoritativa.

**Tech Stack:** Next.js 16.3, React, TypeScript, Radix Dialog, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- No relajar las validaciones financieras de la API o Supabase.
- No consultar ni exigir caja cuando la reparación no tiene precio o saldo.
- Usar componentes y tokens visuales existentes.
- Preservar los cambios locales ajenos; preparar por hunk cualquier edición de `page.tsx`.

---

### Task 1: Estados financieros bloqueados del modal

**Files:**
- Modify: `src/components/dashboard/repairs/RepairPaymentDialog.tsx`
- Test: `src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx`

**Interfaces:**
- Consumes: `repair.finalCost`, `repair.estimatedCost`, `repair.paidAmount`.
- Produces: `onDefinePrice?: (repair: Repair) => void` en `RepairPaymentDialogProps`.

- [ ] **Step 1: Escribir pruebas fallidas para reparación sin precio y pagada**

Agregar casos que verifiquen:

```tsx
expect(screen.getByText('Primero definí el precio de la reparación')).toBeVisible()
expect(screen.queryByRole('button', { name: 'Confirmar Cobro' })).not.toBeInTheDocument()
fireEvent.click(screen.getByRole('button', { name: 'Definir precio' }))
expect(onDefinePrice).toHaveBeenCalledWith(expect.objectContaining({ id: 'repair-1' }))

expect(screen.getByText('Reparación totalmente pagada')).toBeVisible()
expect(screen.queryByText('Método de pago')).not.toBeInTheDocument()
```

- [ ] **Step 2: Ejecutar pruebas y confirmar RED**

Run: `npx vitest run src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx`

Expected: FAIL porque los estados y `onDefinePrice` todavía no existen.

- [ ] **Step 3: Implementar los estados bloqueados**

Extender las props con `onDefinePrice?: (repair: Repair) => void` y derivar:

```ts
const hasDefinedPrice = totalDue > 0
const isFullyPaid = hasDefinedPrice && balanceDue <= 0
```

Antes del formulario y de cualquier estado de caja, renderizar:

- Sin precio: icono, título, explicación, `Cancelar` y `Definir precio` cuando exista callback.
- Pagado: icono de confirmación, título, resumen total/pagado/saldo y `Cerrar`.

`Definir precio` debe ejecutar `onDefinePrice(repair)` sin llamar luego a `handleClose`, porque el consumidor coordina ambos diálogos.

- [ ] **Step 4: Ejecutar pruebas y confirmar GREEN**

Run: `npx vitest run src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx`

Expected: todos los casos del modal pasan.

- [ ] **Step 5: Commit del estado del modal**

```bash
git add src/components/dashboard/repairs/RepairPaymentDialog.tsx src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx
git commit -m "feat: validate repair state before payment"
```

### Task 2: Conectar Definir precio con la edición

**Files:**
- Modify: `src/app/dashboard/repairs/page.tsx`
- Test: `src/test/dashboard-financial-workflows.test.ts`

**Interfaces:**
- Consumes: `RepairPaymentDialog.onDefinePrice(repair)` de Task 1.
- Produces: transición `payTarget -> selectedRepair/dialogMode='edit'/isDialogOpen=true`.

- [ ] **Step 1: Escribir una prueba fallida de integración**

La prueba debe exigir que la página conecte esta transición:

```tsx
onDefinePrice={(repair) => {
  setPayTarget(null)
  setSelectedRepair(repair)
  setDialogMode('edit')
  setIsDialogOpen(true)
}}
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npx vitest run src/test/dashboard-financial-workflows.test.ts`

Expected: FAIL porque la página todavía no entrega `onDefinePrice`.

- [ ] **Step 3: Conectar el callback en la página**

Agregar `onDefinePrice` usando exactamente la transición anterior. No modificar entrega ni otros handlers financieros.

- [ ] **Step 4: Ejecutar pruebas enfocadas**

Run: `npx vitest run src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx src/test/dashboard-financial-workflows.test.ts`

Expected: PASS.

- [ ] **Step 5: Validar tipos, lint y diff**

Run:

```bash
npm run typecheck
npx eslint src/components/dashboard/repairs/RepairPaymentDialog.tsx src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx src/app/dashboard/repairs/page.tsx src/test/dashboard-financial-workflows.test.ts
git diff --check -- src/components/dashboard/repairs/RepairPaymentDialog.tsx src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx src/app/dashboard/repairs/page.tsx src/test/dashboard-financial-workflows.test.ts
```

Expected: cero errores en los archivos alcanzados.

- [ ] **Step 6: Commit y sincronización**

Preparar solamente el hunk de `onDefinePrice` si `page.tsx` mantiene cambios ajenos, crear el commit `feat: route repair payment to price editing` y ejecutar `git push origin update-nextjs-16.3`.
