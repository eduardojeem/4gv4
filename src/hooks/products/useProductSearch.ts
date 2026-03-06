'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import type { Product, SearchConfig } from './types'

interface SearchResult {
  product: Product
  score: number
  matches: {
    field: string
    value: string
    highlighted: string
  }[]
}

type SearchMatch = SearchResult['matches'][number]

interface SearchHistory {
  query: string
  timestamp: Date
  resultsCount: number
}

interface SearchSuggestion {
  text: string
  type: 'product' | 'category' | 'supplier' | 'tag'
  count: number
}

interface SearchFilters {
  categories: string[]
  suppliers: string[]
  priceRange: { min: number, max: number }
  stockStatus: string[]
  tags: string[]
}

interface AdvancedToken {
  field: string
  value: string
  operator: 'AND' | 'OR' | null
}

/**
 * Hook compuesto para busqueda avanzada de productos
 * Incluye multiples algoritmos de busqueda, sugerencias y historial
 */
export function useProductSearch(
  products: Product[] = [],
  config: SearchConfig = {
    fields: ['name', 'sku', 'description'],
    fuzzy: true,
    minLength: 2,
    debounceMs: 300
  }
) {
  const [query, setQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    categories: [],
    suppliers: [],
    priceRange: { min: 0, max: 0 },
    stockStatus: [],
    tags: []
  })
  const [searchMode, setSearchMode] = useState<'simple' | 'advanced' | 'fuzzy' | 'semantic'>('simple')

  const debouncedQuery = useDebounce(query, config.debounceMs || 300)

  // Inicializar rangos de filtros
  useEffect(() => {
    if (products.length > 0) {
      const prices = products.map(p => p.sale_price || 0).filter(p => p > 0)
      if (prices.length === 0) return

      setSearchFilters(prev => ({
        ...prev,
        priceRange: {
          min: Math.min(...prices),
          max: Math.max(...prices)
        }
      }))
    }
  }, [products])

  // Algoritmo de busqueda simple
  const simpleSearch = useCallback((items: Product[], searchQuery: string): SearchResult[] => {
    if (!searchQuery) return []

    const normalizedQuery = searchQuery.toLowerCase()
    const results: SearchResult[] = []

    items.forEach(product => {
      let score = 0
      const matches: SearchResult['matches'] = []

      config.fields.forEach(field => {
        const value = product[field as keyof Product]
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase()
          const index = lowerValue.indexOf(normalizedQuery)

          if (index !== -1) {
            const positionScore = index === 0 ? 10 : 5
            const lengthScore = normalizedQuery.length / value.length * 5
            score += positionScore + lengthScore

            const highlighted = value.replace(
              new RegExp(normalizedQuery, 'gi'),
              match => `<mark>${match}</mark>`
            )

            matches.push({
              field,
              value,
              highlighted
            })
          }
        }
      })

      if (score > 0) {
        results.push({ product, score, matches })
      }
    })

    return results.sort((a, b) => b.score - a.score)
  }, [config.fields])

  // Algoritmo de busqueda fuzzy
  const fuzzySearch = useCallback((items: Product[], searchQuery: string): SearchResult[] => {
    if (!searchQuery) return []

    const results: SearchResult[] = []

    items.forEach(product => {
      let score = 0
      const matches: SearchResult['matches'] = []

      config.fields.forEach(field => {
        const value = product[field as keyof Product]
        if (typeof value === 'string') {
          const fuzzyScore = calculateFuzzyScore(value.toLowerCase(), searchQuery.toLowerCase())

          if (fuzzyScore > 0.3) {
            score += fuzzyScore * 10

            matches.push({
              field,
              value,
              highlighted: highlightFuzzyMatch(value, searchQuery)
            })
          }
        }
      })

      if (score > 0) {
        results.push({ product, score, matches })
      }
    })

    return results.sort((a, b) => b.score - a.score)
  }, [config.fields])

  // Algoritmo de busqueda avanzada con operadores
  const advancedSearch = useCallback((items: Product[], searchQuery: string): SearchResult[] => {
    if (!searchQuery) return []

    const tokens = parseAdvancedQuery(searchQuery)
    const results: SearchResult[] = []

    items.forEach(product => {
      let score = 0
      const matches: SearchResult['matches'] = []
      let matchesAllConditions = true

      tokens.forEach(token => {
        const fieldMatch = evaluateToken(product, token)

        if (token.operator === 'AND' && !fieldMatch.matched) {
          matchesAllConditions = false
        } else if (token.operator === 'OR' && fieldMatch.matched) {
          score += fieldMatch.score
          matches.push(...fieldMatch.matches)
        } else if (!token.operator && fieldMatch.matched) {
          score += fieldMatch.score
          matches.push(...fieldMatch.matches)
        }
      })

      if (matchesAllConditions && score > 0) {
        results.push({ product, score, matches })
      }
    })

    return results.sort((a, b) => b.score - a.score)
  }, [])

  // Aplicar filtros a los resultados
  const applySearchFilters = useCallback((
    results: SearchResult[],
    filters: SearchFilters
  ): SearchResult[] => {
    return results.filter(({ product }) => {
      if (filters.categories.length > 0 &&
          !filters.categories.includes(product.category?.id || '')) {
        return false
      }

      if (filters.suppliers.length > 0 &&
          !filters.suppliers.includes(product.supplier?.id || '')) {
        return false
      }

      const price = product.sale_price || 0
      if (price < filters.priceRange.min || price > filters.priceRange.max) {
        return false
      }

      if (filters.stockStatus.length > 0 &&
          !filters.stockStatus.includes(product.stock_status || '')) {
        return false
      }

      return true
    })
  }, [])

  // Busqueda semantica (simulada)
  const semanticSearch = useCallback((items: Product[], searchQuery: string): SearchResult[] => {
    const synonyms: Record<string, string[]> = {
      telefono: ['smartphone', 'movil', 'celular'],
      computadora: ['laptop', 'pc', 'ordenador'],
      barato: ['economico', 'bajo precio', 'oferta'],
      caro: ['premium', 'alto precio', 'lujo']
    }

    let expandedQuery = searchQuery.toLowerCase()

    Object.entries(synonyms).forEach(([word, syns]) => {
      if (expandedQuery.includes(word)) {
        expandedQuery += ` ${syns.join(' ')}`
      }
    })

    return simpleSearch(items, expandedQuery)
  }, [simpleSearch])

  // Ejecutar busqueda segun el modo
  const searchResults = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < (config.minLength || 2)) {
      return []
    }

    let results: SearchResult[] = []

    switch (searchMode) {
      case 'simple':
        results = simpleSearch(products, debouncedQuery)
        break
      case 'fuzzy':
        results = fuzzySearch(products, debouncedQuery)
        break
      case 'advanced':
        results = advancedSearch(products, debouncedQuery)
        break
      case 'semantic':
        results = semanticSearch(products, debouncedQuery)
        break
    }

    return applySearchFilters(results, searchFilters)
  }, [
    products,
    debouncedQuery,
    searchMode,
    searchFilters,
    config.minLength,
    simpleSearch,
    fuzzySearch,
    advancedSearch,
    semanticSearch,
    applySearchFilters
  ])

  // Generar sugerencias
  const suggestions = useMemo((): SearchSuggestion[] => {
    if (!query || query.length < 2) return []

    const acc: SearchSuggestion[] = []
    const queryLower = query.toLowerCase()

    products.forEach(product => {
      if (product.name?.toLowerCase().includes(queryLower)) {
        acc.push({
          text: product.name,
          type: 'product',
          count: 1
        })
      }
    })

    const categories = new Set(products.map(p => p.category?.name).filter(Boolean))
    categories.forEach(category => {
      if (category!.toLowerCase().includes(queryLower)) {
        const count = products.filter(p => p.category?.name === category).length
        acc.push({
          text: category!,
          type: 'category',
          count
        })
      }
    })

    const suppliers = new Set(products.map(p => p.supplier?.name).filter(Boolean))
    suppliers.forEach(supplier => {
      if (supplier!.toLowerCase().includes(queryLower)) {
        const count = products.filter(p => p.supplier?.name === supplier).length
        acc.push({
          text: supplier!,
          type: 'supplier',
          count
        })
      }
    })

    return acc.slice(0, 10)
  }, [query, products])

  // Guardar busqueda en historial
  const saveSearch = useCallback((searchQuery: string, resultsCount: number) => {
    const historyEntry: SearchHistory = {
      query: searchQuery,
      timestamp: new Date(),
      resultsCount
    }

    setSearchHistory(prev => {
      const filtered = prev.filter(entry => entry.query !== searchQuery)
      return [historyEntry, ...filtered].slice(0, 20)
    })
  }, [])

  // Ejecutar busqueda
  const search = useCallback((searchQuery: string) => {
    setQuery(searchQuery)
    if (searchQuery) {
      saveSearch(searchQuery, searchResults.length)
    }
  }, [searchResults.length, saveSearch])

  const clearSearch = useCallback(() => {
    setQuery('')
  }, [])

  const clearHistory = useCallback(() => {
    setSearchHistory([])
  }, [])

  return {
    query,
    searchResults,
    suggestions,
    searchHistory,
    searchMode,
    searchFilters,
    search,
    setQuery,
    clearSearch,
    setSearchMode,
    setSearchFilters,
    clearHistory,
    debouncedQuery,
    isSearching: query !== debouncedQuery
  }
}

