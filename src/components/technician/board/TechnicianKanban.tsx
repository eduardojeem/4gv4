'use client'

import { useState } from 'react'
import { Repair, DbRepairStatus, RepairPriority } from '@/types/repairs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Inbox, Activity, Wrench, CheckCircle, Package, Calendar, AlertCircle, XCircle } from 'lucide-react'
import {
    DndContext,
    DragOverlay,
    SortableContext,
    useSortable,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent
} from '@/components/stubs/HeavyDependencyStubs';

interface TechnicianKanbanProps {
    repairs: Repair[]
    kanbanOrder: Record<DbRepairStatus, string[]>
    onDragStart: (id: string) => void
    onDropTo: (status: DbRepairStatus) => void
    draggedRepairId: string | null
    onEdit: (repair: Repair) => void
    technicianIds: string[]
    showMyRepairsOnly?: boolean
}

const technicianColumns: Record<DbRepairStatus, { label: string, icon: any, color: string, bg: string }> = {
    recibido: { label: 'Recibido', icon: Inbox, color: 'text-slate-600', bg: 'bg-slate-100' },
    diagnostico: { label: 'Diagnóstico', icon: Activity, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    reparacion: { label: 'En Reparación', icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50' },
    pausado: { label: 'Pausado', icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
    listo: { label: 'Listo', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    entregado: { label: 'Entregado', icon: Package, color: 'text-gray-600', bg: 'bg-gray-50' },
    cancelado: { label: 'Cancelado', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' }
}

const priorityConfig: Record<RepairPriority, { label: string, color: string }> = {
    low: { label: 'Baja', color: 'bg-slate-200 text-slate-700' },
    medium: { label: 'Media', color: 'bg-blue-100 text-blue-700' },
    high: { label: 'Alta', color: 'bg-red-100 text-red-700' }
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

export function TechnicianKanban({
    repairs,
    kanbanOrder,
    onDragStart,
    onDropTo,
    draggedRepairId,
    onEdit,
    showMyRepairsOnly
}: TechnicianKanbanProps) {
    const [activeId, setActiveId] = useState<string | null>(null)

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
        if (overId in technicianColumns) {
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
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full gap-4 overflow-x-auto pb-4">
                {(Object.keys(technicianColumns) as DbRepairStatus[]).map((status) => {
                    const config = technicianColumns[status]
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
                            bg={config.bg}
                            repairs={columnRepairs}
                        >
                            <SortableContext
                                items={repairIds}
                            >
                                {columnRepairs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs border-2 border-dashed rounded-lg bg-white/50 p-4 text-center">
                                        <p>{showMyRepairsOnly ? "No tienes reparaciones asignadas" : "Sin reparaciones"}</p>
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
    repairs: Repair[]
    children: React.ReactNode
}

function KanbanColumn({ id, title, icon: Icon, count, color, bg, children }: KanbanColumnProps) {
    const { setNodeRef } = useSortable({
        id: id,
        data: {
            type: 'Column',
        },
    })

    return (
        <div
            ref={setNodeRef}
            className="flex h-full min-w-[300px] flex-col rounded-lg bg-muted/30 p-2"
        >
            <div className={cn("mb-2 flex items-center justify-between rounded-md border p-3 shadow-sm", bg)}>
                <div className="flex items-center gap-2 font-semibold">
                    <Icon className={cn("h-4 w-4", color)} />
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
    return (
        <Card className={cn(
            "hover:shadow-md transition-all border-l-4",
            repair.urgency === 'urgent' ? 'border-l-red-500' : 'border-l-transparent'
        )}>
            <CardContent className="p-3 space-y-2">
                <div className="flex justify-between items-start">
                    <span className="font-medium text-sm truncate max-w-[150px]">{repair.device}</span>
                    <Badge className={cn("text-[10px] px-1 py-0 h-5", priorityConfig[repair.priority].color)}>
                        {priorityConfig[repair.priority].label}
                    </Badge>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5em]">
                    {repair.issue}
                </p>

                {repair.urgency === 'urgent' && (
                    <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                        <AlertCircle className="h-3 w-3" />
                        <span>Urgente</span>
                    </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t mt-2">
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(repair.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                    <span className="font-mono text-[10px] bg-slate-100 px-1 rounded">{repair.id}</span>
                </div>
            </CardContent>
        </Card>
    )
}
