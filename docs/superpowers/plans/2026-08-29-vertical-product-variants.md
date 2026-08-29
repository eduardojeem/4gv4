# Vertical-Aware Product Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir productos simples o con variantes completas, sugeridas por el rubro de la organización e integradas de extremo a extremo con sucursales, inventario, POS, devoluciones, comprobantes y auditoría.

**Architecture:** Se ampliará el sistema existente de `product_variants` mediante una migración aditiva y contratos tenant-aware. El producto principal seguirá siendo compatible con el flujo simple; cuando `has_variants` sea verdadero, las combinaciones serán las unidades vendibles y su stock se resolverá por sucursal mediante operaciones SQL atómicas. La UI resolverá sugerencias desde `business_vertical`, pero persistirá la selección en cada producto para no cambiar productos históricos al modificar el rubro.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, React Hook Form, Supabase/PostgreSQL/RLS, Vitest y Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-29-vertical-product-variants-design.md`

## Global Constraints

- No borrar ni redistribuir automáticamente stock, precios o datos históricos de productos existentes.
- `business_vertical` recomienda campos; nunca restringe atributos personalizados.
- Productos simples deben conservar el flujo actual sin selector adicional.
- Organización, plan, módulo, permisos y sucursal son controles independientes.
- Toda mutación de stock debe ser atómica, idempotente y auditable.
- SKU y código de barras son únicos dentro de una organización, no globalmente.
- Una variante con movimientos o ventas se desactiva; no se elimina físicamente desde la interfaz.
- Lotes, vencimientos, números de serie e IMEI quedan fuera de esta entrega y no se modelan como variantes comerciales.
- No aplicar migraciones remotas ni hacer push sin autorización explícita del usuario.
- Preservar los cambios ajenos actualmente presentes en el worktree.

## File Map

- `supabase/migrations/20260830000000_vertical_product_variants.sql`: esquema aditivo, backfill, RLS, RPC de catálogo y stock.
- `src/lib/products/variant-contract.ts`: tipos Zod y normalización compartida entre UI y API.
- `src/lib/products/vertical-attributes.ts`: sugerencias puras por rubro.
- `src/lib/products/variant-combinations.ts`: generación cartesiana y conservación de valores editados.
- `src/app/api/products/route.ts`: creación/edición transaccional con variantes.
- `src/app/api/variants/route.ts` y `src/app/api/variants/[id]/route.ts`: contratos tenant-aware normalizados.
- `src/components/dashboard/products/ProductVariantsEditor.tsx`: editor responsivo de atributos y combinaciones.
- `src/components/dashboard/product-modal.tsx`: integración del editor y resumen previo.
- `src/app/dashboard/pos/lib/cart-variant.ts`: resolución de variante para el carrito.
- `src/app/dashboard/pos/components/ProductVariantPicker.tsx`: selector obligatorio en POS.
- `src/app/dashboard/pos/contexts/CheckoutContext.tsx`: persistencia de `variant_id` en líneas de venta.
- `src/app/api/pos/process-sale/route.ts`: validación y descuento atómico durante la venta POS.
- `src/app/api/sales/[id]/cancel/route.ts`: endpoint nuevo para restitución idempotente al anular.
- `src/app/api/after-sales/[id]/route.ts` y `src/lib/after-sales/resolution.ts`: restitución de variante en devoluciones.
- `src/components/dashboard/product-details-dialog-v2.tsx`: consulta de stock y variantes.
- `src/hooks/useProductsSupabase.ts`: carga y estadísticas agregadas.
- `src/lib/receipts/*`: presentación de variante en comprobantes existentes.
- `docs/operations/product-variants.md`: guía operativa.

---

### Task 1: Contract for vertical attribute recommendations

**Files:**
- Create: `src/lib/products/vertical-attributes.ts`
- Create: `src/lib/products/vertical-attributes.test.ts`

**Interfaces:**
- Consumes: `BusinessVertical` from `src/lib/organization/business-profile.ts`.
- Produces: `VariantAttributeSuggestion`, `getVerticalAttributeSuggestions(vertical)` and `getVerticalProductCopy(vertical)`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { getVerticalAttributeSuggestions } from './vertical-attributes'

describe('vertical product attribute suggestions', () => {
  it('suggests cosmetic attributes without forbidding custom fields', () => {
    const result = getVerticalAttributeSuggestions('cosmetics')
    expect(result.map(item => item.key)).toEqual(['line', 'tone', 'volume', 'skin_type', 'presentation'])
    expect(result.every(item => item.customizable)).toBe(true)
  })

  it('returns a safe generic profile for other', () => {
    expect(getVerticalAttributeSuggestions('other')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cmd /c npx vitest run src/lib/products/vertical-attributes.test.ts`

Expected: FAIL because `vertical-attributes.ts` does not exist.

- [ ] **Step 3: Implement the typed resolver**

```ts
export type VariantAttributeControl = 'text' | 'number' | 'select' | 'color'

export interface VariantAttributeSuggestion {
  key: string
  label: string
  control: VariantAttributeControl
  examples: string[]
  customizable: true
}

export function getVerticalAttributeSuggestions(
  vertical: BusinessVertical,
): VariantAttributeSuggestion[]
```

Implement exact ordered presets from the approved spec and return fresh arrays to prevent consumer mutation.

- [ ] **Step 4: Run tests and TypeScript**

Run: `cmd /c npx vitest run src/lib/products/vertical-attributes.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/lib/products/vertical-attributes.ts src/lib/products/vertical-attributes.test.ts
git commit -m "feat(products): add vertical attribute suggestions"
```

### Task 2: Canonical variant validation and combination engine

**Files:**
- Create: `src/lib/products/variant-contract.ts`
- Create: `src/lib/products/variant-contract.test.ts`
- Create: `src/lib/products/variant-combinations.ts`
- Create: `src/lib/products/variant-combinations.test.ts`

**Interfaces:**
- Consumes: suggestions from Task 1.
- Produces: `ProductAttributeDefinitionSchema`, `ProductVariantInputSchema`, `ProductVariantsPayloadSchema`, `generateVariantCombinations()` and `mergeGeneratedVariants()`.

- [ ] **Step 1: Write failing contract tests**

```ts
it('rejects duplicate combinations and negative stock', () => {
  const parsed = ProductVariantsPayloadSchema.safeParse({
    hasVariants: true,
    attributes: [{ key: 'color', label: 'Color', control: 'color', options: ['Negro'] }],
    variants: [
      { attributes: { color: 'Negro' }, sku: 'REM-N', salePrice: 90000, stockQuantity: -1 },
      { attributes: { color: 'Negro' }, sku: 'REM-N2', salePrice: 90000, stockQuantity: 1 },
    ],
  })
  expect(parsed.success).toBe(false)
})
```

```ts
it('preserves edited prices when combinations are regenerated', () => {
  const previous = [{ key: 'color=Negro|size=M', attributes: { color: 'Negro', size: 'M' }, salePrice: 95000 }]
  const generated = generateVariantCombinations([
    { key: 'color', options: ['Negro'] },
    { key: 'size', options: ['M', 'L'] },
  ])
  expect(mergeGeneratedVariants(generated, previous)[0].salePrice).toBe(95000)
})
```

- [ ] **Step 2: Verify RED**

Run: `cmd /c npx vitest run src/lib/products/variant-contract.test.ts src/lib/products/variant-combinations.test.ts`

Expected: FAIL for missing modules.

- [ ] **Step 3: Implement schemas and pure combinator**

Define the canonical input with these names:

```ts
type ProductVariantInput = {
  id?: string
  clientKey: string
  name: string
  attributes: Record<string, string>
  sku: string
  barcode?: string
  purchasePrice: number
  salePrice: number
  wholesalePrice?: number
  minStock: number
  stockQuantity: number
  isActive: boolean
}
```

Normalize attribute keys and values with `trim()`, compare combinations using sorted `key=value` pairs, and reject duplicate SKU/barcode values within the submitted payload before database access.

- [ ] **Step 4: Verify GREEN**

Run: `cmd /c npx vitest run src/lib/products/variant-contract.test.ts src/lib/products/variant-combinations.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/lib/products/variant-contract.ts src/lib/products/variant-contract.test.ts src/lib/products/variant-combinations.ts src/lib/products/variant-combinations.test.ts
git commit -m "feat(products): define variant contracts and combinations"
```

### Task 3: Additive tenant-aware database migration

**Files:**
- Create: `supabase/migrations/20260830000000_vertical_product_variants.sql`
- Create: `src/test/vertical-product-variants-migration.test.ts`
- Modify: `src/lib/supabase/types.ts` using the project type-generation workflow after local migration verification.

**Interfaces:**
- Consumes: canonical field semantics from Task 2.
- Produces: normalized `product_variants`, `product_variant_attributes`, `branch_variant_inventory`, `variant_inventory_movements`, RLS and RPCs `save_product_with_variants`, `adjust_variant_stock_atomic`, `restore_variant_stock_atomic`.

- [ ] **Step 1: Write the failing migration contract test**

```ts
it('adds tenant, branch stock, RLS and atomic variant operations', () => {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260830000000_vertical_product_variants.sql'), 'utf8')
  expect(sql).toContain('add column if not exists organization_id')
  expect(sql).toContain('create table if not exists public.branch_variant_inventory')
  expect(sql).toContain('create or replace function public.save_product_with_variants')
  expect(sql).toContain('create or replace function public.adjust_variant_stock_atomic')
  expect(sql).toContain('enable row level security')
})
```

- [ ] **Step 2: Verify RED**

Run: `cmd /c npx vitest run src/test/vertical-product-variants-migration.test.ts`

Expected: FAIL because migration is absent.

- [ ] **Step 3: Write the additive migration**

The migration must:

```sql
alter table public.products
  add column if not exists has_variants boolean not null default false,
  add column if not exists variant_attribute_config jsonb not null default '[]'::jsonb;

alter table public.product_variants
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists barcode text,
  add column if not exists purchase_price numeric(14,2) not null default 0,
  add column if not exists sale_price numeric(14,2),
  add column if not exists wholesale_price numeric(14,2),
  add column if not exists min_stock integer not null default 0;
```

Backfill `organization_id` from `products`, derive `sale_price` from base price plus legacy `price_adjustment`, retain `variant_name`, and add tenant-scoped partial unique indexes. Create branch inventory and immutable movement/audit rows. RLS must resolve membership through `organization_members`; do not retain the legacy `auth.role() = 'authenticated'` read policy.

Add nullable snapshot columns to `sale_items`: `variant_id`, `variant_name`, `variant_sku` and `variant_attributes jsonb`. Existing sale items remain null and continue to render as simple products.

The save RPC receives `p_product jsonb`, `p_variants jsonb`, `p_branch_id uuid`, `p_actor_id uuid`, validates ownership and locks affected rows. The stock RPC updates with `stock_quantity >= p_quantity`, inserts one movement keyed by a unique idempotency key, and raises `VARIANT_STOCK_INSUFFICIENT` on conflict.

- [ ] **Step 4: Verify migration locally without remote mutation**

Run focused SQL contract test first. If Supabase CLI is available, run the repository's local migration/reset command; otherwise inspect with the connected Supabase validation tooling without applying remotely and report `SUPABASE_CLI_NOT_FOUND` explicitly.

Run: `cmd /c npx vitest run src/test/vertical-product-variants-migration.test.ts`

Expected: PASS.

- [ ] **Step 5: Regenerate/check types and commit**

```powershell
git add -- supabase/migrations/20260830000000_vertical_product_variants.sql src/test/vertical-product-variants-migration.test.ts src/lib/supabase/types.ts
git commit -m "feat(database): harden tenant product variants"
```

Checkpoint: Do not apply the migration remotely. Ask the user before any remote database change.

### Task 4: Transactional product and variant APIs

**Files:**
- Modify: `src/lib/validation/schemas.ts`
- Modify: `src/lib/validations/product-schema.ts`
- Modify: `src/app/api/products/route.ts`
- Modify: `src/app/api/products/[id]/route.ts`
- Modify: `src/app/api/variants/route.ts`
- Modify: `src/app/api/variants/[id]/route.ts`
- Create: `src/app/api/products/product-variants-route.test.ts`

**Interfaces:**
- Consumes: `ProductVariantsPayloadSchema` and RPCs from Tasks 2-3.
- Produces: POST/PUT product responses containing `{ product, variants }` and tenant-safe variant endpoints.

- [ ] **Step 1: Write failing API tests**

Cover:

```ts
it('rejects a variant product without variants', async () => { /* expect 400 VALIDATION_FAILED */ })
it('passes organization and actor from auth to the save RPC, not from body', async () => { /* inspect rpc args */ })
it('returns 409 for tenant-scoped duplicate SKU', async () => { /* mock VARIANT_SKU_DUPLICATE */ })
it('does not expose purchasePrice without cost permission', async () => { /* expect omitted */ })
```

- [ ] **Step 2: Verify RED**

Run: `cmd /c npx vitest run src/app/api/products/product-variants-route.test.ts`

Expected: FAIL under the current non-transactional contract.

- [ ] **Step 3: Extend schemas and route payloads**

Add optional `has_variants`, `variant_attribute_config` and `variants` to product schemas, mapping snake_case at the API boundary and camelCase inside the shared contract. Call `save_product_with_variants` only after `withTenantAuth`, branch resolution, permission and plan checks. Translate stable SQL errors to:

```ts
const VARIANT_ERROR_STATUS = {
  VARIANT_SKU_DUPLICATE: 409,
  VARIANT_BARCODE_DUPLICATE: 409,
  VARIANT_STOCK_INSUFFICIENT: 409,
  VARIANT_BRANCH_FORBIDDEN: 403,
} as const
```

Normalize the existing `/api/variants` routes to use the same schemas, organization predicate, permissions and branch checks. Keep read compatibility for legacy consumers.

- [ ] **Step 4: Verify GREEN and related product contracts**

Run: `cmd /c npx vitest run src/app/api/products/product-variants-route.test.ts src/lib/validation/schemas.test.ts src/components/dashboard/product-modal-submit-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/lib/validation/schemas.ts src/lib/validations/product-schema.ts src/app/api/products/route.ts src/app/api/products/[id]/route.ts src/app/api/variants/route.ts src/app/api/variants/[id]/route.ts src/app/api/products/product-variants-route.test.ts
git commit -m "feat(products): save variants transactionally"
```

### Task 5: Responsive variants editor in the product modal

**Files:**
- Create: `src/components/dashboard/products/ProductVariantsEditor.tsx`
- Create: `src/components/dashboard/products/ProductVariantsEditor.test.tsx`
- Create: `src/components/dashboard/products/ProductVariantReview.tsx`
- Modify: `src/components/dashboard/product-modal.tsx`
- Modify: `src/components/dashboard/product-modal-behavior.ts`
- Modify: `src/components/dashboard/product-modal-behavior.test.ts`

**Interfaces:**
- Consumes: Tasks 1-2 and `businessVertical` from `SubscriptionStatusContext`.
- Produces: controlled editor props `{ value, onChange, basePrices, businessVertical, disabled }` and review summary.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it('shows cosmetic suggestions and generates tone-volume combinations', async () => {
  render(<ProductVariantsEditor businessVertical="cosmetics" value={emptyValue} onChange={onChange} basePrices={prices} />)
  expect(screen.getByText('Tono')).toBeInTheDocument()
  expect(screen.getByText('Volumen')).toBeInTheDocument()
  // choose two tones and two volumes, generate, expect four editable variants
})

it('keeps edited price when adding another option', async () => { /* edit first row, regenerate, assert preserved */ })
it('renders variant cards at the mobile presentation contract', () => { /* assert accessible headings/actions */ })
```

