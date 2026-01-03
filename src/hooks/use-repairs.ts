import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Repair, RepairStatus } from '@/types/repairs'
import { mapSupabaseRepairToUi } from '@/utils/repair-mapping'
import { useErrorHandler } from './use-error-handler'
import { useDebounce } from './use-debounce'
import { measure, trackMetric } from '@/lib/performance'
import type { RepairFormData } from '@/schemas'

export function useRepairs() {
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Initialize error handler with default context
  const { handleError } = useErrorHandler({
    defaultContext: { operation: 'repairs' }
  })

  const fetchRepairs = useCallback(async () => {
    setIsLoading(true)
    try {
      await measure('fetchRepairs', async () => {
        try {
          let attempts = 0
          const maxAttempts = 3
          let lastError: unknown = null
          while (attempts < maxAttempts) {
            attempts++
            try {
              const supabase = createSupabaseClient()
              const response = await supabase
                .from('repairs')
                .select(`*, customer:customers(id, name, phone, email), technician:profiles(id, full_name)`)
              const { data, error } = response
              if (error) {
                const msg = (error as any)?.message || String(error)
                const missing = msg.includes('relation "repairs" does not exist') || msg.includes("Could not find the table 'public.repairs'")
                if (missing) {
                  setRepairs([])
                  toast.info('Tabla repairs no encontrada', { duration: 3000 })
                  return
                }
                throw error
              }
              const mapped: Repair[] = (data || []).map(mapSupabaseRepairToUi)
              setRepairs(mapped)
              return
            } catch (error) {
              lastError = error
              const isNetworkError = String(error).toLowerCase().includes('network') || String(error).toLowerCase().includes('fetch')
              if (!isNetworkError || attempts >= maxAttempts) {
                throw error
              }
              const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000)
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }
          if (lastError) throw lastError
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          handleError(errorMessage, { operation: 'fetchRepairs' })
          setRepairs([])
          // toast.info('Error cargando datos', { duration: 3000 })
        }
      }, { itemCount: repairs.length })
    } finally {
      setIsLoading(false)
    }
  }, [handleError, repairs.length])

  useEffect(() => {
    fetchRepairs()
    const supabase = createSupabaseClient()
    const channel = (supabase as any)
      .channel('repairs-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, () => {
        fetchRepairs()
      })
      .subscribe()
    return () => {
      (supabase as any).removeChannel?.(channel)
    }
  }, [fetchRepairs])



  const updateStatus = async (id: string, newStatus: RepairStatus) => {
    // Optimistic update
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))

    if (isDemoMode()) {
      toast.success('Estado actualizado (Demo)')
      return
    }

    try {
      // Ya no necesitamos mapear - usamos el estado directamente en español
      const supabase = createSupabaseClient()
      const response = await supabase
        .from('repairs')
        .update({ status: newStatus })
        .eq('id', id)

      const { error } = response as any
      if (error) throw error

      toast.success('Estado actualizado correctamente')
    } catch (error) {
      // Handle error and revert optimistic update
      handleError(error, { operation: 'updateStatus', repairId: id })
      fetchRepairs()
    }
  }

  const createRepair = async (data: RepairFormData) => {
    if (isDemoMode()) {
      const newId = `REP-${Math.floor(Math.random() * 10000)}`
      const device = data.devices[0]
      const newRepair: Repair = {
        id: newId,
        customer: { name: data.customerName || '', phone: data.customerPhone || '', email: data.customerEmail || '' },
        device: `${device.brand} ${device.model}`,
        deviceType: device.deviceType,
        brand: device.brand,
        model: device.model,
        issue: device.issue,
        description: device.description,
        accessType: device.accessType || 'none',
        accessPassword: device.accessPassword,
        status: 'recibido',
        priority: data.priority,
        urgency: data.urgency === 'high' ? 'urgent' : 'normal',
        estimatedCost: device.estimatedCost || 0,
        finalCost: null,
        laborCost: 0,
        technician: { name: 'Técnico Demo', id: device.technician },
        location: 'Taller Principal',
        warranty: null,
        createdAt: new Date().toISOString(),
        estimatedCompletion: null,
        completedAt: null,
        lastUpdate: new Date().toISOString(),
        progress: 0,
        customerRating: null,
        notes: [],
        parts: [],
        images: [],
        notifications: { customer: false, technician: false, manager: false }
      }
      setRepairs(prev => [newRepair, ...prev])
      toast.success('Reparación creada (Demo)')
      return
    }

    try {
      const customerId = data.existingCustomerId
      if (!customerId) {
        throw new Error('ID de cliente no proporcionado')
      }

      const device = data.devices[0]
      const supabase = createSupabaseClient()
      const response = await supabase
        .from('repairs')
        .insert({
          customer_id: customerId,
          technician_id: device.technician,
          device_brand: device.brand,
          device_model: device.model,
          problem_description: device.issue,
          diagnosis: device.description,
          estimated_cost: device.estimatedCost,
          access_type: device.accessType || 'none',
          access_password: device.accessPassword || null,
          status: 'recibido'
        })

      const { error } = response as any
      if (error) throw error

      toast.success('Reparación creada')
      fetchRepairs()
    } catch (error) {
      handleError(error, { operation: 'createRepair' })
      throw error // Re-throw so caller knows it failed
    }
  }

  const updateRepair = async (id: string, data: Partial<Repair>) => {
    if (isDemoMode()) {
      setRepairs(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
      toast.success('Reparación actualizada (Demo)')
      return
    }

    try {
      const supabase = createSupabaseClient()
      const response = await supabase
        .from('repairs')
        .update({
          device_brand: data.brand,
          device_model: data.model,
          problem_description: data.issue,
          diagnosis: data.description,
          estimated_cost: data.estimatedCost,
          access_type: data.accessType || 'none',
          access_password: data.accessPassword || null,
          technician_id: data.technician?.id
        })
        .eq('id', id)

      const { error } = response as any
      if (error) throw error

      toast.success('Reparación actualizada')
      fetchRepairs()
    } catch (error) {
      handleError(error, { operation: 'updateRepair', repairId: id })
      throw error // Re-throw so caller knows it failed
    }
  }

  const deleteRepair = async (id: string) => {
    if (isDemoMode()) {
      setRepairs(prev => prev.filter(r => r.id !== id))
      toast.success('Reparación eliminada (Demo)')
      return
    }

    try {
      const supabase = createSupabaseClient()
      const response = await supabase
        .from('repairs')
        .delete()
        .eq('id', id)

      const { error } = response as any
      if (error) throw error

      toast.success('Reparación eliminada')
      fetchRepairs()
    } catch (error) {
      handleError(error, { operation: 'deleteRepair', repairId: id })
      throw error // Re-throw so caller knows it failed
    }
  }

  return {
    repairs,
    isLoading,
    updateStatus,
    createRepair,
    updateRepair,
    deleteRepair,
    refreshRepairs: fetchRepairs
  }
}
