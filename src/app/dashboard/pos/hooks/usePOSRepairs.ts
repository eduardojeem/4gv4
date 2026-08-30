'use client'

/**
 * usePOSRepairs
 *
 * Encapsula todo el estado de reparaciones del POS:
 * - Carga de reparaciones del cliente activo desde Supabase
 * - Suscripción Realtime a cambios de la tabla `repairs`
 * - Selección / deselección de reparaciones para cobrar
 * - Acumulación de reparaciones añadidas manualmente desde el buscador
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { getRepairBalanceDue, type ChargeableRepair } from '../lib/repair-charge'
import { calculateRepairTotal } from '@/lib/pos-calculator'
import type { CartItem } from '../types'

/** Datos mínimos que el POS necesita para construir la línea del carrito de una reparación */
export type PosCartRepair = ChargeableRepair & {
  id: string
  device_brand?: string | null
  device_model?: string | null
}

export interface UsePOSRepairsOptions {
  /** ID del cliente activo en el POS */
  selectedCustomer: string
  /** ¿Está abierto el modal de checkout? Controla los toggles de entrega */
  isCheckoutOpen: boolean
  /** Tasa de impuesto para el cálculo del total de reparaciones */
  taxPercentage: number
}

export interface UsePOSRepairsReturn {
  /** Reparaciones del cliente cargadas desde Supabase */
  customerRepairs: any[]
  setCustomerRepairs: React.Dispatch<React.SetStateAction<any[]>>

  /** Reparaciones añadidas manualmente desde el buscador del taller */
  manualRepairs: PosCartRepair[]
  setManualRepairs: React.Dispatch<React.SetStateAction<PosCartRepair[]>>

  /** IDs de reparaciones seleccionadas para cobrar */
  selectedRepairIds: string[]
  setSelectedRepairIds: React.Dispatch<React.SetStateAction<string[]>>

  /** Objetos de reparación resueltos (union de customerRepairs y manualRepairs) */
  selectedRepairs: any[]

  /** Toggles de entrega para el checkout */
  markRepairDelivered: boolean
  setMarkRepairDelivered: React.Dispatch<React.SetStateAction<boolean>>
  deliveryOutcome: 'repaired' | 'withdrawn' | 'unrepairable'
  setDeliveryOutcome: React.Dispatch<React.SetStateAction<'repaired' | 'withdrawn' | 'unrepairable'>>

  /** Totales de reparaciones seleccionadas */
  repairTotals: {
    total: number
    subtotal: number
    tax: number
  }

  /** Añadir una reparación al cobro (desde modal de reparaciones) */
  addRepairToCart: (item: CartItem, repair?: PosCartRepair) => void

  /** Quitar una reparación del cobro */
  removeRepair: (id: string) => void

  /** Limpiar todo el estado de reparaciones */
  clearRepairs: () => void
}

