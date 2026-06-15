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
