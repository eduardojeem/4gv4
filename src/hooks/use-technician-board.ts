import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Repair, DbRepairStatus } from '@/types/repairs'
import { mapSupabaseRepairToUi } from '@/utils/repair-mapping'

const isDemoMode = () => process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export function useTechnicianBoard() {
    const [repairs, setRepairs] = useState<Repair[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [kanbanOrder, setKanbanOrder] = useState<Record<DbRepairStatus, string[]>>({
        recibido: [],
        diagnostico: [],
        reparacion: [],
        pausado: [],
        listo: [],
        entregado: [],
        cancelado: []
    })
    const [draggedRepairId, setDraggedRepairId] = useState<string | null>(null)
    const [showMyRepairsOnly, setShowMyRepairsOnly] = useState(true)
    const [currentTechnicianId, setCurrentTechnicianId] = useState<string | null>(null)

    // Fetch repairs
    const fetchRepairs = useCallback(async () => {
        setIsLoading(true)
        try {
            if (isDemoMode()) {
                await new Promise(resolve => setTimeout(resolve, 800))
                // Add dbStatus to mock repairs for demo
                const enhancedMock = mockRepairs.map(r => ({
                    ...r,
                    dbStatus: r.status as DbRepairStatus
                }))
                setRepairs(enhancedMock)
                setCurrentTechnicianId('TECH-001') // Mock ID
            } else {
                const supabase = createSupabaseClient()
                const { data: { user } } = await supabase.auth.getUser()
                setCurrentTechnicianId(user?.id || null)

                const { data, error } = await supabase
                    .from('repairs')
                    .select(`
            *,
            customer:customers(id, first_name, last_name, phone, email),
            technician:profiles(id, full_name)
          `)
                    .order('created_at', { ascending: false })

                if (error) {
                    const msg = (error as any)?.message || String(error)
                    const missingTable = msg.includes("Could not find the table 'public.repairs'") || msg.includes('relation "repairs" does not exist')
                    if (missingTable) {
                        const enhancedMock = mockRepairs.map(r => ({
                            ...r,
                            dbStatus: r.status as DbRepairStatus
                        }))
                        setRepairs(enhancedMock)
                        return
                    }
                    throw error
                }

                const mappedRepairs: Repair[] = (data || []).map(mapSupabaseRepairToUi)
                setRepairs(mappedRepairs)
            }
        } catch (error: unknown) {
            const msg = (error && typeof error === 'object' && 'message' in error) ? (error as Error).message : String(error)
            const code = (error && typeof error === 'object' && 'code' in error) ? (error as { code: string }).code : undefined
            console.error('Error fetching repairs:', { message: msg, code })

            if (msg.includes('JWT') || msg.includes('token')) {
                toast.error('Sesión expirada. Por favor recargue la página.')
            } else if (msg.includes('network') || msg.includes('fetch')) {
                toast.error('Error de conexión. Verifique su internet.')
            } else {
                toast.error('Error al cargar reparaciones')
            }
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRepairs()

        if (!isDemoMode()) {
            const supabase = createSupabaseClient()
            const channel = supabase
                .channel('repairs-tech-board')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'repairs' },
                    () => {
                        fetchRepairs()
                    }
                )
                .subscribe()

            return () => {
                (supabase as any).removeChannel(channel)
            }
        }
    }, [fetchRepairs])

    // Initialize Kanban Order
    useEffect(() => {
        const initial: Record<DbRepairStatus, string[]> = {
            recibido: [], diagnostico: [], reparacion: [], pausado: [], listo: [], entregado: [], cancelado: []
        }

        repairs.forEach(r => {
            const status = (r.dbStatus || r.status) as DbRepairStatus
            if (status in initial) {
                initial[status].push(r.id)
            }
        })

        setKanbanOrder(initial)
    }, [repairs])

    const filteredRepairs = useMemo(() => {
        if (!showMyRepairsOnly || !currentTechnicianId) return repairs
        return repairs.filter(r => r.technician?.id === currentTechnicianId)
    }, [repairs, showMyRepairsOnly, currentTechnicianId])

    const onDragStart = (id: string) => setDraggedRepairId(id)

    const onDropTo = async (status: DbRepairStatus) => {
        if (!draggedRepairId) return

        // Optimistic update
        setKanbanOrder(prev => {
            const next = { ...prev }
                ; (Object.keys(next) as DbRepairStatus[]).forEach(k => {
                    next[k] = next[k].filter(id => id !== draggedRepairId)
                })
            next[status] = [draggedRepairId, ...next[status]]
            return next
        })

        // Update DB
        const supabase = createSupabaseClient()
        const { error } = await supabase
            .from('repairs')
            .update({ status })
            .eq('id', draggedRepairId)

        if (error) {
            console.error('Error updating status:', error)
            toast.error('Error al actualizar estado. Se revertirán los cambios.')
            fetchRepairs() // Revert
        } else {
            toast.success(`Movido a ${status}`)
        }

        setDraggedRepairId(null)
    }

interface RepairUpdateData {
    devices?: Array<{ brand: string; model: string }>
    issue?: string
    description?: string
    status?: string
    priority?: string
    urgency?: string
    estimated_cost?: number
    final_cost?: number
    technician_id?: string
    notes?: string
    [key: string]: unknown
}

    // Update Repair (for Dialog)
    const updateRepair = async (id: string, data: RepairUpdateData) => {
        const supabase = createSupabaseClient()
        const { error } = await supabase
            .from('repairs')
            .update({
                device_brand: data.devices[0].brand,
                device_model: data.devices[0].model,
                problem_description: data.devices[0].issue,
                diagnosis: data.devices[0].description,
                estimated_cost: data.devices[0].estimatedCost,
                technician_id: data.devices[0].technician
            })
            .eq('id', id)

        if (error) {
            console.error('Error updating repair:', error)
            toast.error('Error al guardar cambios')
            throw error
        }

        toast.success('Reparación actualizada')
        fetchRepairs()
    }

    return {
        repairs: filteredRepairs,
        kanbanOrder,
        isLoading,
        draggedRepairId,
        showMyRepairsOnly,
        setShowMyRepairsOnly,
        onDragStart,
        onDropTo,
        updateRepair,
        refreshRepairs: fetchRepairs
    }
}
