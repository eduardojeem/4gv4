/**
 * useSearchHistory Hook
 * 
 * Hook para gestionar historial de búsquedas
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  searchHistory,
  type SearchHistoryEntry,
  type FrequentSearch,
  type RecentProduct,
  type SearchStats,
} from '../lib/search-history'

export interface UseSearchHistoryReturn {
  // Recent searches
  recentSearches: SearchHistoryEntry[]
  uniqueRecentSearches: string[]

  // Frequent searches
  frequentSearches: FrequentSearch[]

  // Recent products
  recentProducts: RecentProduct[]

  // Suggestions
  suggestions: string[]

  // Stats
  stats: SearchStats

  // Actions
  addSearch: (query: string, resultsCount: number) => void
  addRecentProduct: (productId: string, productName: string) => void
  getSuggestions: (input: string) => void
  clearHistory: () => void
  clearFrequent: () => void
  clearRecent: () => void
  clearAll: () => void
}

export function useSearchHistory(): UseSearchHistoryReturn {
  const [recentSearches, setRecentSearches] = useState<SearchHistoryEntry[]>([])
  const [uniqueRecentSearches, setUniqueRecentSearches] = useState<string[]>([])
  const [frequentSearches, setFrequentSearches] = useState<FrequentSearch[]>([])
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [stats, setStats] = useState<SearchStats>(searchHistory.getStats())

  /**
   * Refresh all data
   */
  const refresh = useCallback(() => {
    setRecentSearches(searchHistory.getRecentSearches())
    setUniqueRecentSearches(searchHistory.getUniqueRecentSearches())
    setFrequentSearches(searchHistory.getFrequentSearches())
    setRecentProducts(searchHistory.getRecentProducts())
    setStats(searchHistory.getStats())
  }, [])

  /**
   * Add search
   */
  const addSearch = useCallback(
    (query: string, resultsCount: number) => {
      searchHistory.addSearch(query, resultsCount)
      refresh()
    },
    [refresh]
  )

  /**
   * Add recent product
   */
  const addRecentProduct = useCallback(
    (productId: string, productName: string) => {
      searchHistory.addRecentProduct(productId, productName)
      refresh()
    },
    [refresh]
  )

  /**
   * Get suggestions
   */
  const getSuggestions = useCallback((input: string) => {
    const newSuggestions = searchHistory.getSuggestions(input)
    setSuggestions(newSuggestions)
  }, [])

  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    searchHistory.clearHistory()
    refresh()
  }, [refresh])

  /**
   * Clear frequent
   */
  const clearFrequent = useCallback(() => {
    searchHistory.clearFrequent()
    refresh()
  }, [refresh])

  /**
   * Clear recent
   */
  const clearRecent = useCallback(() => {
    searchHistory.clearRecent()
    refresh()
  }, [refresh])

  /**
   * Clear all
   */
  const clearAll = useCallback(() => {
    searchHistory.clearAll()
    refresh()
  }, [refresh])

  /**
   * Initial load
   */
  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    recentSearches,
    uniqueRecentSearches,
    frequentSearches,
    recentProducts,
    suggestions,
    stats,
    addSearch,
    addRecentProduct,
    getSuggestions,
    clearHistory,
    clearFrequent,
    clearRecent,
    clearAll,
  }
}
