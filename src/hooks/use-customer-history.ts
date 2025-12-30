"use client"

/**
 * useCustomerHistory - Hook consolidado para gestión del historial de clientes
 * 
 * Combina datos de reparaciones, compras y transacciones en una interfaz unificada
 * con filtrado, búsqueda y ordenamiento optimizado.
 */

import React, { useState, useMemo, useCallback } from 'react'
import { useDebounce } from './use-debounce'
import { useCustomerPurchases } from './useCustomerData'
import { useCustomerRepairs } from './useCustomerRepairs'

export interface HistoryItem {
  id: string
  type: 'repair' | 'purchase' | 'payment' | 'note'
  date: string
  title: string
  description: string
  amount?: number
  status: 'completed' | 'pending' | 'cancelled' | 'refunded' | 'in_progress'
  details?: any
  customerId: string
}

export interface HistoryFilters {
  searchTerm: string
  statusFilter: string
  typeFilter: string
  dateFilter: string
  sortBy: 'date' | 'amount'
  sortOrder: 'asc' | 'desc'
}

export interface HistoryStats {
  totalRepairs: number
  totalRepairCost: number
  totalPurchases: number
  totalPurchaseAmount: number
  totalSpent: number
  avgOrderValue: number
  totalRefunds: number
  completedRepairs: number
  pendingRepairs: number
  recentActivity: number
}

const defaultFilters: HistoryFilters = {
  searchTerm: '',
  statusFilter: 'all',
  typeFilter: 'all',
  dateFilter: 'all',
  sortBy: 'date',
  sortOrder: 'desc'
}