- [ ] **Step 2: Verify RED**

Run: `cmd /c npx vitest run src/components/dashboard/products/ProductVariantsEditor.test.tsx`

Expected: FAIL because component is absent.

- [ ] **Step 3: Implement focused UI components**

Build:

- simple/variants segmented choice;
- suggested-attribute chips plus “Agregar atributo”;
- option editor with duplicate prevention;
- explicit “Generar combinaciones” action;
- desktop editable table and mobile cards using the same form state;
- inline validation and a review summary with total variants and stock;
- confirmation when converting a stocked simple product.

Do not place combination logic inside JSX; call Task 2 pure functions. Do not auto-regenerate after every keystroke because it could overwrite edits.

- [ ] **Step 4: Integrate with `ProductModal`**

Add `variantConfig` defaults, hydrate existing variants on edit, include variants in `onSave`, route the first validation failure to the variants section, and preserve draft values after API rejection.

- [ ] **Step 5: Verify UI and type contracts**

Run: `cmd /c npx vitest run src/components/dashboard/products/ProductVariantsEditor.test.tsx src/components/dashboard/product-modal-behavior.test.ts src/components/dashboard/product-modal-submit-state.test.ts && npx eslint src/components/dashboard/products/ProductVariantsEditor.tsx src/components/dashboard/products/ProductVariantReview.tsx src/components/dashboard/product-modal.tsx && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- src/components/dashboard/products/ProductVariantsEditor.tsx src/components/dashboard/products/ProductVariantsEditor.test.tsx src/components/dashboard/products/ProductVariantReview.tsx src/components/dashboard/product-modal.tsx src/components/dashboard/product-modal-behavior.ts src/components/dashboard/product-modal-behavior.test.ts
git commit -m "feat(products): add responsive variant editor"
```

