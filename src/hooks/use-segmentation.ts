"use client"

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Customer } from './use-customer-state'
import { segmentationService } from '@/services/segmentation-service'
import { toast } from 'sonner'

export interface SegmentCriteria {
  // Criterios financieros
  lifetimeValue?: { min?: number; max?: number }
  avgOrderValue?: { min?: number; max?: number }
  totalSpent?: { min?: number; max?: number }
  orderCount?: { min?: number; max?: number }
  
  // Criterios temporales
  lastOrderDays?: { min?: number; max?: number }
  registrationDays?: { min?: number; max?: number }
  avgDaysBetweenOrders?: { min?: number; max?: number }
  
  // Criterios de comportamiento
  purchaseFrequency?: string[]
  satisfactionScore?: { min?: number; max?: number }
  loyaltyPoints?: { min?: number; max?: number }
  
  // Criterios demográficos
  status?: string[]
  customerType?: string[]
  cities?: string[]
  segments?: string[]
  
  // Criterios avanzados
  tags?: string[]
  hasReturns?: boolean
  hasComplaints?: boolean
  referralSource?: string[]
  preferredContact?: string[]
  
  // Criterios de IA (simulados)
  churnRisk?: { min?: number; max?: number }
  upsellPotential?: { min?: number; max?: number }
  engagementScore?: { min?: number; max?: number }
}

export interface Segment {
  id: string
  name: string
  description: string
  criteria: SegmentCriteria
  color: string
  icon: string
  customerCount: number
  isActive: boolean
  createdAt: string
  lastUpdated: string
  autoUpdate: boolean
  priority: number
  tags: string[]
  estimatedRevenue: number
  conversionRate: number
  aiSuggested: boolean
  performance: {
    growth: number
    engagement: number
    retention: number
  }
}

export interface AIInsight {
  id: string
  type: 'opportunity' | 'risk' | 'trend' | 'recommendation'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  confidence: number
  suggestedAction: string
  affectedCustomers: number
  potentialRevenue?: number
  createdAt: string
}

