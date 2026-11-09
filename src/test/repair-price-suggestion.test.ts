import { describe, expect, it } from 'vitest'
import { describeSuggestion, issueKeywords, suggestRepairPrice, type PricedRepairHistory } from '@/lib/repairs/price-suggestion'

const done = (model: string, issue: string, price: number, at: string): PricedRepairHistory => ({
  device_brand: 'Samsung', device_model: model, problem_description: issue, final_cost: price, delivered_at: at,
})

const history = [
  done('A05', 'Cambio de pantalla rota', 330000, '2026-08-01'),
  done('A05', 'Pantalla no da imagen', 350000, '2026-10-01'),
  done('A05', 'Pantalla rayada', 340000, '2026-09-01'),
  done('A05', 'Cambio de batería', 150000, '2026-10-05'),
  done('A12', 'Cambio de pantalla', 420000, '2026-10-06'),
]

describe('precio sugerido por historial', () => {
  it('usa las palabras que dicen qué se arregló', () => {
    expect(issueKeywords('Cambio de PANTALLA rota')).toEqual(['cambio', 'pantalla', 'rota'])
    expect(issueKeywords('no enciende')).toEqual(['enciende'])
  })

  it('sugiere lo último cobrado por el mismo modelo y la misma falla, con lo típico', () => {
    const suggestion = suggestRepairPrice({ brand: 'samsung', model: 'a05', issue: 'Pantalla quebrada' }, history)
    expect(suggestion).toMatchObject({ lastPrice: 350000, typicalPrice: 340000, count: 3, matchedIssue: 'pantalla', device: 'samsung a05' })
    expect(describeSuggestion(suggestion!, (value) => `₲ ${value}`)).toBe(
      'La última vez cobraste ₲ 350000 por «pantalla» en samsung a05 (3 veces, lo típico ₲ 340000).',
    )
  })

  it('con más palabras en común, gana la reparación más parecida', () => {
    expect(suggestRepairPrice({ brand: 'Samsung', model: 'A05', issue: 'cambio de batería' }, history)).toMatchObject({ lastPrice: 150000, count: 1 })
  })

  it('no inventa: otro modelo u otra falla no sugieren nada', () => {
    expect(suggestRepairPrice({ brand: 'Samsung', model: 'A05', issue: 'Pin de carga' }, history)).toBeNull()
    expect(suggestRepairPrice({ brand: 'Samsung', model: 'A54', issue: 'pantalla' }, history)).toBeNull()
    expect(suggestRepairPrice({ brand: 'Samsung', model: 'A05', issue: '' }, history)).toBeNull()
  })
})
