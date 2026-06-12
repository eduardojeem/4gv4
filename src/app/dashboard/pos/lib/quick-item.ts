export type QuickItemInput = {
  name: string
  price: string
  quantity: string
  sku: string
  publishToCatalog: boolean
}

export type QuickItemApiError = {
  error?: string
  details?: Array<{ field?: string; message?: string }>
}

export function buildQuickItemPayload(input: QuickItemInput) {
  const name = input.name.trim()
  const salePrice = Number(input.price)
  const stockQuantity = Number(input.quantity)
  const sku = input.sku.trim().toUpperCase() || `QK-${Date.now().toString().slice(-8)}`

  if (name.length < 2) {
    throw new Error('El nombre debe tener al menos 2 caracteres.')
  }
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error('El precio debe ser mayor a cero.')
  }
  if (!Number.isInteger(stockQuantity) || stockQuantity < 1) {
    throw new Error('La cantidad debe ser un numero entero mayor a cero.')
  }

  return {
    name,
    sku,
    description: 'Item rapido creado desde POS',
    purchase_price: 0,
    sale_price: salePrice,
    stock_quantity: stockQuantity,
    min_stock: 0,
    unit_measure: 'unidad',
    is_active: true,
    visibility: input.publishToCatalog ? 'public' as const : 'hidden' as const,
  }
}

export function getQuickItemApiError(payload: QuickItemApiError | null) {
  const detail = payload?.details?.find((item) => item.message)
  if (detail?.message) {
    return detail.field ? `${detail.field}: ${detail.message}` : detail.message
  }
  return payload?.error || 'No se pudo crear el item rapido.'
}
