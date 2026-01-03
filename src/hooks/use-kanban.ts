import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Repair, RepairStatus } from '@/types/repairs'

export function useKanban(
    repairs: Repair[],
    updateRepairStatus: (id: string, status: RepairStatus) => Promise<void>
) {
    const [kanbanOrder, setKanbanOrder] = useState<Record<RepairStatus, string[]>>({
        pending: [],
        in_progress: [],
        waiting_parts: [],
        on_hold: [],
        completed: [],
        cancelled: []
    })
    const [draggedRepairId, setDraggedRepairId] = useState<string | null>(null)
    const [dragOverTarget, setDragOverTarget] = useState<{ id: string | null, status: RepairStatus } | null>(null)

    // Initialize Kanban Order
    useEffect(() => {
        const loadOrder = async () => {
            // Try loading from Supabase or LocalStorage
            // Simplified for this refactor: Initialize from repairs list if empty
            const initial: Record<RepairStatus, string[]> = {
                pending: [], in_progress: [], waiting_parts: [], on_hold: [], completed: [], cancelled: []
            }

            // Populate based on current repairs
            repairs.forEach(r => {
                if (initial[r.status]) {
                    initial[r.status].push(r.id)
                }
            })

            setKanbanOrder(initial)
        }
        loadOrder()
    }, [repairs]) // Re-run when repairs change (might need optimization)

    const onDragStart = (id: string) => setDraggedRepairId(id)

    const onDropTo = async (status: RepairStatus) => {
        if (!draggedRepairId) return

        // Optimistic update of order
        setKanbanOrder(prev => {
            const next = { ...prev }
                ; (Object.keys(next) as RepairStatus[]).forEach(k => {
                    next[k] = next[k].filter(id => id !== draggedRepairId)
                })
            next[status] = [draggedRepairId, ...next[status]]
            return next
        })

        // Update status via parent hook
        await updateRepairStatus(draggedRepairId, status)

        setDraggedRepairId(null)
        setDragOverTarget(null)
    }

    return {
        kanbanOrder,
        draggedRepairId,
        onDragStart,
        onDropTo,
        setDragOverTarget
    }
}
