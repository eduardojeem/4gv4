/**
 * Cálculo de puntos de una compra.
 *
 * OJO: esto es el espejo del cálculo autoritativo, que vive en la base
 * (`public.award_loyalty_points_for_sale`). Sirve para mostrar "esta compra
 * suma X puntos" antes de cobrar; los puntos que quedan registrados son
 * siempre los que devuelve la función de la base.
 *
 * Se mantienen las dos implementaciones a propósito: el cliente necesita
 * previsualizar sin escribir, y el saldo no puede depender de un número que
 * llegue desde el navegador. Si cambiás una regla acá, cambiala también en
 * la migración 20260827090100_loyalty_and_raffles_operations.sql.
 */

export type PointsRounding = 'floor' | 'round'

export interface LoyaltySettings {
  enabled: boolean
  /** Cuánta moneda hace falta para ganar `pointsPerUnit` puntos. */
  currencyPerPoint: number
  pointsPerUnit: number
  rounding: PointsRounding
  /** Techo diario por cliente. null = sin techo. */
  maxPointsPerCustomerPerDay?: number | null
}

export type PointRuleKind = 'multiplier' | 'bonus_per_purchase'

export interface PointRule {
  id: string
  name: string
  kind: PointRuleKind
  multiplier: number
  bonusPoints: number
  startsAt: string | Date
  endsAt: string | Date
  isActive: boolean
  minPurchaseAmount?: number | null
  maxBonusPointsPerCustomer?: number | null
  maxBonusPointsTotal?: number | null
  awardedBonusPoints?: number
}

export interface PointsContext {
  /** Puntos ya sumados hoy por este cliente, para el techo diario. */
  earnedToday?: number
  /** Bonificación que este cliente ya consumió de esta promoción. */
  customerBonusUsedForRule?: number
  now?: Date
}

export interface PointsBreakdown {
  basePoints: number
  bonusPoints: number
  totalPoints: number
  appliedRule: PointRule | null
  /** Puntos que se perdieron por algún tope, y cuál lo recortó. */
  cappedBy: 'customer_rule_cap' | 'rule_total_cap' | 'daily_cap' | null
  pointsLostToCap: number
}

const EMPTY: PointsBreakdown = {
  basePoints: 0,
  bonusPoints: 0,
  totalPoints: 0,
  appliedRule: null,
  cappedBy: null,
  pointsLostToCap: 0,
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toTime(value: string | Date): number {
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value))
  return Number.isFinite(t) ? t : NaN
}

/** Puntos base, sin promociones ni topes. */
export function calculateBasePoints(amount: number, settings: LoyaltySettings): number {
  const total = toNumber(amount)
  const per = toNumber(settings?.currencyPerPoint)

  if (total <= 0 || per <= 0) return 0

  const raw = (total / per) * (toNumber(settings.pointsPerUnit) || 1)
  const points = settings.rounding === 'round' ? Math.round(raw) : Math.floor(raw)

  return Math.max(0, points)
}

/** Promociones vigentes para esta compra, en este momento. */
export function activeRulesFor(
  rules: PointRule[] | null | undefined,
  amount: number,
  now: Date = new Date(),
): PointRule[] {
  const at = now.getTime()
  const total = toNumber(amount)

  return (rules ?? []).filter((rule) => {
    if (!rule?.isActive) return false

    const from = toTime(rule.startsAt)
    const to = toTime(rule.endsAt)
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false
    if (at < from || at >= to) return false

    const min = rule.minPurchaseAmount
    if (min != null && total < toNumber(min)) return false

    return true
  })
}

/** Bonificación bruta de una regla, antes de aplicarle sus topes. */
function rawBonusFor(rule: PointRule, basePoints: number): number {
  if (rule.kind === 'multiplier') {
    const factor = toNumber(rule.multiplier)
    return Math.max(0, Math.floor(basePoints * (factor - 1)))
  }
  return Math.max(0, Math.floor(toNumber(rule.bonusPoints)))
}

/**
 * Cuántos puntos deja esta compra.
 *
 * Cuando hay más de una promoción vigente se aplica **una sola**: la que más
 * conviene al cliente. Acumularlas haría que dos promociones olvidadas se
 * multipliquen entre sí sin que nadie lo note.
 */
export function estimatePointsForSale(
  amount: number,
  settings: LoyaltySettings | null | undefined,
  rules: PointRule[] | null | undefined = [],
  context: PointsContext = {},
): PointsBreakdown {
  if (!settings?.enabled) return EMPTY

  const basePoints = calculateBasePoints(amount, settings)
  if (basePoints <= 0) return EMPTY

  const now = context.now ?? new Date()
  const candidates = activeRulesFor(rules, amount, now)

  let appliedRule: PointRule | null = null
  let bonusPoints = 0
  let cappedBy: PointsBreakdown['cappedBy'] = null
  let pointsLostToCap = 0

  if (candidates.length > 0) {
    // La que más suma para el cliente.
    appliedRule = candidates.reduce((best, rule) =>
      rawBonusFor(rule, basePoints) > rawBonusFor(best, basePoints) ? rule : best,
    )

    const raw = rawBonusFor(appliedRule, basePoints)
    bonusPoints = raw

    const perCustomer = appliedRule.maxBonusPointsPerCustomer
    if (perCustomer != null) {
      const used = toNumber(context.customerBonusUsedForRule)
      const room = Math.max(0, toNumber(perCustomer) - used)
      if (room < bonusPoints) {
        pointsLostToCap += bonusPoints - room
        bonusPoints = room
        cappedBy = 'customer_rule_cap'
      }
    }

    const totalCap = appliedRule.maxBonusPointsTotal
    if (totalCap != null) {
      const room = Math.max(0, toNumber(totalCap) - toNumber(appliedRule.awardedBonusPoints))
      if (room < bonusPoints) {
        pointsLostToCap += bonusPoints - room
        bonusPoints = room
        cappedBy = 'rule_total_cap'
      }
    }
  }

  let totalPoints = basePoints + bonusPoints

  const dailyCap = settings.maxPointsPerCustomerPerDay
  if (dailyCap != null) {
    const room = Math.max(0, toNumber(dailyCap) - toNumber(context.earnedToday))
    if (room < totalPoints) {
      pointsLostToCap += totalPoints - room
      totalPoints = room
      cappedBy = 'daily_cap'
    }
  }

  return {
    basePoints,
    bonusPoints,
    totalPoints,
    // Se conserva aunque los topes la hayan dejado en cero: saber cuál regla
    // aplicó y que no rindió es justamente lo que se quiere ver.
    appliedRule,
    cappedBy,
    pointsLostToCap,
  }
}

/** Texto corto para mostrar en el POS antes de cobrar. */
export function describePointsPreview(breakdown: PointsBreakdown): string {
  if (breakdown.totalPoints <= 0) return 'Esta compra no suma puntos'

  const plural = breakdown.totalPoints === 1 ? 'punto' : 'puntos'

  if (breakdown.bonusPoints > 0 && breakdown.appliedRule) {
    return `Suma ${breakdown.totalPoints} ${plural} (${breakdown.basePoints} + ${breakdown.bonusPoints} por ${breakdown.appliedRule.name})`
  }

  return `Suma ${breakdown.totalPoints} ${plural}`
}
