# Repair Payment Cash Opening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar el cobro de reparaciones con estado y apertura integrada de caja, más cálculo seguro de efectivo recibido y vuelto.

**Architecture:** `RepairPaymentDialog` reutilizará `useCashRegister` para consultar y abrir la caja de la sucursal, y montará el `OpenCashRegisterDialog` compartido sin desmontar el formulario de pago. El efectivo recibido será estado operativo local; `RepairPaymentResult.amount` seguirá siendo el único monto financiero enviado al endpoint.

**Tech Stack:** Next.js 16, React 19, TypeScript, shadcn/Radix Dialog, Tailwind CSS, Vitest, Testing Library, hook existente `useCashRegister`.

## Global Constraints

- No modificar RPC, esquema de base de datos ni endpoint financiero.
- No enviar `cashReceived` al servidor.
- Efectivo, tarjeta y transferencia requieren caja abierta; crédito no.
- Conservar los campos del pago mientras se abre caja.
- No registrar el vuelto como ingreso.
- Preservar cambios locales ajenos a reparaciones.

---

### Task 1: Estado de caja y apertura integrada

**Files:**
- Create: `src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx`
- Modify: `src/components/dashboard/repairs/RepairPaymentDialog.tsx`

**Interfaces:**
- Consumes: `useCashRegister(): { checkOpenSession(): Promise<CashRegisterSession | null>; openRegister(registerId: string, openingBalance: number, userId?: string, note?: string): Promise<boolean> }`.
- Consumes: `OpenCashRegisterDialog` con sus props controladas actuales.
- Conserva: `RepairPaymentResult` sin campos de efectivo entregado.

- [ ] **Step 1: Escribir pruebas fallidas del estado de caja**

Mockear `useCashRegister` con `checkOpenSession` y `openRegister`. Renderizar una reparación con saldo pendiente y comprobar:

```tsx
expect(await screen.findByText('Caja cerrada')).toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Confirmar cobro' })).toBeDisabled()
expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeEnabled()
```

Seleccionar Crédito y comprobar que `Registrar crédito` puede habilitarse con datos válidos aun con caja cerrada.

- [ ] **Step 2: Ejecutar y confirmar el fallo rojo**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx`

Expected: FAIL porque el modal todavía no consulta ni presenta el estado de caja.

- [ ] **Step 3: Implementar consulta y estados de caja**

Agregar estados `cashStatus: 'checking' | 'open' | 'closed'`, `isOpenRegisterDialogOpen`, `openingAmount`, `openingNote` e `isOpeningRegister`. Al abrir:

```tsx
setCashStatus('checking')
const session = await cashRegister.checkOpenSession()
setCashStatus(session ? 'open' : 'closed')
```

Calcular `requiresOpenRegister = method !== 'credit'` e incluir `cashStatus === 'open'` en `canConfirm` solamente cuando corresponda.

- [ ] **Step 4: Integrar el diálogo compartido sin desmontar el pago**

Renderizar `OpenCashRegisterDialog` como diálogo hermano dentro del componente. Su envío debe ejecutar:

```tsx
const opened = await cashRegister.openRegister('principal', amount, undefined, note)
if (opened) {
  const session = await cashRegister.checkOpenSession()
  setCashStatus(session ? 'open' : 'closed')
  setIsOpenRegisterDialogOpen(false)
  setOpeningAmount('')
  setOpeningNote('')
}
```

No llamar `handleClose` ni reinicializar `method`, `amount`, `reference` o `note` durante este recorrido.

- [ ] **Step 5: Probar apertura y preservación de campos**

Agregar prueba que ingrese monto y nota, abra caja, complete el diálogo de apertura y compruebe que el pago conserva ambos valores y muestra `Caja abierta`.

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx`

Expected: PASS.

- [ ] **Step 6: Guardar el incremento**

```bash
git add src/components/dashboard/repairs/RepairPaymentDialog.tsx src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx
git commit -m "feat: open cash register from repair payment"
```

---

### Task 2: Efectivo recibido y cálculo de vuelto

**Files:**
- Modify: `src/components/dashboard/repairs/RepairPaymentDialog.tsx`
- Modify: `src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx`