export function usePOSRepairs({
  selectedCustomer,
  isCheckoutOpen,
  taxPercentage,
}: UsePOSRepairsOptions): UsePOSRepairsReturn {
  const [customerRepairs, setCustomerRepairs] = useState<any[]>([])
  const [manualRepairs, setManualRepairs] = useState<PosCartRepair[]>([])
  const [selectedRepairIds, setSelectedRepairIds] = useState<string[]>([])
  const [markRepairDelivered, setMarkRepairDelivered] = useState(false)
  const [deliveryOutcome, setDeliveryOutcome] = useState<'repaired' | 'withdrawn' | 'unrepairable'>('repaired')

  // --- Carga desde Supabase + suscripción Realtime ---
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerRepairs([])
      setSelectedRepairIds(prev => (prev.length ? [] : prev))
      return
    }

    const supabase = createSupabaseClient()
    let canSubscribe = true

    const loadRepairs = async () => {
      const { data, error }: any = await supabase
        .from('repairs')
        .select(
          'id, device_brand, device_model, status, payment_status, paid_amount, created_at, final_cost, estimated_cost, notes:problem_description, customer_id'
        )
        .eq('customer_id', selectedCustomer)
        .order('created_at', { ascending: false })

      if (error) {
        const msg: string = error.message || ''
        const missingTable =
          msg.includes("Could not find the table 'public.repairs'") ||
          msg.includes('relation "repairs" does not exist')
        if (missingTable) {
          console.warn('Tabla repairs no encontrada en Supabase; usando lista vacía para el cliente.')
          canSubscribe = false
          setCustomerRepairs([])
        } else {
          console.error('Error cargando reparaciones del cliente:', msg)
        }
        return
      }
      setCustomerRepairs(data || [])
    }

    loadRepairs()

    let channel: RealtimeChannel | null = null
    if (canSubscribe) {
      // Nombre único de canal por cliente para evitar mezclar eventos entre pestañas
      channel = supabase
        .channel(`repairs-pos-${selectedCustomer}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'repairs' },
          (payload: any) => {
            const row = payload.new || payload.old
            if (!row || row.customer_id !== selectedCustomer) return

            if (payload.eventType === 'DELETE') {
              setCustomerRepairs(prev => prev.filter(r => r.id !== row.id))
              setSelectedRepairIds(prev => prev.filter(id => id !== row.id))
              return
            }

            setCustomerRepairs(prev => {
              const idx = prev.findIndex(r => r.id === row.id)
              const mapped = { ...row, notes: row.problem_description }
              if (idx === -1) return [mapped, ...prev]
              const copy = [...prev]
              copy[idx] = mapped
              return copy
            })
          }
        )
        .subscribe()
    }

    return () => {
      if (channel) channel.unsubscribe()
    }
  }, [selectedCustomer])

  // --- Toggles de entrega ---
  useEffect(() => {
    if (!isCheckoutOpen) {
      setMarkRepairDelivered(false)
      setDeliveryOutcome('repaired')
    }
  }, [isCheckoutOpen, selectedRepairIds])

  useEffect(() => {
    if (!isCheckoutOpen) return
    setMarkRepairDelivered(selectedRepairIds.length > 0)
  }, [selectedRepairIds, isCheckoutOpen])

  // --- Resolución de reparaciones seleccionadas ---
  const selectedRepairs = useMemo(() => {
    // customerRepairs tiene prioridad (datos frescos de Supabase).
    // manualRepairs cubre reparaciones de otros clientes añadidas manualmente.
    const byId = new Map<string, any>()
    for (const repair of manualRepairs) byId.set(repair.id, repair)
    for (const repair of customerRepairs) byId.set(repair.id, repair)
    return selectedRepairIds.map(id => byId.get(id)).filter(Boolean)
  }, [customerRepairs, manualRepairs, selectedRepairIds])

  // --- Totales de reparaciones ---
  const repairTotals = useMemo(() => {
    const details = selectedRepairs.map(repair => {
      const laborCost = getRepairBalanceDue(repair)
      return calculateRepairTotal({
        laborCost,
        partsCost: 0,
        taxRate: taxPercentage,
        pricesIncludeTax: true,
      })
    })
    return {
      total: details.reduce((s, d) => s + d.total, 0),
      subtotal: details.reduce((s, d) => s + d.subtotal, 0),
      tax: details.reduce((s, d) => s + d.taxAmount, 0),
    }
  }, [selectedRepairs, taxPercentage])

  // --- Acciones ---
  const addRepairToCart = useCallback((item: CartItem, repair?: PosCartRepair) => {
    const rawRepairId = item.id.startsWith('repair_') ? item.id.replace('repair_', '') : item.id
    if (!rawRepairId) return

    if (repair) {
      setManualRepairs(prev =>
        prev.some(r => r.id === rawRepairId)
          ? prev
          : [...prev, { ...repair, id: rawRepairId }]
      )
    }
    setSelectedRepairIds(prev => (prev.includes(rawRepairId) ? prev : [...prev, rawRepairId]))
  }, [])

  const removeRepair = useCallback((id: string) => {
    const rawId = id.startsWith('repair_') ? id.replace('repair_', '') : id
    setSelectedRepairIds(prev => prev.filter(r => r !== rawId && r !== id))
    setManualRepairs(prev => prev.filter(r => r.id !== rawId && r.id !== id))
  }, [])

  const clearRepairs = useCallback(() => {
    setSelectedRepairIds([])
    setManualRepairs([])
  }, [])

  return {
    customerRepairs,
    setCustomerRepairs,
    manualRepairs,
    setManualRepairs,
    selectedRepairIds,
    setSelectedRepairIds,
    selectedRepairs,
    markRepairDelivered,
    setMarkRepairDelivered,
    deliveryOutcome,
    setDeliveryOutcome,
    repairTotals,
    addRepairToCart,
    removeRepair,
    clearRepairs,
  }
}
