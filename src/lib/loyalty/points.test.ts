import { describe, expect, it } from 'vitest'
import {
  activeRulesFor,
  calculateBasePoints,
  describePointsPreview,
  estimatePointsForSale,
  type LoyaltySettings,
  type PointRule,
} from './points'

const settings: LoyaltySettings = {
  enabled: true,
  currencyPerPoint: 10_000,
  pointsPerUnit: 1,
  rounding: 'floor',
}

const NOW = new Date('2026-08-27T12:00:00Z')

function rule(overrides: Partial<PointRule> = {}): PointRule {
  return {
    id: 'r-1',
    name: 'Semana doble',
    kind: 'multiplier',
    multiplier: 2,
    bonusPoints: 0,
    startsAt: '2026-08-24T00:00:00Z',
    endsAt: '2026-08-31T00:00:00Z',
    isActive: true,
    ...overrides,
  }
}

describe('calculateBasePoints', () => {
  it('convierte moneda a puntos con la tasa configurada', () => {
    expect(calculateBasePoints(150_000, settings)).toBe(15)
  })

  it('trunca la fracción por defecto: no se regalan puntos parciales', () => {
    expect(calculateBasePoints(159_999, settings)).toBe(15)
  })

  it('redondea si así se configuró', () => {
    expect(calculateBasePoints(155_000, { ...settings, rounding: 'round' })).toBe(16)
  })

  it('respeta una tasa que da varios puntos por unidad', () => {
    expect(calculateBasePoints(50_000, { ...settings, currencyPerPoint: 10_000, pointsPerUnit: 3 })).toBe(15)
  })

  it('una compra menor a la tasa no suma nada', () => {
    expect(calculateBasePoints(9_999, settings)).toBe(0)
  })

  it('no explota con importes inválidos ni tasa cero', () => {
    expect(calculateBasePoints(-100, settings)).toBe(0)
    expect(calculateBasePoints(NaN, settings)).toBe(0)
    expect(calculateBasePoints(100_000, { ...settings, currencyPerPoint: 0 })).toBe(0)
  })
})

