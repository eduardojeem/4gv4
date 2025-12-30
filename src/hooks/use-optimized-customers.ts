"use client"

import useSWR, { mutate as globalMutate } from 'swr'
import { useCallback, useMemo } from 'react'
import customerService from '@/services/customer-service'
import { cacheUtils } from '@/providers/swr-provider'
import type { Customer } from '@/hooks/use-customer-state'

interface UseOptimizedCustomersOptions {
  segment?: string
  status?: 'active' | 'inactive' | 'all'
  prefetchRelated?: boolean
  enableRealtime?: boolean
}

/**
 * Hook optimizado para manejo de clientes con cache inteligente
 */
export function useOptimizedCustomers(options: UseOptimizedCustomersOptions = {}) {
  const {
    segment,
    status = 'all',
    prefetchRelated = true,
    enableRealtime = false
  } = options

  // Generar clave de cache dinámica
  const cacheKey = useMemo(() => {
    const parts = ['customers']
    if (segment) parts.push('segment', segment)
    if (status !== 'all') parts.push('status', status)
    return parts
  }, [segment, status])

  // Configuración optimizada de SWR
  const { data, error, mutate, isLoading } = useSWR(
    cacheKey,
    async () => {
      const response = await customerService.getCustomers(1, 1000)
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar clientes')
      }

      let customers = response.data || []

      // Filtrar por segmento
      if (segment) {
        customers = customers.filter(c => c.segment === segment)
      }

      // Filtrar por estado
      if (status !== 'all') {
        customers = customers.filter(c => c.status === status)
      }

      // Prefetch datos relacionados si está habilitado
      if (prefetchRelated && customers.length > 0) {
        prefetchRelatedData(customers)
      }

      return customers
    },
    {
      // Cache más agresivo para clientes
      dedupingInterval: 60000,        // 1 minuto
      revalidateIfStale: false,       // No revalidar automáticamente
      revalidateOnMount: false,       // No revalidar al montar
      revalidateOnFocus: false,       // No revalidar al enfocar
      
      // Mantener datos previos durante actualizaciones
      keepPreviousData: true,
      
      // Datos de respaldo
      fallbackData: [],
      
      // Configuración de errores
      errorRetryCount: 2,
      shouldRetryOnError: (error: any) => {
        // No reintentar errores de autorización
        return error?.status !== 401 && error?.status !== 403
      },
      
      // Callback de éxito
      onSuccess: (data: Customer[]) => {
        // Actualizar cache de segmentos
        updateSegmentCache(data)
        
        // Prefetch clientes individuales más populares
        if (data.length > 0) {
          prefetchPopularCustomers(data.slice(0, 10))
        }
      }
    }
  )

  // Funciones de mutación optimizadas
  const addCustomer = useCallback(async (newCustomer: Customer) => {
    // Optimistic update
    await mutate(
      (currentData: Customer[] = []) => [newCustomer, ...currentData],
      { revalidate: false }
    )

    // Invalidar caches relacionados
    invalidateRelatedCaches()
  }, [mutate])

  const updateCustomer = useCallback(async (updatedCustomer: Customer) => {
    // Optimistic update
    await mutate(
      (currentData: Customer[] = []) =>
        currentData.map(c => c.id === updatedCustomer.id ? updatedCustomer : c),
      { revalidate: false }
    )

    // Invalidar cache específico del cliente
    await globalMutate(['customer', updatedCustomer.id], updatedCustomer, { revalidate: false })
  }, [mutate])

  const removeCustomer = useCallback(async (customerId: string) => {
    // Optimistic update
    await mutate(
      (currentData: Customer[] = []) =>
        currentData.filter(c => c.id !== customerId),
      { revalidate: false }
    )

    // Invalidar cache específico del cliente
    await globalMutate(['customer', customerId], undefined, { revalidate: false })
  }, [mutate])

  // Función para refrescar datos
  const refresh = useCallback(async () => {
    await mutate()
    invalidateRelatedCaches()
  }, [mutate])

  // Función para prefetch de un cliente específico
  const prefetchCustomer = useCallback(async (customerId: string) => {
    try {
      await cacheUtils.prefetch(['customer', customerId], async () => {
        const response = await customerService.getCustomer(customerId)
        return response.success ? response.data : null
      })
    } catch (error) {
      console.warn(`Failed to prefetch customer ${customerId}:`, error)
    }
  }, [])

  // Estadísticas derivadas
  const stats = useMemo(() => {
    if (!data) return null

    return {
      total: data.length,
      active: data.filter(c => c.status === 'active').length,
      inactive: data.filter(c => c.status === 'inactive').length,
      segments: [...new Set(data.map(c => c.segment).filter(Boolean))],
      recentlyAdded: data.filter(c => {
        const addedDate = new Date(c.registration_date)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        return addedDate > weekAgo
      }).length
    }
  }, [data])

  return {
    customers: data || [],
    error,
    isLoading,
    stats,
    
    // Funciones de mutación
    addCustomer,
    updateCustomer,
    removeCustomer,
    refresh,
    prefetchCustomer,
    
    // Utilidades
    mutate
  }
}

