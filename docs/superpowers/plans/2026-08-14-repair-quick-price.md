# Repair Quick Price Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar de forma segura el precio al cliente desde el detalle de una reparación, mostrando el saldo resultante y reutilizando el contrato financiero existente.

**Architecture:** Un nuevo `RepairQuickPriceDialog` encapsula entrada, vista previa y validación de cliente. `RepairDetailDialog` lo presenta y delega el guardado; `page.tsx` conecta esa intención con `RepairsContext.updateRepair`, cuya respuesta actualiza la colección y por tanto `activeDetailRepair`. El servidor conserva la autoridad mediante `resolveRepairPricingWrite`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Radix/shadcn UI, Tailwind CSS, Vitest, Testing Library, Supabase/Postgres mediante el endpoint existente.

## Global Constraints

- No escribir directamente en Supabase desde el modal.
- No crear una API ni migración nueva.
- No permitir un precio inferior al monto ya pagado.
- No ofrecer edición rápida para reparaciones canceladas.
- Mantener la restricción del servidor para precio manual y precios inferiores al costo interno.
- Distinguir en la interfaz `Precio al cliente` de `Costo de repuestos`.
- Preservar cambios locales ajenos a reparaciones.

---

### Task 1: Modal de edición rápida con validación local

**Files:**
- Create: `src/components/dashboard/repairs/RepairQuickPriceDialog.tsx`
- Create: `src/components/dashboard/repairs/__tests__/RepairQuickPriceDialog.test.tsx`

**Interfaces:**
- Consumes: `Repair` de `@/types/repairs`, `RepairPricingMode` de `@/lib/repairs/pricing` y `calculateRepairPricing`/`validateRepairPricing` del mismo módulo.
- Produces: `RepairQuickPriceUpdate = { pricingMode: RepairPricingMode; laborCost: number; finalCost: number | null; discountAmount: number; priceOverrideReason: string }`.
- Produces: `RepairQuickPriceDialog({ open, repair, onOpenChange, onSave })`, donde `onSave(update): Promise<boolean>` devuelve `true` únicamente cuando el servidor persistió el cambio.

- [ ] **Step 1: Escribir pruebas fallidas del contrato visual y financiero**

Crear pruebas con Testing Library que rendericen una reparación con `finalCost: 300000`, `paidAmount: 100000`, `laborCost: 150000`, repuestos por `50000` y verifiquen:

```tsx
expect(screen.getByText('Editar precio de reparación')).toBeInTheDocument()
expect(screen.getByText('Gs. 100.000')).toBeInTheDocument()
expect(screen.getByText('Gs. 200.000')).toBeInTheDocument()
```

Cambiar a presupuesto, ingresar `90000` y comprobar que `Guardar precio` queda deshabilitado y aparece `El precio no puede ser menor que lo ya pagado.`. Ingresar `320000`, confirmar y esperar:

```tsx
expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
  pricingMode: 'budget',
  finalCost: 320000,
}))
```

Agregar un caso `onSave.mockResolvedValue(false)` que compruebe que el diálogo sigue abierto.

- [ ] **Step 2: Ejecutar la prueba para confirmar el fallo esperado**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairQuickPriceDialog.test.tsx`

Expected: FAIL porque `RepairQuickPriceDialog` todavía no existe.

- [ ] **Step 3: Implementar el modal mínimo accesible**

Implementar estado reinicializado al abrir, controles etiquetados para modo, mano de obra, precio final, descuento y motivo; usar `calculateRepairPricing` para la vista previa y `validateRepairPricing` para mensajes conocidos. El envío debe:

```tsx
const saved = await onSave({
  pricingMode,
  laborCost: pricing.laborCost,
  finalCost: pricing.customerTotal,
  discountAmount: pricing.discountAmount,
  priceOverrideReason: reason.trim(),
})
if (saved) onOpenChange(false)
```

Mostrar siempre `Pagado` y `Saldo resultante`; si `paidAmount > 0`, mostrar una alerta textual. Deshabilitar cierre y envío mientras `isSaving` sea verdadero.

- [ ] **Step 4: Ejecutar pruebas del componente**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairQuickPriceDialog.test.tsx`

Expected: PASS en todos los casos del archivo.

- [ ] **Step 5: Verificar tipos y guardar el incremento**

Run: `npm run typecheck`

Expected: salida exit code 0.

Commit:

```bash
git add src/components/dashboard/repairs/RepairQuickPriceDialog.tsx src/components/dashboard/repairs/__tests__/RepairQuickPriceDialog.test.tsx
git commit -m "feat: add repair quick price dialog"
```

---

