/**
 * Precios en otra moneda.
 *
 * Un producto puede tener su precio en USD (u otra moneda): el precio en la
 * moneda de la empresa lo calcula la base con el tipo de cambio vigente
 * (trigger `products_apply_foreign_prices`). Acá está la misma cuenta para
 * mostrarla mientras se carga, y el puente con la API.
 *
 * Como con `hide_price`, el código puede llegar antes que la migración: se
 * pregunta una vez si las columnas existen y, si no, se guarda el producto
 * como siempre, en moneda local.
 */

export const ROUNDING_OPTIONS = [
  { value: 1, label: 'Sin redondear' },
  { value: 100, label: 'A 100' },
  { value: 500, label: 'A 500' },
  { value: 1000, label: 'A 1.000' },
] as const

export interface ExchangeRate {
  currency: string
  rate: number
  rounding: number
  updated_at: string | null
}

export const FOREIGN_PRICE_FIELDS = ['price_currency', 'foreign_sale_price', 'foreign_wholesale_price', 'foreign_purchase_price'] as const

/** La misma cuenta que `convert_currency_amount` en la base. */
export function convertWithRounding(amount: number, rate: number, rounding = 1): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return 0
  const step = rounding > 0 ? rounding : 1
  return Math.round((amount * rate) / step) * step
}

/** El costo no se redondea a la góndola: se usa para el margen. */
export function convertCost(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return 0
  return Math.round(amount * rate * 100) / 100
}

type ClienteConProductos = {
  from: (tabla: string) => {
    select: (columnas: string) => {
      limit: (n: number) => PromiseLike<{ error: unknown }>
    }
  }
}

const REINTENTAR_EN_MS = 60_000
let recordado: { valor: boolean; hasta: number } | null = null

export async function productsHaveForeignPriceColumns(supabase: ClienteConProductos): Promise<boolean> {
  if (recordado && (recordado.valor || Date.now() < recordado.hasta)) return recordado.valor
  const { error } = await supabase.from('products').select('price_currency').limit(0)
  recordado = { valor: !error, hasta: Date.now() + REINTENTAR_EN_MS }
  return recordado.valor
}

/** Sólo para los tests. */
export function forgetForeignPriceColumnCheck() {
  recordado = null
}

type ForeignPriceInput = {
  price_currency?: string | null
  foreign_sale_price?: number | null
  foreign_wholesale_price?: number | null
  foreign_purchase_price?: number | null
}

/**
 * Los campos de moneda que van a la base. Sin moneda, se limpian los precios
 * extranjeros para que el producto vuelva a precio local.
 */
export function foreignPriceColumns(input: ForeignPriceInput, sent: (key: string) => boolean = () => true) {
  if (!FOREIGN_PRICE_FIELDS.some((key) => sent(key))) return {}
  const currency = input.price_currency?.trim().toUpperCase() || null
  if (sent('price_currency') && !currency) {
    return { price_currency: null, foreign_sale_price: null, foreign_wholesale_price: null, foreign_purchase_price: null }
  }
  // Solo lo que llegó: quien no ve el costo no lo manda, y no se le borra.
  const columns: Record<string, string | number | null> = {}
  if (sent('price_currency')) columns.price_currency = currency
  if (sent('foreign_sale_price')) columns.foreign_sale_price = input.foreign_sale_price ?? null
  if (sent('foreign_wholesale_price')) columns.foreign_wholesale_price = input.foreign_wholesale_price ?? null
  if (sent('foreign_purchase_price')) columns.foreign_purchase_price = input.foreign_purchase_price ?? null
  return columns
}

/** Traduce los errores del trigger a algo que la tienda entienda. */
export function foreignPriceErrorMessage(error: { message?: string } | null | undefined): string | null {
  const message = error?.message ?? ''
  const missing = message.match(/EXCHANGE_RATE_MISSING\|([A-Z]{3})/)
  if (missing) {
    return `No hay tipo de cambio cargado para ${missing[1]}. Cargalo en Configuración → Monedas antes de guardar precios en esa moneda.`
  }
  if (message.includes('FOREIGN_PRICE_REQUIRED')) {
    return 'Ingresá el precio de venta en la moneda elegida.'
  }
  return null
}

export const EXCHANGE_RATE_ERRORS: Record<string, string> = {
  EXCHANGE_RATE_FORBIDDEN: 'Solo el dueño o un administrador puede cambiar el tipo de cambio.',
  EXCHANGE_RATE_INVALID_CURRENCY: 'Elegí una moneda válida.',
  EXCHANGE_RATE_INVALID_RATE: 'El tipo de cambio tiene que ser mayor a cero.',
  EXCHANGE_RATE_LOCAL_CURRENCY: 'Esa es la moneda de tu empresa: no necesita tipo de cambio.',
  EXCHANGE_RATE_IN_USE: 'Hay productos con precio en esa moneda. Pasalos a otra moneda antes de borrarla.',
}

export function exchangeRateErrorMessage(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? ''
  const code = Object.keys(EXCHANGE_RATE_ERRORS).find((key) => message.includes(key))
  return code ? EXCHANGE_RATE_ERRORS[code] : 'No se pudo guardar el tipo de cambio.'
}
