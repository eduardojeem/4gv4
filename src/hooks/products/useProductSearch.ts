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

/**
 * Hook compuesto para búsqueda avanzada de productos
 * Incluye múltiples algoritmos de búsqueda, sugerencias y historial
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
      const prices = products.map(p => p.price || 0).filter(p => p > 0)
      setSearchFilters(prev => ({
        ...prev,
        priceRange: {
          min: Math.min(...prices),
          max: Math.max(...prices)
        }
      }))
    }
  }, [products])

  // Algoritmo de búsqueda simple
  const simpleSearch = useCallback((products: Product[], searchQuery: string): SearchResult[] => {
    if (!searchQuery) return []

    const query = searchQuery.toLowerCase()
    const results: SearchResult[] = []

    products.forEach(product => {
      let score = 0
      const matches: SearchResult['matches'] = []

      config.fields.forEach(field => {
        const value = product[field as keyof Product]
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase()
          const index = lowerValue.indexOf(query)
          
          if (index !== -1) {
            // Puntuación basada en posición y longitud
            const positionScore = index === 0 ? 10 : 5
            const lengthScore = query.length / value.length * 5
            score += positionScore + lengthScore

            // Resaltar coincidencias
            const highlighted = value.replace(
              new RegExp(query, 'gi'),
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

  // Algoritmo de búsqueda fuzzy
  const fuzzySearch = useCallback((products: Product[], searchQuery: string): SearchResult[] => {
    if (!searchQuery) return []

    const results: SearchResult[] = []

    products.forEach(product => {
      let score = 0
      const matches: SearchResult['matches'] = []

      config.fields.forEach(field => {
        const value = product[field as keyof Product]
        if (typeof value === 'string') {
          const fuzzyScore = calculateFuzzyScore(value.toLowerCase(), searchQuery.toLowerCase())
          
          if (fuzzyScore > 0.3) { // Umbral de similitud
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

  // Algoritmo de búsqueda avanzada con operadores
  const advancedSearch = useCallback((products: Product[], searchQuery: string): SearchResult[] => {
    if (!searchQuery) return []

    // Parsear query avanzada (ej: "name:samsung AND price:>500")
    const tokens = parseAdvancedQuery(searchQuery)
    const results: SearchResult[] = []

    products.forEach(product => {
      let score = 0
      const matches: SearchResult['matches'] = []
      let matchesAllConditions = true

      tokens.forEach(token => {
        const fieldMatch = evaluateToken(product, token)
        
        if (token.operator === 'AND' && !fieldMatch.matches) {
          matchesAllConditions = false
        } else if (token.operator === 'OR' && fieldMatch.matches) {
          score += fieldMatch.score
          matches.push(...fieldMatch.matches)
        } else if (!token.operator && fieldMatch.matches) {
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

  // Búsqueda semántica (simulada)
  const semanticSearch = useCallback((products: Product[], searchQuery: string): SearchResult[] => {
    // En una implementación real, esto usaría embeddings y similitud coseno
    // Por ahora, usamos sinónimos y palabras relacionadas
    const synonyms: Record<string, string[]> = {
      'teléfono': ['smartphone', 'móvil', 'celular'],
      'computadora': ['laptop', 'pc', 'ordenador'],
      'barato': ['económico', 'bajo precio', 'oferta'],
      'caro': ['premium', 'alto precio', 'lujo']
    }

    let expandedQuery = searchQuery.toLowerCase()
    
    // Expandir query con sinónimos
    Object.entries(synonyms).forEach(([word, syns]) => {
      if (expandedQuery.includes(word)) {
        expandedQuery += ' ' + syns.join(' ')
      }
    })

    return simpleSearch(products, expandedQuery)
  }, [simpleSearch])

  // Ejecutar búsqueda según el modo
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

    // Aplicar filtros adicionales
    return applySearchFilters(results, searchFilters)
  }, [products, debouncedQuery, searchMode, searchFilters, config.minLength, 
      simpleSearch, fuzzySearch, advancedSearch, semanticSearch])

  // Aplicar filtros a los resultados
  const applySearchFilters = useCallback((
    results: SearchResult[], 
    filters: SearchFilters
  ): SearchResult[] => {
    return results.filter(({ product }) => {
      // Filtro por categorías
      if (filters.categories.length > 0 && 
          !filters.categories.includes(product.category?.id || '')) {
        return false
      }

      // Filtro por proveedores
      if (filters.suppliers.length > 0 && 
          !filters.suppliers.includes(product.supplier?.id || '')) {
        return false
      }

      // Filtro por rango de precio
      const price = product.price || 0
      if (price < filters.priceRange.min || price > filters.priceRange.max) {
        return false
      }

      // Filtro por estado de stock
      if (filters.stockStatus.length > 0 && 
          !filters.stockStatus.includes(product.stock_status || '')) {
        return false
      }

      return true
    })
  }, [])

  // Generar sugerencias
  const suggestions = useMemo((): SearchSuggestion[] => {
    if (!query || query.length < 2) return []

    const suggestions: SearchSuggestion[] = []
    const queryLower = query.toLowerCase()

    // Sugerencias de productos
    products.forEach(product => {
      if (product.name?.toLowerCase().includes(queryLower)) {
        suggestions.push({
          text: product.name,
          type: 'product',
          count: 1
        })
      }
    })

    // Sugerencias de categorías
    const categories = new Set(products.map(p => p.category?.name).filter(Boolean))
    categories.forEach(category => {
      if (category!.toLowerCase().includes(queryLower)) {
        const count = products.filter(p => p.category?.name === category).length
        suggestions.push({
          text: category!,
          type: 'category',
          count
        })
      }
    })

    // Sugerencias de proveedores
    const suppliers = new Set(products.map(p => p.supplier?.name).filter(Boolean))
    suppliers.forEach(supplier => {
      if (supplier!.toLowerCase().includes(queryLower)) {
        const count = products.filter(p => p.supplier?.name === supplier).length
        suggestions.push({
          text: supplier!,
          type: 'supplier',
          count
        })
      }
    })

    return suggestions.slice(0, 10)
  }, [query, products])

  // Guardar búsqueda en historial
  const saveSearch = useCallback((searchQuery: string, resultsCount: number) => {
    const historyEntry: SearchHistory = {
      query: searchQuery,
      timestamp: new Date(),
      resultsCount
    }

    setSearchHistory(prev => {
      const filtered = prev.filter(entry => entry.query !== searchQuery)
      return [historyEntry, ...filtered].slice(0, 20) // Mantener últimas 20
    })
  }, [])

  // Ejecutar búsqueda
  const search = useCallback((searchQuery: string) => {
    setQuery(searchQuery)
    if (searchQuery && searchResults.length >= 0) {
      saveSearch(searchQuery, searchResults.length)
    }
  }, [searchResults.length, saveSearch])

  // Limpiar búsqueda
  const clearSearch = useCallback(() => {
    setQuery('')
  }, [])

  // Limpiar historial
  const clearHistory = useCallback(() => {
    setSearchHistory([])
  }, [])

  return {
    // Estado de búsqueda
    query,
    searchResults,
    suggestions,
    searchHistory,
    searchMode,
    searchFilters,
    
    // Funciones de búsqueda
    search,
    setQuery,
    clearSearch,
    
    // Configuración
    setSearchMode,
    setSearchFilters,
    
    // Historial
    clearHistory,
    
    // Utilidades
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
  const matrix = []
  
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
  // Implementación simplificada de resaltado fuzzy
  return text.replace(new RegExp(query, 'gi'), match => `<mark>${match}</mark>`)
}

function parseAdvancedQuery(query: string): any[] {
  // Implementación simplificada de parser de query avanzada
  return [{ field: 'name', value: query, operator: null }]
}

function evaluateToken(product: Product, token: any): { matches: boolean, score: number, matches: any[] } {
  // Implementación simplificada de evaluación de tokens
  return { matches: true, score: 1, matches: [] }
}