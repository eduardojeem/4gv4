'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { parseISO, isAfter, isBefore, differenceInDays } from 'date-fns'

export interface Promotion {
  id: string
  name: string
  code: string
  description?: string
  type: 'percentage' | 'fixed'
  value: number
  min_purchase?: number
  max_discount?: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
  usage_count?: number
  usage_limit?: number
  created_at?: string
  updated_at?: string
}

export interface PromotionFilters {
  search: string
  status: 'all' | 'active' | 'scheduled' | 'expired' | 'inactive'
  type: 'all' | 'percentage' | 'fixed'
}

export interface PromotionStats {
  total: number
  active: number
  scheduled: number
  expired: number
  inactive: number
  totalUsage: number
  expiringSoon: number
}

export function usePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<PromotionFilters>({
    search: '',
    status: 'all',
    type: 'all'
  })

  const supabase = createClient()

  // Fetch promotions with caching
  const fetchPromotions = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPromotions(data || [])
    } catch (error) {
      console.error('Error fetching promotions:', error)
      toast.error('Error al cargar promociones')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Initial load
  useEffect(() => {
    fetchPromotions()
  }, [fetchPromotions])

  // Filtered promotions
  const filteredPromotions = useMemo(() => {
    return promotions.filter(promo => {
      // Search filter
      const matchesSearch = !filters.search || 
        promo.name.toLowerCase().includes(filters.search.toLowerCase()) || 
        promo.code.toLowerCase().includes(filters.search.toLowerCase()) ||
        (promo.description?.toLowerCase().includes(filters.search.toLowerCase()) ?? false)
      
      // Status filter
      let matchesStatus = true
      if (filters.status !== 'all') {
        const now = new Date()
        const startDate = promo.start_date ? parseISO(promo.start_date) : null
        const endDate = promo.end_date ? parseISO(promo.end_date) : null
        
        switch (filters.status) {
          case 'active':
            matchesStatus = promo.is_active && 
              (!startDate || isBefore(startDate, now) || startDate.getTime() === now.getTime()) && 
              (!endDate || isAfter(endDate, now))
            break
          case 'scheduled':
            matchesStatus = promo.is_active && startDate !== null && isAfter(startDate, now)
            break
          case 'expired':
            matchesStatus = endDate !== null && isBefore(endDate, now)
            break
          case 'inactive':
            matchesStatus = !promo.is_active
            break
        }
      }

      // Type filter
      const matchesType = filters.type === 'all' || promo.type === filters.type
      
      return matchesSearch && matchesStatus && matchesType
    })
  }, [promotions, filters])

  // Statistics
  const stats = useMemo((): PromotionStats => {
    const now = new Date()
    
    const active = promotions.filter(p => {
      const start = p.start_date ? parseISO(p.start_date) : null
      const end = p.end_date ? parseISO(p.end_date) : null
      return p.is_active && (!start || isBefore(start, now)) && (!end || isAfter(end, now))
    }).length

    const scheduled = promotions.filter(p => {
      const start = p.start_date ? parseISO(p.start_date) : null
      return p.is_active && start && isAfter(start, now)
    }).length

    const expired = promotions.filter(p => {
      const end = p.end_date ? parseISO(p.end_date) : null
      return end && isBefore(end, now)
    }).length

    const inactive = promotions.filter(p => !p.is_active).length
    
    const totalUsage = promotions.reduce((sum, p) => sum + (p.usage_count || 0), 0)
    
    const expiringSoon = promotions.filter(p => {
      const end = p.end_date ? parseISO(p.end_date) : null
      return p.is_active && end && differenceInDays(end, now) <= 7 && differenceInDays(end, now) > 0
    }).length

    return {
      total: promotions.length,
      active,
      scheduled,
      expired,
      inactive,
      totalUsage,
      expiringSoon
    }
  }, [promotions])

  // CRUD operations
  const createPromotion = useCallback(async (data: Omit<Promotion, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .insert(data)
      
      if (error) throw error
      
      toast.success('Promoción creada exitosamente')
      await fetchPromotions()
      return true
    } catch (error: any) {
      console.error('Error creating promotion:', error)
      if (error.code === '23505') {
        toast.error('Ya existe una promoción con ese código')
      } else {
        toast.error('Error al crear la promoción')
      }
      return false
    }
  }, [supabase, fetchPromotions])

  const updatePromotion = useCallback(async (id: string, data: Partial<Promotion>) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update(data)
        .eq('id', id)
      
      if (error) throw error
      
      toast.success('Promoción actualizada exitosamente')
      await fetchPromotions()
      return true
    } catch (error: any) {
      console.error('Error updating promotion:', error)
      if (error.code === '23505') {
        toast.error('Ya existe una promoción con ese código')
      } else {
        toast.error('Error al actualizar la promoción')
      }
      return false
    }
  }, [supabase, fetchPromotions])

  const deletePromotion = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast.success('Promoción eliminada exitosamente')
      await fetchPromotions()
      return true
    } catch (error) {
      console.error('Error deleting promotion:', error)
      toast.error('Error al eliminar la promoción')
      return false
    }
  }, [supabase, fetchPromotions])

  const togglePromotionStatus = useCallback(async (id: string, isActive: boolean) => {
    return updatePromotion(id, { is_active: !isActive })
  }, [updatePromotion])

  // Filter management
  const updateFilters = useCallback((newFilters: Partial<PromotionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      status: 'all',
      type: 'all'
    })
  }, [])

  // Utility functions
  const getPromotionStatus = useCallback((promotion: Promotion) => {
    const now = new Date()
    const startDate = promotion.start_date ? parseISO(promotion.start_date) : null
    const endDate = promotion.end_date ? parseISO(promotion.end_date) : null

    if (!promotion.is_active) return 'inactive'
    if (endDate && isBefore(endDate, now)) return 'expired'
    if (startDate && isAfter(startDate, now)) return 'scheduled'
    return 'active'
  }, [])

  const isPromotionExpiringSoon = useCallback((promotion: Promotion, days: number = 7) => {
    if (!promotion.is_active || !promotion.end_date) return false
    const now = new Date()
    const endDate = parseISO(promotion.end_date)
    const daysRemaining = differenceInDays(endDate, now)
    return daysRemaining <= days && daysRemaining > 0
  }, [])

  // Advanced operations
  const duplicatePromotion = useCallback(async (promotion: Promotion) => {
    const duplicatedData = {
      ...promotion,
      name: `${promotion.name} (Copia)`,
      code: `${promotion.code}_COPY_${Date.now()}`,
      is_active: false,
      usage_count: 0,
      start_date: null,
      end_date: null
    }
    
    // Remove fields that shouldn't be duplicated
    delete (duplicatedData as any).id
    delete (duplicatedData as any).created_at
    delete (duplicatedData as any).updated_at
    
    return createPromotion(duplicatedData)
  }, [createPromotion])

  const bulkUpdateStatus = useCallback(async (promotionIds: string[], isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: isActive })
        .in('id', promotionIds)
      
      if (error) throw error
      
      toast.success(`${promotionIds.length} promociones ${isActive ? 'activadas' : 'desactivadas'}`)
      await fetchPromotions()
      return true
    } catch (error) {
      console.error('Error bulk updating promotions:', error)
      toast.error('Error al actualizar promociones')
      return false
    }
  }, [supabase, fetchPromotions])

  const bulkDelete = useCallback(async (promotionIds: string[]) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .in('id', promotionIds)
      
      if (error) throw error
      
      toast.success(`${promotionIds.length} promociones eliminadas`)
      await fetchPromotions()
      return true
    } catch (error) {
      console.error('Error bulk deleting promotions:', error)
      toast.error('Error al eliminar promociones')
      return false
    }
  }, [supabase, fetchPromotions])

  // Validation functions
  const validatePromotionCode = useCallback(async (code: string, excludeId?: string) => {
    try {
      let query = supabase
        .from('promotions')
        .select('id')
        .eq('code', code)
      
      if (excludeId) {
        query = query.neq('id', excludeId)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      return data.length === 0
    } catch (error) {
      console.error('Error validating promotion code:', error)
      return false
    }
  }, [supabase])

  const validatePromotionDates = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (!startDate || !endDate) return true
    return isBefore(startDate, endDate)
  }, [])

  const validatePromotionValue = useCallback((type: 'percentage' | 'fixed', value: number) => {
    if (type === 'percentage') {
      return value > 0 && value <= 100
    }
    return value >= 0
  }, [])

  // Analytics and insights
  const getPromotionInsights = useCallback((promotion: Promotion) => {
    const now = new Date()
    const startDate = promotion.start_date ? parseISO(promotion.start_date) : null
    const endDate = promotion.end_date ? parseISO(promotion.end_date) : null
    
    const insights = {
      status: getPromotionStatus(promotion),
      daysRemaining: endDate ? differenceInDays(endDate, now) : null,
      daysActive: startDate ? differenceInDays(now, startDate) : null,
      usageRate: promotion.usage_limit ? (promotion.usage_count || 0) / promotion.usage_limit : null,
      isExpiringSoon: isPromotionExpiringSoon(promotion),
      canBeActivated: !promotion.is_active && (!startDate || isBefore(startDate, now)),
      shouldBeDeactivated: promotion.is_active && endDate && isBefore(endDate, now),
      effectiveness: calculateEffectiveness(promotion),
      roi: calculateROI(promotion)
    }
    
    return insights
  }, [getPromotionStatus, isPromotionExpiringSoon])

  // Calculate promotion effectiveness
  const calculateEffectiveness = useCallback((promotion: Promotion) => {
    if (!promotion.usage_count || promotion.usage_count === 0) return 0
    
    const now = new Date()
    const startDate = promotion.start_date ? parseISO(promotion.start_date) : null
    const daysActive = startDate ? differenceInDays(now, startDate) : 1
    
    // Usage per day
    const usagePerDay = promotion.usage_count / Math.max(daysActive, 1)
    
    // Effectiveness score (0-100)
    let score = 0
    
    // Base score from usage frequency
    if (usagePerDay >= 10) score += 40
    else if (usagePerDay >= 5) score += 30
    else if (usagePerDay >= 1) score += 20
    else score += 10
    
    // Bonus for high usage rate if limit exists
    if (promotion.usage_limit) {
      const usageRate = promotion.usage_count / promotion.usage_limit
      if (usageRate >= 0.8) score += 30
      else if (usageRate >= 0.5) score += 20
      else if (usageRate >= 0.2) score += 10
    } else {
      score += 15 // Bonus for unlimited usage
    }
    
    // Bonus for active status
    if (promotion.is_active) score += 15
    
    // Penalty for expiring soon
    if (isPromotionExpiringSoon(promotion)) score -= 10
    
    return Math.min(Math.max(score, 0), 100)
  }, [isPromotionExpiringSoon])

  // Calculate ROI (simplified)
  const calculateROI = useCallback((promotion: Promotion) => {
    if (!promotion.usage_count || promotion.usage_count === 0) return 0
    
    // Estimated average order value (this could be configurable)
    const avgOrderValue = 150000 // 150k PYG
    
    // Calculate discount per use
    let discountPerUse = 0
    if (promotion.type === 'percentage') {
      const estimatedDiscount = (avgOrderValue * promotion.value) / 100
      discountPerUse = promotion.max_discount 
        ? Math.min(estimatedDiscount, promotion.max_discount)
        : estimatedDiscount
    } else {
      discountPerUse = promotion.value
    }
    
    const totalDiscountGiven = discountPerUse * promotion.usage_count
    const totalRevenue = avgOrderValue * promotion.usage_count
    
    // ROI = (Revenue - Discount) / Discount * 100
    const roi = totalDiscountGiven > 0 
      ? ((totalRevenue - totalDiscountGiven) / totalDiscountGiven) * 100
      : 0
    
    return Math.round(roi)
  }, [])

  // Get promotion performance metrics
  const getPromotionMetrics = useCallback(() => {
    const activePromotions = promotions.filter(p => p.is_active)
    const totalUsage = promotions.reduce((sum, p) => sum + (p.usage_count || 0), 0)
    
    const topPerformers = [...promotions]
      .filter(p => p.usage_count && p.usage_count > 0)
      .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
      .slice(0, 5)
    
    const underperformers = promotions.filter(p => p.is_active && (p.usage_count || 0) === 0)
    
    const metrics = {
      totalPromotions: promotions.length,
      activePromotions: activePromotions.length,
      totalUsage,
      avgUsagePerPromotion: promotions.length > 0 ? totalUsage / promotions.length : 0,
      topPerformers,
      underperformers,
      effectivenessDistribution: {
        high: promotions.filter(p => calculateEffectiveness(p) >= 70).length,
        medium: promotions.filter(p => calculateEffectiveness(p) >= 40 && calculateEffectiveness(p) < 70).length,
        low: promotions.filter(p => calculateEffectiveness(p) < 40).length
      }
    }
    
    return metrics
  }, [promotions, calculateEffectiveness])

  const getTopPerformingPromotions = useCallback((limit: number = 5) => {
    return [...promotions]
      .filter(p => p.usage_count && p.usage_count > 0)
      .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
      .slice(0, limit)
  }, [promotions])

  const getUnusedPromotions = useCallback(() => {
    return promotions.filter(p => p.is_active && (p.usage_count || 0) === 0)
  }, [promotions])

  // Export/Import functionality
  const exportPromotions = useCallback((format: 'json' | 'csv' = 'json') => {
    const dataToExport = filteredPromotions.map(p => ({
      name: p.name,
      code: p.code,
      description: p.description || '',
      type: p.type,
      value: p.value,
      min_purchase: p.min_purchase || 0,
      start_date: p.start_date,
      end_date: p.end_date,
      is_active: p.is_active,
      usage_count: p.usage_count || 0,
      usage_limit: p.usage_limit
    }))

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `promociones_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else if (format === 'csv') {
      const headers = Object.keys(dataToExport[0] || {})
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `promociones_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    
    toast.success(`Promociones exportadas en formato ${format.toUpperCase()}`)
  }, [filteredPromotions])

  // Real-time subscription (optional)
  const subscribeToPromotions = useCallback(() => {
    const subscription = supabase
      .channel('promotions_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'promotions' },
        (payload) => {
          console.log('Promotion change detected:', payload)
          fetchPromotions()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchPromotions])

  // Automatic cleanup of expired promotions
  const cleanupExpiredPromotions = useCallback(async () => {
    const now = new Date()
    const expiredPromotions = promotions.filter(p => {
      const endDate = p.end_date ? parseISO(p.end_date) : null
      return p.is_active && endDate && isBefore(endDate, now)
    })

    if (expiredPromotions.length === 0) {
      toast.info('No hay promociones expiradas para limpiar')
      return
    }

    const expiredIds = expiredPromotions.map(p => p.id)
    const success = await bulkUpdateStatus(expiredIds, false)
    
    if (success) {
      toast.success(`${expiredPromotions.length} promociones expiradas desactivadas`)
    }
  }, [promotions, bulkUpdateStatus])

  return {
    // Data
    promotions: filteredPromotions,
    allPromotions: promotions,
    loading,
    stats,
    filters,
    
    // Basic CRUD
    fetchPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotionStatus,
    
    // Advanced operations
    duplicatePromotion,
    bulkUpdateStatus,
    bulkDelete,
    
    // Validation
    validatePromotionCode,
    validatePromotionDates,
    validatePromotionValue,
    
    // Analytics
    getPromotionInsights,
    getTopPerformingPromotions,
    getUnusedPromotions,
    getPromotionMetrics,
    
    // Filters
    updateFilters,
    clearFilters,
    
    // Utilities
    getPromotionStatus,
    isPromotionExpiringSoon,
    exportPromotions,
    subscribeToPromotions,
    cleanupExpiredPromotions
  }
}