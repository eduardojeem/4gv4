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

export type InventoryCountGuidanceKind =
  | 'unavailable'
  | 'read-only'
  | 'start'
  | 'count'
  | 'continue'
  | 'review'
  | 'closed'

export type InventoryCountGuidance = {
  kind: InventoryCountGuidanceKind
  title: string
  description: string
  actionLabel?: string
  countId?: string
  pending?: number
}

export function getInventoryCountListGuidance(input: {
  available: boolean
  canAdjust: boolean
  counts: Array<{ id: string; number: number; status: CountStatus }>
  progress: Record<string, { total: number; counted: number }>
}): InventoryCountGuidance {
  if (!input.available) return {
    kind: 'unavailable',
    title: 'Activación pendiente',
    description: 'La base de datos todavía no tiene habilitada la toma física de inventario.',
  }
  if (!input.canAdjust) return {
    kind: 'read-only',
    title: 'Consulta disponible',
    description: 'Podés revisar tomas anteriores. Para contar o ajustar stock necesitás permiso de gestión de inventario.',
  }

  const open = input.counts.find((count) => count.status === 'counting')
  if (!open) return {
    kind: 'start',
    title: 'Empezá una toma física',
    description: 'Elegí una sucursal y contá todo el inventario o una categoría específica.',
    actionLabel: 'Nueva toma',
  }

  const progress = input.progress[open.id]
  const pending = Math.max(0, (progress?.total ?? 0) - (progress?.counted ?? 0))
  if (progress?.total && pending === 0) return {
    kind: 'review',
    title: `La toma #${open.number} está lista para revisar`,
    description: 'Ya se contaron todos los productos. Revisá las diferencias antes de aplicar los ajustes.',
    actionLabel: 'Revisar toma',
    countId: open.id,
    pending: 0,
  }
  return {
    kind: 'continue',
    title: `Continuá la toma #${open.number}`,
    description: pending > 0 ? `Quedan ${pending} productos sin contar.` : 'La toma está abierta y lista para comenzar.',
    actionLabel: 'Continuar conteo',
    countId: open.id,
    pending,
  }
}

export function getInventoryCountDetailGuidance(input: {
  status: CountStatus
  canAdjust: boolean
  counted: number
  notCounted: number
  withDifference: number
}): InventoryCountGuidance {
  if (input.status !== 'counting') return {
    kind: 'closed',
    title: input.status === 'applied' ? 'Toma aplicada' : 'Toma anulada',
    description: input.status === 'applied'
      ? 'El stock ya fue ajustado y podés consultar o exportar el resultado.'
      : 'Esta toma quedó cerrada sin modificar el stock.',
  }
  if (!input.canAdjust) return {
    kind: 'read-only',
    title: 'Vista de consulta',
    description: 'Podés revisar el avance, pero necesitás permiso de gestión de inventario para contar o aplicar.',
  }
  if (input.counted === 0) return {
    kind: 'count',
    title: 'Empezá por el primer producto',
    description: 'Escaneá un código o cargá la cantidad física. Activá el conteo a ciegas para evitar copiar el número del sistema.',
    actionLabel: 'Ir a contar',
  }
  if (input.notCounted > 0) return {
    kind: 'continue',
    title: 'Continuá con los pendientes',
    description: `Todavía quedan ${input.notCounted} productos sin contar. Esos productos no se modificarán si aplicás ahora.`,
    actionLabel: 'Ver pendientes',
    pending: input.notCounted,
  }
  return {
    kind: 'review',
    title: input.withDifference > 0 ? 'Revisá las diferencias' : 'El conteo está completo',
    description: input.withDifference > 0
      ? `${input.withDifference} productos cambiarán de stock. Confirmá las cantidades antes de aplicar.`
      : 'Todo coincide con el sistema. Aplicá la toma para cerrarla y guardar el resultado.',
    actionLabel: 'Revisar y aplicar',
    pending: 0,
  }
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
