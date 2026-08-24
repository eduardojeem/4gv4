export type ProductModalTab = 'basic' | 'pricing' | 'inventory' | 'post-sale' | 'images'

const TAB_FIELDS: Record<ProductModalTab, string[]> = {
  basic: ['sku', 'name', 'description', 'category_id', 'brand_id', 'brand', 'supplier_id', 'barcode', 'unit_measure', 'is_active', 'visibility'],
  pricing: ['purchase_price', 'sale_price', 'wholesale_price', 'offer_price', 'has_offer'],
  inventory: ['stock_quantity', 'min_stock', 'max_stock'],
  'post-sale': ['warranty_months', 'warranty_info', 'return_window_days', 'exchange_window_days', 'return_policy', 'exchange_policy'],
  images: ['images'],
}

export function getFirstProductErrorTab(errorFields: string[]): ProductModalTab | null {
  const tabs = Object.keys(TAB_FIELDS) as ProductModalTab[]
  return tabs.find(tab => errorFields.some(field => TAB_FIELDS[tab].includes(field))) ?? null
}

export function shouldConfirmProductModalClose({
  isDirty,
  isSubmitting,
  isUploadingImages = false,
}: {
  isDirty: boolean
  isSubmitting: boolean
  isUploadingImages?: boolean
}): 'blocked' | 'confirm' | 'close' {
  if (isSubmitting || isUploadingImages) return 'blocked'
  if (isDirty) return 'confirm'
  return 'close'
}

/**
 * Progreso de los campos obligatorios de un producto nuevo.
 *
 * Los 4 obligatorios estan repartidos en dos pestañas, y hasta ahora el usuario
 * solo se enteraba de que faltaba alguno despues de intentar guardar y ser
 * rebotado. Esto permite mostrarlo en vivo y llevarlo a la pestaña que falta.
 */

export type ProductRequirementKey = 'name' | 'sku' | 'category_id' | 'sale_price'

export type ProductRequirement = {
  key: ProductRequirementKey
  label: string
  tab: ProductModalTab
  done: boolean
}

export type ProductRequirementValues = {
  name?: string | null
  sku?: string | null
  category_id?: string | null
  sale_price?: number | string | null
}

/** Mismos minimos que exige productSchema, para no prometer algo distinto. */
function isTextComplete(value: unknown, minLength: number) {
  return typeof value === 'string' && value.trim().length >= minLength
}

function isPriceComplete(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0.01
}

export function getProductRequirements(values: ProductRequirementValues): ProductRequirement[] {
  return [
    { key: 'name', label: 'Nombre del producto', tab: 'basic', done: isTextComplete(values.name, 3) },
    { key: 'sku', label: 'SKU / Codigo', tab: 'basic', done: isTextComplete(values.sku, 3) },
    { key: 'category_id', label: 'Categoria', tab: 'basic', done: isTextComplete(values.category_id, 1) },
    { key: 'sale_price', label: 'Precio de venta', tab: 'pricing', done: isPriceComplete(values.sale_price) },
  ]
}

export function getProductRequirementsProgress(values: ProductRequirementValues) {
  const requirements = getProductRequirements(values)
  const completed = requirements.filter((requirement) => requirement.done).length

  return {
    requirements,
    completed,
    total: requirements.length,
    missing: requirements.filter((requirement) => !requirement.done),
    isComplete: completed === requirements.length,
  }
}