**Interfaces:**
- Produce estado local: `cashReceived: string`.
- Produce valores derivados: `parsedCashReceived`, `cashIsInsufficient`, `changeDue`.
- Conserva `onConfirm(repairId, result)` con `result.amount === monto aplicado` y sin `cashReceived`.

- [ ] **Step 1: Escribir pruebas fallidas de efectivo y vuelto**

Con caja abierta, ingresar monto aplicado `180000` y efectivo recibido `200000`; comprobar:

```tsx
expect(screen.getByText(/20\.000/)).toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Confirmar cobro' })).toBeEnabled()
```

Cambiar efectivo recibido a `170000`, comprobar el mensaje `El efectivo recibido no alcanza para cubrir el monto aplicado.` y botón deshabilitado.

- [ ] **Step 2: Ejecutar y confirmar el fallo rojo**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx`

Expected: FAIL porque aún no existe el campo de efectivo recibido ni el resumen de vuelto.

- [ ] **Step 3: Implementar campos y reglas de efectivo**

Renombrar la etiqueta principal a `Monto aplicado a la reparación`. Mostrar `Efectivo recibido del cliente` solo para `method === 'cash'`. Derivar:

```tsx
const parsedCashReceived = Number(cashReceived) || 0
const cashIsInsufficient = method === 'cash' && parsedCashReceived < parsedAmount
const changeDue = method === 'cash' ? Math.max(0, parsedCashReceived - parsedAmount) : 0
```

Incluir `!cashIsInsufficient` en `canConfirm`. Mostrar el error con `role="alert"` y el vuelto con texto y cantidad formateada.

- [ ] **Step 4: Mejorar saldo completo sin inflar el cobro**

Al pulsar `Usar saldo pendiente`, asignar `amount = balanceDue`. Si el método es efectivo y `cashReceived` está vacío o es inferior al saldo, asignar también `cashReceived = balanceDue`. Al editar después el efectivo recibido, no modificar el monto aplicado.

- [ ] **Step 5: Probar el payload financiero**

Confirmar un cobro con `amount = 180000` y `cashReceived = 200000`. Verificar:

```tsx
expect(onConfirm).toHaveBeenCalledWith('repair-payment-1', expect.objectContaining({
  method: 'cash',
  amount: 180000,
}))
expect(onConfirm.mock.calls[0][1]).not.toHaveProperty('cashReceived')
```

Agregar un rechazo de `onConfirm` y comprobar que el diálogo y los dos importes permanecen visibles.

- [ ] **Step 6: Ejecutar pruebas y guardar el incremento**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx src/app/api/repairs/[id]/payment/route.test.ts`

Expected: PASS.

```bash
git add src/components/dashboard/repairs/RepairPaymentDialog.tsx src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx
git commit -m "feat: calculate cash change for repair payments"
```

---

### Task 3: Verificación final

**Files:**
- Verify only: archivos modificados en Tasks 1 y 2.

**Interfaces:**
- Consumes: flujo reparación -> pago -> apertura de caja -> reanudación -> cobro.
- Produces: evidencia de pruebas, tipos, lint y revisión del diff.

- [ ] **Step 1: Ejecutar pruebas enfocadas**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx src/app/api/repairs/[id]/payment/route.test.ts src/lib/repairs/financial-closure.test.ts`

Expected: PASS.

- [ ] **Step 2: Ejecutar TypeScript y ESLint**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npx eslint src/components/dashboard/repairs/RepairPaymentDialog.tsx src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx`

Expected: 0 errores.

- [ ] **Step 3: Revisar el diff y el estado del repositorio**

Run: `git diff --check HEAD~2..HEAD`

Expected: sin salida.

Run: `git status --short`

Expected: solo los cambios locales ajenos presentes antes de esta implementación.

- [ ] **Step 4: Prueba visual autenticada cuando esté disponible**

Abrir `/dashboard/repairs`, seleccionar una reparación con saldo, abrir `Cobrar saldo`, verificar los tres estados de caja, abrir caja con datos de prueba y comprobar vuelto sin confirmar un cobro real salvo que exista autorización y un registro seguro de desarrollo.

