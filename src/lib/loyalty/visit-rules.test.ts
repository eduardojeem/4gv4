import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { estimatePointsForSale, type PointRule } from './points'
import { rulesFromRows } from '@/app/dashboard/pos/hooks/useLoyaltyPreview'

const settings = { enabled: true, currencyPerPoint: 1000, pointsPerUnit: 1, rounding: 'floor' as const }
const visitas: PointRule = {
  id: 'v', name: 'Cada 10 visitas', kind: 'visit_milestone', multiplier: 1, bonusPoints: 100, visitInterval: 10,
  startsAt: '2000-01-01', endsAt: '2999-01-01', isActive: true,
}

describe('promoción «cada N visitas» en el cálculo de la app', () => {
  it('en la visita N suma el regalo', () => {
    expect(estimatePointsForSale(20000, settings, [visitas], { visitNumber: 10 }).totalPoints).toBe(120)
    expect(estimatePointsForSale(20000, settings, [visitas], { visitNumber: 20 }).bonusPoints).toBe(100)
  })

  it('en las demás visitas, o sin saber cuál es, no promete nada', () => {
    expect(estimatePointsForSale(20000, settings, [visitas], { visitNumber: 9 }).totalPoints).toBe(20)
    expect(estimatePointsForSale(20000, settings, [visitas]).totalPoints).toBe(20)
  })

  it('compite con las otras promociones como en la base', () => {
    const triple: PointRule = { ...visitas, id: 't', name: 'Triple', kind: 'multiplier', multiplier: 3, visitInterval: null }
    expect(estimatePointsForSale(50000, settings, [visitas, triple], { visitNumber: 10 }).appliedRule?.id).toBe('t')
  })

  it('el cobro lee el tipo y cada cuántas visitas', () => {
    const [rule] = rulesFromRows([{ id: 'v', kind: 'visit_milestone', visit_interval: 10, bonus_points: 100, starts_at: '2000-01-01', ends_at: '2999-01-01' }])
    expect(rule).toMatchObject({ kind: 'visit_milestone', visitInterval: 10, bonusPoints: 100 })
  })
})

describe('la API y la tarjeta de promociones', () => {
  it('aceptan el nuevo tipo y exigen cada cuántas visitas', () => {
    const api = readFileSync(resolve(process.cwd(), 'src/app/api/loyalty/rules/route.ts'), 'utf8')
    expect(api).toContain("kind: z.enum(['multiplier', 'bonus_per_purchase', 'visit_milestone'])")
    expect(api).toContain("data.kind !== 'visit_milestone' || (Boolean(data.visit_interval) && data.bonus_points > 0)")
    const tarjeta = readFileSync(resolve(process.cwd(), 'src/components/dashboard/loyalty/PointRulesCard.tsx'), 'utf8')
    expect(tarjeta).toContain('<SelectItem value="visit_milestone">Cada N visitas (premia volver)</SelectItem>')
    expect(tarjeta).toContain("applyPreset('visits10')")
  })
})
