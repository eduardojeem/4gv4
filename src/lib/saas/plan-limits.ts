/**
 * Límites de un plan: los números que el sistema hace cumplir (`plans.limits`)
 * y el texto que se muestra en la venta (`subscription_plans.limits`).
 *
 * El trigger `sync_subscription_plans_to_plans` extrae los dígitos del texto
 * comercial y los copia a `plans.limits`. El panel aceptaba texto libre sin
 * validar ("muchos" quedaba como sin límite) y no dejaba editar cajas ni fotos.
 * Ahora se valida el número y el texto se genera con un formato que el trigger
 * lee igual ("10.000", "300/mes", "Ilimitadas").
 */

export const PLAN_LIMIT_FIELDS = [
  { key: 'users', label: 'Usuarios', unlimited: true },
  { key: 'branches', label: 'Sucursales', unlimited: true },
  { key: 'cashRegisters', label: 'Cajas', unlimited: true },
  { key: 'products', label: 'Productos', unlimited: true },
  { key: 'repairs', label: 'Reparaciones por mes', unlimited: true },
  // Sin tope no tiene sentido: el formulario de fotos necesita un máximo.
  { key: 'repairPhotos', label: 'Fotos por reparación', unlimited: false },
] as const

export type PlanLimitKey = (typeof PLAN_LIMIT_FIELDS)[number]['key']

const MAX_REPAIR_PHOTOS = 20

/** Número, `null` (sin límite) o `undefined` (no es un valor válido). */
export function parsePlanLimit(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined
  if (typeof value !== 'string') return undefined
  const text = value.trim().toLowerCase()
  if (!text || /ilimitad|sin\s+l[ií]mite|∞/.test(text)) return null
  const digits = text.replace(/\/\s*mes$/, '').replace(/[\s.]/g, '')
  return /^\d+$/.test(digits) ? Number(digits) : undefined
}

export function formatPlanLimit(key: PlanLimitKey, value: number | null): string {
  if (value === null) return key === 'repairs' ? 'Ilimitadas' : 'Ilimitados'
  const number = value.toLocaleString('es-PY')
  return key === 'repairs' ? `${number}/mes` : number
}

export type NormalizedPlanLimits = {
  technical: Partial<Record<PlanLimitKey, number | null>>
  display: Partial<Record<PlanLimitKey, string>>
}

/** Valores iniciales del formulario para un plan nuevo. */
export function emptyLimits(): Record<PlanLimitKey, string> {
  return { users: '1', branches: '1', cashRegisters: '1', products: '100', repairs: '', repairPhotos: '0' }
}

/** Valores del formulario a partir de los límites guardados del plan. */
export function limitsFromPlan(limits: Record<string, unknown> | null | undefined): Record<PlanLimitKey, string> {
  const result = emptyLimits()
  for (const field of PLAN_LIMIT_FIELDS) {
    const value = limits?.[field.key]
    if (value === undefined) continue
    result[field.key] = value === null ? 'Ilimitado' : String(value)
  }
  return result
}

/** Valida los límites enviados por el panel. Solo procesa las claves presentes. */
export function normalizePlanLimits(input: Record<string, unknown>): NormalizedPlanLimits | { error: string } {
  const technical: NormalizedPlanLimits['technical'] = {}
  const display: NormalizedPlanLimits['display'] = {}

  for (const field of PLAN_LIMIT_FIELDS) {
    if (!(field.key in input)) continue
    const value = parsePlanLimit(input[field.key])
    if (value === undefined) {
      return { error: `${field.label}: escribí un número o "Ilimitado".` }
    }
    if (value === null && !field.unlimited) {
      return { error: `${field.label}: indicá un número (0 = no incluye).` }
    }
    if (field.key === 'repairPhotos' && value !== null && value > MAX_REPAIR_PHOTOS) {
      return { error: `${field.label}: el máximo es ${MAX_REPAIR_PHOTOS}.` }
    }
    technical[field.key] = value
    display[field.key] = formatPlanLimit(field.key, value)
  }

  return { technical, display }
}
