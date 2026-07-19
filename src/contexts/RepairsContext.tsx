'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { mapSupabaseRepairToUi } from '@/utils/repair-mapping'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'

// ============================================================================
// Types
// ============================================================================

// Importar tipos centralizados
import { Repair, RepairStatus, RepairPriority, RepairDeliveryOutcome } from '@/types/repairs'

type SupabaseRepairPayload = Parameters<typeof mapSupabaseRepairToUi>[0]
type RepairPartFormInput = {
    name?: string
    cost?: number
    quantity?: number
    supplier?: string
    partNumber?: string
}
type RepairNoteFormInput = {
    id?: string | number
    text?: string
    isInternal?: boolean
}

export interface RepairFormData {
    customer_id: string
    device: string
    deviceType: string
    brand: string
    model: string
    issue: string
    description?: string
    accessType?: 'none' | 'pin' | 'password' | 'pattern' | 'biometric' | 'other'
    accessPassword?: string
    priority: RepairPriority
    urgency: 'normal' | 'urgent'
    technician_id?: string
    estimated_cost?: number
    laborCost?: number
    finalCost?: number | null
    warrantyMonths?: number
    warrantyType?: 'labor' | 'parts' | 'full'
    warrantyNotes?: string
    metadata?: Record<string, unknown>
    parts?: RepairPartFormInput[]
    notes?: RepairNoteFormInput[]
    images?: string[]
}

export type RepairUpdateData = Omit<Partial<Repair>, 'customer' | 'technician' | 'images' | 'parts' | 'notes'> & {
    customer_id?: string
    technician_id?: string
    images?: string[]
    parts?: RepairPartFormInput[]
    notes?: RepairNoteFormInput[]
}

export interface RepairsContextValue {
    repairs: Repair[]
    isLoading: boolean
    error: Error | null

    fetchRepairs: () => Promise<void>
    createRepair: (data: RepairFormData) => Promise<Repair | null>
    updateRepair: (id: string, data: RepairUpdateData) => Promise<Repair | null>
    deleteRepair: (id: string) => Promise<boolean>
    updateStatus: (id: string, status: RepairStatus) => Promise<boolean>
    deliverRepair: (id: string, outcome: RepairDeliveryOutcome, note?: string) => Promise<boolean>
    assignTechnician: (repairId: string, technicianId: string) => Promise<boolean>

    getRepairsByStatus: (status: RepairStatus) => Repair[]
    getRepairsByTechnician: (technicianId: string) => Repair[]
    getUrgentRepairs: () => Repair[]
    searchRepairs: (query: string) => Repair[]
    getRepairById: (id: string) => Repair | undefined
    refreshRepairs: () => Promise<void>
    addImages: (repairId: string, urls: string[], imageType?: string) => Promise<boolean>
}

// ============================================================================
// Context
// ============================================================================

const RepairsContext = createContext<RepairsContextValue | undefined>(undefined)

// ============================================================================
// Provider
// ============================================================================

interface RepairsProviderProps {
    children: ReactNode
}

