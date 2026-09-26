# POS Product Credit Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar, filtrar y comparar productos financiables en el POS, y permitir que un plan precargue de forma segura las condiciones de crédito del ticket.

**Architecture:** La configuración existente de cuotas viajará desde la API de productos al tipo unificado mediante el mapper del POS. Una utilidad pura será la única fuente para normalizar planes y calcular cuota, interés y total; catálogo, ficha y checkout consumirán esa utilidad. El checkout conservará un único crédito por ticket y la persistencia atómica existente.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Radix/shadcn, Vitest, Testing Library, Supabase/PostgreSQL existente.

**Spec:** `docs/superpowers/specs/2026-08-21-pos-product-credit-discovery-design.md`

## Global Constraints

- No crear una ruta ni un catálogo paralelo.
- No agregar migraciones SQL: reutilizar `installments_enabled`, `installments_public` e `installments_plans`.
- Un plan válido tiene `count` entero entre 1 y 60 y `rate` entre 0 y 100.
- La frecuencia precargada será `monthly`.
- El plan elegido se aplica al saldo financiado de todo el ticket.
- La venta debe continuar por `/api/pos/process-sale` y su RPC atómico.
- Conservar idempotencia, alcance por organización/sucursal, stock, pagos mixtos y saldo a favor.
- No subir cambios al remoto.
- Preservar los cambios locales existentes en `CustomerSelection.tsx` y `store-credit-contract.test.ts`.

---

### Task 1: Contrato y cálculos de financiación por producto

**Files:**
- Create: `src/app/dashboard/pos/lib/product-credit.ts`
- Create: `src/app/dashboard/pos/lib/__tests__/product-credit.test.ts`
- Modify: `src/types/product-unified.ts`
- Modify: `src/app/dashboard/pos/lib/pos-product-mapper.ts`
- Test: `src/app/dashboard/pos/lib/__tests__/product-credit.test.ts`

**Interfaces:**
- Consumes: `buildCreditInstallmentPlan(input)` de `src/lib/credits/installments.ts`.
- Produces: `InstallmentPlanOption`, `ProductCreditPlan`, `hasProductCredit(product)`, `getProductCreditPlans(product, price)` y `getFeaturedProductCreditPlan(product, price)`.

- [ ] **Step 1: Escribir pruebas fallidas del contrato y cálculos**

```ts
import { describe, expect, it } from 'vitest'
import { getFeaturedProductCreditPlan, getProductCreditPlans, hasProductCredit } from '../product-credit'

const product = {
  installments_enabled: true,
  installments_plans: [
    { count: 6, rate: 0 },
    { count: 12, rate: 12 },
    { count: 0, rate: 10 },
  ],
}

it('normalizes valid plans and calculates totals from the effective price', () => {
  expect(getProductCreditPlans(product, 1_200_000)).toMatchObject([
    { count: 6, rate: 0, installmentAmount: 200_000, financedTotal: 1_200_000 },
    { count: 12, rate: 12, installmentAmount: 112_000, financedTotal: 1_344_000 },
  ])
})

it('selects the highest installment count and then the lowest rate', () => {
  expect(getFeaturedProductCreditPlan(product, 1_200_000)?.count).toBe(12)
})

it('rejects disabled products and invalid plans', () => {
  expect(hasProductCredit({ ...product, installments_enabled: false })).toBe(false)
  expect(getProductCreditPlans({ installments_enabled: true, installments_plans: [{ count: 61, rate: 0 }] }, 100_000)).toEqual([])
})
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npx vitest run src/app/dashboard/pos/lib/__tests__/product-credit.test.ts`

Expected: FAIL porque `product-credit.ts` todavía no existe.

- [ ] **Step 3: Ampliar el tipo y el mapper**

Agregar a `Product` y `PosProductRow`:

```ts
export interface InstallmentPlanOption {
  count: number
  rate: number
}

installments_enabled?: boolean | null
installments_public?: boolean | null
installments_plans?: InstallmentPlanOption[] | null
```

En `mapProductForPOS`, conservar booleanos y normalizar el JSON a una matriz candidata sin calcular importes.

- [ ] **Step 4: Implementar la utilidad pura**

```ts
export type ProductCreditPlan = {
  count: number
  rate: number
  frequency: 'monthly'
  installmentAmount: number
  interestAmount: number
  financedTotal: number
}

export function getProductCreditPlans(product: ProductCreditSource, price: number): ProductCreditPlan[]
export function hasProductCredit(product: ProductCreditSource): boolean
export function getFeaturedProductCreditPlan(product: ProductCreditSource, price: number): ProductCreditPlan | null
```

