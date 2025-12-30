/**
 * useIntelligentSearch Hook
 * 
 * Hook personalizado para manejar búsqueda inteligente con:
 * - Detección de patrones automática
 * - Sugerencias contextuales
 * - Métricas de rendimiento
 * - Cache de resultados
 * - Historial de búsquedas
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Customer } from './use-customer-state'
import searchService, { SearchResult, SearchOptions } from '@/services/search-service'
import { useDebounce } from './use-debounce'

interface UseIntelligentSearchProps {
  customers: Customer[]
  initialQuery?: string
  debounceMs?: number
  searchOptions?: SearchOptions
}

interface SearchMetrics {
  totalResults: number
  searchTime: number
  accuracy: number
  patterns: {
    isEmail: boolean
    isPhone: boolean
    isRUC: boolean
    isCode: boolean
    isQuickFilter: boolean
  }
}

export function useIntelligentSearch({
  customers,
  initialQuery = '',
  debounceMs = 300,
  searchOptions = {}
}: UseIntelligentSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchMetrics, setSearchMetrics] = useState<SearchMetrics | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  // Debounce the search query
  const debouncedQuery = useDebounce(query, debounceMs)

  // Load search history on mount
  useEffect(() => {
    const history = searchService.getSearchHistory()
    setSearchHistory(history)
  }, [])

  // Detect search patterns
  const searchPatterns = useMemo(() => {
    if (!debouncedQuery) return null

    return {
      isEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedQuery),
      isPhone: /^[\d\s\-\+\(\)]+$/.test(debouncedQuery) && debouncedQuery.replace(/\D/g, '').length >= 8,
      isRUC: /^\d{12}$/.test(debouncedQuery.replace(/\D/g, '')),
      isCode: /^CLI-/.test(debouncedQuery.toUpperCase()),
      isQuickFilter: debouncedQuery.includes(':')
    }
  }, [debouncedQuery])

  // Perform search when query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([])
      setSearchMetrics(null)
      setSuggestions([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    
    const startTime = performance.now()
    
    try {
      // Perform search
      const results = searchService.search(customers, debouncedQuery, searchOptions)
      const endTime = performance.now()
      const searchTime = Math.round(endTime - startTime)

      // Calculate metrics
      const accuracy = customers.length > 0 ? (results.length / customers.length) * 100 : 0
      
      const metrics: SearchMetrics = {
        totalResults: results.length,
        searchTime,
        accuracy,
        patterns: searchPatterns || {
          isEmail: false,
          isPhone: false,
          isRUC: false,
          isCode: false,
          isQuickFilter: false
        }
      }

      setSearchResults(results)
      setSearchMetrics(metrics)

      // Generate suggestions if no results
      if (results.length === 0) {
        const searchSuggestions = searchService.generateSuggestions(customers, debouncedQuery)
        setSuggestions(searchSuggestions.map(s => s.value))
      } else {
        setSuggestions([])
      }

    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
      setSearchMetrics(null)
      setSuggestions([])
    } finally {
      setIsSearching(false)
    }
  }, [debouncedQuery, customers, searchOptions, searchPatterns])

  // Update search history when search is performed
  useEffect(() => {
    if (debouncedQuery && searchResults.length > 0) {
      const newHistory = searchService.getSearchHistory()
      setSearchHistory(newHistory)
    }
  }, [debouncedQuery, searchResults.length])

  // Search functions
  const performSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery)
  }, [])

  const clearSearch = useCallback(() => {
    setQuery('')
    setSearchResults([])
    setSearchMetrics(null)
    setSuggestions([])
  }, [])

  const selectSuggestion = useCallback((suggestion: string) => {
    setQuery(suggestion)
  }, [])

  const clearHistory = useCallback(() => {
    searchService.clearSearchHistory()
    setSearchHistory([])
  }, [])

  const clearCache = useCallback(() => {
    searchService.clearCache()
  }, [])

  // Get filtered customers (just the customer objects)
  const filteredCustomers = useMemo(() => {
    return searchResults.map(result => result.customer)
  }, [searchResults])

  // Get search insights
  const searchInsights = useMemo(() => {
    if (!searchMetrics) return null

    return {
      performance: {
        speed: searchMetrics.searchTime < 100 ? 'excellent' : 
               searchMetrics.searchTime < 300 ? 'good' : 'slow',
        accuracy: searchMetrics.totalResults === 0 ? 'no_results' : 
                  searchMetrics.totalResults <= 10 ? 'precise' : 
                  searchMetrics.totalResults <= 50 ? 'good' : 'broad'
      },
      patterns: searchMetrics.patterns,
      coverage: searchMetrics.accuracy
    }
  }, [searchMetrics])

  // Generate contextual quick filters
  const quickFilters = useMemo(() => {
    if (!searchPatterns || !debouncedQuery) return []

    const filters = []

    if (searchPatterns.isEmail) {
      filters.push({
        label: 'Buscar por email',
        query: `email:${debouncedQuery}`,
        icon: '📧'
      })
    }

    if (searchPatterns.isPhone) {
      filters.push({
        label: 'Buscar por teléfono',
        query: `phone:${debouncedQuery}`,
        icon: '📱'
      })
    }

    if (searchPatterns.isCode) {
      filters.push({
        label: 'Buscar por código',
        query: `code:${debouncedQuery}`,
        icon: '#️⃣'
      })
    }

    return filters
  }, [searchPatterns, debouncedQuery])

  return {
    // State
    query,
    isSearching,
    searchResults,
    filteredCustomers,
    searchMetrics,
    suggestions,
    searchHistory,
    searchInsights,
    quickFilters,
    
    // Actions
    performSearch,
    clearSearch,
    selectSuggestion,
    clearHistory,
    clearCache,
    setQuery
  }
}