export function useSegmentation(customers: Customer[]) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])

  // Cargar segmentos desde Supabase
  useEffect(() => {
    loadSegments()
  }, [])

  const loadSegments = useCallback(async () => {
    setLoading(true)
    try {
      const result = await segmentationService.getSegments()
      if (result.success && result.data) {
        setSegments(result.data)
      } else {
        toast.error('Error al cargar segmentos: ' + result.error)
      }
    } catch (error) {
      console.error('Error loading segments:', error)
      toast.error('Error al cargar segmentos')
    } finally {
      setLoading(false)
    }
  }, [])

  // Cargar insights de IA
  const loadAIInsights = useCallback(async () => {
    try {
      const result = await segmentationService.getAIInsights()
      if (result.success && result.data) {
        setAiInsights(result.data)
      }
    } catch (error) {
      console.error('Error loading AI insights:', error)
    }
  }, [])

  // Aplicar criterios de segmentación
  const applySegmentCriteria = useCallback((criteria: SegmentCriteria, customerList: Customer[]): Customer[] => {
    return customerList.filter(customer => {
      // Criterios financieros
      if (criteria.lifetimeValue) {
        if (criteria.lifetimeValue.min && customer.lifetime_value < criteria.lifetimeValue.min) return false
        if (criteria.lifetimeValue.max && customer.lifetime_value > criteria.lifetimeValue.max) return false
      }

      if (criteria.totalSpent) {
        if (criteria.totalSpent.min && customer.total_spent_this_year < criteria.totalSpent.min) return false
        if (criteria.totalSpent.max && customer.total_spent_this_year > criteria.totalSpent.max) return false
      }

      if (criteria.orderCount) {
        if (criteria.orderCount.min && customer.total_purchases < criteria.orderCount.min) return false
        if (criteria.orderCount.max && customer.total_purchases > criteria.orderCount.max) return false
      }

      if (criteria.avgOrderValue) {
        if (criteria.avgOrderValue.min && customer.avg_order_value < criteria.avgOrderValue.min) return false
        if (criteria.avgOrderValue.max && customer.avg_order_value > criteria.avgOrderValue.max) return false
      }

      // Criterios temporales
      if (criteria.lastOrderDays) {
        const daysSinceLastOrder = Math.floor((Date.now() - new Date(customer.last_visit).getTime()) / (1000 * 60 * 60 * 24))
        if (criteria.lastOrderDays.min && daysSinceLastOrder < criteria.lastOrderDays.min) return false
        if (criteria.lastOrderDays.max && daysSinceLastOrder > criteria.lastOrderDays.max) return false
      }

      if (criteria.registrationDays) {
        const daysSinceRegistration = Math.floor((Date.now() - new Date(customer.registration_date).getTime()) / (1000 * 60 * 60 * 24))
        if (criteria.registrationDays.min && daysSinceRegistration < criteria.registrationDays.min) return false
        if (criteria.registrationDays.max && daysSinceRegistration > criteria.registrationDays.max) return false
      }

      // Criterios de comportamiento
      if (criteria.satisfactionScore) {
        if (criteria.satisfactionScore.min && customer.satisfaction_score < criteria.satisfactionScore.min) return false
        if (criteria.satisfactionScore.max && customer.satisfaction_score > criteria.satisfactionScore.max) return false
      }

      if (criteria.loyaltyPoints) {
        if (criteria.loyaltyPoints.min && customer.loyalty_points < criteria.loyaltyPoints.min) return false
        if (criteria.loyaltyPoints.max && customer.loyalty_points > criteria.loyaltyPoints.max) return false
      }

      if (criteria.purchaseFrequency && criteria.purchaseFrequency.length > 0) {
        if (!criteria.purchaseFrequency.includes(customer.purchase_frequency)) return false
      }

      // Criterios demográficos
      if (criteria.status && criteria.status.length > 0) {
        if (!criteria.status.includes(customer.status)) return false
      }

      if (criteria.customerType && criteria.customerType.length > 0) {
        if (!criteria.customerType.includes(customer.customer_type)) return false
      }

      if (criteria.cities && criteria.cities.length > 0) {
        if (!criteria.cities.includes(customer.city)) return false
      }

      if (criteria.segments && criteria.segments.length > 0) {
        if (!criteria.segments.includes(customer.segment)) return false
      }

      // Criterios de tags
      if (criteria.tags && criteria.tags.length > 0) {
        const hasAnyTag = criteria.tags.some(tag => customer.tags.includes(tag))
        if (!hasAnyTag) return false
      }

      // Criterios de contacto preferido
      if (criteria.preferredContact && criteria.preferredContact.length > 0) {
        if (!criteria.preferredContact.includes(customer.preferred_contact)) return false
      }

      // Criterios de IA simulados
      if (criteria.churnRisk) {
        // Simular riesgo de abandono basado en días desde última compra y valor
        const daysSinceLastOrder = Math.floor((Date.now() - new Date(customer.last_visit).getTime()) / (1000 * 60 * 60 * 24))
        const churnRisk = Math.min(daysSinceLastOrder / 365, 1) // Riesgo aumenta con tiempo
        if (criteria.churnRisk.min && churnRisk < criteria.churnRisk.min) return false
        if (criteria.churnRisk.max && churnRisk > criteria.churnRisk.max) return false
      }

      if (criteria.upsellPotential) {
        // Simular potencial de upselling basado en valor y frecuencia
        const upsellPotential = Math.min((customer.lifetime_value / 10000) * (customer.total_purchases / 20), 1)
        if (criteria.upsellPotential.min && upsellPotential < criteria.upsellPotential.min) return false
        if (criteria.upsellPotential.max && upsellPotential > criteria.upsellPotential.max) return false
      }

      if (criteria.engagementScore) {
        // Simular engagement basado en satisfacción y actividad
        const engagementScore = (customer.satisfaction_score / 5) * (customer.loyalty_points / 1000)
        if (criteria.engagementScore.min && engagementScore < criteria.engagementScore.min) return false
        if (criteria.engagementScore.max && engagementScore > criteria.engagementScore.max) return false
      }

      return true
    })
  }, [])

  // Crear segmento
  const createSegment = useCallback(async (segmentData: Omit<Segment, 'id' | 'customerCount' | 'createdAt' | 'lastUpdated' | 'estimatedRevenue'>) => {
    try {
      const result = await segmentationService.createSegment({
        name: segmentData.name,
        description: segmentData.description,
        criteria: segmentData.criteria,
        color: segmentData.color,
        icon: segmentData.icon,
        is_active: segmentData.isActive,
        auto_update: segmentData.autoUpdate,
        priority: segmentData.priority,
        tags: segmentData.tags
      })

      if (result.success && result.data) {
        setSegments(prev => [...prev, result.data!])
        toast.success(`Segmento "${segmentData.name}" creado exitosamente`)
        return result.data
      } else {
        toast.error('Error al crear segmento: ' + result.error)
        return null
      }
    } catch (error) {
      console.error('Error creating segment:', error)
      toast.error('Error al crear segmento')
      return null
    }
  }, [])

  // Actualizar segmento
  const updateSegment = useCallback(async (segmentId: string, updates: Partial<Segment>) => {
    try {
      const result = await segmentationService.updateSegment(segmentId, {
        name: updates.name,
        description: updates.description,
        criteria: updates.criteria,
        color: updates.color,
        icon: updates.icon,
        is_active: updates.isActive,
        auto_update: updates.autoUpdate,
        priority: updates.priority,
        tags: updates.tags
      })

      if (result.success) {
        // Recargar segmentos para obtener datos actualizados
        await loadSegments()
        toast.success('Segmento actualizado exitosamente')
      } else {
        toast.error('Error al actualizar segmento: ' + result.error)
      }
    } catch (error) {
      console.error('Error updating segment:', error)
      toast.error('Error al actualizar segmento')
    }
  }, [loadSegments])

  // Eliminar segmento
  const deleteSegment = useCallback(async (segmentId: string) => {
    try {
      const result = await segmentationService.deleteSegment(segmentId)
      
      if (result.success) {
        setSegments(prev => prev.filter(segment => segment.id !== segmentId))
        toast.success('Segmento eliminado exitosamente')
      } else {
        toast.error('Error al eliminar segmento: ' + result.error)
      }
    } catch (error) {
      console.error('Error deleting segment:', error)
      toast.error('Error al eliminar segmento')
    }
  }, [])

  // Obtener clientes de un segmento
  const getSegmentCustomers = useCallback(async (segmentId: string): Promise<Customer[]> => {
    try {
      const result = await segmentationService.getSegmentCustomers(segmentId)
      if (result.success && result.data) {
        return result.data
      }
      return []
    } catch (error) {
      console.error('Error getting segment customers:', error)
      return []
    }
  }, [])

  // Análisis de IA con datos reales
  const runAIAnalysis = useCallback(async (): Promise<AIInsight[]> => {
    setIsAnalyzing(true)
    
    try {
      const result = await segmentationService.getAIInsights()
      
      if (result.success && result.data) {
        setAiInsights(result.data)
        toast.success(`Análisis completado. Se encontraron ${result.data.length} insights`)
        return result.data
      } else {
        toast.error('Error en análisis de IA: ' + result.error)
        return []
      }
    } catch (error) {
      console.error('Error running AI analysis:', error)
      toast.error('Error en análisis de IA')
      return []
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  // Métricas calculadas
  const metrics = useMemo(() => {
    const totalCustomers = customers.length
    const segmentedCustomers = segments.reduce((acc, seg) => acc + seg.customerCount, 0)
    const activeSegments = segments.filter(seg => seg.isActive).length
    const totalRevenue = segments.reduce((acc, seg) => acc + seg.estimatedRevenue, 0)

    return {
      totalSegments: segments.length,
      activeSegments,
      segmentedCustomers,
      coverage: totalCustomers > 0 ? (segmentedCustomers / totalCustomers) * 100 : 0,
      avgSegmentSize: segments.length > 0 ? Math.round(segmentedCustomers / segments.length) : 0,
      totalRevenue,
      avgRevenuePerSegment: segments.length > 0 ? Math.round(totalRevenue / segments.length) : 0
    }
  }, [segments, customers])

  return {
    segments,
    metrics,
    isAnalyzing,
    loading,
    aiInsights,
    createSegment,
    updateSegment,
    deleteSegment,
    getSegmentCustomers,
    applySegmentCriteria,
    runAIAnalysis,
    loadSegments,
    loadAIInsights
  }
}