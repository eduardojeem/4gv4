'use client'

import { useEffect, useState } from 'react'
import { estimatePointsForSale, type LoyaltySettings, type PointRule } from '@/lib/loyalty/points'

type SettingsRow = {
  enabled?: boolean
  currency_per_point?: number | string | null
  points_per_unit?: number | string | null
  rounding?: string | null
  max_points_per_customer_per_day?: number | string | null
}

type RuleRow = {
  id: string
  name?: string | null
  kind?: string | null
  multiplier?: number | string | null
  bonus_points?: number | string | null
  starts_at: string
  ends_at: string
  is_active?: boolean | null
  min_purchase_amount?: number | string | null
  max_bonus_points_per_customer?: number | string | null
  max_bonus_points_total?: number | string | null
  awarded_bonus_points?: number | string | null
}

const toNumberOrNull = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value))

export function settingsFromRow(row: SettingsRow | null | undefined): LoyaltySettings | null {
  if (!row?.enabled) return null
  return {
    enabled: true,
    currencyPerPoint: Number(row.currency_per_point) || 0,
    pointsPerUnit: Number(row.points_per_unit) || 1,
    rounding: row.rounding === 'round' ? 'round' : 'floor',
    maxPointsPerCustomerPerDay: toNumberOrNull(row.max_points_per_customer_per_day),
  }
}

export function rulesFromRows(rows: RuleRow[] | null | undefined): PointRule[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? 'Promoción',
    kind: row.kind === 'bonus_per_purchase' ? 'bonus_per_purchase' : 'multiplier',
    multiplier: Number(row.multiplier) || 1,
    bonusPoints: Number(row.bonus_points) || 0,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active !== false,
    minPurchaseAmount: toNumberOrNull(row.min_purchase_amount),
    maxBonusPointsPerCustomer: toNumberOrNull(row.max_bonus_points_per_customer),
    maxBonusPointsTotal: toNumberOrNull(row.max_bonus_points_total),
    awardedBonusPoints: Number(row.awarded_bonus_points) || 0,
  }))
}

/**
 * Texto para el cobro: cuántos puntos va a sumar la compra.
 *
 * `estimatePointsForSale` existía para esto y ninguna pantalla lo usaba. Es
 * una estimación: los puntos que quedan son los que devuelve la base al cobrar
 * (ahí se aplican el tope diario y lo ya usado de cada promoción).
 */
export function pointsPreviewText(input: {
  settings: LoyaltySettings | null
  rules: PointRule[]
  pointsBase: number
  onCredit: boolean
}): string | null {
  if (!input.settings) return null
  if (input.onCredit && input.pointsBase <= 0) return 'Suma puntos a medida que se paguen las cuotas'
  const breakdown = estimatePointsForSale(input.pointsBase, input.settings, input.rules)
  if (breakdown.totalPoints <= 0) return null
  const plural = breakdown.totalPoints === 1 ? 'punto' : 'puntos'
  const capped = input.settings.maxPointsPerCustomerPerDay != null ? 'hasta ' : ''
  const promo = breakdown.bonusPoints > 0 && breakdown.appliedRule ? ` (incluye ${breakdown.bonusPoints} por ${breakdown.appliedRule.name})` : ''
  return `Esta compra suma ${capped}${breakdown.totalPoints} ${plural}${promo}`
}

/** Canje por saldo a favor, si la tienda lo ofrece. */
export function redemptionFromRow(row: (SettingsRow & { redemption_value?: number | string | null; min_redemption_points?: number | string | null }) | null | undefined) {
  const value = Number(row?.redemption_value)
  if (!row?.enabled || !Number.isFinite(value) || value <= 0) return null
  const min = toNumberOrNull(row.min_redemption_points)
  return { value, min: min && min > 0 ? min : null }
}

/** Configuración y promociones de puntos, una vez por apertura del cobro. */
export function useLoyaltyPreview(enabled: boolean) {
  const [settings, setSettings] = useState<LoyaltySettings | null>(null)
  const [rules, setRules] = useState<PointRule[]>([])
  const [redemption, setRedemption] = useState<{ value: number; min: number | null } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    Promise.all([
      fetch('/api/loyalty/settings', { cache: 'no-store', signal: controller.signal }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/loyalty/rules', { cache: 'no-store', signal: controller.signal }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([settingsBody, rulesBody]) => {
        // Sin el módulo de promociones o sin permiso: no se muestra nada.
        setSettings(settingsFromRow(settingsBody?.settings))
        setRules(rulesFromRows(rulesBody?.rules))
        setRedemption(redemptionFromRow(settingsBody?.settings))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [enabled])

  return { settings, rules, redemption }
}