/**
 * Hook para un cliente específico con cache optimizado
 */
export function useOptimizedCustomer(customerId: string | null) {
  const { data, error, mutate, isLoading } = useSWR(
    customerId ? ['customer', customerId] : null,
    async () => {
      if (!customerId) return null
      
      const response = await customerService.getCustomer(customerId)
      if (!response.success) {
        throw new Error(response.error || 'Cliente no encontrado')
      }
      
      return response.data
    },
    {
      // Cache más largo para clientes individuales
      dedupingInterval: 120000,       // 2 minutos
      revalidateIfStale: false,
      revalidateOnFocus: false,
      
      // Mantener datos previos
      keepPreviousData: true,
      
      // Configuración de errores
      errorRetryCount: 2,
      shouldRetryOnError: (error: any) => error?.status !== 404
    }
  )

  const updateCustomer = useCallback(async (updates: Partial<Customer>) => {
    if (!data) return

    const updatedCustomer = { ...data, ...updates }
    
    // Optimistic update
    await mutate(updatedCustomer, { revalidate: false })
    
    // Actualizar en lista de clientes también
    await globalMutate(
      (key) => Array.isArray(key) && key[0] === 'customers',
      (customers: Customer[] = []) =>
        customers.map(c => c.id === customerId ? updatedCustomer : c),
      { revalidate: false }
    )
  }, [data, mutate, customerId])

  return {
    customer: data,
    error,
    isLoading,
    updateCustomer,
    mutate
  }
}

// Funciones auxiliares
async function prefetchRelatedData(customers: Customer[]) {
  try {
    // Prefetch segmentos únicos
    const segments = [...new Set(customers.map(c => c.segment).filter(Boolean))]
    
    for (const segment of segments.slice(0, 3)) { // Limitar a 3 segmentos
      await cacheUtils.prefetch(['customers', 'segment', segment], async () => {
        const response = await customerService.getCustomers(1, 200)
        return response.success ? 
          (response.data || []).filter(c => c.segment === segment) : 
          []
      })
    }
  } catch (error) {
    console.warn('Failed to prefetch related data:', error)
  }
}

async function prefetchPopularCustomers(customers: Customer[]) {
  const prefetchPromises = customers.map(customer =>
    cacheUtils.prefetch(['customer', customer.id], async () => customer)
  )
  
  await Promise.allSettled(prefetchPromises)
}

function updateSegmentCache(customers: Customer[]) {
  // Agrupar por segmento y actualizar caches individuales
  const bySegment = customers.reduce((acc, customer) => {
    if (customer.segment) {
      if (!acc[customer.segment]) acc[customer.segment] = []
      acc[customer.segment].push(customer)
    }
    return acc
  }, {} as Record<string, Customer[]>)

  // Actualizar cache de cada segmento
  Object.entries(bySegment).forEach(([segment, segmentCustomers]) => {
    globalMutate(
      ['customers', 'segment', segment],
      segmentCustomers,
      { revalidate: false }
    )
  })
}

function invalidateRelatedCaches() {
  // Invalidar caches relacionados con clientes
  globalMutate(
    (key) => Array.isArray(key) && key[0] === 'customers',
    undefined,
    { revalidate: true }
  )
}

export default useOptimizedCustomers