# Repair Detail Payment and Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en el detalle de reparación el estado y los montos reales del pago, y conducir toda entrega por el modal unificado de resultado, cobro y saldo pendiente.

**Architecture:** Mantener el cálculo financiero puro en `financial-closure.ts` y dejar que `RepairDetailDialog` solo presente ese resultado. `RepairDeliveryDialog` seguirá siendo la única interfaz de entrega; la página coordina la llamada atómica al endpoint `/delivery` y abre `RepairPaymentDialog` para cobros posteriores.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Radix Dialog, Vitest, Testing Library, Supabase/PostgreSQL.

## Global Constraints

- Separar siempre el estado operativo del estado financiero.
- POS es una alternativa para agregar productos, no un requisito para cobrar una reparación.
- No permitir una entrega con saldo sin confirmación explícita.
- No permitir que la transición genérica de estado escriba `entregado`.
- No agregar dependencias.
- Conservar el contrato transaccional e idempotente existente.

---

### Task 1: Resumen financiero accesible en el detalle

**Files:**
- Modify: `src/components/dashboard/repairs/RepairDetailDialog.tsx`
- Create: `src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`
- Reuse: `src/lib/repairs/financial-closure.ts`

**Interfaces:**
- Consumes: `getRepairFinancialPresentation({ status, finalCost, estimatedCost, paidAmount })`.
- Produces: etiquetas visibles `Total`, `Pagado`, `Pendiente` y acción `Cobrar saldo` cuando `financial.canCollect` sea verdadera.

- [ ] **Step 1: Escribir pruebas fallidas del detalle pagado y pendiente**

Crear dos casos con `Repair` mínimo. El primero debe buscar `Estado del pago`, `Pagado`, `Total`, el monto pagado y `Pendiente` con saldo cero. El segundo debe buscar `Pago parcial`, el saldo restante y el botón `Cobrar saldo` para una reparación entregada.

```tsx
expect(screen.getByText('Estado del pago')).toBeInTheDocument()
expect(screen.getByText('Pago parcial')).toBeInTheDocument()
expect(screen.getByText('Pendiente')).toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Cobrar saldo' })).toBeEnabled()
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npx vitest run src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`

Expected: FAIL porque el detalle actual no tiene la estructura ni las etiquetas accesibles exactas.

- [ ] **Step 3: Implementar el resumen mínimo**

Reemplazar el bloque decorativo ambiguo por un resumen con encabezado `Estado del pago`, badge financiero y tres filas:

```tsx
<dl>
  <div><dt>Total</dt><dd>{formatCurrency(financial.total)}</dd></div>
  <div><dt>Pagado</dt><dd>{formatCurrency(financial.paid)}</dd></div>
  <div><dt>Pendiente</dt><dd>{formatCurrency(financial.balance)}</dd></div>
</dl>
```

Eliminar el aviso que afirma que POS es obligatorio y sustituirlo por texto contextual: `Podés cobrar al entregar o continuar por POS si necesitás agregar productos.`

- [ ] **Step 4: Ejecutar la prueba y confirmar GREEN**

Run: `npx vitest run src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/repairs/RepairDetailDialog.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx
git commit -m "feat(repairs): clarify payment status in detail"
```

### Task 2: Probar el recorrido Entregar → resultado → cobro

**Files:**
- Modify: `src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`
- Modify only if the test proves a defect: `src/components/dashboard/repairs/RepairDeliveryDialog.tsx`
- Modify only if the test proves a defect: `src/app/dashboard/repairs/page.tsx`

**Interfaces:**
- Consumes: `RepairDeliveryConfirmPayload` con `outcome`, `payment`, `allowOutstandingBalance` e `idempotencyKey`.
- Produces: una entrega reparada con pago completo sin consentimiento de deuda, o una entrega parcial que exige dicho consentimiento.

- [ ] **Step 1: Escribir la prueba fallida del pago completo al entregar**

Abrir el diálogo, seleccionar `Reparado y funcionando`, verificar que el saldo completo se sugiere, seleccionar transferencia, ingresar referencia y confirmar.

```tsx
expect(onConfirm).toHaveBeenCalledWith('repair-1', expect.objectContaining({
  outcome: 'repaired',
  allowOutstandingBalance: false,
  payment: expect.objectContaining({ method: 'transfer', amount: 100, reference: 'TRX-1' }),
}))
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npx vitest run src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`

Expected: FAIL si el flujo no sugiere el saldo, no conserva la referencia o exige consentimiento incorrectamente.

- [ ] **Step 3: Implementar únicamente el comportamiento faltante**

Mantener `remainingAfterPayment = Math.max(0, balanceDue - parsedAmount)` y derivar:

```ts
const needsUnpaidConfirm = allowPayment && remainingAfterPayment > 0
allowOutstandingBalance: !allowPayment || remainingAfterPayment > 0
```

La página debe enviar el payload completo a `POST /api/repairs/:id/delivery`; no debe llamar la transición genérica ni ejecutar pago y entrega en dos requests.

- [ ] **Step 4: Ejecutar ambas pruebas de entrega y confirmar GREEN**

Run: `npx vitest run src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx src/app/api/repairs/[id]/delivery/route.test.ts src/app/api/repairs/[id]/status/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx src/components/dashboard/repairs/RepairDeliveryDialog.tsx src/app/dashboard/repairs/page.tsx
git commit -m "test(repairs): verify payment during delivery"
```

### Task 3: Validación integral y revisión

**Files:**
- Verify: todos los archivos cambiados desde `be9791f`.

**Interfaces:**
- Consumes: resumen financiero, modal de entrega y endpoints ya integrados.
- Produces: evidencia de pruebas, tipos, lint y árbol Git limpio.

- [ ] **Step 1: Ejecutar las pruebas enfocadas**

Run:

```bash
npx vitest run src/lib/repairs/financial-closure.test.ts src/lib/repairs/financial-closure-rpc.test.ts src/lib/repairs/financial-closure-migration.test.ts src/utils/repair-mapping.test.ts src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx src/app/api/repairs/[id]/delivery/route.test.ts src/app/api/repairs/[id]/payment/route.test.ts src/app/api/repairs/[id]/status/route.test.ts
```

Expected: todos PASS.

- [ ] **Step 2: Ejecutar tipos y lint enfocado**

Run: `npm run typecheck`

Run:

```bash
npx eslint src/components/dashboard/repairs/RepairDetailDialog.tsx src/components/dashboard/repairs/RepairDeliveryDialog.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx src/app/dashboard/repairs/page.tsx
```

Expected: typecheck con código 0 y ESLint sin errores.

- [ ] **Step 3: Revisar corrección, accesibilidad, seguridad y rendimiento**

Confirmar que los montos provienen del resumen financiero, que ninguna acción confunde entrega con pago, que los errores de API llegan al usuario y que no se agregó una segunda escritura financiera.

- [ ] **Step 4: Comprobar el diff**

Run: `git diff --check && git status --short`

Expected: sin errores de whitespace y únicamente cambios esperados.

- [ ] **Step 5: Commit de correcciones de revisión, si existen**

```bash
git add <archivos-corregidos>
git commit -m "fix(repairs): address payment detail review"
```
