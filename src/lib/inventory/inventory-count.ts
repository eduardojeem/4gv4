/**
 * Toma de inventario física: cuentas puras que usan la API y la pantalla.
 *
 * La diferencia de cada producto se mide contra el stock que tenía el sistema
 * en el momento de contarlo (`system_qty_at_count`), no contra el de la
 * apertura: si entre la apertura y el conteo se vendieron dos unidades, esas
 * dos no son un faltante.
 */

export type CountStatus = 'counting' | 'applied' | 'cancelled'

export const COUNT_STATUS_LABELS: Record<CountStatus, string> = {
  counting: 'En curso',
  applied: 'Aplicada',
  cancelled: 'Anulada',
}

export type CountItem = {
  id: string
  product_id: string
  variant_id: string | null
  name: string
  sku: string | null
  barcode: string | null
  category_name: string | null
  unit_cost: number
  system_qty: number
  counted_qty: number | null
  system_qty_at_count: number | null
  counted_at: string | null
  applied_delta: number | null
}

/** Unidades de más (+) o de menos (−) contra el sistema. null = sin contar. */
export function countDifference(item: Pick<CountItem, 'counted_qty' | 'system_qty' | 'system_qty_at_count'>): number | null {
  if (item.counted_qty === null || item.counted_qty === undefined) return null
  return item.counted_qty - (item.system_qty_at_count ?? item.system_qty)
}

export function summarizeCount(items: CountItem[]) {
  let counted = 0
  let withDifference = 0
  let unitsIn = 0
  let unitsOut = 0
  let valueDifference = 0
  for (const item of items) {
    const diff = countDifference(item)
    if (diff === null) continue
    counted += 1
    if (diff === 0) continue
    withDifference += 1
    if (diff > 0) unitsIn += diff
    else unitsOut += -diff
    valueDifference += diff * Number(item.unit_cost || 0)
  }
  return {
    total: items.length,
    counted,
    notCounted: items.length - counted,
    withDifference,
    unitsIn,
    unitsOut,
    valueDifference: Math.round(valueDifference * 100) / 100,
    progress: items.length ? Math.round((counted / items.length) * 100) : 0,
  }
}

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

/** Busca por código de barras o SKU exacto (lo que lee un escáner). */
export function findByCode(items: CountItem[], code: string): CountItem | null {
  const wanted = normalize(code)
  if (!wanted) return null
  return items.find((item) => normalize(item.barcode) === wanted)
    ?? items.find((item) => normalize(item.sku) === wanted)
    ?? null
}

/**
 * «3*7791234» suma 3 unidades del código; sin multiplicador suma 1. Así se
 * cuentan las cajas cerradas sin escanear cada unidad.
 */
export function parseScan(input: string): { code: string; quantity: number } {
  const match = input.trim().match(/^(\d{1,5})\s*[*xX]\s*(.+)$/)
  if (match) return { quantity: Math.max(1, Number(match[1])), code: match[2].trim() }
  return { quantity: 1, code: input.trim() }
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function countToCsv(items: CountItem[]) {
  const header = ['Producto', 'SKU', 'Código de barras', 'Categoría', 'Sistema', 'Contado', 'Diferencia', 'Costo unitario', 'Diferencia valorizada']
  const rows = items.map((item) => {
    const diff = countDifference(item)
    return [
      item.name,
      item.sku,
      item.barcode,
      item.category_name,
      item.system_qty_at_count ?? item.system_qty,
      item.counted_qty,
      diff,
      item.unit_cost,
      diff === null ? null : Math.round(diff * Number(item.unit_cost || 0) * 100) / 100,
    ].map(csvCell).join(';')
  })
  return [header.join(';'), ...rows].join('\n')
}

export const COUNT_APPLY_ERRORS: Record<string, string> = {
  COUNT_NOT_FOUND: 'La toma de inventario no existe.',
  COUNT_FORBIDDEN: 'No tenés permiso para ajustar el stock de esta sucursal.',
  COUNT_NOT_OPEN: 'La toma ya se aplicó o se anuló.',
}

export function countErrorMessage(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message ?? ''
  const code = Object.keys(COUNT_APPLY_ERRORS).find((key) => message.includes(key))
  return code ? COUNT_APPLY_ERRORS[code] : fallback
}
