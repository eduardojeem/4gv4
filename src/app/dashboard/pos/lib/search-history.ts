/**
 * Search History - Gestión de historial de búsquedas
 * 
 * Características:
 * - Historial de búsquedas recientes
 * - Búsquedas frecuentes
 * - Productos recientemente vistos
 * - Persistencia en localStorage
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SearchHistoryEntry {
  query: string
  timestamp: Date
  results_count: number
}

export interface FrequentSearch {
  query: string
  count: number
  last_used: Date
}

export interface RecentProduct {
  product_id: string
  product_name: string
  timestamp: Date
  view_count: number
}

export interface SearchStats {
  total_searches: number
  unique_searches: number
  average_results: number
  most_common_query: string | null
}

// ============================================================================
// Search History Class
// ============================================================================

class SearchHistory {
  private readonly STORAGE_KEY_HISTORY = 'pos_search_history'
  private readonly STORAGE_KEY_FREQUENT = 'pos_frequent_searches'
  private readonly STORAGE_KEY_RECENT = 'pos_recent_products'

  private readonly MAX_HISTORY = 50
  private readonly MAX_FREQUENT = 20
  private readonly MAX_RECENT = 30

  private history: SearchHistoryEntry[] = []
  private frequent: Map<string, FrequentSearch> = new Map()
  private recent: Map<string, RecentProduct> = new Map()

  constructor() {
    this.loadFromStorage()
  }

  // ==========================================================================
  // Search History
  // ==========================================================================

  /**
   * Add search to history
   */
  addSearch(query: string, resultsCount: number): void {
    if (!query.trim()) return

    const normalizedQuery = query.trim().toLowerCase()

    // Add to history
    this.history.unshift({
      query: normalizedQuery,
      timestamp: new Date(),
      results_count: resultsCount,
    })

    // Keep only MAX_HISTORY entries
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(0, this.MAX_HISTORY)
    }

    // Update frequent searches
    this.updateFrequentSearch(normalizedQuery)

    // Save to storage
    this.saveToStorage()
  }

  /**
   * Get recent searches
   */
  getRecentSearches(limit: number = 10): SearchHistoryEntry[] {
    return this.history.slice(0, limit)
  }

  /**
   * Get unique recent searches
   */
  getUniqueRecentSearches(limit: number = 10): string[] {
    const seen = new Set<string>()
    const unique: string[] = []

    for (const entry of this.history) {
      if (!seen.has(entry.query)) {
        seen.add(entry.query)
        unique.push(entry.query)

        if (unique.length >= limit) break
      }
    }

    return unique
  }

  /**
   * Clear search history
   */
  clearHistory(): void {
    this.history = []
    this.saveToStorage()
  }

  // ==========================================================================
  // Frequent Searches
  // ==========================================================================

  /**
   * Update frequent search
   */
  private updateFrequentSearch(query: string): void {
    const existing = this.frequent.get(query)

    if (existing) {
      existing.count += 1
      existing.last_used = new Date()
    } else {
      this.frequent.set(query, {
        query,
        count: 1,
        last_used: new Date(),
      })
    }

    // Keep only top MAX_FREQUENT
    if (this.frequent.size > this.MAX_FREQUENT) {
      const sorted = Array.from(this.frequent.values()).sort(
        (a, b) => b.count - a.count
      )

      this.frequent.clear()

      for (let i = 0; i < this.MAX_FREQUENT; i++) {
        this.frequent.set(sorted[i].query, sorted[i])
      }
    }
  }

  /**
   * Get frequent searches
   */
  getFrequentSearches(limit: number = 10): FrequentSearch[] {
    return Array.from(this.frequent.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Clear frequent searches
   */
  clearFrequent(): void {
    this.frequent.clear()
    this.saveToStorage()
  }

  // ==========================================================================
  // Recent Products
  // ==========================================================================

  /**
   * Add product to recent
   */
  addRecentProduct(productId: string, productName: string): void {
    const existing = this.recent.get(productId)

    if (existing) {
      existing.timestamp = new Date()
      existing.view_count += 1
    } else {
      this.recent.set(productId, {
        product_id: productId,
        product_name: productName,
        timestamp: new Date(),
        view_count: 1,
      })
    }

    // Keep only MAX_RECENT entries
    if (this.recent.size > this.MAX_RECENT) {
      const sorted = Array.from(this.recent.values()).sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      )

      this.recent.clear()

      for (let i = 0; i < this.MAX_RECENT; i++) {
        this.recent.set(sorted[i].product_id, sorted[i])
      }
    }

    this.saveToStorage()
  }

  /**
   * Get recent products
   */
  getRecentProducts(limit: number = 10): RecentProduct[] {
    return Array.from(this.recent.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Clear recent products
   */
  clearRecent(): void {
    this.recent.clear()
    this.saveToStorage()
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get search statistics
   */
  getStats(): SearchStats {
    const uniqueQueries = new Set(this.history.map((h) => h.query))

    const totalResults = this.history.reduce(
      (sum, h) => sum + h.results_count,
      0
    )

    const mostCommon = this.getFrequentSearches(1)[0]

    return {
      total_searches: this.history.length,
      unique_searches: uniqueQueries.size,
      average_results:
        this.history.length > 0 ? totalResults / this.history.length : 0,
      most_common_query: mostCommon?.query || null,
    }
  }

  // ==========================================================================
  // Suggestions
  // ==========================================================================

  /**
   * Get search suggestions based on input
   */
  getSuggestions(input: string, limit: number = 5): string[] {
    if (!input.trim()) {
      // Return frequent searches if no input
      return this.getFrequentSearches(limit).map((s) => s.query)
    }

    const normalizedInput = input.toLowerCase()

    // Find matching queries from history
    const matches = new Set<string>()

    // Check frequent searches first
    for (const search of this.frequent.values()) {
      if (search.query.includes(normalizedInput)) {
        matches.add(search.query)
      }
    }

    // Then check history
    for (const entry of this.history) {
      if (entry.query.includes(normalizedInput)) {
        matches.add(entry.query)
      }

      if (matches.size >= limit) break
    }

    return Array.from(matches).slice(0, limit)
  }

  // ==========================================================================
  // Storage
  // ==========================================================================

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      // Load history
      const historyJson = localStorage.getItem(this.STORAGE_KEY_HISTORY)
      if (historyJson) {
        const parsed = JSON.parse(historyJson)
        this.history = parsed.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }))
      }

      // Load frequent
      const frequentJson = localStorage.getItem(this.STORAGE_KEY_FREQUENT)
      if (frequentJson) {
        const parsed = JSON.parse(frequentJson)
        this.frequent = new Map(
          parsed.map((entry: any) => [
            entry.query,
            {
              ...entry,
              last_used: new Date(entry.last_used),
            },
          ])
        )
      }

      // Load recent
      const recentJson = localStorage.getItem(this.STORAGE_KEY_RECENT)
      if (recentJson) {
        const parsed = JSON.parse(recentJson)
        this.recent = new Map(
          parsed.map((entry: any) => [
            entry.product_id,
            {
              ...entry,
              timestamp: new Date(entry.timestamp),
            },
          ])
        )
      }
    } catch (error) {
      console.error('Failed to load search history from storage:', error)
    }
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      // Save history
      localStorage.setItem(
        this.STORAGE_KEY_HISTORY,
        JSON.stringify(this.history)
      )

      // Save frequent
      localStorage.setItem(
        this.STORAGE_KEY_FREQUENT,
        JSON.stringify(Array.from(this.frequent.values()))
      )

      // Save recent
      localStorage.setItem(
        this.STORAGE_KEY_RECENT,
        JSON.stringify(Array.from(this.recent.values()))
      )
    } catch (error) {
      console.error('Failed to save search history to storage:', error)
    }
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.history = []
    this.frequent.clear()
    this.recent.clear()
    this.saveToStorage()
  }

  /**
   * Export data
   */
  exportData(): {
    history: SearchHistoryEntry[]
    frequent: FrequentSearch[]
    recent: RecentProduct[]
  } {
    return {
      history: this.history,
      frequent: Array.from(this.frequent.values()),
      recent: Array.from(this.recent.values()),
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const searchHistory = new SearchHistory()
