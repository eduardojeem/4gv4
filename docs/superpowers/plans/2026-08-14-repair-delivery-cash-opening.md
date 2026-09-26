# Repair Delivery Cash Opening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir abrir la caja desde el cobro integrado a la entrega de una reparación antes de enviar un pago que requiere movimiento de caja.

**Architecture:** `RepairDeliveryDialog` consultará y abrirá la caja mediante `useCashRegister`, y reutilizará `OpenCashRegisterDialog`. El estado local bloqueará solamente los cobros no crediticios; la API seguirá siendo la autoridad final y un rechazo conservará el modal y su borrador.

**Tech Stack:** Next.js 16.3, React, TypeScript, Vitest, Testing Library, Supabase/Postgres mediante las APIs existentes.

## Global Constraints

- Reutilizar `useCashRegister` y `OpenCashRegisterDialog`; no duplicar la apertura.
- Efectivo, tarjeta y transferencia requieren caja abierta.
- Crédito y entrega con saldo pendiente no requieren caja.
- Conservar resultado, método, monto, referencia, nota y consentimiento durante la apertura.
- No modificar la validación del servidor ni cambios ajenos de Productos y Finanzas.

---

### Task 1: Reproducir la caja cerrada durante la entrega

**Files:**
- Modify: `src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`

**Interfaces:**
- Consumes: `useCashRegister(): { checkOpenSession, openRegister }`
- Produces: pruebas que definen el bloqueo y la excepción de crédito.

- [ ] **Step 1: Añadir mocks controlables de caja**

```tsx
const cashRegisterMocks = vi.hoisted(() => ({
  checkOpenSession: vi.fn(),
  openRegister: vi.fn(),
}))
vi.mock('@/hooks/useCashRegister', () => ({ useCashRegister: () => cashRegisterMocks }))
```

Crear un doble accesible de `OpenCashRegisterDialog` que permita completar `Fondo inicial`, `Referencia del turno` y ejecutar `onSubmit`.

- [ ] **Step 2: Escribir la prueba fallida para efectivo con caja cerrada**

```tsx
cashRegisterMocks.checkOpenSession.mockResolvedValue(null)
render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)
fireEvent.click(screen.getByRole('button', { name: /Reparado y funcionando/i }))
expect(await screen.findByText('Caja cerrada')).toBeVisible()
expect(screen.getByRole('button', { name: 'Cobrar y Entregar' })).toBeDisabled()
expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeEnabled()
```

- [ ] **Step 3: Escribir la prueba fallida para crédito sin caja**

Seleccionar `Crédito` y comprobar que `Registrar Crédito y Entregar` queda habilitado aun cuando se muestre `Caja cerrada`.

- [ ] **Step 4: Ejecutar las pruebas y verificar RED**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`

Expected: FAIL porque el modal de entrega no muestra estado ni apertura de caja.

---

### Task 2: Integrar estado y apertura de caja

**Files:**
- Modify: `src/components/dashboard/repairs/RepairDeliveryDialog.tsx`
- Test: `src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`

**Interfaces:**
- Consumes: `checkOpenSession(registerId?: string)` y `openRegister('principal', amount, undefined, note)`.
- Produces: `cashStatus: 'checking' | 'open' | 'closed'` y apertura contextual controlada.

- [ ] **Step 1: Consultar la caja al abrir el modal**

Mantener `checkOpenSession` en un `useRef`, exponer `refreshCashStatus` con `useCallback`, y ejecutarlo cuando se abre el diálogo o cambia la reparación.

```tsx
const [cashStatus, setCashStatus] = useState<'checking' | 'open' | 'closed'>('checking')
const refreshCashStatus = useCallback(async () => {
  setCashStatus('checking')
  const session = await checkOpenSessionRef.current()
  setCashStatus(session ? 'open' : 'closed')
  return Boolean(session)
}, [])
```

- [ ] **Step 2: Mostrar estado y botón de apertura**

En el paso `payment`, renderizar `Consultando caja`, `Caja abierta` o `Caja cerrada`. Con estado cerrado, mostrar `Abrir caja` y explicar que crédito o entrega pendiente siguen disponibles.

- [ ] **Step 3: Bloquear únicamente cobros que necesitan caja**

```tsx
const requiresOpenRegister = wantsCharge && method !== 'credit'
const canConfirm = !!selected && !isSubmitting &&
  (!needsUnpaidConfirm || deliverUnpaid) &&
  (!wantsCharge || (
    (!selectedMethod?.requiresRef || reference.trim().length > 0) &&
    (!isCredit || creditCount >= 1)
  )) &&
  (!requiresOpenRegister || cashStatus === 'open')
