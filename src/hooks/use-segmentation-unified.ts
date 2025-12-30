import { useState, useMemo, useCallback } from 'react'
import { Customer } from './use-customer-state'
import { toast } from 'sonner'

export interface SegmentRule {
  id: string
  field: keyof Customer
  operator: '>' | '<' | '>=' | '<=' | '=' | '!=' | 'contains' | 'not_contains' | 'in' | 'not_in'
  value: string | number | string[]
  type: 'number' | 'string' | 'date' | 'boolean' | 'array'
}

export interface Segment {
  id: string
  name: string
  description: string
  color: string
  icon?: string
  rules: SegmentRule[]
  isActive: boolean
  autoUpdate: boolean
  priority: number
  tags: string[]
  createdAt: string
  updatedAt: string
  aiSuggested?: boolean
  performance?: {
    growth: number
    engagement: number
    retention: number
  }
}

export interface SegmentMetrics {
  customerCount: number
  totalValue: number
  avgValue: number
  avgOrderValue: number
  retentionRate: number
  growthRate: number
  conversionRate: number
  satisfactionScore: number
}

export interface UseSegmentationOptions {
  enableAI?: boolean
  autoUpdate?: boolean
  maxSegments?: number
}

export function useSegmentationUnified(
  customers: Customer[], 
  options: UseSegmentationOptions = {}
) {
  const { enableAI = true, autoUpdate = true, maxSegments = 20 } = options

  // Estado de segmentos
  const [segments, setSegments] = useState<Segment[]>(() => getDefaultSegments())
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Evaluar si un cliente cumple con las reglas de un segmento
  const evaluateCustomerRules = useCallback((customer: Customer, rules: SegmentRule[]): boolean => {
    return rules.every(rule => {
      const customerValue = customer[rule.field]
      const ruleValue = rule.value

      switch (rule.operator) {
        case '>':
          return Number(customerValue) > Number(ruleValue)
        case '<':
          return Number(customerValue) < Number(ruleValue)
        case '>=':
          return Number(customerValue) >= Number(ruleValue)
        case '<=':
          return Number(customerValue) <= Number(ruleValue)
        case '=':
          return customerValue === ruleValue
        case '!=':
          return customerValue !== ruleValue
        case 'contains':
          return String(customerValue).toLowerCase().includes(String(ruleValue).toLowerCase())
        case 'not_contains':
          return !String(customerValue).toLowerCase().includes(String(ruleValue).toLowerCase())
        case 'in':
          return Array.isArray(ruleValue) && ruleValue.includes(String(customerValue))
        case 'not_in':
          return Array.isArray(ruleValue) && !ruleValue.includes(String(customerValue))
        default:
          return false
      }
    })
  }, [])

  // Obtener clientes de un segmento
  const getSegmentCustomers = useCallback((segment: Segment): Customer[] => {
    if (!segment.isActive) return []
    return customers.filter(customer => evaluateCustomerRules(customer, segment.rules))
  }, [customers, evaluateCustomerRules])

  // Calcular métricas de un segmento
  const calculateSegmentMetrics = useCallback((segment: Segment): SegmentMetrics => {
    const segmentCustomers = getSegmentCustomers(segment)
    const customerCount = segmentCustomers.length
    
    if (customerCount === 0) {
      return {
        customerCount: 0,
        totalValue: 0,
        avgValue: 0,
        avgOrderValue: 0,
        retentionRate: 0,
        growthRate: 0,
        conversionRate: 0,
        satisfactionScore: 0
      }
    }

    const totalValue = segmentCustomers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0)
    const avgValue = totalValue / customerCount
    const avgOrderValue = segmentCustomers.reduce((sum, c) => sum + (c.avg_order_value || 0), 0) / customerCount
    const activeCustomers = segmentCustomers.filter(c => c.status === 'active').length
    const retentionRate = (activeCustomers / customerCount) * 100
    const satisfactionScore = segmentCustomers.reduce((sum, c) => sum + (c.satisfaction_score || 0), 0) / customerCount

    // Simular métricas adicionales (en una implementación real, estos datos vendrían de la base de datos)
    const growthRate = Math.random() * 20 - 10 // -10% a +10%
    const conversionRate = Math.random() * 15 + 5 // 5% a 20%

    return {
      customerCount,
      totalValue,
      avgValue,
      avgOrderValue,
      retentionRate,
      growthRate,
      conversionRate,
      satisfactionScore
    }
  }, [getSegmentCustomers])

  // Segmentos con métricas calculadas
  const segmentsWithMetrics = useMemo(() => {
    return segments.map(segment => ({
      ...segment,
      metrics: calculateSegmentMetrics(segment),
      customers: getSegmentCustomers(segment)
    }))
  }, [segments, calculateSegmentMetrics, getSegmentCustomers])

  // Crear nuevo segmento
  const createSegment = useCallback((segmentData: Omit<Segment, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (segments.length >= maxSegments) {
      toast.error(`Máximo ${maxSegments} segmentos permitidos`)
      return false
    }

    const newSegment: Segment = {
      ...segmentData,
      id: `segment_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setSegments(prev => [...prev, newSegment])
    toast.success(`Segmento "${newSegment.name}" creado exitosamente`)
    return true
  }, [segments.length, maxSegments])

  // Actualizar segmento
  const updateSegment = useCallback((segmentId: string, updates: Partial<Segment>) => {
    setSegments(prev => prev.map(segment => 
      segment.id === segmentId 
        ? { ...segment, ...updates, updatedAt: new Date().toISOString() }
        : segment
    ))
    toast.success('Segmento actualizado exitosamente')
  }, [])

  // Eliminar segmento
  const deleteSegment = useCallback((segmentId: string) => {
    setSegments(prev => prev.filter(segment => segment.id !== segmentId))
    if (selectedSegmentId === segmentId) {
      setSelectedSegmentId(null)
    }
    toast.success('Segmento eliminado exitosamente')
  }, [selectedSegmentId])

  // Duplicar segmento
  const duplicateSegment = useCallback((segmentId: string) => {
    const segment = segments.find(s => s.id === segmentId)
    if (!segment) return false

    const duplicatedSegment: Segment = {
      ...segment,
      id: `segment_${Date.now()}`,
      name: `${segment.name} (Copia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setSegments(prev => [...prev, duplicatedSegment])
    toast.success(`Segmento "${segment.name}" duplicado exitosamente`)
    return true
  }, [segments])

  // Activar/desactivar segmento
  const toggleSegment = useCallback((segmentId: string) => {
    setSegments(prev => prev.map(segment => 
      segment.id === segmentId 
        ? { ...segment, isActive: !segment.isActive, updatedAt: new Date().toISOString() }
        : segment
    ))
  }, [])

  // Generar segmentos con IA (simulado)
  const generateAISegments = useCallback(() => {
    if (!enableAI) {
      toast.error('IA no habilitada')
      return
    }

    const aiSegments = getAIGeneratedSegments(customers)
    const newSegments = aiSegments.filter(aiSegment => 
      !segments.some(existing => existing.name === aiSegment.name)
    )

    if (newSegments.length === 0) {
      toast.info('No se encontraron nuevos segmentos sugeridos')
      return
    }

    setSegments(prev => [...prev, ...newSegments])
    toast.success(`${newSegments.length} segmentos generados por IA`)
  }, [enableAI, customers, segments])

  // Obtener insights de segmentación
  const getSegmentationInsights = useCallback(() => {
    const totalCustomers = customers.length
    const segmentedCustomers = new Set()
    
    segmentsWithMetrics.forEach(segment => {
      segment.customers.forEach(customer => segmentedCustomers.add(customer.id))
    })

    const coverageRate = (segmentedCustomers.size / totalCustomers) * 100
    const activeSegments = segments.filter(s => s.isActive).length
    const topSegment = segmentsWithMetrics.reduce((top, current) => 
      current.metrics.totalValue > top.metrics.totalValue ? current : top
    , segmentsWithMetrics[0])

    return {
      totalSegments: segments.length,
      activeSegments,
      coverageRate,
      unsegmentedCustomers: totalCustomers - segmentedCustomers.size,
      topSegment: topSegment?.name || 'N/A',
      topSegmentValue: topSegment?.metrics.totalValue || 0,
      avgSegmentSize: segmentedCustomers.size / activeSegments || 0
    }
  }, [customers.length, segments, segmentsWithMetrics])

  return {
    // Estado
    segments: segmentsWithMetrics,
    selectedSegmentId,
    isCreating,
    isEditing,

    // Acciones
    createSegment,
    updateSegment,
    deleteSegment,
    duplicateSegment,
    toggleSegment,
    generateAISegments,

    // Utilidades
    getSegmentCustomers,
    calculateSegmentMetrics,
    evaluateCustomerRules,
    getSegmentationInsights,

    // Setters
    setSelectedSegmentId,
    setIsCreating,
    setIsEditing,

    // Datos derivados
    insights: getSegmentationInsights()
  }
}

// Segmentos por defecto
function getDefaultSegments(): Segment[] {
  return [
    {
      id: 'vip',
      name: 'Clientes VIP',
      description: 'Clientes con alto valor de vida (>1M Gs)',
      color: '#fbbf24',
      icon: 'crown',
      rules: [
        { id: '1', field: 'lifetime_value', operator: '>', value: 1000000, type: 'number' }
      ],
      isActive: true,
      autoUpdate: true,
      priority: 1,
      tags: ['alto-valor', 'premium'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiSuggested: false
    },
    {
      id: 'premium',
      name: 'Clientes Premium',
      description: 'Clientes con valor medio-alto (500K-1M Gs)',
      color: '#8b5cf6',
      icon: 'star',
      rules: [
        { id: '1', field: 'lifetime_value', operator: '>=', value: 500000, type: 'number' },
        { id: '2', field: 'lifetime_value', operator: '<', value: 1000000, type: 'number' }
      ],
      isActive: true,
      autoUpdate: true,
      priority: 2,
      tags: ['medio-alto', 'premium'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiSuggested: false
    },
    {
      id: 'regular',
      name: 'Clientes Regulares',
      description: 'Clientes con valor medio (100K-500K Gs)',
      color: '#10b981',
      icon: 'user',
      rules: [
        { id: '1', field: 'lifetime_value', operator: '>=', value: 100000, type: 'number' },
        { id: '2', field: 'lifetime_value', operator: '<', value: 500000, type: 'number' }
      ],
      isActive: true,
      autoUpdate: true,
      priority: 3,
      tags: ['medio', 'regular'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiSuggested: false
    },
    {
      id: 'nuevos',
      name: 'Clientes Nuevos',
      description: 'Clientes registrados en los últimos 30 días',
      color: '#3b82f6',
      icon: 'user-plus',
      rules: [
        { id: '1', field: 'registration_date', operator: '>=', value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), type: 'date' }
      ],
      isActive: true,
      autoUpdate: true,
      priority: 4,
      tags: ['nuevos', 'recientes'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiSuggested: false
    },
    {
      id: 'inactivos',
      name: 'Clientes Inactivos',
      description: 'Clientes sin actividad en los últimos 90 días',
      color: '#ef4444',
      icon: 'user-x',
      rules: [
        { id: '1', field: 'last_activity', operator: '<', value: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), type: 'date' }
      ],
      isActive: true,
      autoUpdate: true,
      priority: 5,
      tags: ['inactivos', 'riesgo'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiSuggested: false
    }
  ]
}

// Generar segmentos con IA (simulado)
function getAIGeneratedSegments(customers: Customer[]): Segment[] {
  // En una implementación real, esto haría una llamada a un servicio de IA
  const aiSegments: Segment[] = []

  // Segmento basado en frecuencia de compra alta
  const highFrequencyCustomers = customers.filter(c => c.purchase_frequency === 'high')
  if (highFrequencyCustomers.length > 10) {
    aiSegments.push({
      id: `ai_high_frequency_${Date.now()}`,
      name: 'Compradores Frecuentes (IA)',
      description: 'Clientes con alta frecuencia de compra identificados por IA',
      color: '#06b6d4',
      icon: 'zap',
      rules: [
        { id: '1', field: 'purchase_frequency', operator: '=', value: 'high', type: 'string' }
      ],
      isActive: false,
      autoUpdate: true,
      priority: 6,
      tags: ['ia', 'frecuencia', 'sugerido'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiSuggested: true,
      performance: {
        growth: 15.2,
        engagement: 78.5,
        retention: 85.3
      }
    })
  }

  // Segmento basado en satisfacción alta
  const highSatisfactionCustomers = customers.filter(c => (c.satisfaction_score || 0) > 8)
  if (highSatisfactionCustomers.length > 15) {
    aiSegments.push({
      id: `ai_high_satisfaction_${Date.now()}`,
      name: 'Alta Satisfacción (IA)',
      description: 'Clientes con puntuación de satisfacción superior a 8',
      color: '#f59e0b',
      icon: 'heart',
      rules: [
        { id: '1', field: 'satisfaction_score', operator: '>', value: 8, type: 'number' }
      ],
      isActive: false,
      autoUpdate: true,
      priority: 7,
      tags: ['ia', 'satisfaccion', 'sugerido'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiSuggested: true,
      performance: {
        growth: 12.8,
        engagement: 82.1,
        retention: 91.7
      }
    })
  }

  return aiSegments
}