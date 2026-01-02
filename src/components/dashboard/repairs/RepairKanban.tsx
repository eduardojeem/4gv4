'use client'

import React, { useState, memo } from 'react'
import { Repair, RepairStatus } from '@/types/repairs'
import { statusConfig } from '@/data/mock-repairs'
import { cn } from '@/lib/utils'
import { RepairCard } from './RepairCard'
import {
    DndContext,
    DragOverlay,
    SortableContext,
    useSortable
} from '@/components/stubs/HeavyDependencyStubs';
import { EmptyState } from '@/components/shared/EmptyState'
import { Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RepairKanbanProps {
    repairs: Repair[]
    onStatusChange: (id: string, status: RepairStatus) => Promise<void>
    onEdit: (repair: Repair) => void
}

// Comentado temporalmente para optimización de bundle
// const dropAnimation: DropAnimation = {
//     sideEffects: defaultDropAnimationSideEffects({
//         styles: {
//             active: {
//                 opacity: '0.5',
//             },
//         },
//     }),
// }

export function RepairKanban({ repairs, onStatusChange, onEdit }: RepairKanbanProps) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const [kanbanOrder, setKanbanOrder] = useState<Record<RepairStatus, string[]>>(() => {
        const initial: Record<RepairStatus, string[]> = {
            recibido: [],
            diagnostico: [],
            reparacion: [],
            pausado: [],
            listo: [],
            entregado: [],
            cancelado: []
        }
        repairs.forEach(r => {
            if (initial[r.status]) {
                initial[r.status].push(r.id)
            }
        })
        return initial
    })

    // Comentado temporalmente para optimización de bundle
    // const sensors = useSensors(
    //     useSensor(PointerSensor, {
    //         activationConstraint: {
    //             distance: 5,
    //         },
    //     }),
    //     useSensor(KeyboardSensor, {
    //         coordinateGetter: sortableKeyboardCoordinates,
    //     })
    // )

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)

        if (!over) return

        const activeRepairId = active.id as string
        const overId = over.id as string

        // Find the status of the container we dropped into
        let newStatus: RepairStatus | undefined

        // Check if we dropped directly onto a column
        if (overId in statusConfig) {
            newStatus = overId as RepairStatus
        } else {
            // Check if we dropped onto another card
            for (const [status, ids] of Object.entries(kanbanOrder)) {
                if (ids.includes(overId)) {
                    newStatus = status as RepairStatus
                    break
                }
            }
        }

        if (newStatus) {
            // Optimistic update
            setKanbanOrder(prev => {
                const next = { ...prev }
                    // Remove from all columns
                    ; (Object.keys(next) as RepairStatus[]).forEach(k => {
                        next[k] = next[k].filter(id => id !== activeRepairId)
                    })
                // Add to new column
                next[newStatus!] = [activeRepairId, ...next[newStatus!]]
                return next
            })

            // Update in database
            try {
                await onStatusChange(activeRepairId, newStatus)
            } catch (error) {
                // Revert on error
                const initial: Record<RepairStatus, string[]> = {
                    recibido: [],
                    diagnostico: [],
                    reparacion: [],
                    pausado: [],
                    listo: [],
                    entregado: [],
                    cancelado: []
                }
                repairs.forEach(r => {
                    if (initial[r.status]) {
                        initial[r.status].push(r.id)
                    }
                })
                setKanbanOrder(initial)
            }
        }
    }

    const getRepairById = (id: string) => repairs.find(r => r.id === id)

    return (
        <DndContext
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full gap-4 overflow-x-auto pb-4">
                {(Object.keys(statusConfig) as RepairStatus[]).map((status) => {
                    const config = statusConfig[status]
                    const repairIds = kanbanOrder[status] || []
                    const columnRepairs = repairIds
                        .map(id => repairs.find(r => r.id === id))
                        .filter((r): r is Repair => !!r)

                    return (
                        <KanbanColumn
                            key={status}
                            id={status}
                            title={config.label}
                            icon={config.icon}
                            count={columnRepairs.length}
                            color={config.color}
                            bg={config.color}
                            columnBg={config.columnBg}
                        >
                            <SortableContext
                                items={repairIds}
                            >
                                {columnRepairs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs border-2 border-dashed rounded-lg bg-white/50 p-4 text-center">
                                        <Package className="h-6 w-6 mb-2 opacity-50" />
                                        <p>Sin reparaciones</p>
                                    </div>
                                ) : (
                                    columnRepairs.map((repair) => (
                                        <SortableRepairCard
                                            key={repair.id}
                                            repair={repair}
                                            onEdit={onEdit}
                                        />
                                    ))
                                )}
                            </SortableContext>
                        </KanbanColumn>
                    )
                })}
            </div>

            <DragOverlay>
                {activeId ? (
                    <RepairCardOverlay repair={getRepairById(activeId)} />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}

interface KanbanColumnProps {
    id: string
    title: string
    icon: any
    count: number
    color: string
    bg: string
    columnBg?: string
    children: React.ReactNode
}

function KanbanColumn({ id, title, icon: Icon, count, color, bg, columnBg, children }: KanbanColumnProps) {
    const { setNodeRef } = useSortable({
        id: id,
        data: {
            type: 'Column',
        },
    })

    return (
        <div
            ref={setNodeRef}
            className={cn("flex h-full min-w-[300px] flex-col rounded-lg p-2", columnBg || "bg-muted/30")}
        >
            <div className={cn("mb-2 flex items-center justify-between rounded-md border p-3 shadow-sm", bg)}>
                <div className="flex items-center gap-2 font-semibold">
                    <Icon className={cn("h-4 w-4", color.split(' ')[1])} />
                    <span>{title}</span>
                </div>
                <Badge variant="secondary" className="bg-white/50">
                    {count}
                </Badge>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-1">
                {children}
            </div>
        </div>
    )
}

interface SortableRepairCardProps {
    repair: Repair
    onEdit: (repair: Repair) => void
}

function SortableRepairCard({ repair, onEdit }: SortableRepairCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: repair.id,
        data: {
            type: 'Repair',
            repair,
        },
    })

    const style = {
        transform: CSS.Transform?.toString(transform),
        transition,
    }

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-30"
            >
                <RepairCardContent repair={repair} />
            </div>
        )
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onEdit(repair)}
            className="cursor-grab active:cursor-grabbing"
        >
            <RepairCardContent repair={repair} />
        </div>
    )
}

function RepairCardOverlay({ repair }: { repair?: Repair }) {
    if (!repair) return null
    return (
        <div className="cursor-grabbing rotate-2 scale-105 shadow-xl">
            <RepairCardContent repair={repair} />
        </div>
    )
}

function RepairCardContent({ repair }: { repair: Repair }) {
    return <RepairCard repair={repair} />
}

