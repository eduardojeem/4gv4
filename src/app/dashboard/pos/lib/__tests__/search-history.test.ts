import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SearchHistoryManager } from '../search-history'

describe('SearchHistoryManager', () => {
  let manager: SearchHistoryManager

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    manager = new SearchHistoryManager()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('search tracking', () => {
    it('should add search to history', () => {
      manager.addSearch('iphone', 5)

      const recent = manager.getRecentSearches()
      expect(recent).toHaveLength(1)
      expect(recent[0].query).toBe('iphone')
      expect(recent[0].results_count).toBe(5)
    })

    it('should track search count', () => {
      manager.addSearch('iphone', 5)
      manager.addSearch('iphone', 5)
      manager.addSearch('iphone', 5)

      const frequent = manager.getFrequentSearches()
      expect(frequent[0].count).toBe(3)
    })

    it('should normalize search queries', () => {
      manager.addSearch('  iPhone  ', 5)
      manager.addSearch('iphone', 5)

      const frequent = manager.getFrequentSearches()
      expect(frequent).toHaveLength(1)
      expect(frequent[0].count).toBe(2)
    })

    it('should limit recent searches', () => {
      for (let i = 0; i < 25; i++) {
        manager.addSearch(`query_${i}`, 1)
      }

      const recent = manager.getRecentSearches()
      expect(recent.length).toBeLessThanOrEqual(20)
    })
  })

  describe('product viewing', () => {
    it('should track viewed products', () => {
      manager.addProductView('prod_1', 'iPhone 13')

      const recent = manager.getRecentProducts()
      expect(recent).toHaveLength(1)
      expect(recent[0].product_id).toBe('prod_1')
      expect(recent[0].product_name).toBe('iPhone 13')
    })

    it('should update view count', () => {
      manager.addProductView('prod_1', 'iPhone 13')
      manager.addProductView('prod_1', 'iPhone 13')

      const recent = manager.getRecentProducts()
      expect(recent[0].view_count).toBe(2)
    })

    it('should update last viewed timestamp', () => {
      const firstView = Date.now()
      manager.addProductView('prod_1', 'iPhone 13')

      // Wait a bit
      vi.useFakeTimers()
      vi.advanceTimersByTime(1000)

      manager.addProductView('prod_1', 'iPhone 13')

      const recent = manager.getRecentProducts()
      expect(recent[0].last_viewed).toBeGreaterThan(firstView)

      vi.useRealTimers()
    })

    it('should limit recent products', () => {
      for (let i = 0; i < 15; i++) {
        manager.addProductView(`prod_${i}`, `Product ${i}`)
      }

      const recent = manager.getRecentProducts()
      expect(recent.length).toBeLessThanOrEqual(10)
    })
  })

  describe('suggestions', () => {
    it('should provide search suggestions', () => {
      manager.addSearch('iphone 13', 5)
      manager.addSearch('iphone 14', 3)
      manager.addSearch('ipad', 2)

      const suggestions = manager.getSuggestions('ip')
      expect(suggestions).toContain('iphone 13')
      expect(suggestions).toContain('iphone 14')
      expect(suggestions).toContain('ipad')
    })

    it('should be case insensitive', () => {
      manager.addSearch('iPhone', 5)

      const suggestions = manager.getSuggestions('ip')
      expect(suggestions).toContain('iPhone')
    })

    it('should limit suggestions', () => {
      for (let i = 0; i < 10; i++) {
        manager.addSearch(`iphone_${i}`, 1)
      }

      const suggestions = manager.getSuggestions('ip', 5)
      expect(suggestions.length).toBeLessThanOrEqual(5)
    })

    it('should return empty array for no matches', () => {
      manager.addSearch('iphone', 5)

      const suggestions = manager.getSuggestions('android')
      expect(suggestions).toEqual([])
    })
  })

  describe('frequent searches', () => {
    it('should sort by frequency', () => {
      manager.addSearch('query_a', 1)
      manager.addSearch('query_a', 1)
      manager.addSearch('query_a', 1)
      
      manager.addSearch('query_b', 1)
      manager.addSearch('query_b', 1)

      const frequent = manager.getFrequentSearches()
      expect(frequent[0].query).toBe('query_a')
      expect(frequent[0].count).toBe(3)
      expect(frequent[1].query).toBe('query_b')
      expect(frequent[1].count).toBe(2)
    })

    it('should limit results', () => {
      for (let i = 0; i < 15; i++) {
        manager.addSearch(`query_${i}`, 1)
      }

      const frequent = manager.getFrequentSearches(5)
      expect(frequent.length).toBeLessThanOrEqual(5)
    })
  })

  describe('statistics', () => {
    it('should provide search statistics', () => {
      manager.addSearch('iphone', 5)
      manager.addSearch('ipad', 3)
      manager.addSearch('macbook', 0)

      const stats = manager.getStats()
      expect(stats.totalSearches).toBe(3)
      expect(stats.uniqueQueries).toBe(3)
      expect(stats.averageResults).toBeCloseTo(2.67, 1)
      expect(stats.emptySearches).toBe(1)
    })

    it('should handle empty history', () => {
      const stats = manager.getStats()
      expect(stats.totalSearches).toBe(0)
      expect(stats.uniqueQueries).toBe(0)
      expect(stats.averageResults).toBe(0)
      expect(stats.emptySearches).toBe(0)
    })
  })

  describe('data persistence', () => {
    it('should persist to localStorage', () => {
      manager.addSearch('iphone', 5)

      const stored = localStorage.getItem('pos_search_history')
      expect(stored).toBeTruthy()
      
      const parsed = JSON.parse(stored!)
      expect(parsed.searches).toHaveLength(1)
    })

    it('should load from localStorage', () => {
      manager.addSearch('iphone', 5)

      // Create new instance
      const newManager = new SearchHistoryManager()
      const recent = newManager.getRecentSearches()

      expect(recent).toHaveLength(1)
      expect(recent[0].query).toBe('iphone')
    })

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('pos_search_history', 'invalid json')

      const newManager = new SearchHistoryManager()
      const recent = newManager.getRecentSearches()

      expect(recent).toEqual([])
    })
  })

  describe('data management', () => {
    it('should clear all history', () => {
      manager.addSearch('iphone', 5)
      manager.addProductView('prod_1', 'iPhone')

      manager.clearHistory()

      expect(manager.getRecentSearches()).toEqual([])
      expect(manager.getRecentProducts()).toEqual([])
    })

    it('should clear search history only', () => {
      manager.addSearch('iphone', 5)
      manager.addProductView('prod_1', 'iPhone')

      manager.clearSearchHistory()

      expect(manager.getRecentSearches()).toEqual([])
      expect(manager.getRecentProducts()).toHaveLength(1)
    })

    it('should clear product history only', () => {
      manager.addSearch('iphone', 5)
      manager.addProductView('prod_1', 'iPhone')

      manager.clearProductHistory()

      expect(manager.getRecentSearches()).toHaveLength(1)
      expect(manager.getRecentProducts()).toEqual([])
    })

    it('should export data', () => {
      manager.addSearch('iphone', 5)
      manager.addProductView('prod_1', 'iPhone')

      const exported = manager.exportData()
      expect(exported.searches).toBeDefined()
      expect(exported.products).toBeDefined()
      expect(exported.stats).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty search query', () => {
      manager.addSearch('', 0)

      const recent = manager.getRecentSearches()
      expect(recent).toEqual([])
    })

    it('should handle whitespace-only query', () => {
      manager.addSearch('   ', 0)

      const recent = manager.getRecentSearches()
      expect(recent).toEqual([])
    })

    it('should handle negative results count', () => {
      manager.addSearch('iphone', -1)

      const recent = manager.getRecentSearches()
      expect(recent[0].results_count).toBe(0)
    })

    it('should handle very long queries', () => {
      const longQuery = 'a'.repeat(200)
      manager.addSearch(longQuery, 5)

      const recent = manager.getRecentSearches()
      expect(recent[0].query.length).toBeLessThanOrEqual(100)
    })
  })
})
