'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { parseISO, isAfter, isBefore, differenceInDays } from 'date-fns'
import type { Promotion, PromotionFilters, PromotionStats } from '@/types/promotion'

export function usePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<PromotionFilters>({
    search: '',
    status: 'all',
    type: 'all'
  })

  // Fetch promotions with caching
  const fetchPromotions = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/promotions?limit=100', { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar promociones')
      setPromotions(result.promotions || [])
    } catch (error) {
      console.error('Error fetching promotions:', error)
      toast.error('Error al cargar promociones')
    } finally {
      setLoading(false)
    }
  }, [])

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

  // Statistics + arrays derivados (single pass para evitar N filters)
  const { stats, expiringSoonArray, expiredActiveArray } = useMemo(() => {
    const now = new Date()
    let active = 0, scheduled = 0, expired = 0, inactive = 0
    let totalUsage = 0
    const expiringSoonArr: Promotion[] = []
    const expiredActiveArr: Promotion[] = []

    for (const p of promotions) {
      const start = p.start_date ? parseISO(p.start_date) : null
      const end = p.end_date ? parseISO(p.end_date) : null
      const isExpired = end ? isBefore(end, now) : false
      const isScheduled = start ? isAfter(start, now) : false

      totalUsage += p.usage_count || 0

      if (!p.is_active) {
        inactive++
      } else if (isScheduled) {
        scheduled++
      } else if (isExpired) {
        expiredActiveArr.push(p)
      } else {
        active++
        if (end) {
          const daysLeft = differenceInDays(end, now)
          if (daysLeft > 0 && daysLeft <= 7) expiringSoonArr.push(p)
        }
      }

      if (isExpired) expired++
    }

    return {
      stats: {
        total: promotions.length,
        active,
        scheduled,
        expired,
        inactive,
        totalUsage,
        expiringSoon: expiringSoonArr.length,
      } as PromotionStats,
      expiringSoonArray: expiringSoonArr,
      expiredActiveArray: expiredActiveArr,
    }
  }, [promotions])

  // CRUD operations
  const createPromotion = useCallback(async (data: Omit<Promotion, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const response = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'No se pudo crear la promocion')
      
      toast.success('Promoción creada exitosamente')
      await fetchPromotions()
      return true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Error creating promotion:', error)
      if (error.code === '23505') {
        toast.error('Ya existe una promoción con ese código')
      } else {
        toast.error('Error al crear la promoción')
      }
      return false
    }
  }, [fetchPromotions])

  const updatePromotion = useCallback(async (id: string, data: Partial<Promotion>) => {
    try {
      const response = await fetch(`/api/promotions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la promocion')
      
      toast.success('Promoción actualizada exitosamente')
      await fetchPromotions()
      return true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Error updating promotion:', error)
      if (error.code === '23505') {
        toast.error('Ya existe una promoción con ese código')
      } else {
        toast.error('Error al actualizar la promoción')
      }
      return false
    }
  }, [fetchPromotions])

  const deletePromotion = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/promotions/${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'No se pudo eliminar la promocion')
      
      toast.success('Promoción eliminada exitosamente')
      await fetchPromotions()
      return true
    } catch (error) {
      console.error('Error deleting promotion:', error)
      toast.error('Error al eliminar la promoción')
      return false
    }
  }, [fetchPromotions])

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

  // Métricas reales y accionables (no scores arbitrarios)

  /** Promedio de usos por día desde que la promo está activa */
  const getUsagePerDay = useCallback((promotion: Promotion): number => {
    if (!promotion.usage_count || promotion.usage_count === 0) return 0
    const startDate = promotion.start_date ? parseISO(promotion.start_date) : null
    const daysActive = startDate ? Math.max(differenceInDays(new Date(), startDate), 1) : 1
    return Math.round((promotion.usage_count / daysActive) * 10) / 10
  }, [])

  /** Porcentaje de la cuota de usos consumida (null si no hay límite) */
  const getQuotaPercent = useCallback((promotion: Promotion): number | null => {
    if (!promotion.usage_limit || promotion.usage_limit === 0) return null
    return Math.min(100, Math.round(((promotion.usage_count || 0) / promotion.usage_limit) * 100))
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (duplicatedData as any).id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (duplicatedData as any).created_at
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (duplicatedData as any).updated_at
    
    return createPromotion(duplicatedData)
  }, [createPromotion])

  const bulkUpdateStatus = useCallback(async (promotionIds: string[], isActive: boolean) => {
    try {
      await Promise.all(promotionIds.map(async (id) => {
        const response = await fetch(`/api/promotions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: isActive }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'No se pudo actualizar una promocion')
      }))
      
      toast.success(`${promotionIds.length} promociones ${isActive ? 'activadas' : 'desactivadas'}`)
      await fetchPromotions()
      return true
    } catch (error) {
      console.error('Error bulk updating promotions:', error)
      toast.error('Error al actualizar promociones')
      return false
    }
  }, [fetchPromotions])

  // Validation functions
  const validatePromotionCode = useCallback(async (code: string, excludeId?: string) => {
    try {
      const params = new URLSearchParams({ code })
      if (excludeId) params.set('exclude', excludeId)
      const response = await fetch(`/api/promotions/check-code?${params.toString()}`, { cache: 'no-store' })
      const result = await response.json() as { available?: boolean; error?: string }

      if (!response.ok) throw new Error(result.error || 'No se pudo validar el código')

      return Boolean(result.available)
    } catch (error) {
      console.error('Error validating promotion code:', error)
      return false
    }
  }, [])

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
      min_purchase: p.min_purchase ?? 0,
      start_date: p.start_date,
      end_date: p.end_date,
      is_active: p.is_active,
      usage_count: p.usage_count ?? 0,
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
      const escapeCsvValue = (value: unknown) => {
        if (value === null || value === undefined) return '""'
        const serializedValue = Array.isArray(value) ? value.join('|') : String(value)
        return `"${serializedValue.replace(/"/g, '""')}"`
      }
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(row =>
          headers.map(header => escapeCsvValue(row[header as keyof typeof row])).join(',')
        )
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
    return () => undefined
  }, [])

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
    expiringSoonArray,    // derivado del único pass de stats
    expiredActiveArray,   // derivado del único pass de stats

    // Basic CRUD
    fetchPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotionStatus,

    // Advanced operations
    duplicatePromotion,
    bulkUpdateStatus,

    // Validation
    validatePromotionCode,
    validatePromotionDates,
    validatePromotionValue,

    // Métricas reales y accionables
    getTopPerformingPromotions,
    getUnusedPromotions,
    getUsagePerDay,
    getQuotaPercent,

    // Filters
    updateFilters,
    clearFilters,

    // Utilities
    getPromotionStatus,
    isPromotionExpiringSoon,
    exportPromotions,
    subscribeToPromotions,
    cleanupExpiredPromotions,
  }
}
