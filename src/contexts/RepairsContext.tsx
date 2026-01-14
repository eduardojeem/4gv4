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
    laborCost?: number
    finalCost?: number | null
    metadata?: Record<string, unknown>
    parts?: any[]
    notes?: any[]
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

            const { parts, notes, ...repairData } = data

            // 1. Create Repair
            const { data: newRepair, error: createError } = await supabase
                .from('repairs')
                .insert([{
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
                    technician_id: repairData.technician_id,
                    estimated_cost: repairData.estimated_cost,
                    labor_cost: repairData.laborCost || 0,
                    final_cost: repairData.finalCost,
                    received_at: new Date().toISOString()
                }])
                .select()
                .single()

            if (createError) throw createError
            
            const newRepairId = newRepair.id

            // 2. Insert Parts
            if (parts && parts.length > 0) {
                 const partsToInsert = parts.map((p: any) => ({
                     repair_id: newRepairId,
                     part_name: p.name,
                     unit_cost: p.cost,
                     quantity: p.quantity,
                     supplier: p.supplier,
                     part_number: p.partNumber
                 }))
                 const { error: insertPartsError } = await supabase.from('repair_parts').insert(partsToInsert)
                 if (insertPartsError) throw insertPartsError
            }

            // 3. Insert Notes
            if (notes && notes.length > 0) {
                 const notesToInsert = notes.map((n: any) => ({
                     repair_id: newRepairId,
                     note_text: n.text,
                     is_internal: n.isInternal
                 }))
                 const { error: insertNotesError } = await supabase.from('repair_notes').insert(notesToInsert)
                 if (insertNotesError) throw insertNotesError
            }

            // 4. Fetch Complete Repair
            const { data: finalRepair, error: fetchError } = await supabase
                .from('repairs')
                .select(`
                  *,
                  customer:customers(name, phone, email),
                  technician:profiles(id, full_name),
                  images:repair_images(id, image_url, description),
                  parts:repair_parts(*),
                  notes:repair_notes(*)
                `)
                .eq('id', newRepairId)
                .single()

            if (fetchError) throw fetchError

            const mapped = mapSupabaseRepairToUi(finalRepair)
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

            // Extract parts and notes to handle separately
            const { parts, notes, customer, technician, images, ...repairData } = data as any

            const dbUpdateData: any = {}

            // Map UI fields to DB columns
            if (repairData.brand !== undefined) dbUpdateData.device_brand = repairData.brand
            if (repairData.model !== undefined) dbUpdateData.device_model = repairData.model
            if (repairData.deviceType !== undefined) dbUpdateData.device_type = repairData.deviceType
            if (repairData.issue !== undefined) dbUpdateData.problem_description = repairData.issue
            if (repairData.description !== undefined) dbUpdateData.diagnosis = repairData.description
            if (repairData.accessType !== undefined) dbUpdateData.access_type = repairData.accessType
            if (repairData.accessPassword !== undefined) dbUpdateData.access_password = repairData.accessPassword
            if (repairData.status !== undefined) dbUpdateData.status = repairData.status
            if (repairData.priority !== undefined) dbUpdateData.priority = repairData.priority
            if (repairData.urgency !== undefined) dbUpdateData.urgency = repairData.urgency
            if (repairData.technician_id !== undefined) dbUpdateData.technician_id = repairData.technician_id
            if (repairData.estimatedCost !== undefined) dbUpdateData.estimated_cost = repairData.estimatedCost
            if (repairData.laborCost !== undefined) dbUpdateData.labor_cost = repairData.laborCost
            if (repairData.finalCost !== undefined) dbUpdateData.final_cost = repairData.finalCost

            // Only update repair if there are fields to update
            if (Object.keys(dbUpdateData).length > 0) {
                const { error: updateError } = await supabase
                    .from('repairs')
                    .update(dbUpdateData)
                    .eq('id', id)

                if (updateError) throw updateError
            }

            // Handle Parts - Strategy: Delete all and re-insert (simplest for syncing list)
            if (parts) {
                // 1. Delete existing parts
                const { error: deletePartsError } = await supabase
                    .from('repair_parts')
                    .delete()
                    .eq('repair_id', id)
                
                if (deletePartsError) throw deletePartsError

                // 2. Insert new parts
                if (parts.length > 0) {
                    const partsToInsert = parts.map((p: any) => ({
                        repair_id: id,
                        part_name: p.name,
                        unit_cost: p.cost,
                        quantity: p.quantity,
                        supplier: p.supplier,
                        part_number: p.partNumber
                    }))

                    const { error: insertPartsError } = await supabase
                        .from('repair_parts')
                        .insert(partsToInsert)
                    
                    if (insertPartsError) throw insertPartsError
                }
            }

            // Handle Notes - Strategy: Upsert existing, Insert new, Delete missing
            if (notes) {
                // 1. Get all current note IDs for this repair
                const { data: currentNotes } = await supabase
                    .from('repair_notes')
                    .select('id')
                    .eq('repair_id', id)
                
                const currentIds = (currentNotes || []).map((n: any) => n.id)
                const incomingIds = notes.filter((n: any) => n.id).map((n: any) => n.id)
                
                // 2. Delete notes that are no longer in the list
                const idsToDelete = currentIds.filter((cid: number) => !incomingIds.includes(cid))
                
                if (idsToDelete.length > 0) {
                    const { error: deleteNotesError } = await supabase
                        .from('repair_notes')
                        .delete()
                        .in('id', idsToDelete)

                    if (deleteNotesError) throw deleteNotesError
                }

                // 3. Upsert (Update/Insert) notes
                if (notes.length > 0) {
                    const notesToUpsert = notes.map((n: any) => {
                        const notePayload: any = {
                            repair_id: id,
                            note_text: n.text,
                            is_internal: n.isInternal
                        }
                        if (n.id) notePayload.id = n.id
                        // If it's a new note, we might want to set author if available, 
                        // but for now we let DB default or handle it.
                        return notePayload
                    })

                    const { error: upsertNotesError } = await supabase
                        .from('repair_notes')
                        .upsert(notesToUpsert)
                    
                    if (upsertNotesError) throw upsertNotesError
                }
            }

            // Fetch final state with all relations
            const { data: finalRepair, error: fetchError } = await supabase
                .from('repairs')
                .select(`
          *,
          customer:customers(name, phone, email),
          technician:profiles(id, full_name),
          images:repair_images(id, image_url, description),
          parts:repair_parts(*),
          notes:repair_notes(*)
        `)
                .single() // We query by ID in the context of previous operations, but need to be sure we get the right one
                .eq('id', id)

            if (fetchError) throw fetchError

            const mapped = mapSupabaseRepairToUi(finalRepair)
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
