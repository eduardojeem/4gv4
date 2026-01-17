/**
 * useSmartSuggestions Hook
 * 
 * Hook para obtener sugerencias inteligentes de productos
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  recommendationEngine,
  type ProductRecommendation,
} from '../lib/recommendation-engine'

export interface UseSmartSuggestionsReturn {
  recommendations: ProductRecommendation[]
  isLoading: boolean
  recordPurchase: (productIds: string[], customerId?: string, total?: number) => void
  refreshRecommendations: (cartProductIds: string[], customerId?: string) => void
  stats: ReturnType<typeof recommendationEngine.getStats>
}

export function useSmartSuggestions(
  cartProductIds: string[] = [],
  customerId?: string
): UseSmartSuggestionsReturn {
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState(recommendationEngine.getStats())

  /**
   * Refresh recommendations
   */
  const refreshRecommendations = useCallback(
    (productIds: string[], customer?: string) => {
      setIsLoading(true)

      try {
        const recs = recommendationEngine.getRecommendations(
          productIds,
          customer || customerId
        )
        setRecommendations(recs)
        setStats(recommendationEngine.getStats())
      } catch (error) {
        console.error('Failed to get recommendations:', error)
        setRecommendations([])
      } finally {
        setIsLoading(false)
      }
    },
    [customerId]
  )

  /**
   * Record purchase
   */
  const recordPurchase = useCallback(
    (productIds: string[], customer?: string, total?: number) => {
      recommendationEngine.recordPurchase(productIds, customer, total)
      setStats(recommendationEngine.getStats())

      // Refresh recommendations after recording
      if (cartProductIds.length > 0) {
        refreshRecommendations(cartProductIds, customer || customerId)
      }
    },
    [cartProductIds, customerId, refreshRecommendations]
  )

  /**
   * Auto-refresh when cart changes
   */
  useEffect(() => {
    if (cartProductIds.length > 0) {
      refreshRecommendations(cartProductIds, customerId)
    } else {
      setRecommendations([])
    }
  }, [cartProductIds, customerId, refreshRecommendations])

  return {
    recommendations,
    isLoading,
    recordPurchase,
    refreshRecommendations,
    stats,
  }
}
