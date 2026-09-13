/**
 * Garantía de reparaciones: límites, textos y reglas en un solo lugar.
 *
 * La misma garantía se configuraba en cuatro pantallas —el formulario de nueva
 * reparación, su subdiálogo, Ajustes del taller y el comprobante— y cada una
 * tenía su lista de meses, sus etiquetas y sus cláusulas:
 *
 * - Ajustes permitía cualquier valor de 0 a 36; el formulario solo ofrecía
 *   algunos, así que con 2 o 9 meses el selector quedaba en blanco.
 * - La nota del taller admitía 1000 caracteres y el formulario validaba 500:
 *   una nota larga bloqueaba el alta de reparaciones.
 * - «Completa», «Total y repuestos» y «Mano de obra + Repuestos» nombraban lo
 *   mismo, y las cláusulas repetidas con redacción apenas distinta no se
 *   detectaban como duplicadas.
 */

export type WarrantyType = 'labor' | 'parts' | 'full'

export const WARRANTY_MONTHS_MIN = 0
export const WARRANTY_MONTHS_MAX = 36
/** Igual al tope de la API de reparaciones; la columna es TEXT. */
export const WARRANTY_NOTES_MAX = 1000

export const WARRANTY_TYPES: WarrantyType[] = ['full', 'labor', 'parts']

/** Para elegir en pantalla. */
export const WARRANTY_TYPE_LABELS: Record<WarrantyType, string> = {
  full: 'Completa (mano de obra y repuestos)',
  labor: 'Solo mano de obra',
  parts: 'Solo repuestos',
}

/** Lo que cubre, dicho corto, para el comprobante impreso. */
export const WARRANTY_TYPE_PRINT_LABELS: Record<WarrantyType, string> = {
  full: 'mano de obra y repuestos',
  labor: 'solo mano de obra',
  parts: 'solo repuestos',
}

export const WARRANTY_TYPE_HINTS: Record<WarrantyType, string> = {
  full: 'Cubre el trabajo y las piezas instaladas',
  labor: 'Cubre el trabajo realizado',
  parts: 'Cubre las piezas instaladas',
}

/** Duraciones ofrecidas en los selectores. */
export const WARRANTY_MONTH_PRESETS = [0, 1, 3, 6, 12, 24, 36] as const

/** Atajos de un clic en el formulario: los más usados. */
export const WARRANTY_QUICK_MONTHS = [0, 1, 3, 6, 12] as const

export const WARRANTY_CLAUSES = [
  'Aplica únicamente a la pieza sustituida.',
  'No cubre daños por humedad, agua o líquidos.',
  'No cubre caídas, golpes o fracturas de pantalla posteriores a la entrega.',
  'La garantía de batería está sujeta a ciclos normales de carga.',
  'Conserve este comprobante para cualquier reclamo.',
] as const

export function isWarrantyType(value: unknown): value is WarrantyType {
  return value === 'labor' || value === 'parts' || value === 'full'
}

/** Lleva cualquier entrada a un entero de 0 a 36. */
export function clampWarrantyMonths(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(WARRANTY_MONTHS_MAX, Math.max(WARRANTY_MONTHS_MIN, Math.trunc(parsed)))
}

/** «Sin garantía», «1 mes», «6 meses», «1 año», «2 años», «18 meses». */
export function formatWarrantyMonths(months: number): string {
  if (months <= 0) return 'Sin garantía'
  if (months === 1) return '1 mes'
  if (months % 12 === 0) {
    const years = months / 12
    return years === 1 ? '1 año' : `${years} años`
  }
  return `${months} meses`
}

/**
 * Opciones para un selector de duración. Incluye el valor actual aunque no sea
 * uno de los habituales: sin eso, un taller con 2 meses veía el selector vacío.
 */
export function warrantyMonthOptions(current?: number | null): number[] {
  const options = new Set<number>(WARRANTY_MONTH_PRESETS)
  if (typeof current === 'number' && Number.isFinite(current)) options.add(clampWarrantyMonths(current))
  return [...options].sort((a, b) => a - b)
}

function normalizeClause(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/^[\s•\-*]+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Si una cláusula ya está en el texto, aunque cambien viñetas, tildes o puntuación. */
export function hasClause(notes: string, clause: string): boolean {
  const target = normalizeClause(clause)
  if (!target) return true
  return notes
    .split(/\n|(?<=\.)\s+/)
    .some((line) => normalizeClause(line) === target)
}

/** Agrega una cláusula como viñeta, sin repetirla y sin pasar el tope. */
export function appendClause(notes: string, clause: string): string {
  const current = notes ?? ''
  if (hasClause(current, clause)) return current
  const next = current.trim() ? `${current.trimEnd()}\n• ${clause}` : `• ${clause}`
  return next.length > WARRANTY_NOTES_MAX ? current : next
}

export type ResolvedWarranty = {
  months: number
  type: WarrantyType
  notes: string
  /** true si la orden no traía garantía propia y se usó la del taller. */
  fromDefault: boolean
}

/**
 * La garantía que corresponde imprimir para una orden.
 *
 * Una orden con garantía propia manda, aunque sea 0: «sin garantía» es una
 * decisión, no un dato faltante. Antes `0 || predeterminada` convertía las
 * órdenes del modo rápido en «3 meses» impresos y firmados. La garantía del
 * taller solo se usa cuando la orden no dice nada.
 */
export function resolveWarranty(
  order: { warrantyMonths?: number | null; warrantyType?: string | null; warrantyNotes?: string | null },
  defaults: { defaultWarrantyMonths: number; defaultWarrantyType: WarrantyType; defaultWarrantyNotes: string }
): ResolvedWarranty {
  const hasOwn = typeof order.warrantyMonths === 'number' && Number.isFinite(order.warrantyMonths)
  if (!hasOwn) {
    return {
      months: clampWarrantyMonths(defaults.defaultWarrantyMonths),
      type: defaults.defaultWarrantyType,
      notes: defaults.defaultWarrantyNotes ?? '',
      fromDefault: true,
    }
  }

  const months = clampWarrantyMonths(order.warrantyMonths)
  return {
    months,
    type: isWarrantyType(order.warrantyType) ? order.warrantyType : defaults.defaultWarrantyType,
    notes: months > 0 ? (order.warrantyNotes ?? '') : '',
    fromDefault: false,
  }
}