```

No condicionar `Confirmar Entrega` cuando `wantsCharge` sea falso.

- [ ] **Step 4: Abrir la caja y reanudar el flujo**

Controlar `openingAmount`, `openingNote`, `isOpeningRegister` e `isOpening`. Al completar:

```tsx
const opened = await cashRegister.openRegister('principal', initialAmount, undefined, openingReference)
if (!opened) return
setIsOpeningRegister(false)
await refreshCashStatus()
```

No reiniciar ningún campo del cobro al abrir o cerrar este diálogo auxiliar.

- [ ] **Step 5: Ejecutar las pruebas y verificar GREEN**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`

Expected: todas las pruebas pasan.

- [ ] **Step 6: Crear un commit atómico**

```bash
git add src/components/dashboard/repairs/RepairDeliveryDialog.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx
git commit -m "fix: require open cash register during repair delivery"
```

---

### Task 3: Probar preservación y rechazo concurrente

**Files:**
- Modify: `src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`
- Modify: `src/components/dashboard/repairs/RepairDeliveryDialog.tsx`

**Interfaces:**
- Consumes: el estado de apertura de Task 2.
- Produces: cobertura de preservación del borrador y del error final de API.

- [ ] **Step 1: Escribir una prueba de apertura que preserve el borrador**

Configurar `checkOpenSession` para devolver primero `null` y luego una sesión, y `openRegister` para devolver `true`. Completar monto, referencia y nota antes de abrir caja; después verificar que permanecen y que `Cobrar y Entregar` queda habilitado.

- [ ] **Step 2: Escribir una prueba de rechazo de confirmación**

```tsx
const onConfirm = vi.fn().mockRejectedValue(new Error('Caja cerrada'))
cashRegisterMocks.checkOpenSession.mockResolvedValue({ id: 'session-1' })
render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={onConfirm} />)
fireEvent.click(screen.getByRole('button', { name: /Reparado y funcionando/i }))
fireEvent.click(screen.getByRole('button', { name: 'Cobrar y Entregar' }))
await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
expect(screen.getByRole('heading', { name: 'Cobrar reparación' })).toBeVisible()
expect(screen.getByLabelText('Monto a cobrar')).toHaveValue(100)
expect(screen.getByRole('alert')).toHaveTextContent('Caja cerrada')
```

La implementación debe capturar el rechazo, guardar su mensaje en
`submissionError`, mostrarlo con `role="alert"` y no ejecutar `handleClose`.
Limpiar el error al reintentar, abrir caja o cerrar el modal. Esto evita que el
rechazo de la API llegue como error de ejecución de Next.js.

- [ ] **Step 3: Ejecutar las pruebas y verificar RED/GREEN**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`

Expected: las pruebas pasan; si el rechazo ya conserva el modal, documentarlo sin cambiar producción.

- [ ] **Step 4: Crear un commit si hubo cambios adicionales**

```bash
git add src/components/dashboard/repairs/RepairDeliveryDialog.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx
git commit -m "test: cover repair delivery cash recovery"
```

---

### Task 4: Verificación final y revisión

**Files:**
- Verify: `src/components/dashboard/repairs/RepairDeliveryDialog.tsx`
- Verify: `src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`
- Verify: `src/components/dashboard/repairs/RepairPaymentDialog.tsx`

**Interfaces:**
- Consumes: todos los cambios anteriores.
- Produces: evidencia final de integración sin regresiones.

- [ ] **Step 1: Ejecutar pruebas enfocadas**

```bash
npm test -- --run src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx "src/app/api/repairs/[id]/delivery/route.test.ts" "src/app/api/repairs/[id]/payment/route.test.ts" src/lib/repairs/financial-closure.test.ts
```

Expected: 0 fallos.

- [ ] **Step 2: Ejecutar comprobaciones estáticas**

```bash
npm run typecheck
npx eslint src/components/dashboard/repairs/RepairDeliveryDialog.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx
git diff --check -- src/components/dashboard/repairs/RepairDeliveryDialog.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx
```

Expected: todos terminan con código 0.

- [ ] **Step 3: Revisar el diff por cinco ejes**

Comprobar corrección, legibilidad, arquitectura, seguridad y rendimiento. Verificar que no se envíen nuevos campos al backend, no haya doble apertura y los cambios ajenos permanezcan fuera del commit.

- [ ] **Step 4: Inspeccionar el commit final**

```bash
git status --short
git show --stat --oneline --summary HEAD
```

Documentar cualquier validación global bloqueada por problemas preexistentes.