### Task 2: Integración desde el detalle hasta el contexto

**Files:**
- Modify: `src/components/dashboard/repairs/RepairDetailDialog.tsx:60-89,1047-1080`
- Modify: `src/app/dashboard/repairs/page.tsx:693-695,963-974`
- Modify: `src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`

**Interfaces:**
- Consumes: `RepairQuickPriceDialog` y `RepairQuickPriceUpdate` de Task 1.
- Produce en `RepairDetailDialogProps`: `onQuickPriceSave?: (repair: Repair, update: RepairQuickPriceUpdate) => Promise<boolean>`.
- Consume `updateRepair(id, update): Promise<Repair | null>` del `RepairsContext`; adapta el resultado con `Boolean(await updateRepair(...))`.

- [ ] **Step 1: Escribir pruebas fallidas de integración en el detalle**

Extender la prueba existente para renderizar `RepairDetailDialog` con `onQuickPriceSave`. Abrir la pestaña `Costos y Piezas`, comprobar que existe `Editar precio`, pulsarlo y verificar `Editar precio de reparación`. Agregar un caso con `status: 'cancelado'` que compruebe:

```tsx
expect(screen.queryByRole('button', { name: /editar precio/i })).not.toBeInTheDocument()
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`

Expected: FAIL porque el detalle no presenta la acción ni el modal.

- [ ] **Step 3: Integrar el modal en `RepairDetailDialog`**

Agregar estado local `isQuickPriceOpen`, colocar un botón `Editar precio` junto a `Resumen de Costos` solo cuando `repair.status !== 'cancelado' && onQuickPriceSave`, y renderizar:

```tsx
<RepairQuickPriceDialog
  open={isQuickPriceOpen}
  repair={repair}
  onOpenChange={setIsQuickPriceOpen}
  onSave={(update) => onQuickPriceSave(repair, update)}
/>
```

No cerrar `RepairDetailDialog` al abrir el modal secundario.

- [ ] **Step 4: Conectar `page.tsx` con `updateRepair`**

Pasar la función:

```tsx
onQuickPriceSave={async (repair, update) => {
  const updated = await updateRepair(repair.id, update)
  return Boolean(updated)
}}
```

La colección actualizada por el contexto debe alimentar `activeDetailRepair` mediante el `find` ya existente; no agregar una segunda fuente de estado.

- [ ] **Step 5: Ejecutar las pruebas enfocadas**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairQuickPriceDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`

Expected: PASS.

- [ ] **Step 6: Guardar el incremento integrado**

```bash
git add src/components/dashboard/repairs/RepairDetailDialog.tsx src/app/dashboard/repairs/page.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx
git commit -m "feat: edit repair price from detail"
```

---

### Task 3: Verificación final y control de regresiones

**Files:**
- Verify only: archivos modificados en Tasks 1 y 2.

**Interfaces:**
- Consumes: el recorrido completo detalle -> modal -> `updateRepair` -> PATCH existente -> reparación actualizada.
- Produces: evidencia de pruebas, tipos, lint y limpieza del diff.

- [ ] **Step 1: Ejecutar suite financiera enfocada de reparaciones**

Run: `npm test -- --run src/components/dashboard/repairs/__tests__/RepairQuickPriceDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx src/lib/repairs/pricing.test.ts src/lib/repairs/pricing-write.test.ts`

Expected: PASS.

- [ ] **Step 2: Ejecutar TypeScript**

Run: `npm run typecheck`

Expected: exit code 0; si existe un bloqueo de línea base ajeno, documentar archivo y diagnóstico exactos sin modificarlo.

- [ ] **Step 3: Ejecutar ESLint enfocado**

Run: `npx eslint src/components/dashboard/repairs/RepairQuickPriceDialog.tsx src/components/dashboard/repairs/__tests__/RepairQuickPriceDialog.test.tsx src/components/dashboard/repairs/RepairDetailDialog.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx src/app/dashboard/repairs/page.tsx`

Expected: exit code 0.

- [ ] **Step 4: Revisar el diff y espacios**

Run: `git diff --check HEAD~2..HEAD`

Expected: sin salida.

Run: `git status --short`

Expected: solo permanecen los cambios locales ajenos que ya estaban presentes antes de esta implementación.

- [ ] **Step 5: Verificar en navegador si dev está disponible**

Abrir `/dashboard/repairs`, entrar al detalle de una reparación no cancelada, abrir `Costos y Piezas`, cambiar a presupuesto y guardar un precio válido. Confirmar visualmente que el nuevo precio y saldo aparecen sin recargar y que no hay errores de consola o red. No modificar datos remotos si no existe una reparación segura de prueba.