Filtrar límites, eliminar combinaciones duplicadas `count-rate`, ordenar por `count` ascendente y calcular con `buildCreditInstallmentPlan`.

- [ ] **Step 5: Ejecutar prueba, tipos y mapper contract**

Run: `npx vitest run src/app/dashboard/pos/lib/__tests__/product-credit.test.ts src/app/api/pos/process-sale/store-credit-contract.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Crear commit local del incremento**

```bash
git add src/types/product-unified.ts src/app/dashboard/pos/lib/pos-product-mapper.ts src/app/dashboard/pos/lib/product-credit.ts src/app/dashboard/pos/lib/__tests__/product-credit.test.ts
git commit -m "feat(pos): preserve product financing plans"
```

### Task 2: Filtro y ordenamiento financiero del catálogo

**Files:**
- Create: `src/app/dashboard/pos/lib/product-credit-filter.ts`
- Create: `src/app/dashboard/pos/lib/__tests__/product-credit-filter.test.ts`
- Modify: `src/app/dashboard/pos/page.tsx:651-954`
- Test: `src/app/dashboard/pos/lib/__tests__/product-credit-filter.test.ts`

**Interfaces:**
- Consumes: `hasProductCredit`, `getFeaturedProductCreditPlan` de Task 1.
- Produces: `ProductCreditSort = 'installment_low' | 'rate_low' | 'installments_high' | 'financed_total_low'` y `applyProductCreditFilter(products, options)`.

- [ ] **Step 1: Escribir pruebas fallidas de filtro combinado y orden**

```ts
it('keeps only financed products with at least the requested installments', () => {
  const result = applyProductCreditFilter(products, { creditOnly: true, minimumInstallments: 12, creditSort: null })
  expect(result.map(product => product.id)).toEqual(['credit-12'])
})

it('orders by lowest installment without mutating the input', () => {
  const original = [...products]
  const result = applyProductCreditFilter(products, { creditOnly: true, minimumInstallments: 1, creditSort: 'installment_low' })
  expect(result[0].id).toBe('lowest-installment')
  expect(products).toEqual(original)
})
```

- [ ] **Step 2: Ejecutar prueba y confirmar RED**

Run: `npx vitest run src/app/dashboard/pos/lib/__tests__/product-credit-filter.test.ts`

Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar la utilidad de filtrado**

La función recibirá productos ya filtrados por texto/categoría/stock y aplicará solamente reglas financieras. Usará el precio minorista del producto; la presentación mayorista calculará su importe efectivo en la tarjeta.

- [ ] **Step 4: Integrar estados en `page.tsx`**

Agregar:

```ts
const [creditOnly, setCreditOnly] = useState(false)
const [minimumInstallments, setMinimumInstallments] = useState(1)
const [creditSort, setCreditSort] = useState<ProductCreditSort | null>(null)
```

Incluirlos en contador, reset, paginación y preferencias. Validar valores restaurados contra listas permitidas antes de actualizar estado.

- [ ] **Step 5: Agregar controles accesibles**

Agregar el botón rápido `Con cuotas` con `aria-pressed`, contador de productos financiables, selector de cuota mínima y opciones de orden. Agregar chips removibles para `Con cuotas`, mínimo y orden financiero.

- [ ] **Step 6: Ejecutar pruebas y verificación estática**

Run: `npx vitest run src/app/dashboard/pos/lib/__tests__/product-credit-filter.test.ts && npx eslint src/app/dashboard/pos/page.tsx src/app/dashboard/pos/lib/product-credit-filter.ts && npm run typecheck`

Expected: PASS sin errores.

- [ ] **Step 7: Crear commit local del incremento**

```bash
git add src/app/dashboard/pos/page.tsx src/app/dashboard/pos/lib/product-credit-filter.ts src/app/dashboard/pos/lib/__tests__/product-credit-filter.test.ts
git commit -m "feat(pos): filter products by financing terms"
```

### Task 3: Señales de financiación en tarjetas

**Files:**
- Modify: `src/app/dashboard/pos/components/ProductCard.tsx`
- Create: `src/app/dashboard/pos/components/__tests__/ProductCard.credit.test.tsx`
- Test: `src/app/dashboard/pos/components/__tests__/ProductCard.credit.test.tsx`

**Interfaces:**
- Consumes: `getFeaturedProductCreditPlan(product, effectivePrice)` de Task 1.
- Produces: presentación `Hasta N cuotas`, `Desde X/mes`, `Sin interés` o `Tasa Y%` en grilla y lista.

- [ ] **Step 1: Escribir pruebas fallidas de tarjeta**

```tsx
it('shows financing summary for an enabled product', () => {
  render(<ProductCard product={financedProduct} addToCart={vi.fn()} formatCurrency={formatGs} />)
  expect(screen.getByText('Hasta 12 cuotas')).toBeInTheDocument()
  expect(screen.getByText(/Desde .*\/mes/)).toBeInTheDocument()
})

