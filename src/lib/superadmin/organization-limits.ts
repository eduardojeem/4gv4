/**
 * Los topes del plan contra lo que la organizacion tiene hoy.
 *
 * La pestaña listaba seis renglones «usado / tope» en texto plano, en el orden
 * en que estaban escritos. Un catalogo al 99% del tope se leia igual que uno al
 * 2%, y no habia forma de saber cuanto espacio queda ni que pasa al llegar al
 * limite.
 */

export type LimitState =
  /** Ya llego o paso el tope. */
  | 'full'
  /** 80% o mas. */
  | 'near'
  | 'ok'
  /** El plan no pone tope a este recurso. */
  | 'unlimited'
  /** El plan no tiene ese limite cargado. */
  | 'undefined'
  /** Esta pantalla no cuenta ese recurso: un cero seria mentira. */
  | 'uncounted'

export interface LimitRowData {
  key: string
  label: string
  /** Que ocupa cupo exactamente. */
  hint: string
  used: number | null
  limit: number | null
  percent: number | null
  /** Cuanto falta para el tope. `null` sin tope o sin conteo. */
  remaining: number | null
  state: LimitState
  /** Que pasa al llegar al tope. */
  atCap?: string
}

const numeroFinito = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export interface LimitInput {
  key: string
  label: string
  hint: string
  used: number | null
  limit: unknown
  atCap?: string
}

export function buildLimitRow(input: LimitInput): LimitRowData {
  const limit = numeroFinito(input.limit)
  const base = {
    key: input.key,
    label: input.label,
    hint: input.hint,
    used: input.used,
    limit,
    atCap: input.atCap,
  }

  // Un recurso que esta pantalla no cuenta no puede reportarse como cero: eso
  // seria una afirmacion sobre la organizacion y no sobre la pantalla.
  if (input.used === null) {
    return { ...base, percent: null, remaining: null, state: 'uncounted' }
  }
  if (limit === null) {
    return { ...base, percent: null, remaining: null, state: 'undefined' }
  }
  if (limit <= 0) {
    return { ...base, percent: null, remaining: null, state: 'unlimited' }
  }

  const percent = Math.min(100, Math.round((input.used / limit) * 100))
  const remaining = Math.max(0, limit - input.used)
  const state: LimitState = input.used >= limit ? 'full' : percent >= 80 ? 'near' : 'ok'

  return { ...base, percent, remaining, state }
}

/** Lo apretado primero: un catalogo al 99% no puede quedar sepultado. */
const PESO_ESTADO: Record<LimitState, number> = {
  full: 0,
  near: 1,
  ok: 2,
  unlimited: 3,
  undefined: 4,
  uncounted: 5,
}

export function sortLimitRows(rows: LimitRowData[]): LimitRowData[] {
  return [...rows].sort((a, b) => {
    const porEstado = PESO_ESTADO[a.state] - PESO_ESTADO[b.state]
    if (porEstado !== 0) return porEstado
    return (b.percent ?? -1) - (a.percent ?? -1)
  })
}

export function countAttention(rows: LimitRowData[]): number {
  return rows.filter((r) => r.state === 'full' || r.state === 'near').length
}

// ── El plan siguiente ───────────────────────────────────────────────────────

/** De menor a mayor. El orden importa para saber cual es «el siguiente». */
export const PLAN_ORDER = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'] as const

export interface PlanLike {
  code?: string | null
  name?: string | null
  limits?: unknown
}

/**
 * El plan inmediatamente superior al actual. Sirve para responder «si se queda
 * sin cupo, a que pasa» sin salir de la pantalla.
 */
export function nextPlan(currentCode: string, plans: PlanLike[]): PlanLike | null {
  const actual = PLAN_ORDER.indexOf(String(currentCode).toUpperCase() as (typeof PLAN_ORDER)[number])
  if (actual === -1 || actual === PLAN_ORDER.length - 1) return null

  for (let i = actual + 1; i < PLAN_ORDER.length; i++) {
    const encontrado = plans.find((p) => String(p.code ?? '').toUpperCase() === PLAN_ORDER[i])
    if (encontrado) return encontrado
  }
  return null
}

/**
 * Que tope daria el plan siguiente para ese recurso. `null` cuando no mejora
 * nada: ofrecer un upgrade que no cambia el tope seria vender humo.
 */
export function upgradeLimit(
  resourceKey: string,
  currentLimit: number | null,
  next: PlanLike | null
): { limit: number | null; unlimited: boolean } | null {
  if (!next) return null

  const limits = next.limits && typeof next.limits === 'object' && !Array.isArray(next.limits)
    ? (next.limits as Record<string, unknown>)
    : null
  if (!limits || !(resourceKey in limits)) return null

  const valor = limits[resourceKey]
  // `null` en la tabla de planes significa «sin tope».
  if (valor === null) return { limit: null, unlimited: true }

  const siguiente = numeroFinito(valor)
  if (siguiente === null) return null
  if (currentLimit !== null && siguiente <= currentLimit) return null

  return { limit: siguiente, unlimited: false }
}