### Task 6: Variant-aware product listing and inventory details

**Files:**
- Modify: `src/hooks/useProductsSupabase.ts`
- Modify: `src/types/product-unified.ts`
- Modify: `src/components/dashboard/product-details-dialog-v2.tsx`
- Modify: `src/components/dashboard/products-modern/ProductCard.tsx`
- Modify: `src/components/dashboard/products-modern/ProductTable.tsx`
- Create: `src/components/dashboard/products/ProductVariantInventory.tsx`
- Create: `src/components/dashboard/products/ProductVariantInventory.test.tsx`

**Interfaces:**
- Consumes: variant API from Task 4 and branch stock from Task 3.
- Produces: product summaries with `hasVariants`, `variantCount`, `aggregateStock`, `priceRange` and expandable inventory details.

- [ ] **Step 1: Write failing presentation tests**

Test that a variant product displays “4 variantes”, a price range, aggregate branch stock and a low-stock warning naming the affected combination. Test that a simple product renders unchanged.

- [ ] **Step 2: Verify RED**

Run: `cmd /c npx vitest run src/components/dashboard/products/ProductVariantInventory.test.tsx`

- [ ] **Step 3: Extend product query summaries**

Return aggregate values without N+1 queries. Prefer a SQL view/RPC included in Task 3 or a batched relation select. Preserve cost stripping for unauthorized roles.

