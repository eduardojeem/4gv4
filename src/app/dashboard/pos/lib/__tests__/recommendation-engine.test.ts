import { describe, it, expect, beforeEach } from 'vitest'
import { RecommendationEngine } from '../recommendation-engine'

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine

  beforeEach(() => {
    engine = new RecommendationEngine()
  })

  describe('purchase recording', () => {
    it('should record purchase', () => {
      engine.recordPurchase(['prod_1', 'prod_2'], 'customer_1', 1000)

      const recommendations = engine.getRecommendations(['prod_1'])
      expect(recommendations.length).toBeGreaterThan(0)
    })

    it('should track product associations', () => {
      // Record multiple purchases with same products
      engine.recordPurchase(['prod_1', 'prod_2'], 'customer_1', 1000)
      engine.recordPurchase(['prod_1', 'prod_2'], 'customer_2', 1000)
      engine.recordPurchase(['prod_1', 'prod_3'], 'customer_3', 1000)

      const recommendations = engine.getRecommendations(['prod_1'])
      
      // prod_2 should be recommended more than prod_3
      const prod2Rec = recommendations.find(r => r.product_id === 'prod_2')
      const prod3Rec = recommendations.find(r => r.product_id === 'prod_3')
      
      expect(prod2Rec).toBeDefined()
      expect(prod2Rec!.confidence).toBeGreaterThan(prod3Rec?.confidence || 0)
    })
  })

  describe('frequently bought together', () => {
    it('should recommend frequently bought together products', () => {
      // Simulate multiple purchases
      for (let i = 0; i < 5; i++) {
        engine.recordPurchase(['prod_1', 'prod_2'], `customer_${i}`, 1000)
      }

      const recommendations = engine.getRecommendations(['prod_1'])
      const prod2Rec = recommendations.find(r => r.product_id === 'prod_2')

      expect(prod2Rec).toBeDefined()
      expect(prod2Rec?.reason).toContain('frecuentemente comprados juntos')
      expect(prod2Rec?.confidence).toBeGreaterThan(0.5)
    })

    it('should not recommend products already in cart', () => {
      engine.recordPurchase(['prod_1', 'prod_2'], 'customer_1', 1000)

      const recommendations = engine.getRecommendations(['prod_1', 'prod_2'])
      const prod2Rec = recommendations.find(r => r.product_id === 'prod_2')

      expect(prod2Rec).toBeUndefined()
    })
  })

  describe('category-based recommendations', () => {
    it('should recommend products from same category', () => {
      const products = [
        { id: 'prod_1', name: 'Product 1', category: 'Electronics', price: 1000 },
        { id: 'prod_2', name: 'Product 2', category: 'Electronics', price: 1500 },
        { id: 'prod_3', name: 'Product 3', category: 'Clothing', price: 500 }
      ]

      engine.setProducts(products)
      engine.recordPurchase(['prod_1'], 'customer_1', 1000)

      const recommendations = engine.getRecommendations(['prod_1'])
      const electronicsRecs = recommendations.filter(r => 
        products.find(p => p.id === r.product_id)?.category === 'Electronics'
      )

      expect(electronicsRecs.length).toBeGreaterThan(0)
    })
  })

  describe('customer history', () => {
    it('should use customer purchase history', () => {
      // Customer 1 frequently buys prod_2
      engine.recordPurchase(['prod_2'], 'customer_1', 500)
      engine.recordPurchase(['prod_2'], 'customer_1', 500)
      engine.recordPurchase(['prod_2'], 'customer_1', 500)

      const recommendations = engine.getRecommendations(['prod_1'], 'customer_1')
      const prod2Rec = recommendations.find(r => r.product_id === 'prod_2')

      expect(prod2Rec).toBeDefined()
      expect(prod2Rec?.reason).toContain('historial')
    })

    it('should work without customer ID', () => {
      engine.recordPurchase(['prod_1', 'prod_2'], undefined, 1000)

      const recommendations = engine.getRecommendations(['prod_1'])
      expect(recommendations).toBeDefined()
    })
  })

  describe('confidence scoring', () => {
    it('should calculate confidence based on frequency', () => {
      // High frequency
      for (let i = 0; i < 10; i++) {
        engine.recordPurchase(['prod_1', 'prod_2'], `customer_${i}`, 1000)
      }

      // Low frequency
      engine.recordPurchase(['prod_1', 'prod_3'], 'customer_x', 1000)

      const recommendations = engine.getRecommendations(['prod_1'])
      const prod2Rec = recommendations.find(r => r.product_id === 'prod_2')
      const prod3Rec = recommendations.find(r => r.product_id === 'prod_3')

      expect(prod2Rec!.confidence).toBeGreaterThan(prod3Rec!.confidence)
    })

    it('should filter low confidence recommendations', () => {
      engine.recordPurchase(['prod_1', 'prod_2'], 'customer_1', 1000)

      const recommendations = engine.getRecommendations(['prod_1'], undefined, 0.9)
      
      // With high threshold, should have fewer recommendations
      expect(recommendations.length).toBeLessThanOrEqual(1)
    })
  })

  describe('upselling', () => {
    it('should recommend higher-priced alternatives', () => {
      const products = [
        { id: 'prod_1', name: 'Basic Phone', category: 'Electronics', price: 500 },
        { id: 'prod_2', name: 'Premium Phone', category: 'Electronics', price: 1500 }
      ]

      engine.setProducts(products)
      engine.recordPurchase(['prod_1'], 'customer_1', 500)

      const recommendations = engine.getRecommendations(['prod_1'])
      const upsellRec = recommendations.find(r => r.product_id === 'prod_2')

      expect(upsellRec).toBeDefined()
      expect(upsellRec?.price).toBeGreaterThan(500)
    })
  })

  describe('recommendation limits', () => {
    it('should respect max recommendations limit', () => {
      const products = Array.from({ length: 20 }, (_, i) => ({
        id: `prod_${i}`,
        name: `Product ${i}`,
        category: 'Test',
        price: 100
      }))

      engine.setProducts(products)

      products.forEach(p => {
        engine.recordPurchase(['prod_0', p.id], 'customer_1', 100)
      })

      const recommendations = engine.getRecommendations(['prod_0'], undefined, 0.1, 5)
      expect(recommendations.length).toBeLessThanOrEqual(5)
    })
  })

  describe('data management', () => {
    it('should clear old purchase history', () => {
      engine.recordPurchase(['prod_1', 'prod_2'], 'customer_1', 1000)
      
      engine.clearHistory()

      const recommendations = engine.getRecommendations(['prod_1'])
      expect(recommendations.length).toBe(0)
    })

    it('should export recommendation data', () => {
      engine.recordPurchase(['prod_1', 'prod_2'], 'customer_1', 1000)

      const exported = engine.exportData()
      expect(exported.purchases).toBeDefined()
      expect(exported.associations).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty cart', () => {
      const recommendations = engine.getRecommendations([])
      expect(recommendations).toEqual([])
    })

    it('should handle unknown products', () => {
      const recommendations = engine.getRecommendations(['unknown_product'])
      expect(recommendations).toBeDefined()
    })

    it('should handle single product purchases', () => {
      engine.recordPurchase(['prod_1'], 'customer_1', 1000)

      const recommendations = engine.getRecommendations(['prod_1'])
      expect(recommendations).toBeDefined()
    })
  })
})
