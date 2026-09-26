/**
 * Hook para búsqueda optimizada con índices
 * Mejora significativa de performance en catálogos grandes
 */

import { useState, useEffect, useMemo } from 'react'
import type { Product } from '@/types/product-unified'
import { getSearchOptimizer } from '../lib/search-optimizer'

export interface UseOptimizedSearchOptions {
  products: Product[]
  debounceMs?: number
  maxResults?: number
}

export interface UseOptimizedSearchResult {
  query: string
  setQuery: (query: string) => void
  results: Product[]
  isSearching: boolean
  searchTime: number
  suggestions: string[]
  stats: {
    totalProducts: number
    filteredCount: number
    indexSize: number
  }
}

export function useOptimizedSearch({
  products,
  debounceMs = 300,
  maxResults = 50
}: UseOptimizedSearchOptions): UseOptimizedSearchResult {
  const [query, setQuery] = useState('')
  const [completed, setCompleted] = useState({ query: '', products: null as Product[] | null, maxResults, results: [] as Product[], searchTime: 0, suggestions: [] as string[], indexSize: 0 })

  const optimizer = useMemo(() => getSearchOptimizer(), [])

  // Indexar y medir la búsqueda cuando termina el debounce, fuera del render.
  useEffect(() => {
    const timer = setTimeout(() => {
      optimizer.buildIndex(products)
      const startTime = performance.now()
      const byId = new Map(products.map(product => [product.id, product]))
      const results = optimizer.search(query, {})
        .map(id => byId.get(id))
        .filter((product): product is Product => product !== undefined)
        .slice(0, maxResults)
      setCompleted({ query, products, maxResults, results, searchTime: performance.now() - startTime,
        suggestions: query ? optimizer.getSuggestions(query, 5) : [], indexSize: optimizer.getStats().totalTokens })
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [query, debounceMs, products, optimizer, maxResults])
  const results = completed.products === products ? completed.results : []
  const isSearching = completed.query !== query || completed.products !== products || completed.maxResults !== maxResults
  const searchTime = completed.searchTime
  const suggestions = query && completed.query === query ? completed.suggestions : []

  // Estadísticas
  const stats = useMemo(() => {
    return {
      totalProducts: products.length,
      filteredCount: results.length,
      indexSize: completed.indexSize
    }
  }, [products.length, results.length, completed.indexSize])

  return {
    query,
    setQuery,
    results,
    isSearching,
    searchTime,
    suggestions,
    stats
  }
}
