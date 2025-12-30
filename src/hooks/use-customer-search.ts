import { useState, useMemo, useCallback } from 'react'
import { useCustomers } from './use-customers'
import { type Customer } from './use-customer-state'
import { useDebounce } from './use-debounce'

interface CustomerSearchOptions {
  debounceMs?: number
  maxResults?: number
  includeInactive?: boolean
  prioritizeRecent?: boolean
}

interface CustomerWithScore {
  customer: Customer
  score: number
  matchType: 'name' | 'phone' | 'email' | 'exact'
}

interface CustomerUsageStats {
  customerId: string
  count: number
  lastUsed: number
}

// Advanced fuzzy search with scoring
function calculateSearchScore(customer: Customer, query: string): CustomerWithScore | null {
  const queryLower = query.toLowerCase().trim()
  if (!queryLower) return null

  const fullName = (customer.name || '').toLowerCase()
  const nameWords = fullName.split(' ').filter(Boolean)
  const firstName = nameWords[0] || ''
  const lastName = nameWords.slice(1).join(' ') || ''
  const phone = (customer.phone || '').replace(/\D/g, '')
  const email = (customer.email || '').toLowerCase()
  const queryDigits = query.replace(/\D/g, '')

  let score = 0
  let matchType: CustomerWithScore['matchType'] = 'name'

  // Exact name match (highest priority)
  if (fullName === queryLower || firstName === queryLower || lastName === queryLower) {
    return { customer, score: 100, matchType: 'exact' }
  }

  // Phone number exact match (very high priority)
  if (queryDigits && queryDigits.length >= 4) {
    if (phone === queryDigits) {
      return { customer, score: 95, matchType: 'phone' }
    }
    // Phone starts with query
    if (phone.startsWith(queryDigits)) {
      score = Math.max(score, 85 + (queryDigits.length / phone.length) * 10)
      matchType = 'phone'
    }
    // Phone contains query (for partial matches)
    else if (phone.includes(queryDigits)) {
      score = Math.max(score, 70 + (queryDigits.length / phone.length) * 10)
      matchType = 'phone'
    }
  }

  // Name matching with improved scoring
  if (fullName.startsWith(queryLower)) {
    score = Math.max(score, 80)
    matchType = score === 80 ? 'name' : matchType
  }
  else if (firstName.startsWith(queryLower) || lastName.startsWith(queryLower)) {
    score = Math.max(score, 75)
    matchType = score === 75 ? 'name' : matchType
  }
  else if (fullName.includes(queryLower)) {
    score = Math.max(score, 60)
    matchType = score === 60 ? 'name' : matchType
  }
  else {
    // Fuzzy name matching with word-by-word comparison
    const queryWords = queryLower.split(' ').filter(Boolean)
    
    let wordMatchScore = 0
    for (const queryWord of queryWords) {
      for (const nameWord of nameWords) {
        if (nameWord.startsWith(queryWord)) {
          wordMatchScore += 40 * (queryWord.length / nameWord.length)
        } else if (nameWord.includes(queryWord)) {
          wordMatchScore += 20 * (queryWord.length / nameWord.length)
        }
      }
    }
    
    if (wordMatchScore > 0) {
      score = Math.max(score, wordMatchScore)
      matchType = score === wordMatchScore ? 'name' : matchType
    }
  }

  // Email matching (lower priority)
  if (email && email.includes(queryLower)) {
    const emailScore = 50 + (queryLower.length / email.length) * 20
    if (emailScore > score) {
      score = emailScore
      matchType = 'email'
    } else {
      score += emailScore * 0.3
    }
  }

  return score > 0 ? { customer, score, matchType } : null
}

