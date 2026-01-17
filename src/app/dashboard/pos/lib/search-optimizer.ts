/**
 * Optimizador de búsqueda para el POS
 * Implementa índices y búsqueda eficiente
 */

import type { Product } from '@/types/product-unified'

export interface SearchIndex {
  productId: string
  searchableText: string
  tokens: string[]
  category: string
  price: number
  stock: number
}

export class SearchOptimizer {
  private index: Map<string, SearchIndex> = new Map()
  private tokenIndex: Map<string, Set<string>> = new Map()
  private categoryIndex: Map<string, Set<string>> = new Map()
  private priceRangeIndex: Map<string, Set<string>> = new Map()

  /**
   * Construye el índice de búsqueda
   */
  buildIndex(products: Product[]): void {
    this.index.clear()
    this.tokenIndex.clear()
    this.categoryIndex.clear()
    this.priceRangeIndex.clear()

    for (const product of products) {
      const searchIndex = this.createSearchIndex(product)
      this.index.set(product.id, searchIndex)

      // Índice de tokens
      for (const token of searchIndex.tokens) {
        if (!this.tokenIndex.has(token)) {
          this.tokenIndex.set(token, new Set())
        }
        this.tokenIndex.get(token)!.add(product.id)
      }

      // Índice de categorías
      if (searchIndex.category) {
        if (!this.categoryIndex.has(searchIndex.category)) {
          this.categoryIndex.set(searchIndex.category, new Set())
        }
        this.categoryIndex.get(searchIndex.category)!.add(product.id)
      }

      // Índice de rangos de precio
      const priceRange = this.getPriceRange(searchIndex.price)
      if (!this.priceRangeIndex.has(priceRange)) {
        this.priceRangeIndex.set(priceRange, new Set())
      }
      this.priceRangeIndex.get(priceRange)!.add(product.id)
    }
  }

  /**
   * Crea un índice de búsqueda para un producto
   */
  private createSearchIndex(product: Product): SearchIndex {
    const categoryName = typeof product.category === 'object' 
      ? product.category?.name || '' 
      : product.category || ''

    const searchableText = [
      product.name,
      product.sku,
      product.barcode || '',
      categoryName,
      product.description || ''
    ].join(' ').toLowerCase()

    const tokens = this.tokenize(searchableText)

    return {
      productId: product.id,
      searchableText,
      tokens,
      category: categoryName,
      price: product.sale_price,
      stock: product.stock_quantity
    }
  }

  /**
   * Tokeniza texto para búsqueda
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(token => token.length > 0)
      .map(token => token.replace(/[^\w]/g, ''))
      .filter(token => token.length > 1) // Ignorar tokens de 1 carácter
  }

  /**
   * Determina el rango de precio
   */
  private getPriceRange(price: number): string {
    if (price < 100) return '0-100'
    if (price < 500) return '100-500'
    if (price < 1000) return '500-1000'
    if (price < 5000) return '1000-5000'
    return '5000+'
  }

  /**
   * Búsqueda optimizada con índices
   */
  search(
    query: string,
    options: {
      category?: string
      minPrice?: number
      maxPrice?: number
      inStock?: boolean
    } = {}
  ): string[] {
    const startTime = performance.now()

    // Si no hay query, usar filtros directamente
    if (!query.trim()) {
      return this.filterByOptions(Array.from(this.index.keys()), options)
    }

    // Tokenizar query
    const queryTokens = this.tokenize(query)
    
    // Búsqueda por tokens
    let candidateIds = this.searchByTokens(queryTokens)

    // Aplicar filtros adicionales
    candidateIds = this.filterByOptions(candidateIds, options)

    // Ordenar por relevancia
    const results = this.rankResults(candidateIds, queryTokens)

    const endTime = performance.now()
    console.log(`Search completed in ${(endTime - startTime).toFixed(2)}ms`)

    return results
  }