it('does not show financing copy for a cash-only product', () => {
  render(<ProductCard product={cashProduct} addToCart={vi.fn()} formatCurrency={formatGs} />)
  expect(screen.queryByText(/cuotas/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Ejecutar prueba y confirmar RED**

Run: `npx vitest run src/app/dashboard/pos/components/__tests__/ProductCard.credit.test.tsx`

- [ ] **Step 3: Implementar resumen compacto en ambas vistas**

Calcular el precio efectivo con la misma regla minorista/mayorista ya usada por la tarjeta. Añadir texto al `aria-label` del contenedor interactivo, sin cambiar la acción de clic que agrega al carrito.

- [ ] **Step 4: Ejecutar pruebas, lint y tipos**

Run: `npx vitest run src/app/dashboard/pos/components/__tests__/ProductCard.credit.test.tsx && npx eslint src/app/dashboard/pos/components/ProductCard.tsx && npm run typecheck`

- [ ] **Step 5: Crear commit local del incremento**

```bash
git add src/app/dashboard/pos/components/ProductCard.tsx src/app/dashboard/pos/components/__tests__/ProductCard.credit.test.tsx
git commit -m "feat(pos): show financing on product cards"
```

### Task 4: Ficha del producto, requisitos y selección de plan

**Files:**
- Create: `src/app/dashboard/pos/lib/credit-eligibility.ts`
- Create: `src/app/dashboard/pos/lib/__tests__/credit-eligibility.test.ts`
- Modify: `src/app/dashboard/pos/components/POSProductDetailDialog.tsx`
- Modify: `src/app/dashboard/pos/page.tsx:3533-3545`
- Test: `src/app/dashboard/pos/components/__tests__/POSProductDetailDialog.credit.test.tsx`

**Interfaces:**
- Consumes: `ProductCreditPlan` de Task 1, cliente activo, crédito disponible, caja abierta, stock y cantidad.
- Produces: `CreditEligibilityItem[]` y callback `onUseCreditPlan(product, quantity, plan)`.

- [ ] **Step 1: Escribir pruebas fallidas de elegibilidad**

```ts
expect(buildCreditEligibility({
  hasCustomer: true,
  hasCreditLine: true,
  availableCredit: 2_000_000,
  financedTotal: 1_500_000,
  stock: 2,
  quantity: 1,
  isRegisterOpen: true,
}).every(item => item.met)).toBe(true)

expect(buildCreditEligibility({
  hasCustomer: false,
  hasCreditLine: false,
  availableCredit: 0,
  financedTotal: 1_500_000,
  stock: 2,
  quantity: 1,
  isRegisterOpen: true,
}).find(item => item.id === 'customer')?.met).toBe(false)
```

- [ ] **Step 2: Ejecutar pruebas y confirmar RED**

Run: `npx vitest run src/app/dashboard/pos/lib/__tests__/credit-eligibility.test.ts src/app/dashboard/pos/components/__tests__/POSProductDetailDialog.credit.test.tsx`

- [ ] **Step 3: Implementar elegibilidad pura**

Definir IDs `customer`, `credit_line`, `credit_capacity`, `stock`, `register`; cada resultado incluirá `id`, `label`, `met` y `detail`.

- [ ] **Step 4: Extender props de la ficha**

```ts
type POSProductDetailDialogProps = {
  creditContext: {
    hasCustomer: boolean
    hasCreditLine: boolean
    availableCredit: number
    isRegisterOpen: boolean
  }
  onUseCreditPlan: (product: Product, quantity: number, plan: ProductCreditPlan) => void
}
```

- [ ] **Step 5: Renderizar planes y requisitos**

Mostrar todos los planes válidos con cuota, tasa, interés y total. `Usar este plan` permanecerá disponible cuando haya stock; los requisitos pendientes se explicarán y volverán a validarse en checkout. La acción agrega la cantidad, llama al callback y cierra la ficha.

- [ ] **Step 6: Conectar la ficha desde `page.tsx`**

Construir `creditContext` desde `activeCustomer`, `creditSummary` e `isRegisterOpen`. El callback agregará el producto respetando la función de carrito existente y enviará el plan al contexto en Task 5.

- [ ] **Step 7: Ejecutar pruebas y verificación estática**

Run: `npx vitest run src/app/dashboard/pos/lib/__tests__/credit-eligibility.test.ts src/app/dashboard/pos/components/__tests__/POSProductDetailDialog.credit.test.tsx && npx eslint src/app/dashboard/pos/components/POSProductDetailDialog.tsx src/app/dashboard/pos/lib/credit-eligibility.ts && npm run typecheck`

- [ ] **Step 8: Crear commit local del incremento**

```bash
git add src/app/dashboard/pos/components/POSProductDetailDialog.tsx src/app/dashboard/pos/components/__tests__/POSProductDetailDialog.credit.test.tsx src/app/dashboard/pos/lib/credit-eligibility.ts src/app/dashboard/pos/lib/__tests__/credit-eligibility.test.ts src/app/dashboard/pos/page.tsx
git commit -m "feat(pos): select product financing plans"
```

### Task 5: Sugerencia de producto en el contexto y checkout

**Files:**
- Modify: `src/app/dashboard/pos/contexts/CheckoutContext.tsx`
- Modify: `src/app/dashboard/pos/page.tsx`
- Modify: `src/app/dashboard/pos/components/checkout/CreditStatusPanel.tsx`
- Modify: `src/app/dashboard/pos/components/checkout/PaymentMethods.tsx`
- Create: `src/app/dashboard/pos/contexts/__tests__/CheckoutContext.credit-suggestion.test.tsx`
- Create: `src/app/api/pos/process-sale/product-credit-single-contract.test.ts`

**Interfaces:**
- Consumes: `ProductCreditPlan` y `onUseCreditPlan` de Task 4.
- Produces: `CreditPlanSuggestion` y `applyProductCreditSuggestion(suggestion)`.

- [ ] **Step 1: Escribir prueba fallida del contexto**

```tsx
type CreditPlanSuggestion = {
  productId: string
  productName: string
  count: number
  interestRate: number
  frequency: 'monthly'
}

it('prefills terms and records the product that suggested them', async () => {
  render(<CheckoutContextHarness />)
  await user.click(screen.getByRole('button', { name: 'Aplicar sugerencia' }))
  expect(screen.getByTestId('credit-terms')).toHaveTextContent('12|12|monthly')
  expect(screen.getByTestId('credit-source')).toHaveTextContent('Notebook')
})
```

- [ ] **Step 2: Ejecutar prueba y confirmar RED**

Run: `npx vitest run src/app/dashboard/pos/contexts/__tests__/CheckoutContext.credit-suggestion.test.tsx`

- [ ] **Step 3: Implementar sugerencia en contexto**

Agregar estado `creditPlanSuggestion`, setter, `applyProductCreditSuggestion` y limpieza durante `resetCheckout`. La aplicación actualizará `creditTerms` en una sola transición.

- [ ] **Step 4: Conectar selección desde la ficha**

En `page.tsx`, después de agregar exitosamente la cantidad, ejecutar:

```ts
applyProductCreditSuggestion({
  productId: product.id,
  productName: product.name,
  count: plan.count,
  interestRate: plan.rate,
  frequency: 'monthly',
})
```

- [ ] **Step 5: Mostrar origen y detectar edición manual**

`CreditStatusPanel` mostrará `Plan sugerido por {productName}` y `Estas condiciones se aplican al total financiado del ticket`. Si cuotas, tasa o frecuencia ya no coinciden, mostrará `Condiciones ajustadas manualmente`.

- [ ] **Step 6: Mantener el contrato atómico**

Crear una prueba contractual separada para confirmar que el payload continúa enviando un solo `p_credit` y que no se crean créditos por producto. No cambiar la ruta ni el RPC ni el archivo local previamente modificado `store-credit-contract.test.ts`.

- [ ] **Step 7: Ejecutar regresión financiera**

Run: `npx vitest run src/app/dashboard/pos/contexts/__tests__/CheckoutContext.credit-suggestion.test.tsx src/app/api/pos/process-sale/product-credit-single-contract.test.ts src/app/api/pos/process-sale/store-credit-contract.test.ts src/app/dashboard/pos/lib/__tests__/payment-validation.test.ts src/app/dashboard/pos/lib/__tests__/repair-charge.test.ts && npm run typecheck`

- [ ] **Step 8: Crear commit local del incremento**

```bash
git add src/app/dashboard/pos/contexts/CheckoutContext.tsx src/app/dashboard/pos/contexts/__tests__/CheckoutContext.credit-suggestion.test.tsx src/app/dashboard/pos/page.tsx src/app/dashboard/pos/components/checkout/CreditStatusPanel.tsx src/app/dashboard/pos/components/checkout/PaymentMethods.tsx src/app/api/pos/process-sale/product-credit-single-contract.test.ts
git commit -m "feat(pos): prefill checkout from product plans"
```

### Task 6: Guía operativa y verificación integral

**Files:**
- Modify: `src/components/dashboard/common/section-guides-data.ts`
- Create: `src/components/help/pos-credit-products-guide.test.ts`
- Test: todos los archivos de prueba creados en Tasks 1-5.

**Interfaces:**
- Consumes: textos y comportamiento final de Tasks 1-5.
- Produces: guía operativa consultable para personal de ventas.

- [ ] **Step 1: Escribir prueba fallida de documentación**

```ts
import { POS_GUIDE } from '@/components/dashboard/common/section-guides-data'

it('documents how product plans apply to a POS ticket', () => {
  const guideText = JSON.stringify(POS_GUIDE)
  expect(guideText).toContain('Con cuotas')
  expect(guideText).toContain('ticket completo')
  expect(guideText).toContain('línea de crédito')
})
```

- [ ] **Step 2: Ejecutar prueba y confirmar RED**

Run: `npx vitest run src/components/help/pos-credit-products-guide.test.ts`

- [ ] **Step 3: Agregar guía operativa**

Documentar identificación, filtros, comparación, `Usar este plan`, alcance sobre ticket completo y requisitos automáticos. Usar los nombres exactos visibles en la interfaz.

- [ ] **Step 4: Ejecutar suite enfocada completa**

Run: `npx vitest run src/app/dashboard/pos/lib/__tests__/product-credit.test.ts src/app/dashboard/pos/lib/__tests__/product-credit-filter.test.ts src/app/dashboard/pos/components/__tests__/ProductCard.credit.test.tsx src/app/dashboard/pos/lib/__tests__/credit-eligibility.test.ts src/app/dashboard/pos/components/__tests__/POSProductDetailDialog.credit.test.tsx src/app/dashboard/pos/contexts/__tests__/CheckoutContext.credit-suggestion.test.tsx src/app/api/pos/process-sale/product-credit-single-contract.test.ts src/app/api/pos/process-sale/store-credit-contract.test.ts src/app/dashboard/pos/lib/__tests__/payment-validation.test.ts src/app/dashboard/pos/lib/__tests__/repair-charge.test.ts src/components/help/pos-credit-products-guide.test.ts`

Expected: todos los archivos y casos PASS.

- [ ] **Step 5: Ejecutar controles estáticos**

Run: `npm run typecheck`

Run: `npx eslint src/app/dashboard/pos/page.tsx src/app/dashboard/pos/components/ProductCard.tsx src/app/dashboard/pos/components/POSProductDetailDialog.tsx src/app/dashboard/pos/components/checkout/CreditStatusPanel.tsx src/app/dashboard/pos/components/checkout/PaymentMethods.tsx src/app/dashboard/pos/contexts/CheckoutContext.tsx src/app/dashboard/pos/lib/product-credit.ts src/app/dashboard/pos/lib/product-credit-filter.ts src/app/dashboard/pos/lib/credit-eligibility.ts src/app/dashboard/pos/lib/pos-product-mapper.ts src/components/dashboard/common/section-guides-data.ts`

Run: `git diff --check`

Expected: exit code 0; documentar advertencias preexistentes separadamente.

- [ ] **Step 6: Verificar en navegador autenticado**

Comprobar 320, 768, 1024 y 1440 px: filtro, orden, tarjeta, ficha, teclado, selección de plan y checkout. Confirmar consola sin errores y que no se ejecuta una venta real durante la prueba visual.

- [ ] **Step 7: Revisar alcance Git**

Confirmar que los cambios locales previos de alta de cliente no fueron sobrescritos ni incluidos accidentalmente en commits de financiación. No ejecutar `git push`.

- [ ] **Step 8: Crear commit local de documentación y cierre**

```bash
git add src/components/dashboard/common/section-guides-data.ts src/components/help/pos-credit-products-guide.test.ts
git commit -m "docs(pos): explain product financing workflow"
```