- [ ] **Step 4: Implement details and adjustments**

Allow searching by variant SKU/barcode and adjusting one variant at a time. Submit a unique idempotency key and branch ID to `adjust_variant_stock_atomic`; display previous and resulting stock.

- [ ] **Step 5: Verify**

Run: `cmd /c npx vitest run src/components/dashboard/products/ProductVariantInventory.test.tsx src/test/dashboard-products-loading-contract.test.ts && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```powershell
git add -- src/hooks/useProductsSupabase.ts src/types/product-unified.ts src/components/dashboard/product-details-dialog-v2.tsx src/components/dashboard/products-modern/ProductCard.tsx src/components/dashboard/products-modern/ProductTable.tsx src/components/dashboard/products/ProductVariantInventory.tsx src/components/dashboard/products/ProductVariantInventory.test.tsx
git commit -m "feat(inventory): show product variant stock"
```

### Task 7: POS variant selection and cart identity

**Files:**
- Create: `src/app/dashboard/pos/lib/cart-variant.ts`
- Create: `src/app/dashboard/pos/lib/__tests__/cart-variant.test.ts`
- Create: `src/app/dashboard/pos/components/ProductVariantPicker.tsx`
- Create: `src/app/dashboard/pos/components/__tests__/ProductVariantPicker.test.tsx`
- Modify: `src/app/dashboard/pos/types.ts`
- Modify: `src/app/dashboard/pos/components/ProductCard.tsx`
- Modify: `src/app/dashboard/pos/components/POSProductDetailDialog.tsx`
- Modify: `src/app/dashboard/pos/components/POSCart.tsx`
- Modify: `src/app/dashboard/pos/hooks/useOptimizedCart.ts`

**Interfaces:**
- Consumes: variant read contract from Tasks 4 and 6.
- Produces: `CartVariantSelection`, `buildVariantCartLine(product, variant, pricingMode)` and mandatory picker behavior.

- [ ] **Step 1: Write failing domain and component tests**

```ts
it('uses product plus variant as cart identity', () => {
  expect(getCartLineKey({ productId: 'p1', variantId: 'v1' })).toBe('p1:v1')
  expect(getCartLineKey({ productId: 'p1' })).toBe('p1')
})
```

Test that clicking a variant product opens the picker, unavailable combinations are disabled, wholesale mode selects `wholesalePrice`, and a simple product still enters the cart immediately.

- [ ] **Step 2: Verify RED**

Run: `cmd /c npx vitest run src/app/dashboard/pos/lib/__tests__/cart-variant.test.ts src/app/dashboard/pos/components/__tests__/ProductVariantPicker.test.tsx`

- [ ] **Step 3: Implement cart contract and picker**

Add optional `variant_id`, `variant_name`, `variant_attributes`, `variant_sku` and immutable selected price to cart lines. Quantity merges only when both product and variant IDs match. The picker must show branch stock and use accessible radio/select semantics.

- [ ] **Step 4: Verify POS regression suite**

Run: `cmd /c npx vitest run src/app/dashboard/pos/lib/__tests__/cart-variant.test.ts src/app/dashboard/pos/components/__tests__/ProductVariantPicker.test.tsx src/app/dashboard/pos/components/__tests__/ProductCard.credit.test.tsx src/app/dashboard/pos/components/__tests__/POSProductDetailDialog.credit.test.tsx && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```powershell
git add -- src/app/dashboard/pos/lib/cart-variant.ts src/app/dashboard/pos/lib/__tests__/cart-variant.test.ts src/app/dashboard/pos/components/ProductVariantPicker.tsx src/app/dashboard/pos/components/__tests__/ProductVariantPicker.test.tsx src/app/dashboard/pos/types.ts src/app/dashboard/pos/components/ProductCard.tsx src/app/dashboard/pos/components/POSProductDetailDialog.tsx src/app/dashboard/pos/components/POSCart.tsx src/app/dashboard/pos/hooks/useOptimizedCart.ts
git commit -m "feat(pos): select product variants in cart"
```