export function RepairsProvider({ children }: RepairsProviderProps) {
    const [repairs, setRepairs] = useState<Repair[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const { selectedBranchId } = useBranch()
    const pathname = usePathname()
    const shouldLoadRepairs = pathname.startsWith('/dashboard/repairs') || pathname.startsWith('/dashboard/technician')

    const supabase = useMemo(() => createClient(), [])

    const fetchRepairsWithCustomerFallback = useCallback(async () => {
        const response = await fetch('/api/repairs?pageSize=100', {
            headers: branchHeaders(selectedBranchId),
            cache: 'no-store',
        })

        const payload = await response.json().catch(() => null) as { repairs?: unknown[]; pagination?: { total: number }; error?: string } | null

        if (!response.ok) {
            return {
                data: [],
                total: 0,
                error: new Error(payload?.error || 'No se pudieron cargar las reparaciones'),
            }
        }

        return { data: payload?.repairs || [], total: payload?.pagination?.total ?? 0, error: null }
    }, [selectedBranchId])

    // Fetch all repairs
    const fetchRepairs = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)

            const { data, error: fetchError } = await fetchRepairsWithCustomerFallback()

            if (fetchError) throw fetchError

            // Transform data to match Repair interface
            const transformedData = (data || []).map((repair) => {
                const mapped = mapSupabaseRepairToUi(repair as SupabaseRepairPayload)
                return { ...mapped, dbStatus: mapped.status }
            })

            setRepairs(transformedData)
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al cargar reparaciones: ' + error.message)
        } finally {
            setIsLoading(false)
        }
    }, [fetchRepairsWithCustomerFallback])

    // Create repair
    const createRepair = useCallback(async (data: RepairFormData): Promise<Repair | null> => {
        try {
            setError(null)

            const { parts, notes, images, ...repairData } = data

            let warrantyExpiresAt = null
            if (repairData.warrantyMonths && repairData.warrantyMonths > 0) {
                const expirationDate = new Date()
                expirationDate.setMonth(expirationDate.getMonth() + repairData.warrantyMonths)
                warrantyExpiresAt = expirationDate.toISOString()
            }

            const response = await fetch('/api/repairs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...branchHeaders(selectedBranchId),
                },
                body: JSON.stringify({
                    customer_id: repairData.customer_id,
                    device_brand: repairData.brand,
                    device_model: repairData.model,
                    device_type: repairData.deviceType,
                    problem_description: repairData.issue,
                    diagnosis: repairData.description,
                    access_type: repairData.accessType || 'none',
                    access_password: repairData.accessPassword || null,
                    status: 'recibido',
                    priority: repairData.priority,
                    urgency: repairData.urgency,
                    technician_id: repairData.technician_id || null,
                    estimated_cost: repairData.estimated_cost,
                    labor_cost: repairData.laborCost || 0,
                    final_cost: repairData.finalCost,
                    warranty_months: repairData.warrantyMonths || 0,
                    warranty_type: repairData.warrantyType || 'full',
                    warranty_notes: repairData.warrantyNotes || null,
                    warranty_expires_at: warrantyExpiresAt,
                    ...(selectedBranchId ? { branch_id: selectedBranchId } : {}),
                    received_at: new Date().toISOString(),
                    parts: parts?.map((p) => ({
                        part_name: p.name,
                        unit_cost: p.cost,
                        quantity: p.quantity,
                        supplier: p.supplier,
                        part_number: p.partNumber,
                    })) ?? [],
                    notes: notes?.map((n) => ({
                        note_text: n.text,
                        is_internal: n.isInternal,
                    })) ?? [],
                    images: Array.isArray(images) ? images : [],
                }),
            })

            const payload = await response.json().catch(() => null) as { repair?: unknown; error?: string } | null

            if (!response.ok) {
                throw new Error(payload?.error || 'No se pudo crear la reparación')
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped = mapSupabaseRepairToUi(payload?.repair as any)
            const transformedRepair = { ...mapped, dbStatus: mapped.status }

            setRepairs(prev => [transformedRepair, ...prev])
            toast.success('Reparación creada exitosamente')
            return transformedRepair
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al crear reparación: ' + error.message)
            return null
        }
    }, [selectedBranchId])

    // Update repair
    const updateRepair = useCallback(async (
        id: string,
        data: RepairUpdateData
    ): Promise<Repair | null> => {
        try {
            setError(null)

            const { customer, technician, ...payload } = data as RepairUpdateData & {
                customer?: unknown
                technician?: unknown
            }
            void customer
            void technician

            const response = await fetch(`/api/repairs/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...branchHeaders(selectedBranchId),
                },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => null) as { repair?: unknown; error?: string } | null

            if (!response.ok || !body?.repair) {
                throw new Error(body?.error || 'No se pudo actualizar la reparacion')
            }

            const mapped = mapSupabaseRepairToUi(body.repair as SupabaseRepairPayload)
            const transformed = { ...mapped, dbStatus: mapped.status }

            setRepairs(prev =>
                prev.map(repair => repair.id === id ? transformed : repair)
            )
            toast.success('Reparación actualizada exitosamente')
            return transformed
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al actualizar reparación: ' + error.message)
            return null
        }
    }, [selectedBranchId])

    // Delete repair
    const deleteRepair = useCallback(async (id: string): Promise<boolean> => {
        try {
            setError(null)

            const response = await fetch(`/api/repairs/${id}`, {
                method: 'DELETE',
                headers: branchHeaders(selectedBranchId),
            })
            const payload = await response.json().catch(() => null) as { error?: string } | null

            if (!response.ok) {
                throw new Error(payload?.error || 'No se pudo eliminar la reparacion')
            }

            setRepairs(prev => prev.filter(repair => repair.id !== id))
            toast.success('Reparación eliminada exitosamente')
            return true
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al eliminar reparación: ' + error.message)
            return false
        }
    }, [selectedBranchId])

    // Update status
    const updateStatus = useCallback(async (
        id: string,
        status: RepairStatus
    ): Promise<boolean> => {
        try {
            setError(null)

            const response = await fetch(`/api/repairs/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...branchHeaders(selectedBranchId),
                },
                body: JSON.stringify({ stage: status }),
            })
            const payload = await response.json().catch(() => null) as { ok?: boolean; repair?: unknown; error?: string } | null

            if (!response.ok || payload?.ok === false) {
                throw new Error(payload?.error || 'No se pudo actualizar estado')
            }

            if (!payload?.repair) {
                throw new Error('No se pudo recargar la reparacion')
            }

            const mapped = mapSupabaseRepairToUi(payload.repair as SupabaseRepairPayload)
            const transformed = { ...mapped, dbStatus: mapped.status }

            setRepairs(prev =>
                prev.map(repair => repair.id === id ? transformed : repair)
            )

            // Status change notification
            const statusLabels: Record<RepairStatus, string> = {
                recibido: 'Recibido',
                diagnostico: 'En diagnóstico',
                reparacion: 'En reparación',
                pausado: 'Pausado',
                listo: 'Listo para entrega',
                entregado: 'Entregado',
                cancelado: 'Cancelado'
            }

            toast.success(`Estado actualizado a: ${statusLabels[status]}`)
            return true
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al actualizar estado: ' + error.message)
            return false
        }
    }, [selectedBranchId])

    // Deliver repair with outcome
    const deliverRepair = useCallback(async (
        id: string,
        outcome: RepairDeliveryOutcome,
        note?: string
    ): Promise<boolean> => {
        try {
            setError(null)
            const response = await fetch(`/api/repairs/${id}/delivery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...branchHeaders(selectedBranchId),
                },
                body: JSON.stringify({ outcome, note }),
            })
            const payload = await response.json().catch(() => null) as { repair?: unknown; error?: string } | null

            if (!response.ok || !payload?.repair) {
                throw new Error(payload?.error || 'No se pudo registrar la entrega')
            }

            const mapped = mapSupabaseRepairToUi(payload.repair as SupabaseRepairPayload)
            const transformed = { ...mapped, dbStatus: mapped.status }
            setRepairs(prev => prev.map(r => r.id === id ? transformed : r))

            toast.success('Reparación marcada como entregada')
            return true
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al registrar entrega: ' + error.message)
            return false
        }
    }, [selectedBranchId])

    // Assign technician
    const assignTechnician = useCallback(async (
        repairId: string,
        technicianId: string
    ): Promise<boolean> => {
        try {
            setError(null)

            const response = await fetch(`/api/repairs/${repairId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...branchHeaders(selectedBranchId),
                },
                body: JSON.stringify({ technician_id: technicianId }),
            })
            const payload = await response.json().catch(() => null) as { repair?: unknown; error?: string } | null

            if (!response.ok || !payload?.repair) {
                throw new Error(payload?.error || 'No se pudo asignar tecnico')
            }

            const mapped = mapSupabaseRepairToUi(payload.repair as SupabaseRepairPayload)
            const transformed = { ...mapped, dbStatus: mapped.status }

            setRepairs(prev =>
                prev.map(repair => repair.id === repairId ? transformed : repair)
            )

            toast.success('Técnico asignado exitosamente')
            return true
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al asignar técnico: ' + error.message)
            return false
        }
    }, [selectedBranchId])

    // Add images to repair
    const addImages = useCallback(async (
        repairId: string,
        urls: string[],
        imageType: string = 'general'
    ): Promise<boolean> => {
        try {
            if (!urls || urls.length === 0) return true
            const response = await fetch(`/api/repairs/${repairId}/images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...branchHeaders(selectedBranchId),
                },
                body: JSON.stringify({ urls, imageType }),
            })
            const payload = await response.json().catch(() => null) as { repair?: unknown; error?: string } | null

            if (!response.ok || !payload?.repair) {
                throw new Error(payload?.error || 'No se pudieron agregar imagenes')
            }

            const mapped = mapSupabaseRepairToUi(payload.repair as SupabaseRepairPayload)
            const transformed = { ...mapped, dbStatus: mapped.status }
            setRepairs(prev => prev.map(r => r.id === repairId ? transformed : r))
            toast.success('Imágenes agregadas a la reparación')
            return true
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al agregar imágenes: ' + error.message)
            return false
        }
    }, [selectedBranchId])

    // Get repairs by status
    const getRepairsByStatus = useCallback((status: RepairStatus): Repair[] => {
        return repairs.filter(repair => repair.dbStatus === status)
    }, [repairs])

    // Get repairs by technician
    const getRepairsByTechnician = useCallback((technicianId: string): Repair[] => {
        return repairs.filter(repair => repair.technician?.id === technicianId)
    }, [repairs])

    // Get urgent repairs
    const getUrgentRepairs = useCallback((): Repair[] => {
        return repairs.filter(
            repair => repair.urgency === 'urgent' &&
                repair.dbStatus !== 'listo' &&
                repair.dbStatus !== 'entregado' &&
                repair.dbStatus !== 'cancelado'
        )
    }, [repairs])

    // Search repairs
    const searchRepairs = useCallback((query: string): Repair[] => {
        if (!query.trim()) return repairs

        const lowerQuery = query.toLowerCase()
        return repairs.filter(
            repair =>
                repair.customer.name.toLowerCase().includes(lowerQuery) ||
                repair.device.toLowerCase().includes(lowerQuery) ||
                repair.brand.toLowerCase().includes(lowerQuery) ||
                repair.model.toLowerCase().includes(lowerQuery) ||
                repair.issue.toLowerCase().includes(lowerQuery) ||
                repair.id.toLowerCase().includes(lowerQuery)
        )
    }, [repairs])

    // Get repair by ID
    const getRepairById = useCallback((id: string): Repair | undefined => {
        return repairs.find(repair => repair.id === id)
    }, [repairs])

    // Refresh repairs (alias for fetchRepairs)
    const refreshRepairs = fetchRepairs

    // Initial fetch
    useEffect(() => {
        if (!shouldLoadRepairs) return
        fetchRepairs()
    }, [fetchRepairs, shouldLoadRepairs])

    // Supabase realtime subscription
    useEffect(() => {
        if (!shouldLoadRepairs) return
        const channel = supabase
            .channel(`repairs_changes_${selectedBranchId || 'all'}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'repairs',
                    ...(selectedBranchId ? { filter: `branch_id=eq.${selectedBranchId}` } : {}),
                },
                async (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        await fetchRepairs()
                    } else if (payload.eventType === 'DELETE') {
                        setRepairs(prev => prev.filter(repair => repair.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchRepairs, selectedBranchId, shouldLoadRepairs, supabase])

    // Create context value object
    const contextValue = useMemo<RepairsContextValue>(() => ({
        repairs,
        isLoading,
        error,
        fetchRepairs,
        createRepair,
        updateRepair,
        deleteRepair,
        updateStatus,
        deliverRepair,
        assignTechnician,
        getRepairsByStatus,
        getRepairsByTechnician,
        getUrgentRepairs,
        searchRepairs,
        getRepairById,
        refreshRepairs,
        addImages
    }), [
        repairs,
        isLoading,
        error,
        fetchRepairs,
        createRepair,
        updateRepair,
        deleteRepair,
        updateStatus,
        deliverRepair,
        assignTechnician,
        getRepairsByStatus,
        getRepairsByTechnician,
        getUrgentRepairs,
        searchRepairs,
        getRepairById,
        refreshRepairs,
        addImages
    ])

    return (
        <RepairsContext.Provider value={contextValue}>
            {children}
        </RepairsContext.Provider>
    )
}

// ============================================================================
// Hook
// ============================================================================

export function useRepairs() {
    const context = useContext(RepairsContext)
    if (context === undefined) {
        throw new Error('useRepairs must be used within a RepairsProvider')
    }
    return context
}
