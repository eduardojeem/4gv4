/**
 * Hook para búsqueda inteligente de productos
 * Incluye corrección de errores tipográficos, sugerencias y búsqueda semántica
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useDebounce } from '@/hooks/use-debounce'

interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  description?: string
  category: string
  price: number
  stock: number
  tags?: string[]
}

interface SearchResult {
  product: Product
  score: number
  matchType: 'exact' | 'partial' | 'fuzzy' | 'semantic' | 'category' | 'barcode'
  matchedField: string
  highlightedName: string
}

interface SearchSuggestion {
  text: string
  type: 'product' | 'category' | 'brand' | 'recent'
  count?: number
}

interface UseSmartSearchOptions {
  products: Product[]
  maxResults?: number
  enableFuzzySearch?: boolean
  enableSemanticSearch?: boolean
  minQueryLength?: number
  debounceMs?: number
}

export function useSmartSearch({
  products,
  maxResults = 20,
  enableFuzzySearch = true,
  enableSemanticSearch = true,
  minQueryLength = 1,
  debounceMs = 300
}: UseSmartSearchOptions) {
  
  const [query, setQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const debouncedQuery = useDebounce(query, debounceMs)
  const searchCacheRef = useRef<Map<string, SearchResult[]>>(new Map())

  // Función para calcular distancia de Levenshtein (para fuzzy search)
  const levenshteinDistance = useCallback((str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }, [])

  // Función para resaltar coincidencias
  const highlightMatch = useCallback((text: string, query: string): string => {
    if (!query) return text
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
  }, [])

  // Función para búsqueda exacta
  const exactSearch = useCallback((products: Product[], query: string): SearchResult[] => {
    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()
    
    products.forEach(product => {
      const lowerName = product.name.toLowerCase()
      const lowerSku = product.sku.toLowerCase()
      const lowerDescription = product.description?.toLowerCase() || ''
      
      // Coincidencia exacta en nombre
      if (lowerName === lowerQuery) {
        results.push({
          product,
          score: 100,
          matchType: 'exact',
          matchedField: 'name',
          highlightedName: highlightMatch(product.name, query)
        })
      }
      // Coincidencia exacta en SKU
      else if (lowerSku === lowerQuery) {
        results.push({
          product,
          score: 95,
          matchType: 'exact',
          matchedField: 'sku',
          highlightedName: highlightMatch(product.name, query)
        })
      }
      // Coincidencia exacta en código de barras
      else if (product.barcode === query) {
        results.push({
          product,
          score: 90,
          matchType: 'barcode',
          matchedField: 'barcode',
          highlightedName: product.name
        })
      }
    })
    
    return results
  }, [highlightMatch])

  // Función para búsqueda parcial
  const partialSearch = useCallback((products: Product[], query: string): SearchResult[] => {
    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()
    
    products.forEach(product => {
      const lowerName = product.name.toLowerCase()
      const lowerSku = product.sku.toLowerCase()
      const lowerDescription = product.description?.toLowerCase() || ''
      const lowerCategory = product.category.toLowerCase()
      
      let score = 0
      let matchedField = ''
      
      // Coincidencia en nombre (mayor peso)
      if (lowerName.includes(lowerQuery)) {
        const position = lowerName.indexOf(lowerQuery)
        score = 80 - (position * 2) // Mejor score si aparece al principio
        matchedField = 'name'
      }
      // Coincidencia en SKU
      else if (lowerSku.includes(lowerQuery)) {
        score = 70
        matchedField = 'sku'
      }
      // Coincidencia en descripción
      else if (lowerDescription.includes(lowerQuery)) {
        score = 60
        matchedField = 'description'
      }
      // Coincidencia en categoría
      else if (lowerCategory.includes(lowerQuery)) {
        score = 50
        matchedField = 'category'
      }
      
      if (score > 0) {
        results.push({
          product,
          score,
          matchType: 'partial',
          matchedField,
          highlightedName: highlightMatch(product.name, query)
        })
      }
    })
    
    return results
  }, [highlightMatch])

  // Función para búsqueda fuzzy (con errores tipográficos)
  const fuzzySearch = useCallback((products: Product[], query: string): SearchResult[] => {
    if (!enableFuzzySearch || query.length < 3) return []
    
    const results: SearchResult[] = []
    const maxDistance = Math.floor(query.length / 3) // Permitir 1 error cada 3 caracteres
    
    products.forEach(product => {
      const words = product.name.toLowerCase().split(' ')
      
      words.forEach(word => {
        if (word.length >= 3) {
          const distance = levenshteinDistance(query.toLowerCase(), word)
          if (distance <= maxDistance) {
            const score = Math.max(0, 40 - (distance * 10))
            results.push({
              product,
              score,
              matchType: 'fuzzy',
              matchedField: 'name',
              highlightedName: highlightMatch(product.name, word)
            })
          }
        }
      })
    })
    
    return results
  }, [enableFuzzySearch, levenshteinDistance, highlightMatch])

  // Función para búsqueda semántica (palabras relacionadas)
  const semanticSearch = useCallback((products: Product[], query: string): SearchResult[] => {
    if (!enableSemanticSearch) return []
    
    const results: SearchResult[] = []
    const synonyms: Record<string, string[]> = {
      'celular': ['teléfono', 'móvil', 'smartphone', 'phone'],
      'cargador': ['cable', 'adaptador', 'fuente'],
      'funda': ['case', 'protector', 'carcasa'],
      'pantalla': ['display', 'screen', 'lcd'],
      'batería': ['pila', 'battery'],
      'auricular': ['audífono', 'headphone', 'earphone'],
      'memoria': ['storage', 'almacenamiento', 'sd'],
      'tablet': ['ipad', 'tableta']
    }
    
    const lowerQuery = query.toLowerCase()
    const relatedWords: string[] = []
    
    // Buscar sinónimos
    Object.entries(synonyms).forEach(([key, values]) => {
      if (key.includes(lowerQuery) || values.some(v => v.includes(lowerQuery))) {
        relatedWords.push(key, ...values)
      }
    })
    
    if (relatedWords.length > 0) {
      products.forEach(product => {
        const lowerName = product.name.toLowerCase()
        const lowerDescription = product.description?.toLowerCase() || ''
        
        relatedWords.forEach(word => {
          if (lowerName.includes(word) || lowerDescription.includes(word)) {
            results.push({
              product,
              score: 30,
              matchType: 'semantic',
              matchedField: 'name',
              highlightedName: highlightMatch(product.name, word)
            })
          }
        })
      })
    }
    
    return results
  }, [enableSemanticSearch, highlightMatch])

  // Función principal de búsqueda
  const performSearch = useCallback((searchQuery: string): SearchResult[] => {
    if (!searchQuery || searchQuery.length < minQueryLength) {
      return []
    }

    // Verificar caché
    const cacheKey = searchQuery.toLowerCase()
    if (searchCacheRef.current.has(cacheKey)) {
      return searchCacheRef.current.get(cacheKey)!
    }

    setIsSearching(true)

    try {
      const allResults: SearchResult[] = []
      
      // 1. Búsqueda exacta (mayor prioridad)
      allResults.push(...exactSearch(products, searchQuery))
      
      // 2. Búsqueda parcial
      allResults.push(...partialSearch(products, searchQuery))
      
      // 3. Búsqueda fuzzy (errores tipográficos)
      allResults.push(...fuzzySearch(products, searchQuery))
      
      // 4. Búsqueda semántica
      allResults.push(...semanticSearch(products, searchQuery))
      
      // Eliminar duplicados y ordenar por score
      const uniqueResults = allResults.reduce((acc, result) => {
        const existing = acc.find(r => r.product.id === result.product.id)
        if (!existing || existing.score < result.score) {
          return [...acc.filter(r => r.product.id !== result.product.id), result]
        }
        return acc
      }, [] as SearchResult[])
      
      const sortedResults = uniqueResults
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
      
      // Guardar en caché
      searchCacheRef.current.set(cacheKey, sortedResults)
      
      return sortedResults
    } finally {
      setIsSearching(false)
    }
  }, [products, minQueryLength, maxResults, exactSearch, partialSearch, fuzzySearch, semanticSearch])

  // Resultados de búsqueda
  const searchResults = useMemo(() => {
    return performSearch(debouncedQuery)
  }, [debouncedQuery, performSearch])

  // Generar sugerencias
  const suggestions = useMemo((): SearchSuggestion[] => {
    const suggestions: SearchSuggestion[] = []
    
    if (query.length === 0) {
      // Mostrar búsquedas recientes
      recentSearches.slice(0, 5).forEach(search => {
        suggestions.push({
          text: search,
          type: 'recent'
        })
      })
      
      // Mostrar categorías populares
      const categories = [...new Set(products.map(p => p.category))]
      categories.slice(0, 5).forEach(category => {
        const count = products.filter(p => p.category === category).length
        suggestions.push({
          text: category,
          type: 'category',
          count
        })
      })
    } else if (query.length >= 2) {
      // Sugerencias basadas en productos
      const lowerQuery = query.toLowerCase()
      const productSuggestions = products
        .filter(p => p.name.toLowerCase().includes(lowerQuery))
        .slice(0, 5)
        .map(p => ({
          text: p.name,
          type: 'product' as const
        }))
      
      suggestions.push(...productSuggestions)
      
      // Sugerencias de categorías
      const categorySuggestions = [...new Set(products.map(p => p.category))]
        .filter(c => c.toLowerCase().includes(lowerQuery))
        .slice(0, 3)
        .map(c => ({
          text: c,
          type: 'category' as const,
          count: products.filter(p => p.category === c).length
        }))
      
      suggestions.push(...categorySuggestions)
    }
    
    return suggestions
  }, [query, products, recentSearches])

  // Función para agregar a búsquedas recientes
  const addToRecentSearches = useCallback((searchQuery: string) => {
    if (searchQuery.trim()) {
      setRecentSearches(prev => {
        const filtered = prev.filter(s => s !== searchQuery)
        return [searchQuery, ...filtered].slice(0, 10)
      })
    }
  }, [])

  // Limpiar caché cuando cambien los productos
  useEffect(() => {
    searchCacheRef.current.clear()
  }, [products])

  return {
    query,
    setQuery,
    searchResults,
    suggestions,
    isSearching,
    addToRecentSearches,
    clearRecentSearches: () => setRecentSearches([]),
    clearCache: () => searchCacheRef.current.clear()
  }
}