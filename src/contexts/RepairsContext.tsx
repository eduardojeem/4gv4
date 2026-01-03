'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { mapSupabaseRepairToUi } from '@/utils/repair-mapping'

// ============================================================================
// Types
// ============================================================================

// Importar tipos centralizados
import { Repair, RepairStatus, RepairPriority } from '@/types/repairs'

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
    metadata?: Record<string, unknown>
}

export interface RepairsContextValue {
    repairs: Repair[]
    isLoading: boolean
    error: Error | null

    fetchRepairs: () => Promise<void>
    createRepair: (data: RepairFormData) => Promise<Repair | null>
    updateRepair: (id: string, data: Partial<Repair>) => Promise<Repair | null>
    deleteRepair: (id: string) => Promise<boolean>
    updateStatus: (id: string, status: RepairStatus) => Promise<boolean>
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

    const supabase = createClient()

    // Fetch all repairs
    const fetchRepairs = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)

            const { data, error: fetchError } = await supabase
                .from('repairs')
                .select(`
          *,
          customer:customers(id, name, phone, email),
          technician:profiles(id, full_name),
          images:repair_images(id, image_url, description)
        `)
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            // Transform data to match Repair interface
            const transformedData = (data || []).map((repair: any) => {
                const mapped = mapSupabaseRepairToUi(repair)
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
    }, [supabase])

    // Create repair
    const createRepair = useCallback(async (data: RepairFormData): Promise<Repair | null> => {
        try {
            setError(null)

            const { data: newRepair, error: createError } = await supabase
                .from('repairs')
                .insert([{
                    customer_id: data.customer_id,
                    device_brand: data.brand,
                    device_model: data.model,
                    device_type: data.deviceType,
                    problem_description: data.issue,
                    diagnosis: data.description,
                    access_type: data.accessType || 'none',
                    access_password: data.accessPassword || null,
                    status: 'recibido',
                    priority: data.priority,
                    urgency: data.urgency,
                    technician_id: data.technician_id,
                    estimated_cost: data.estimated_cost,
                    received_at: new Date().toISOString()
                }])
                .select(`
          *,
          customer:customers(name, phone, email),
          technician:profiles(id, full_name),
          images:repair_images(id, image_url, description)
        `)
                .single()

            if (createError) throw createError

            const mapped = mapSupabaseRepairToUi(newRepair)
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
    }, [supabase])

    // Update repair
    const updateRepair = useCallback(async (
        id: string,
        data: Partial<Repair>
    ): Promise<Repair | null> => {
        try {
            setError(null)

            const { data: updatedRepair, error: updateError } = await supabase
                .from('repairs')
                .update(data)
                .eq('id', id)
                .select(`
          *,
          customer:customers(name, phone, email),
          technician:profiles(id, full_name),
          images:repair_images(id, image_url, description)
        `)
                .single()

            if (updateError) throw updateError

            const mapped = mapSupabaseRepairToUi(updatedRepair)
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
    }, [supabase])

    // Delete repair
    const deleteRepair = useCallback(async (id: string): Promise<boolean> => {
        try {
            setError(null)

            const { error: deleteError } = await supabase
                .from('repairs')
                .delete()
                .eq('id', id)

            if (deleteError) throw deleteError

            setRepairs(prev => prev.filter(repair => repair.id !== id))
            toast.success('Reparación eliminada exitosamente')
            return true
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al eliminar reparación: ' + error.message)
            return false
        }
    }, [supabase])

    // Update status
    const updateStatus = useCallback(async (
        id: string,
        status: RepairStatus
    ): Promise<boolean> => {
        try {
            setError(null)

            const updateData: any = { status }

            // Auto-set dates based on status
            if (status === 'listo') {
                updateData.completed_at = new Date().toISOString()
            }
            if (status === 'entregado') {
                updateData.delivered_at = new Date().toISOString()
            }

            const { data: updatedRepair, error: updateError } = await supabase
                .from('repairs')
                .update(updateData)
                .eq('id', id)
                .select(`
          *,
          customer:customers(name, phone, email),
          technician:profiles(id, full_name),
          images:repair_images(id, image_url, description)
        `)
                .single()

            if (updateError) throw updateError

            const mapped = mapSupabaseRepairToUi(updatedRepair)
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
    }, [supabase])

    // Assign technician
    const assignTechnician = useCallback(async (
        repairId: string,
        technicianId: string
    ): Promise<boolean> => {
        try {
            setError(null)

            const { data: updatedRepair, error: updateError } = await supabase
                .from('repairs')
                .update({ technician_id: technicianId })
                .eq('id', repairId)
                .select(`
          *,
          customer:customers(name, phone, email),
          technician:profiles(id, full_name),
          images:repair_images(id, image_url, description)
        `)
                .single()

            if (updateError) throw updateError

            const mapped = mapSupabaseRepairToUi(updatedRepair)
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
    }, [supabase])

    // Add images to repair
    const addImages = useCallback(async (
        repairId: string,
        urls: string[],
        imageType: string = 'general'
    ): Promise<boolean> => {
        try {
            if (!urls || urls.length === 0) return true
            const payload = urls.map(url => ({
                repair_id: repairId,
                image_url: url,
                image_type: imageType
            }))
            const { error: insertError } = await supabase
                .from('repair_images')
                .insert(payload)
            if (insertError) throw insertError
            setRepairs(prev => prev.map(r => 
                r.id === repairId 
                    ? { 
                        ...r, 
                        images: [
                            ...(Array.isArray(r.images) ? r.images : []), 
                            ...urls.map(u => ({ id: u, url: u }))
                        ] 
                      } 
                    : r
            ))
            toast.success('Imágenes agregadas a la reparación')
            return true
        } catch (err) {
            const error = err as Error
            setError(error)
            toast.error('Error al agregar imágenes: ' + error.message)
            return false
        }
    }, [supabase])

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
        fetchRepairs()
    }, [fetchRepairs])

    // Supabase realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel('repairs_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'repairs' },
                async (payload) => {
                    // Fetch full repair with relations
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const { data } = await supabase
                            .from('repairs')
                            .select(`
                *,
                customer:customers(name, phone, email),
                technician:profiles(id, full_name),
                images:repair_images(id, image_url, description)
              `)
                            .eq('id', payload.new.id)
                            .single()

                        if (data) {
                            const mapped = mapSupabaseRepairToUi(data)
                            const transformed = { ...mapped, dbStatus: mapped.status }

                            if (payload.eventType === 'INSERT') {
                                setRepairs(prev => [transformed, ...prev])
                            } else {
                                setRepairs(prev =>
                                    prev.map(repair => repair.id === transformed.id ? transformed : repair)
                                )
                            }
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setRepairs(prev => prev.filter(repair => repair.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase])

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
