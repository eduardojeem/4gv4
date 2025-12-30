/**
 * Advanced Search Service
 * 
 * Provides intelligent search capabilities with:
 * - Fuzzy matching with configurable thresholds
 * - Pattern detection (email, phone, RUC, etc.)
 * - Multi-field search with weighted scoring
 * - Search suggestions and autocomplete
 * - Search analytics and optimization
 */

import { Customer } from '@/hooks/use-customer-state'

export interface SearchResult {
  customer: Customer
  score: number
  matchedFields: string[]
  highlights: Record<string, string>
}

export interface SearchOptions {
  fuzzyThreshold?: number
  maxResults?: number
  includeInactive?: boolean
  fieldWeights?: Record<string, number>
  sortBy?: 'score' | 'name' | 'date'
}

export interface SearchSuggestion {
  value: string
  type: 'name' | 'email' | 'phone' | 'city' | 'code' | 'company' | 'ruc'
  count: number
  icon: string
}

class SearchService {
  private searchHistory: string[] = []
  private searchCache = new Map<string, SearchResult[]>()
  private readonly maxCacheSize = 100
  private readonly maxHistorySize = 50

  // Default field weights for scoring
  private readonly defaultWeights = {
    name: 2.0,
    email: 1.8,
    customerCode: 1.9,
    phone: 1.7,
    ruc: 1.6,
    company: 1.4,
    city: 1.2,
    address: 1.0,
    notes: 0.8
  }

  /**
   * Perform intelligent search with fuzzy matching and scoring
   */
  search(
    customers: Customer[], 
    query: string, 
    options: SearchOptions = {}
  ): SearchResult[] {
    if (!query || query.trim().length === 0) {
      return customers.map(customer => ({
        customer,
        score: 100,
        matchedFields: [],
        highlights: {}
      }))
    }

    const normalizedQuery = query.toLowerCase().trim()
    
    // Check cache first
    const cacheKey = `${normalizedQuery}-${JSON.stringify(options)}`
    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!
    }

    const {
      fuzzyThreshold = 30,
      maxResults = 100,
      includeInactive = true,
      fieldWeights = {},
      sortBy = 'score'
    } = options

    const weights = { ...this.defaultWeights, ...fieldWeights }

    // Detect query patterns
    const patterns = this.detectPatterns(normalizedQuery)
    
    // Handle quick filters
    if (patterns.isQuickFilter) {
      const filtered = this.handleQuickFilter(customers, normalizedQuery)
      const results = filtered.map(customer => ({
        customer,
        score: 100,
        matchedFields: ['filter'],
        highlights: {}
      }))
      this.cacheResults(cacheKey, results)
      return results
    }

    // Score all customers
    const scoredResults: SearchResult[] = []

    for (const customer of customers) {
      // Skip inactive customers if not included
      if (!includeInactive && customer.status !== 'active') {
        continue
      }

      const result = this.scoreCustomer(customer, normalizedQuery, patterns, weights, fuzzyThreshold)
      
      if (result.score >= fuzzyThreshold) {
        scoredResults.push(result)
      }
    }

    // Sort results
    this.sortResults(scoredResults, sortBy)

    // Limit results
    const limitedResults = scoredResults.slice(0, maxResults)

    // Cache results
    this.cacheResults(cacheKey, limitedResults)

    // Add to search history
    this.addToHistory(query)

