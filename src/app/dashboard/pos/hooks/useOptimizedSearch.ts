/**
 * Hook para búsqueda optimizada con índices
 * Mejora significativa de performance en catálogos grandes
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
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
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchTime, setSearchTime] = useState(0)
  const [suggestions, setSuggestions] = useState<string[]>([])

  const optimizer = useMemo(() => getSearchOptimizer(), [])

  // Construir índice cuando cambian los productos
  useEffect(() => {
    if (products.length === 0) return

    const startTime = performance.now()
    optimizer.buildIndex(products)
    const endTime = performance.now()

    console.log(`Index built in ${(endTime - startTime).toFixed(2)}ms for ${products.length} products`)
  }, [products, optimizer])

  // Debounce del query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [query, debounceMs])

  // Generar sugerencias
  useEffect(() => {
    if (query.length > 0) {
      const newSuggestions = optimizer.getSuggestions(query, 5)
      setSuggestions(newSuggestions)
    } else {
      setSuggestions([])
    }
  }, [query, optimizer])

  // Realizar búsqueda — resultado puro sin side-effects en memo
  const searchResult = useMemo(() => {
    if (products.length === 0) return { products: [] as Product[], elapsed: 0 }

    const startTime = performance.now()
    const productIds = optimizer.search(debouncedQuery, {})
    const foundProducts = productIds
      .map(id => products.find(p => p.id === id))
      .filter((p): p is Product => p !== undefined)
      .slice(0, maxResults)
    const elapsed = performance.now() - startTime

    return { products: foundProducts, elapsed }
  }, [debouncedQuery, products, optimizer, maxResults])

  // Sincronizar estado de búsqueda y tiempo una vez calculado el resultado
  const results = searchResult.products
  useEffect(() => {
    setIsSearching(true)
    // El memo ya corrió; marcamos done en el mismo microtask
    setIsSearching(false)
    setSearchTime(searchResult.elapsed)
  }, [searchResult])

  // Estadísticas
  const stats = useMemo(() => {
    const optimizerStats = optimizer.getStats()
    return {
      totalProducts: products.length,
      filteredCount: results.length,
      indexSize: optimizerStats.totalTokens
    }
  }, [products.length, results.length, optimizer])

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
