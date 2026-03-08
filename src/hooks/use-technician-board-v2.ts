import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import { DbRepairStatus } from '@/types/repairs'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

export function useTechnicianBoardV2() {
    // Usar el contexto global para datos
    const { 
        repairs: allRepairs, 
        isLoading, 
        updateRepair: globalUpdateRepair,
        createRepair: globalCreateRepair,
        addImages: globalAddImages,
        refreshRepairs,
        updateStatus
    } = useRepairs()
    
    const { user } = useAuth()
    const canViewAllRepairs = user?.role === 'admin'
    
    // Estado específico del dashboard técnico
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

    // Filtrar reparaciones para el técnico actual
    const repairs = useMemo(() => {
        if (!showMyRepairsOnly && canViewAllRepairs) return allRepairs
        if (!user?.id) return []
        return allRepairs.filter(r => r.technician?.id === user.id)
    }, [allRepairs, showMyRepairsOnly, user?.id, canViewAllRepairs])

    useEffect(() => {
        if (!canViewAllRepairs && !showMyRepairsOnly) {
            setShowMyRepairsOnly(true)
        }
    }, [canViewAllRepairs, showMyRepairsOnly])

    // Inicializar orden del Kanban cuando cambien las reparaciones
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

    // Funciones específicas del dashboard técnico
    const onDragStart = (id: string) => setDraggedRepairId(id)

    const setScopeToMyRepairs = (show: boolean) => {
        if (!canViewAllRepairs) {
            setShowMyRepairsOnly(true)
            return
        }
        setShowMyRepairsOnly(show)
    }

    const onDropTo = async (status: DbRepairStatus) => {
        if (!draggedRepairId) return

        const repairToMove = repairs.find(r => r.id === draggedRepairId)
        const previousStatus = repairToMove?.dbStatus || repairToMove?.status

        // Actualización optimista del Kanban
        setKanbanOrder(prev => {
            const next = { ...prev }
            ;(Object.keys(next) as DbRepairStatus[]).forEach(k => {
                next[k] = next[k].filter(id => id !== draggedRepairId)
            })
            next[status] = [draggedRepairId, ...next[status]]
            return next
        })

        try {
            // Usar la función del contexto global para actualizar
            const success = await updateStatus(draggedRepairId, status)
            if (!success) {
                throw new Error(`No se pudo actualizar el estado de ${previousStatus} a ${status}`)
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido al actualizar estado'
            logger.error('Error updating repair status', {
                repairId: draggedRepairId,
                fromStatus: previousStatus,
                toStatus: status,
                error: errorMessage
            })
            
            toast.error(`Error: ${errorMessage}. Revirtiendo cambios...`)
            
            // Revertir cambios recargando datos
            await refreshRepairs()
        } finally {
            setDraggedRepairId(null)
        }
    }

interface RepairUpdateData {
    status?: string
    priority?: string
    urgency?: string
    estimated_cost?: number
    final_cost?: number
    technician_id?: string
    notes?: string
    [key: string]: unknown
}

interface RepairCreateData {
    customer_name: string
    customer_phone?: string
    customer_email?: string
    device_brand: string
    device_model: string
    issue_description: string
    status?: string
    priority?: string
    urgency?: string
    estimated_cost?: number
    technician_id?: string
    notes?: string
    [key: string]: unknown
}

    // Wrapper para actualizar reparación manteniendo compatibilidad
    const updateRepair = async (id: string, data: RepairUpdateData) => {
        try {
            // Cast necesario: RepairUpdateData usa snake_case (DB) mientras globalUpdateRepair espera Partial<Repair>
            const result = await globalUpdateRepair(id, data as any)
            return result
        } catch (error) {
            logger.error('Error updating repair', { error })
            toast.error('Error al actualizar la reparación')
            throw error
        }
    }

    const createRepair = async (data: RepairCreateData) => {
        try {
            // Cast necesario: RepairCreateData usa snake_case (DB) mientras globalCreateRepair espera RepairFormData
            const result = await globalCreateRepair(data as any)
            if (result) {
                toast.success('Reparación creada correctamente')
            }
            return result
        } catch (error) {
            logger.error('Error creating repair', { error })
            toast.error('Error al crear la reparación')
            throw error
        }
    }

    const addImages = async (repairId: string, urls: string[], imageType?: string) => {
        try {
            return await globalAddImages(repairId, urls, imageType)
        } catch (error) {
            logger.error('Error adding images', { error })
            toast.error('Error al agregar imágenes')
            return false
        }
    }

    return {
        repairs,
        kanbanOrder,
        isLoading,
        draggedRepairId,
        showMyRepairsOnly,
        setShowMyRepairsOnly: setScopeToMyRepairs,
        canViewAllRepairs,
        onDragStart,
        onDropTo,
        updateRepair,
        createRepair,
        addImages,
        refreshRepairs
    }
}
