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
import { useBranch } from '@/contexts/branch-context'
import {
  getRepairBalanceDue,
  getRepairDeliveryEligibility,
  type PosChargeableRepair,
  type RepairDeliveryEligibility,
} from '../lib/repair-charge'
import { calculateRepairTotal } from '@/lib/pos-calculator'
import type { CartItem } from '../types'

/** Datos mínimos que el POS necesita para construir la línea del carrito de una reparación */
export type PosCartRepair = PosChargeableRepair & {
  id: string
  customer_id?: string | null
  customer_name?: string | null
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
  /**
   * La organización tiene el módulo de taller. Sin él no se consultan las
   * reparaciones del cliente: antes se pedían a la API en cada selección de
   * cliente aunque la organización no tuviera taller.
   */
  enabled?: boolean
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
  deliveryEligibility: RepairDeliveryEligibility

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
  enabled = true,
}: UsePOSRepairsOptions): UsePOSRepairsReturn {
  const { selectedBranchId } = useBranch()
  const [customerRepairs, setCustomerRepairs] = useState<any[]>([])
  const [manualRepairs, setManualRepairs] = useState<PosCartRepair[]>([])
  const [selectedRepairIds, setSelectedRepairIds] = useState<string[]>([])
  const [markRepairDelivered, setMarkRepairDelivered] = useState(false)
  const [deliveryOutcome, setDeliveryOutcome] = useState<'repaired' | 'withdrawn' | 'unrepairable'>('repaired')
  const repairScope = `${enabled}:${selectedCustomer}:${selectedBranchId}`
  const [previousScope, setPreviousScope] = useState(repairScope)
  if (previousScope !== repairScope) {
    setPreviousScope(repairScope)
    setCustomerRepairs([])
    if (!selectedCustomer || !enabled) setSelectedRepairIds([])
  }
  // --- Carga desde Supabase + suscripción Realtime ---
  useEffect(() => {
    if (!selectedCustomer || !enabled) {
      return
    }
    const controller = new AbortController()
    const loadRepairs = async () => {
      const branchQuery = selectedBranchId && selectedBranchId !== 'all' ? `&branch_id=${encodeURIComponent(selectedBranchId)}` : ''
      const response = await fetch(`/api/customers/${selectedCustomer}/repairs?limit=20${branchQuery}`, { cache: 'no-store', signal: controller.signal })
      const payload = await response.json().catch(() => null) as { repairs?: Array<Record<string, unknown>>; error?: string } | null
      if (!response.ok || !Array.isArray(payload?.repairs)) throw new Error(payload?.error || 'No se pudieron cargar las reparaciones')
      if (!controller.signal.aborted) setCustomerRepairs(payload.repairs.map(repair => ({ ...repair, notes: repair.problem_description })))
    }
    loadRepairs().catch(error => {
      if (controller.signal.aborted) return
      console.warn('No se pudieron cargar reparaciones del cliente en el POS:', error)
      setCustomerRepairs([])
    })
    return () => controller.abort()
  }, [selectedCustomer, selectedBranchId, enabled])

  // --- Toggles de entrega ---

  // --- Resolución de reparaciones seleccionadas ---
  const selectedRepairs = useMemo(() => {
    // customerRepairs tiene prioridad (datos frescos de Supabase).
    // manualRepairs cubre reparaciones de otros clientes añadidas manualmente.
    const byId = new Map<string, any>()
    for (const repair of manualRepairs) byId.set(repair.id, repair)
    for (const repair of customerRepairs) byId.set(repair.id, repair)
    return selectedRepairIds.map(id => byId.get(id)).filter(Boolean)
  }, [customerRepairs, manualRepairs, selectedRepairIds])

  const deliveryEligibility = useMemo(
    () => getRepairDeliveryEligibility(selectedRepairs),
    [selectedRepairs],
  )

  const updateMarkRepairDelivered = useCallback<React.Dispatch<React.SetStateAction<boolean>>>((value) => {
    setMarkRepairDelivered((current) => {
      const next = typeof value === 'function' ? value(current) : value
      return next && deliveryEligibility.canDeliver
    })
  }, [deliveryEligibility.canDeliver])

  const effectiveMarkRepairDelivered = (
    isCheckoutOpen
    && deliveryEligibility.canDeliver
    && markRepairDelivered
  )

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
    setMarkRepairDelivered(false)
    setDeliveryOutcome('repaired')
  }, [])

  return {
    customerRepairs,
    setCustomerRepairs,
    manualRepairs,
    setManualRepairs,
    selectedRepairIds,
    setSelectedRepairIds,
    selectedRepairs,
    markRepairDelivered: effectiveMarkRepairDelivered,
    setMarkRepairDelivered: updateMarkRepairDelivered,
    deliveryOutcome,
    setDeliveryOutcome,
    deliveryEligibility,
    repairTotals,
    addRepairToCart,
    removeRepair,
    clearRepairs,
  }
}
