'use client'

import { useState } from 'react'
import { Repair, DbRepairStatus, RepairStatus } from '@/types/repairs'
import { statusConfig } from '@/config/repair-constants'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Package } from 'lucide-react'
import {
    DndContext,
    DragOverlay,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    useSensor,
    useSensors,
    PointerSensor,
    closestCorners
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable
} from '@dnd-kit/sortable';
import { RepairCard } from '@/components/dashboard/repairs/RepairCard'
import { CSS } from '@dnd-kit/utilities';

interface TechnicianKanbanProps {
    repairs: Repair[]
    kanbanOrder: Record<DbRepairStatus, string[]>
    onDragStart: (id: string) => void
    onDropTo: (status: DbRepairStatus) => void
    draggedRepairId: string | null
    onEdit: (repair: Repair) => void
    onView?: (repair: Repair) => void
    technicianIds: string[]
    showMyRepairsOnly?: boolean
}

export function TechnicianKanban({
    repairs,
    kanbanOrder,
    onDragStart,
    onDropTo,
    draggedRepairId,
    onEdit,
    onView,
    showMyRepairsOnly
}: TechnicianKanbanProps) {
    const [activeId, setActiveId] = useState<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        setActiveId(active.id as string)
        onDragStart(active.id as string)
    }

    const handleDragOver = (event: DragOverEvent) => {
        // In a real implementation with local state for ordering, we would update the order here.
        // For now, we rely on the parent's optimistic update on drop.
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)

        if (!over) return

        const activeRepairId = active.id as string
        const overId = over.id as string

        // Find the status of the container we dropped into
        let newStatus: DbRepairStatus | undefined

        // Check if we dropped directly onto a column
        if (overId in statusConfig) {
            newStatus = overId as DbRepairStatus
        } else {
            // Check if we dropped onto another card
            // Find which column contains this card
            for (const [status, ids] of Object.entries(kanbanOrder)) {
                if (ids.includes(overId)) {
                    newStatus = status as DbRepairStatus
                    break
                }
            }
        }

        if (newStatus) {
            onDropTo(newStatus)
        }
    }

    const getRepairById = (id: string) => repairs.find(r => r.id === id)

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full gap-4 overflow-x-auto pb-4">
                {(Object.keys(statusConfig) as DbRepairStatus[]).map((status) => {
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
                                        <p>{showMyRepairsOnly ? "No tienes reparaciones asignadas" : "Sin reparaciones"}</p>
                                    </div>
                                ) : (
                                    columnRepairs.map((repair) => (
                                        <SortableRepairCard
                                            key={repair.id}
                                            repair={repair}
                                            onEdit={onEdit}
                                            onView={onView}
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
    onView?: (repair: Repair) => void
}

function SortableRepairCard({ repair, onEdit, onView }: SortableRepairCardProps) {
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
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
    }

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-30"
            >
                <RepairCard repair={repair} />
            </div>
        )
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onView ? onView(repair) : onEdit(repair)}
            className="cursor-grab active:cursor-grabbing"
        >
            <RepairCard repair={repair} />
        </div>
    )
}

function RepairCardOverlay({ repair }: { repair?: Repair }) {
    if (!repair) return null
    return (
        <div className="cursor-grabbing rotate-2 scale-105 shadow-xl">
            <RepairCard repair={repair} />
        </div>
    )
}