describe('activeRulesFor', () => {
  it('deja fuera la promoción que todavía no empezó y la que ya terminó', () => {
    const futura = rule({ id: 'f', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-05T00:00:00Z' })
    const pasada = rule({ id: 'p', startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-08-05T00:00:00Z' })

    expect(activeRulesFor([futura, pasada, rule()], 100_000, NOW).map((r) => r.id)).toEqual(['r-1'])
  })

  it('el instante de cierre ya no cuenta', () => {
    const justo = rule({ endsAt: NOW.toISOString() })
    expect(activeRulesFor([justo], 100_000, NOW)).toHaveLength(0)
  })

  it('respeta la compra mínima de la promoción', () => {
    const conMinimo = rule({ minPurchaseAmount: 500_000 })

    expect(activeRulesFor([conMinimo], 400_000, NOW)).toHaveLength(0)
    expect(activeRulesFor([conMinimo], 500_000, NOW)).toHaveLength(1)
  })

  it('ignora la promoción desactivada aunque esté en fecha', () => {
    expect(activeRulesFor([rule({ isActive: false })], 100_000, NOW)).toHaveLength(0)
  })
})

describe('estimatePointsForSale', () => {
  it('sin promoción vigente devuelve solo la base', () => {
    const result = estimatePointsForSale(200_000, settings, [], { now: NOW })

    expect(result.basePoints).toBe(20)
    expect(result.bonusPoints).toBe(0)
    expect(result.totalPoints).toBe(20)
  })

  it('el multiplicador suma la diferencia, no reemplaza la base', () => {
    // x2 sobre 20 puntos base = 20 base + 20 de bonificacion, no 20 en total.
    const result = estimatePointsForSale(200_000, settings, [rule({ multiplier: 2 })], { now: NOW })

    expect(result.basePoints).toBe(20)
    expect(result.bonusPoints).toBe(20)
    expect(result.totalPoints).toBe(40)
  })

  it('la promoción de monto fijo suma siempre lo mismo', () => {
    const result = estimatePointsForSale(200_000, settings, [
      rule({ kind: 'bonus_per_purchase', bonusPoints: 50 }),
    ], { now: NOW })

    expect(result.totalPoints).toBe(70)
  })

  it('con dos promociones vigentes aplica una sola: la que más conviene', () => {
    // Acumularlas haria que dos promos olvidadas se multipliquen entre si.
    const result = estimatePointsForSale(200_000, settings, [
      rule({ id: 'x2', multiplier: 2 }),
      rule({ id: 'x3', multiplier: 3 }),
    ], { now: NOW })

    expect(result.appliedRule?.id).toBe('x3')
    expect(result.bonusPoints).toBe(40)
    expect(result.totalPoints).toBe(60)
  })

  it('el saldo no puede desactivarse a medias: apagado devuelve cero', () => {
    const result = estimatePointsForSale(200_000, { ...settings, enabled: false }, [rule()], { now: NOW })

    expect(result.totalPoints).toBe(0)
    expect(result.appliedRule).toBeNull()
  })
})

describe('topes', () => {
  it('el tope por cliente recorta la bonificación y lo informa', () => {
    const result = estimatePointsForSale(200_000, settings, [
      rule({ maxBonusPointsPerCustomer: 30 }),
    ], { now: NOW, customerBonusUsedForRule: 25 })

    // Le quedaban 5 de los 30; la bonificacion bruta era 20.
    expect(result.bonusPoints).toBe(5)
    expect(result.totalPoints).toBe(25)
    expect(result.cappedBy).toBe('customer_rule_cap')
    expect(result.pointsLostToCap).toBe(15)
  })

  it('el tope total de la promoción frena aunque al cliente le quede margen', () => {
    const result = estimatePointsForSale(200_000, settings, [
      rule({ maxBonusPointsTotal: 1_000, awardedBonusPoints: 995 }),
    ], { now: NOW })

    expect(result.bonusPoints).toBe(5)
    expect(result.cappedBy).toBe('rule_total_cap')
  })

  it('agotada la promoción, la compra sigue sumando la base', () => {
    const result = estimatePointsForSale(200_000, settings, [
      rule({ maxBonusPointsTotal: 100, awardedBonusPoints: 100 }),
    ], { now: NOW })

    expect(result.bonusPoints).toBe(0)
    expect(result.totalPoints).toBe(20)
    // La regla queda a la vista aunque no haya rendido: es lo que hay que ver.
    expect(result.appliedRule?.id).toBe('r-1')
  })

  it('el techo diario recorta el total, promoción incluida', () => {
    const result = estimatePointsForSale(200_000, { ...settings, maxPointsPerCustomerPerDay: 25 }, [
      rule({ multiplier: 2 }),
    ], { now: NOW, earnedToday: 10 })

    expect(result.totalPoints).toBe(15)
    expect(result.cappedBy).toBe('daily_cap')
    expect(result.pointsLostToCap).toBe(25)
  })

  it('con el techo diario ya alcanzado no suma nada', () => {
    const result = estimatePointsForSale(200_000, { ...settings, maxPointsPerCustomerPerDay: 20 }, [], {
      now: NOW,
      earnedToday: 20,
    })

    expect(result.totalPoints).toBe(0)
  })

  it('nunca devuelve puntos negativos aunque los acumulados superen el techo', () => {
    const result = estimatePointsForSale(200_000, { ...settings, maxPointsPerCustomerPerDay: 20 }, [], {
      now: NOW,
      earnedToday: 500,
    })

    expect(result.totalPoints).toBe(0)
    expect(result.totalPoints).toBeGreaterThanOrEqual(0)
  })
})

describe('describePointsPreview', () => {
  it('menciona la promoción cuando aportó', () => {
    const result = estimatePointsForSale(200_000, settings, [rule({ name: 'Semana doble' })], { now: NOW })

    expect(describePointsPreview(result)).toBe('Suma 40 puntos (20 + 20 por Semana doble)')
  })

  it('avisa cuando la compra no llega a sumar', () => {
    const result = estimatePointsForSale(5_000, settings, [], { now: NOW })

    expect(describePointsPreview(result)).toBe('Esta compra no suma puntos')
  })

  it('concuerda el singular', () => {
    const result = estimatePointsForSale(10_000, settings, [], { now: NOW })

    expect(describePointsPreview(result)).toBe('Suma 1 punto')
  })
})
