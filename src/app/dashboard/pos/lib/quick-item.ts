export type QuickItemInput = {
  name: string
  price: string
  quantity: string
  sku: string
  publishToCatalog: boolean
  /** Precio de compra. Vacio = 0 (sin costo cargado). */
  purchasePrice?: string
  /** Precio mayorista. Vacio = no se envia y el producto queda sin mayorista. */
  wholesalePrice?: string
}

export type QuickItemApiError = {
  error?: string
  details?: Array<{ field?: string; message?: string }>
}

/** Convierte un campo opcional de precio a numero. Vacio o solo espacios = null. */
function parseOptionalPrice(value: string | undefined, label: string): number | null {
  if (value === undefined) return null
  const trimmed = value.trim()
  if (trimmed === '') return null

  const amount = Number(trimmed)
  if (!Number.isFinite(amount)) {
    throw new Error(`El ${label} debe ser un numero valido.`)
  }
  if (amount < 0) {
    throw new Error(`El ${label} no puede ser negativo.`)
  }
  return amount
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

  const purchasePrice = parseOptionalPrice(input.purchasePrice, 'precio de compra') ?? 0
  const wholesalePrice = parseOptionalPrice(input.wholesalePrice, 'precio mayorista')

  // Las mismas reglas cruzadas que aplica la API al validar el producto. Se
  // repiten aca para avisar en el momento, en vez de esperar el rechazo del
  // servidor con el error puesto en un campo que el dialogo no muestra.
  if (purchasePrice > 0 && salePrice <= purchasePrice) {
    throw new Error('El precio de venta debe ser mayor al precio de compra.')
  }
  if (wholesalePrice !== null && wholesalePrice > 0) {
    if (wholesalePrice >= salePrice) {
      throw new Error('El precio mayorista debe ser menor al precio de venta.')
    }
    if (wholesalePrice <= purchasePrice) {
      throw new Error('El precio mayorista debe ser mayor al precio de compra.')
    }
  }

  return {
    name,
    sku,
    description: 'Item rapido creado desde POS',
    purchase_price: purchasePrice,
    sale_price: salePrice,
    // Se omite cuando no se cargo, para dejar claro que no se especifico en
    // lugar de guardar un 0 que parece un mayorista real.
    ...(wholesalePrice !== null ? { wholesale_price: wholesalePrice } : {}),
    stock_quantity: stockQuantity,
    min_stock: 0,
    unit_measure: 'unidad',
    is_active: true,
    visibility: input.publishToCatalog ? 'public' as const : 'hidden' as const,
  }
}

/** Margen sobre el costo, para mostrarlo mientras se carga el item. */
export function getQuickItemMargin(purchasePrice: number, salePrice: number) {
  if (!Number.isFinite(purchasePrice) || !Number.isFinite(salePrice)) return null
  if (purchasePrice <= 0 || salePrice <= 0) return null

  const profit = salePrice - purchasePrice
  return {
    profit,
    percent: Number(((profit / purchasePrice) * 100).toFixed(1)),
  }
}

export function getQuickItemApiError(payload: QuickItemApiError | null) {
  const detail = payload?.details?.find((item) => item.message)
  if (detail?.message) {
    return detail.field ? `${detail.field}: ${detail.message}` : detail.message
  }
  return payload?.error || 'No se pudo crear el item rapido.'
}