export function useCustomerHistory(customerId: string) {
  const [filters, setFilters] = useState<HistoryFilters>(defaultFilters)
  
  // Debounce search term for performance
  const debouncedSearchTerm = useDebounce(filters.searchTerm, 300)

  // Fetch data from existing hooks
  const { data: purchasesData, isLoading: loadingPurchases } = useCustomerPurchases(customerId)
  const { repairs, loading: loadingRepairs, fetchPendingRepairs } = useCustomerRepairs()

  // Fetch repairs when customer changes
  React.useEffect(() => {
    if (customerId) {
      fetchPendingRepairs(customerId)
    }
  }, [customerId, fetchPendingRepairs])

  // Transform and combine all history items
  const allHistoryItems = useMemo(() => {
    const items: HistoryItem[] = []

    // Add purchases
    if (purchasesData && Array.isArray(purchasesData)) {
      purchasesData.forEach((purchase: any) => {
        items.push({
          id: `purchase-${purchase.id || Math.random()}`,
          type: 'purchase',
          date: purchase.created_at || purchase.date || new Date().toISOString(),
          title: `Compra #${String(purchase.id || Math.random()).slice(-6)}`,
          description: `${purchase.items?.length || 0} artículo${(purchase.items?.length || 0) > 1 ? 's' : ''} - ${purchase.payment_method || 'N/A'}`,
          amount: Number(purchase.total) || 0,
          status: purchase.payment_status === 'completed' || purchase.payment_status === 'paid' ? 'completed' : 
                  purchase.payment_status === 'cancelled' ? 'cancelled' :
                  purchase.payment_status === 'refunded' ? 'refunded' : 'pending',
          details: purchase,
          customerId
        })
      })
    }

    // Add repairs
    if (repairs && Array.isArray(repairs)) {
      repairs.forEach((repair: any) => {
        items.push({
          id: `repair-${repair.id || Math.random()}`,
          type: 'repair',
          date: repair.created_at || new Date().toISOString(),
          title: `Reparación #${String(repair.id || Math.random()).slice(-6)}`,
          description: `${repair.device_brand || ''} ${repair.device_model || ''} - ${repair.problem_description || ''}`,
          amount: Number(repair.estimated_cost) || 0,
          status: repair.status === 'completed' ? 'completed' : 
                  repair.status === 'cancelled' ? 'cancelled' : 
                  repair.status === 'in_progress' ? 'in_progress' : 'pending',
          details: repair,
          customerId
        })
      })
    }

    return items
  }, [purchasesData, repairs, customerId])

  // Helper function for date filtering
  const isWithinDateFilter = useCallback((dateStr: string, filter: string) => {
    if (filter === 'all') return true
    
    const date = new Date(dateStr)
    const now = new Date()
    const start = new Date(now)
    
    switch (filter) {
      case 'today':
        start.setHours(0, 0, 0, 0)
        break
      case 'week':
        start.setDate(now.getDate() - 7)
        break
      case 'last_month':
        start.setMonth(now.getMonth() - 1)
        break
      case 'last_3_months':
        start.setMonth(now.getMonth() - 3)
        break
      case 'last_year':
        start.setFullYear(now.getFullYear() - 1)
        break
      default:
        return true
    }
    
    return date >= start && date <= now
  }, [])

  // Filter and sort history items
  const filteredItems = useMemo(() => {
    let filtered = allHistoryItems

    // Filter by type
    if (filters.typeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === filters.typeFilter)
    }

    // Filter by search term
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase()
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)
      )
    }

    // Filter by status
    if (filters.statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === filters.statusFilter)
    }

    // Filter by date
    if (filters.dateFilter !== 'all') {
      filtered = filtered.filter(item => isWithinDateFilter(item.date, filters.dateFilter))
    }

    // Sort items
    return filtered.sort((a, b) => {
      if (filters.sortBy === 'date') {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return filters.sortOrder === 'desc' ? dateB - dateA : dateA - dateB
      } else {
        const amountA = a.amount || 0
        const amountB = b.amount || 0
        return filters.sortOrder === 'desc' ? amountB - amountA : amountA - amountB
      }
    })
  }, [allHistoryItems, filters, debouncedSearchTerm, isWithinDateFilter])

  // Calculate statistics
  const stats = useMemo((): HistoryStats => {
    const repairItems = allHistoryItems.filter(item => item.type === 'repair')
    const purchaseItems = allHistoryItems.filter(item => item.type === 'purchase')
    
    const totalRepairs = repairItems.length
    const totalRepairCost = repairItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    const completedRepairs = repairItems.filter(item => item.status === 'completed').length
    const pendingRepairs = repairItems.filter(item => item.status === 'pending' || item.status === 'in_progress').length
    
    const totalPurchases = purchaseItems.length
    const totalPurchaseAmount = purchaseItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    const avgOrderValue = totalPurchases > 0 ? totalPurchaseAmount / totalPurchases : 0
    
    const totalRefunds = purchaseItems
      .filter(item => item.status === 'refunded')
      .reduce((sum, item) => sum + (item.amount || 0), 0)
    
    const totalSpent = totalRepairCost + totalPurchaseAmount - totalRefunds
    
    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentActivity = allHistoryItems.filter(item => 
      new Date(item.date) >= thirtyDaysAgo
    ).length

    return {
      totalRepairs,
      totalRepairCost,
      totalPurchases,
      totalPurchaseAmount,
      totalSpent,
      avgOrderValue,
      totalRefunds,
      completedRepairs,
      pendingRepairs,
      recentActivity
    }
  }, [allHistoryItems])

  // Filter update functions
  const updateFilter = useCallback((key: keyof HistoryFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateFilters = useCallback((newFilters: Partial<HistoryFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [])

  // Toggle sort order
  const toggleSort = useCallback((sortBy?: 'date' | 'amount') => {
    setFilters(prev => ({
      ...prev,
      sortBy: sortBy || (prev.sortBy === 'date' ? 'amount' : 'date'),
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }))
  }, [])

  // Get items by type
  const getItemsByType = useCallback((type: HistoryItem['type']) => {
    return allHistoryItems.filter(item => item.type === type)
  }, [allHistoryItems])

  // Get recent items
  const getRecentItems = useCallback((limit: number = 5) => {
    return allHistoryItems
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
  }, [allHistoryItems])

  // Export data
  const exportData = useCallback((format: 'json' | 'csv' = 'json') => {
    const dataToExport = filteredItems.map(item => ({
      id: item.id,
      type: item.type,
      date: item.date,
      title: item.title,
      description: item.description,
      amount: item.amount,
      status: item.status
    }))

    if (format === 'csv') {
      const headers = ['ID', 'Tipo', 'Fecha', 'Título', 'Descripción', 'Monto', 'Estado']
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(item => [
          item.id,
          item.type,
          item.date,
          `"${item.title}"`,
          `"${item.description}"`,
          item.amount || 0,
          item.status
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-history-${customerId}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-history-${customerId}-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [filteredItems, customerId])

  return {
    // Data
    allItems: allHistoryItems,
    filteredItems,
    stats,
    
    // Loading states
    isLoading: loadingPurchases || loadingRepairs,
    
    // Filters
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    toggleSort,
    
    // Utilities
    getItemsByType,
    getRecentItems,
    exportData,
    
    // Computed values
    hasData: allHistoryItems.length > 0,
    totalItems: allHistoryItems.length,
    filteredCount: filteredItems.length
  }
}

// Re-export the HistoryItem interface for external use