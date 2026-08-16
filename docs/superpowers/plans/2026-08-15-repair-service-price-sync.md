# Repair Service Price Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que el precio de un servicio seleccionado al crear una reparación alimente inmediatamente la calculadora y sea el mismo importe que se guarda.

**Architecture:** Extraer la decisión de cómo aplicar un servicio a una función pura y pequeña, y usarla desde el selector existente del formulario. El formulario seguirá siendo la fuente del estado mediante React Hook Form; `RepairCostCalculator` y la API conservarán sus contratos actuales.

**Tech Stack:** Next.js 16, React 19, TypeScript, React Hook Form, Vitest, Testing Library, Zod.

## Global Constraints

- Aplica únicamente al modal de nueva reparación con un solo equipo para la calculadora compartida.
- Con varios equipos, solo se actualiza el precio de referencia del equipo seleccionado.
- No se cambian permisos administrativos, descuentos, adelantos, inventario ni reglas del servidor.
- Un servicio sin repuestos se carga como mano de obra en modo `automatic`.
- Un servicio con repuestos se carga como total acordado en modo `budget`.
- El total visible y el valor enviado deben provenir del mismo estado del formulario.

---

### Task 1: Regla de aplicación del precio del servicio

**Files:**
- Create: `src/lib/repairs/service-pricing-selection.ts`
- Create: `src/lib/repairs/service-pricing-selection.test.ts`

**Interfaces:**
- Consumes: `price: number`, `includesParts: boolean`, `deviceCount: number`.
- Produces: `resolveServicePricingSelection(input): ServicePricingSelection`, donde el resultado indica si debe actualizarse la calculadora, el modo, la mano de obra, el total acordado y el mensaje visible.

- [ ] **Step 1: Escribir pruebas fallidas para los tres contratos**

```ts
import { describe, expect, it } from 'vitest'
import { resolveServicePricingSelection } from './service-pricing-selection'

describe('resolveServicePricingSelection', () => {
  it('carga un servicio sin repuestos como mano de obra automática', () => {
    expect(resolveServicePricingSelection({ price: 150000, includesParts: false, deviceCount: 1 })).toEqual({
      affectsCalculator: true,
      pricingMode: 'automatic',
      laborCost: 150000,
      finalCost: undefined,
      message: 'Se cargó como mano de obra y se actualizó el total.',
    })
  })

  it('carga un servicio con repuestos como total acordado', () => {
    expect(resolveServicePricingSelection({ price: 200000, includesParts: true, deviceCount: 1 })).toEqual({
      affectsCalculator: true,
      pricingMode: 'budget',
      laborCost: undefined,
      finalCost: 200000,
      message: 'Se cargó como total acordado. Si agregás un repuesto, el total no cambia.',
    })
  })

  it('no aplica un precio a la calculadora compartida cuando hay varios equipos', () => {
    expect(resolveServicePricingSelection({ price: 150000, includesParts: false, deviceCount: 2 })).toEqual({
      affectsCalculator: false,
      pricingMode: undefined,
      laborCost: undefined,
      finalCost: undefined,
      message: undefined,
    })
  })
})
```

- [ ] **Step 2: Ejecutar la prueba y comprobar RED**

Run: `cmd /c npx vitest run src/lib/repairs/service-pricing-selection.test.ts`

Expected: FAIL porque `service-pricing-selection.ts` todavía no existe.

- [ ] **Step 3: Implementar la función pura mínima**

```ts
import type { RepairPricingMode } from '@/lib/repairs/pricing'

export type ServicePricingSelection = {
  affectsCalculator: boolean
  pricingMode?: RepairPricingMode
  laborCost?: number
  finalCost?: number
  message?: string
}

export function resolveServicePricingSelection(input: {
  price: number
  includesParts: boolean
  deviceCount: number
}): ServicePricingSelection {
  if (input.deviceCount !== 1) return { affectsCalculator: false }

  if (input.includesParts) {
    return {
      affectsCalculator: true,
      pricingMode: 'budget',
      finalCost: input.price,
      message: 'Se cargó como total acordado. Si agregás un repuesto, el total no cambia.',
    }
  }

  return {
    affectsCalculator: true,
    pricingMode: 'automatic',
    laborCost: input.price,
    message: 'Se cargó como mano de obra y se actualizó el total.',
  }
}
```

- [ ] **Step 4: Ejecutar la prueba y comprobar GREEN**