// Get customer usage statistics from localStorage
function getCustomerUsageStats(): CustomerUsageStats[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem('customer-usage-stats')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useCustomerSearch(options: CustomerSearchOptions = {}) {
  const {
    debounceMs = 200,
    maxResults = 20,
    includeInactive = false,
    prioritizeRecent = true
  } = options

  const customersHook = useCustomers()
  // Use allCustomers instead of customers to get unfiltered data
  const { allCustomers: customers, isLoading, error } = customersHook
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, debounceMs)

  // Filter active customers if needed
  const activeCustomers = useMemo(() => {
    return includeInactive 
      ? customers 
      : customers.filter(c => c.status === 'active')
  }, [customers, includeInactive])

  // Get usage statistics
  const usageStats = useMemo(() => {
    const stats = getCustomerUsageStats()
    return new Map(stats.map(s => [s.customerId, s]))
  }, [])

  // Search and score customers
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) {
      // Return most used customers when no search query
      if (prioritizeRecent) {
        return activeCustomers
          .map(customer => {
            const stats = usageStats.get(customer.id)
            return {
              customer,
              score: (stats?.count || 0) * 10 + (stats?.lastUsed || 0) / 1000000,
              matchType: 'name' as const
            }
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, maxResults)
      }
      
      return activeCustomers
        .slice(0, maxResults)
        .map(customer => ({
          customer,
          score: 0,
          matchType: 'name' as const
        }))
    }

    // Perform search with scoring
    const results: CustomerWithScore[] = []
    
    for (const customer of activeCustomers) {
      const result = calculateSearchScore(customer, debouncedQuery)
      if (result) {
        // Boost score for frequently used customers
        const stats = usageStats.get(customer.id)
        if (stats && prioritizeRecent) {
          result.score += Math.min(stats.count * 2, 20)
          
          // Boost recent customers
          const daysSinceLastUse = (Date.now() - stats.lastUsed) / (1000 * 60 * 60 * 24)
          if (daysSinceLastUse < 7) {
            result.score += 10
          }
        }
        
        results.push(result)
      }
    }

    return results
      .sort((a, b) => {
        // First sort by match type priority
        const typeOrder = { exact: 4, name: 3, phone: 2, email: 1 }
        const typeDiff = typeOrder[b.matchType] - typeOrder[a.matchType]
        if (typeDiff !== 0) return typeDiff
        
        // Then by score
        return b.score - a.score
      })
      .slice(0, maxResults)
  }, [activeCustomers, debouncedQuery, usageStats, prioritizeRecent, maxResults])

  // Get recent customers (last 7 days)
  const recentCustomers = useMemo(() => {
    if (!prioritizeRecent) return []
    
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    const recentStats = Array.from(usageStats.values())
      .filter(s => s.lastUsed > weekAgo)
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, 5)
    
    return recentStats
      .map(s => activeCustomers.find(c => c.id === s.customerId))
      .filter(Boolean) as Customer[]
  }, [activeCustomers, usageStats, prioritizeRecent])

  // Get favorite customers (most used)
  const favoriteCustomers = useMemo(() => {
    if (!prioritizeRecent) return []
    
    const favoriteStats = Array.from(usageStats.values())
      .filter(s => s.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
    
    return favoriteStats
      .map(s => activeCustomers.find(c => c.id === s.customerId))
      .filter(Boolean) as Customer[]
  }, [activeCustomers, usageStats, prioritizeRecent])

  // Update customer usage
  const updateUsage = useCallback((customerId: string) => {
    try {
      if (typeof window === 'undefined') return
      
      const stats = getCustomerUsageStats()
      const existing = stats.find(s => s.customerId === customerId)
      
      if (existing) {
        existing.count++
        existing.lastUsed = Date.now()
      } else {
        stats.push({
          customerId,
          count: 1,
          lastUsed: Date.now()
        })
      }
      
      // Keep only top 100 most used customers
      const sorted = stats
        .sort((a, b) => b.count - a.count)
        .slice(0, 100)
      
      localStorage.setItem('customer-usage-stats', JSON.stringify(sorted))
    } catch (error) {
      console.warn('Error updating customer usage:', error)
    }
  }, [])

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('')
  }, [])

  // Get customer by ID
  const getCustomerById = useCallback((id: string) => {
    return activeCustomers.find(c => c.id === id)
  }, [activeCustomers])

  // Get usage info for a customer
  const getUsageInfo = useCallback((customerId: string) => {
    return usageStats.get(customerId)
  }, [usageStats])

  // Refresh customers function
  const refreshCustomers = useCallback(async () => {
    if (customersHook.actions?.loadCustomers) {
      await customersHook.actions.loadCustomers()
    }
  }, [customersHook.actions])

  return {
    // Search state
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    
    // Results
    searchResults,
    recentCustomers,
    favoriteCustomers,
    
    // Customer data
    customers: activeCustomers,
    isLoading,
    error,
    
    // Actions
    refreshCustomers,
    updateUsage,
    clearSearch,
    getCustomerById,
    getUsageInfo,
    
    // Stats
    totalCustomers: activeCustomers.length,
    hasResults: searchResults.length > 0,
    isSearching: debouncedQuery.trim().length > 0
  }
}