    return limitedResults
  }

  /**
   * Generate search suggestions based on customer data
   */
  generateSuggestions(customers: Customer[], query: string): SearchSuggestion[] {
    if (!query || query.length < 2) return []

    const normalizedQuery = query.toLowerCase()
    const suggestions = new Map<string, SearchSuggestion>()

    for (const customer of customers) {
      // Name suggestions
      if (customer.name?.toLowerCase().includes(normalizedQuery)) {
        this.addSuggestion(suggestions, customer.name, 'name', '👤')
      }

      // Email suggestions
      if (customer.email?.toLowerCase().includes(normalizedQuery)) {
        this.addSuggestion(suggestions, customer.email, 'email', '📧')
      }

      // Phone suggestions
      if (customer.phone?.includes(normalizedQuery)) {
        this.addSuggestion(suggestions, customer.phone, 'phone', '📱')
      }

      // City suggestions
      if (customer.city?.toLowerCase().includes(normalizedQuery)) {
        this.addSuggestion(suggestions, customer.city, 'city', '📍')
      }

      // Customer code suggestions
      if (customer.customerCode?.toLowerCase().includes(normalizedQuery)) {
        this.addSuggestion(suggestions, customer.customerCode, 'code', '#️⃣')
      }

      // Company suggestions
      if (customer.company?.toLowerCase().includes(normalizedQuery)) {
        this.addSuggestion(suggestions, customer.company, 'company', '🏢')
      }

      // RUC suggestions
      if (customer.ruc?.includes(normalizedQuery)) {
        this.addSuggestion(suggestions, customer.ruc, 'ruc', '🆔')
      }
    }

    return Array.from(suggestions.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }

  /**
   * Get search history
   */
  getSearchHistory(): string[] {
    return [...this.searchHistory]
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.searchHistory = []
    localStorage.removeItem('customer-search-history')
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.searchCache.clear()
  }

  // Private methods

  private detectPatterns(query: string) {
    return {
      isEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query),
      isPhone: /^[\d\s\-\+\(\)]+$/.test(query) && query.replace(/\D/g, '').length >= 8,
      isRUC: /^\d{12}$/.test(query.replace(/\D/g, '')),
      isCode: /^CLI-/.test(query.toUpperCase()),
      isQuickFilter: query.includes(':'),
      hasNumbers: /\d/.test(query),
      hasSpecialChars: /[^\w\s]/.test(query)
    }
  }

  private handleQuickFilter(customers: Customer[], query: string): Customer[] {
    const [filterType, filterValue] = query.split(':')
    
    return customers.filter(customer => {
      switch (filterType) {
        case 'customer_type':
          return customer.customer_type === filterValue
        case 'city':
          return customer.city?.toLowerCase() === filterValue.toLowerCase()
        case 'status':
          return customer.status === filterValue
        case 'segment':
          return customer.segment?.toLowerCase() === filterValue.toLowerCase()
        default:
          return true
      }
    })
  }

  private scoreCustomer(
    customer: Customer, 
    query: string, 
    patterns: any, 
    weights: Record<string, number>,
    threshold: number
  ): SearchResult {
    let totalScore = 0
    const matchedFields: string[] = []
    const highlights: Record<string, string> = {}

    // Name matching
    const nameScore = this.fuzzyMatch(customer.name || '', query)
    if (nameScore > threshold) {
      totalScore += nameScore * weights.name
      matchedFields.push('name')
      highlights.name = this.highlightMatch(customer.name || '', query)
    }

    // Email matching
    if (customer.email) {
      let emailScore = 0
      if (patterns.isEmail && customer.email.toLowerCase() === query) {
        emailScore = 100
      } else if (customer.email.toLowerCase().includes(query)) {
        emailScore = 90
      }
      
      if (emailScore > threshold) {
        totalScore += emailScore * weights.email
        matchedFields.push('email')
        highlights.email = this.highlightMatch(customer.email, query)
      }
    }

    // Phone matching
    if (customer.phone) {
      let phoneScore = 0
      const cleanPhone = customer.phone.replace(/\D/g, '')
      const cleanQuery = query.replace(/\D/g, '')
      
      if (patterns.isPhone && cleanPhone.includes(cleanQuery)) {
        phoneScore = 95
      } else if (customer.phone.includes(query)) {
        phoneScore = 85
      }
      
      if (phoneScore > threshold) {
        totalScore += phoneScore * weights.phone
        matchedFields.push('phone')
        highlights.phone = this.highlightMatch(customer.phone, query)
      }
    }

    // Customer code matching
    if (customer.customerCode) {
      let codeScore = 0
      if (patterns.isCode && customer.customerCode.toLowerCase().includes(query)) {
        codeScore = 95
      } else if (customer.customerCode.toLowerCase().includes(query)) {
        codeScore = 90
      }
      
      if (codeScore > threshold) {
        totalScore += codeScore * weights.customerCode
        matchedFields.push('customerCode')
        highlights.customerCode = this.highlightMatch(customer.customerCode, query)
      }
    }

    // RUC matching
    if (customer.ruc) {
      let rucScore = 0
      const cleanRUC = customer.ruc.replace(/\D/g, '')
      const cleanQuery = query.replace(/\D/g, '')
      
      if (patterns.isRUC && cleanRUC === cleanQuery) {
        rucScore = 100
      } else if (customer.ruc.includes(query)) {
        rucScore = 85
      }
      
      if (rucScore > threshold) {
        totalScore += rucScore * weights.ruc
        matchedFields.push('ruc')
        highlights.ruc = this.highlightMatch(customer.ruc, query)
      }
    }

    // City matching
    if (customer.city && customer.city.toLowerCase().includes(query)) {
      const cityScore = 70
      totalScore += cityScore * weights.city
      matchedFields.push('city')
      highlights.city = this.highlightMatch(customer.city, query)
    }

    // Company matching
    if (customer.company && customer.company.toLowerCase().includes(query)) {
      const companyScore = 75
      totalScore += companyScore * weights.company
      matchedFields.push('company')
      highlights.company = this.highlightMatch(customer.company, query)
    }

    // Address matching
    if (customer.address && customer.address.toLowerCase().includes(query)) {
      const addressScore = 50
      totalScore += addressScore * weights.address
      matchedFields.push('address')
      highlights.address = this.highlightMatch(customer.address, query)
    }

    // Notes matching
    if (customer.notes && customer.notes.toLowerCase().includes(query)) {
      const notesScore = 30
      totalScore += notesScore * weights.notes
      matchedFields.push('notes')
      highlights.notes = this.highlightMatch(customer.notes, query)
    }

    // Calculate final score
    const finalScore = matchedFields.length > 0 ? totalScore / matchedFields.length : 0

    return {
      customer,
      score: finalScore,
      matchedFields,
      highlights
    }
  }

  private fuzzyMatch(text: string, query: string): number {
    if (!text || !query) return 0
    
    text = text.toLowerCase()
    query = query.toLowerCase()
    
    // Exact match gets highest score
    if (text === query) return 100
    if (text.includes(query)) return 90
    
    // Calculate fuzzy score
    let score = 0
    let queryIndex = 0
    
    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        score += 1
        queryIndex++
      }
    }
    
    return queryIndex === query.length ? (score / query.length) * 80 : 0
  }

  private highlightMatch(text: string, query: string): string {
    if (!query) return text
    
    const regex = new RegExp(`(${query})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
  }

  private addSuggestion(
    suggestions: Map<string, SearchSuggestion>, 
    value: string, 
    type: SearchSuggestion['type'], 
    icon: string
  ): void {
    const key = `${type}:${value}`
    if (suggestions.has(key)) {
      suggestions.get(key)!.count++
    } else {
      suggestions.set(key, { value, type, count: 1, icon })
    }
  }

  private sortResults(results: SearchResult[], sortBy: string): void {
    results.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.customer.name.localeCompare(b.customer.name)
        case 'date':
          return new Date(b.customer.registration_date).getTime() - 
                 new Date(a.customer.registration_date).getTime()
        case 'score':
        default:
          return b.score - a.score
      }
    })
  }

  private cacheResults(key: string, results: SearchResult[]): void {
    // Implement LRU cache
    if (this.searchCache.size >= this.maxCacheSize) {
      const firstKey = this.searchCache.keys().next().value
      this.searchCache.delete(firstKey)
    }
    this.searchCache.set(key, results)
  }

  private addToHistory(query: string): void {
    if (!query.trim()) return
    
    // Remove if already exists
    this.searchHistory = this.searchHistory.filter(item => item !== query)
    
    // Add to beginning
    this.searchHistory.unshift(query)
    
    // Limit size
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize)
    }
    
    // Persist to localStorage
    try {
      localStorage.setItem('customer-search-history', JSON.stringify(this.searchHistory))
    } catch (error) {
      console.warn('Failed to save search history:', error)
    }
  }
}

export const searchService = new SearchService()
export default searchService