  /**
   * Búsqueda por tokens usando índice invertido
   */
  private searchByTokens(tokens: string[]): string[] {
    if (tokens.length === 0) return Array.from(this.index.keys())

    // Obtener productos que contienen el primer token
    const firstToken = tokens[0]
    let results = this.tokenIndex.get(firstToken) || new Set<string>()

    // Intersección con otros tokens (AND logic)
    for (let i = 1; i < tokens.length; i++) {
      const tokenResults = this.tokenIndex.get(tokens[i]) || new Set<string>()
      results = new Set([...results].filter(id => tokenResults.has(id)))
    }

    return Array.from(results)
  }

  /**
   * Aplica filtros adicionales
   */
  private filterByOptions(
    productIds: string[],
    options: {
      category?: string
      minPrice?: number
      maxPrice?: number
      inStock?: boolean
    }
  ): string[] {
    return productIds.filter(id => {
      const searchIndex = this.index.get(id)
      if (!searchIndex) return false

      // Filtro de categoría
      if (options.category && options.category !== 'all') {
        if (searchIndex.category !== options.category) return false
      }

      // Filtro de precio
      if (options.minPrice !== undefined && searchIndex.price < options.minPrice) {
        return false
      }
      if (options.maxPrice !== undefined && searchIndex.price > options.maxPrice) {
        return false
      }

      // Filtro de stock
      if (options.inStock && searchIndex.stock <= 0) {
        return false
      }

      return true
    })
  }

  /**
   * Ordena resultados por relevancia
   */
  private rankResults(productIds: string[], queryTokens: string[]): string[] {
    const scored = productIds.map(id => {
      const searchIndex = this.index.get(id)!
      let score = 0

      // Puntuación por coincidencia exacta
      if (searchIndex.searchableText.includes(queryTokens.join(' '))) {
        score += 100
      }

      // Puntuación por tokens coincidentes
      for (const token of queryTokens) {
        if (searchIndex.tokens.includes(token)) {
          score += 10
        }
      }

      // Puntuación por posición (inicio del texto tiene más peso)
      const firstTokenIndex = searchIndex.searchableText.indexOf(queryTokens[0])
      if (firstTokenIndex === 0) {
        score += 50
      } else if (firstTokenIndex > 0) {
        score += 25
      }

      return { id, score }
    })

    // Ordenar por puntuación descendente
    scored.sort((a, b) => b.score - a.score)

    return scored.map(item => item.id)
  }

  /**
   * Búsqueda por código de barras (exacta)
   */
  searchByBarcode(barcode: string): string | null {
    for (const [id, searchIndex] of this.index.entries()) {
      if (searchIndex.searchableText.includes(barcode)) {
        return id
      }
    }
    return null
  }

  /**
   * Obtiene sugerencias de búsqueda
   */
  getSuggestions(query: string, limit: number = 5): string[] {
    const tokens = this.tokenize(query)
    if (tokens.length === 0) return []

    const suggestions = new Set<string>()

    // Buscar tokens que empiecen con el query
    for (const [token] of this.tokenIndex.entries()) {
      if (token.startsWith(tokens[0])) {
        suggestions.add(token)
        if (suggestions.size >= limit) break
      }
    }

    return Array.from(suggestions)
  }

  /**
   * Obtiene estadísticas del índice
   */
  getStats() {
    return {
      totalProducts: this.index.size,
      totalTokens: this.tokenIndex.size,
      totalCategories: this.categoryIndex.size,
      priceRanges: this.priceRangeIndex.size,
      averageTokensPerProduct: 
        Array.from(this.index.values())
          .reduce((sum, idx) => sum + idx.tokens.length, 0) / this.index.size
    }
  }

  /**
   * Limpia el índice
   */
  clear(): void {
    this.index.clear()
    this.tokenIndex.clear()
    this.categoryIndex.clear()
    this.priceRangeIndex.clear()
  }
}

// Singleton instance
let searchOptimizerInstance: SearchOptimizer | null = null

export function getSearchOptimizer(): SearchOptimizer {
  if (!searchOptimizerInstance) {
    searchOptimizerInstance = new SearchOptimizer()
  }
  return searchOptimizerInstance
}

export function resetSearchOptimizer(): void {
  searchOptimizerInstance = null
}