### Task 8: Atomic sale, cancellation and return stock flows

**Files:**
- Modify: `src/app/dashboard/pos/contexts/CheckoutContext.tsx`
- Modify: `src/app/dashboard/pos/hooks/useSaleProcessor.ts`
- Modify: `src/app/api/pos/process-sale/route.ts`
- Create: `src/app/api/sales/[id]/cancel/route.ts`
- Modify: `src/app/api/after-sales/[id]/route.ts`
- Modify: `src/lib/after-sales/resolution.ts`
- Create: `src/test/variant-sale-stock-flow.test.ts`

**Interfaces:**
- Consumes: cart lines from Task 7 and stock RPCs from Task 3.
- Produces: persisted `sale_items.variant_id` and idempotent sale/reversal movement keys.

- [ ] **Step 1: Write failing transaction tests**

Cover sale success, insufficient stock, two concurrent attempts for one unit, cancellation restoration, return restoration and repeated cancellation idempotency. Assert the simple-product path remains unchanged.

- [ ] **Step 2: Verify RED**

Run: `cmd /c npx vitest run src/test/variant-sale-stock-flow.test.ts`

- [ ] **Step 3: Persist variant identity and use atomic RPCs**

Add `variant_id` and snapshot fields to sale items through the Task 3 migration if not already present. Generate movement keys:

```ts
const saleKey = `sale:${saleId}:item:${saleItemId}`
const cancelKey = `sale-cancel:${saleId}:item:${saleItemId}`
const returnKey = `sale-return:${returnId}:item:${saleItemId}`
```

Never trust client stock. Reload and lock the selected variant in the transaction. Return HTTP 409 with `VARIANT_STOCK_INSUFFICIENT` and affected line metadata.

- [ ] **Step 4: Verify GREEN and checkout regressions**

Run: `cmd /c npx vitest run src/test/variant-sale-stock-flow.test.ts src/app/dashboard/pos/contexts/__tests__/CheckoutContext.credit-suggestion.test.tsx src/app/dashboard/pos/components/checkout/__tests__/SaleConfirmationDialog.test.tsx && npx tsc --noEmit`

- [ ] **Step 5: Commit**

Stage only the exact sale/return files identified during execution plus the test.

Commit: `git commit -m "feat(sales): move variant stock atomically"`

### Task 9: Receipts, history, reports and exports

**Files:**
- Modify: `src/lib/receipt-utils.ts`
- Modify: `src/components/pos/ReceiptGenerator.tsx`
- Modify: `src/lib/after-sales/sale-receipt.ts`
- Modify: `src/app/api/after-sales/sources/route.ts`
- Modify: `src/app/api/after-sales/sources/[id]/route.ts`
- Modify: `src/app/dashboard/pos/components/SaleDetailsModal.tsx`
- Modify: `src/app/dashboard/pos/components/checkout/SaleSummary.tsx`
- Modify: `src/lib/products-dashboard-utils.ts`
- Create: `src/test/variant-receipt-and-export.test.ts`

