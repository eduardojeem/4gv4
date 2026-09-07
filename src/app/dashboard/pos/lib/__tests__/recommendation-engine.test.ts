import { beforeEach, describe, expect, it } from 'vitest'
import { RecommendationEngine } from '../recommendation-engine'

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine

  beforeEach(() => {
    engine = new RecommendationEngine()
    engine.setProductsMetadata([
      { id: 'phone', name: 'Teléfono', category: 'Tecnología', price: 1_000_000, popularity: 10 },
      { id: 'case', name: 'Funda', category: 'Accesorios', price: 80_000, popularity: 8 },
      { id: 'phone-pro', name: 'Teléfono Pro', category: 'Tecnología', price: 1_300_000, popularity: 7 },
    ])
  })

  it('recomienda productos comprados juntos cuando alcanzan el soporte mínimo', () => {
    for (let index = 0; index < 3; index += 1) engine.recordPurchase(['phone', 'case'])
    expect(engine.getRecommendations(['phone']).map((item) => item.product_id)).toContain('case')
  })

  it('ofrece productos relevantes de la misma categoría', () => {
    const recommendation = engine.getRecommendations(['phone']).find((item) => item.product_id === 'phone-pro')
    expect(recommendation).toMatchObject({ product_id: 'phone-pro', product_name: 'Teléfono Pro' })
  })

  it('respeta el máximo configurable de recomendaciones', () => {
    engine.updateConfig({ maxRecommendations: 1 })
    expect(engine.getRecommendations(['phone'])).toHaveLength(1)
  })

  it('limpia de forma explícita todos los datos acumulados', () => {
    engine.recordPurchase(['phone', 'case'], 'customer-1')
    engine.clear()
    expect(engine.getStats()).toEqual({ patterns: 0, associations: 0, customers: 0, products: 0 })
  })
})