// Funciones auxiliares
function calculateFuzzyScore(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1.0

  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

function highlightFuzzyMatch(text: string, query: string): string {
  return text.replace(new RegExp(query, 'gi'), match => `<mark>${match}</mark>`)
}

function parseAdvancedQuery(query: string): AdvancedToken[] {
  const parts = query.split(/\s+(AND|OR)\s+/i).filter(Boolean)
  const tokens: AdvancedToken[] = []
  let pendingOperator: 'AND' | 'OR' | null = null

  for (const part of parts) {
    const upper = part.toUpperCase()
    if (upper === 'AND' || upper === 'OR') {
      pendingOperator = upper
      continue
    }

    const [maybeField, ...valueParts] = part.split(':')
    if (valueParts.length > 0) {
      tokens.push({
        field: maybeField.toLowerCase(),
        value: valueParts.join(':').trim(),
        operator: pendingOperator
      })
    } else {
      tokens.push({
        field: 'name',
        value: part.trim(),
        operator: pendingOperator
      })
    }
    pendingOperator = null
  }

  if (tokens.length === 0 && query.trim()) {
    return [{ field: 'name', value: query.trim(), operator: null }]
  }

  return tokens
}

function evaluateToken(
  product: Product,
  token: AdvancedToken
): { matched: boolean, score: number, matches: SearchMatch[] } {
  const value = token.value.toLowerCase()
  const matches: SearchMatch[] = []

  const valueByField: Record<string, string> = {
    name: product.name || '',
    sku: product.sku || '',
    description: product.description || '',
    category: product.category?.name || '',
    supplier: product.supplier?.name || ''
  }

  if (token.field === 'price') {
    const numeric = Number(value.replace(/[^\d.-]/g, ''))
    if (!Number.isNaN(numeric)) {
      const matched = (product.sale_price || 0) >= numeric
      return { matched, score: matched ? 2 : 0, matches: [] }
    }
  }

  const sourceValue = valueByField[token.field] ?? valueByField.name
  const matched = sourceValue.toLowerCase().includes(value)

  if (matched) {
    matches.push({
      field: token.field,
      value: sourceValue,
      highlighted: sourceValue.replace(new RegExp(value, 'gi'), m => `<mark>${m}</mark>`)
    })
  }

  return { matched, score: matched ? 1 : 0, matches }
}