**Interfaces:**
- Consumes: sale item snapshot fields from Task 8.
- Produces: stable `formatVariantLabel(attributes)` shared by receipt, history and CSV.

- [ ] **Step 1: Locate active consumers and write failing tests**

The test must assert `Remera — Negro / M`, variant SKU and quantity in receipt/history, one CSV row per variant, and unchanged presentation for simple products.

- [ ] **Step 2: Verify RED**

Run: `cmd /c npx vitest run src/test/variant-receipt-and-export.test.ts`

- [ ] **Step 3: Implement snapshot-based formatting**

Render from sale-item snapshots rather than current variant data so renaming a variant does not alter historical receipts. CSV columns must include parent SKU, variant SKU, attributes, branch stock, cost (permission-gated), retail and wholesale prices.

- [ ] **Step 4: Verify**

Run: `cmd /c npx vitest run src/test/variant-receipt-and-export.test.ts src/app/dashboard/pos/components/checkout/__tests__/SaleSummary.mixed-credit.test.tsx && npx tsc --noEmit`

- [ ] **Step 5: Commit**

Commit staged receipt/history/export files with: `git commit -m "feat(reports): expose sold product variants"`.

### Task 10: Operational documentation, full review and rollout checkpoint

**Files:**
- Create: `docs/operations/product-variants.md`
- Modify: `docs/superpowers/plans/2026-08-29-vertical-product-variants.md` only to check completed boxes during execution.

**Interfaces:**
- Consumes: final UI and operational behavior.
- Produces: user guide and verified rollout/rollback checklist.

- [ ] **Step 1: Write the operations guide**

Document:

- choosing simple versus variant product;
- suggestions by rubro and custom attributes;
- generating combinations safely;
- initial stock assignment by branch;
- selecting variants in POS;
- adjusting stock and reading alerts;
- deactivating instead of deleting historical variants;
- known exclusion of lots, expiry, serials and IMEI;
- rollback by disabling the new UI without deleting data.

- [ ] **Step 2: Run focused verification**

Run all tests introduced by Tasks 1-9 plus existing product/POS suites directly with Vitest. Then run:

```powershell
cmd /c npx tsc --noEmit
cmd /c npx eslint <all changed TypeScript and TSX files>
git diff --check
```

Expected: zero focused test failures, TypeScript exit 0, ESLint exit 0 and no whitespace errors.

- [ ] **Step 3: Browser verification**

With a signed-in development organization for each representative vertical, verify at 320, 768, 1024 and 1440 px:

1. simple product creation;
2. cosmetics tone/volume combinations;
3. clothing color/size combinations;
4. branch stock display;
5. POS selection and sale confirmation;
6. cancellation/restoration;
7. receipt and sale history.

Record any limitation if browser access, accounts or local migration state prevent a scenario; do not claim it passed without evidence.

- [ ] **Step 4: Security and data review**

Confirm RLS blocks cross-organization variant reads/writes, branch IDs cannot be forged, costs remain hidden without permission, stock RPCs reject negative outcomes and every sale/reversal has one audit movement.

- [ ] **Step 5: Commit documentation**

```powershell
git add -- docs/operations/product-variants.md docs/superpowers/plans/2026-08-29-vertical-product-variants.md
git commit -m "docs(products): explain variant operations"
```

- [ ] **Step 6: Remote rollout checkpoint**

Stop and ask for explicit authorization before applying the migration, deploying or pushing. When authorized, take a schema backup, apply the migration in a maintenance window, run smoke checks, monitor stock conflicts and retain the additive rollback path.