Run: `cmd /c npx vitest run src/lib/repairs/service-pricing-selection.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 5: Crear el commit del contrato**

```bash
git add src/lib/repairs/service-pricing-selection.ts src/lib/repairs/service-pricing-selection.test.ts
git commit -m "test(repairs): define service pricing selection contract"
```

### Task 2: Conectar el selector de servicios con la calculadora

**Files:**
- Modify: `src/components/dashboard/repair-form-dialog-v2.tsx:1207-1280`
- Modify: `src/test/dashboard-financial-workflows.test.ts:231`

**Interfaces:**
- Consumes: `resolveServicePricingSelection` de Task 1.
- Produces: selección de servicio sincronizada con `laborCost`, `finalCost`, `pricingMode` y `calculationMode` del formulario.

- [ ] **Step 1: Escribir un contrato fallido de integración del formulario**

Agregar en `src/test/dashboard-financial-workflows.test.ts`:

```ts
it('feeds a selected service price into the new-repair calculator', () => {
  const repairForm = readFileSync(resolve(workspace, 'src/components/dashboard/repair-form-dialog-v2.tsx'), 'utf8')

  expect(repairForm).toContain('resolveServicePricingSelection({')
  expect(repairForm).toContain('deviceCount: fields.length')
  expect(repairForm).toContain("setValue('laborCost', selection.laborCost")
  expect(repairForm).toContain("setValue('finalCost', selection.finalCost")
  expect(repairForm).toContain("setValue('pricingMode', selection.pricingMode")
  expect(repairForm).toContain('setCalculationMode(selection.pricingMode)')
})
```

- [ ] **Step 2: Ejecutar el contrato y comprobar RED**

Run: `cmd /c npx vitest run src/test/dashboard-financial-workflows.test.ts`

Expected: FAIL porque el formulario aún contiene la condición antigua basada en `calculationMode === 'manual'`.

- [ ] **Step 3: Reemplazar la condición antigua por la decisión centralizada**

Importar:

```ts
import { resolveServicePricingSelection } from '@/lib/repairs/service-pricing-selection'
```

Dentro del `onClick` del servicio, después de actualizar `devices.${index}.estimatedCost`, usar:

```ts
const selection = resolveServicePricingSelection({
  price,
  includesParts: serviceIncludesParts,
  deviceCount: fields.length,
})

if (selection.affectsCalculator && selection.pricingMode) {
  setCalculationMode(selection.pricingMode)
  setValue('pricingMode', selection.pricingMode, { shouldDirty: true })

  if (selection.laborCost !== undefined) {
    setValue('laborCost', selection.laborCost, { shouldDirty: true, shouldValidate: true })
  }
  if (selection.finalCost !== undefined) {
    setValue('finalCost', selection.finalCost, { shouldDirty: true, shouldValidate: true })
  }
}

const calculatorNote = selection.message || null
```

Eliminar las ramas anteriores `serviceIncludesParts` y `calculationMode === 'manual'` para que no existan dos reglas de sincronización.

- [ ] **Step 4: Aclarar el campo de referencia del equipo**

Cambiar la etiqueta visible `Costo Estimado` por `Precio de referencia del servicio` y añadir debajo:

```tsx
<p className="text-[11px] text-muted-foreground">
  Al elegir un servicio, este valor también actualiza la calculadora cuando hay un solo equipo.
</p>
```

- [ ] **Step 5: Ejecutar pruebas enfocadas y comprobar GREEN**

Run: `cmd /c npx vitest run src/lib/repairs/service-pricing-selection.test.ts src/test/dashboard-financial-workflows.test.ts src/components/dashboard/repairs/__tests__/RepairCostCalculator.test.tsx`

Expected: todos los archivos PASS.

- [ ] **Step 6: Crear el commit de integración**

```bash
git add src/components/dashboard/repair-form-dialog-v2.tsx src/test/dashboard-financial-workflows.test.ts
git commit -m "fix(repairs): sync selected service with repair total"
```

### Task 3: Verificación final y control de alcance

**Files:**
- Verify only: archivos modificados en Tasks 1 y 2.

**Interfaces:**
- Consumes: implementación completa.
- Produces: evidencia de tipos, lint, pruebas y diff limpio.

- [ ] **Step 1: Ejecutar TypeScript**

Run: `cmd /c npm run typecheck`

Expected: exit code 0.

- [ ] **Step 2: Ejecutar ESLint enfocado**

Run: `cmd /c npx eslint src/lib/repairs/service-pricing-selection.ts src/lib/repairs/service-pricing-selection.test.ts src/components/dashboard/repair-form-dialog-v2.tsx src/test/dashboard-financial-workflows.test.ts`

Expected: exit code 0.

- [ ] **Step 3: Revisar espacios y alcance**

Run: `git diff --check`

Expected para los archivos de esta tarea: sin errores. Si aparecen errores en archivos ajenos ya modificados, informarlos sin alterarlos.

Run: `git status --short`

Expected: los cambios ajenos existentes permanecen sin incluir en los commits de esta tarea.

- [ ] **Step 4: Revisar el historial de los commits de la tarea**

Run: `git log --oneline -5`

Expected: aparecen los commits documental, contrato e integración sin mezclar finanzas, clientes, POS u otros módulos.
