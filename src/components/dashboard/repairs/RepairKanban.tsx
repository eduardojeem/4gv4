'use client'

import React, { useState } from 'react'
import { Repair, RepairStatus } from '@/types/repairs'
import { statusConfig } from '@/config/repair-constants'
import { cn } from '@/lib/utils'
import { RepairCard } from './RepairCard'
import {
  DndContext,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  DragStartEvent,
  DragEndEvent,
  DropAnimation,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RepairKanbanProps {
    repairs: Repair[]
    onStatusChange: (id: string, status: RepairStatus) => Promise<void>
    onEdit: (repair: Repair) => void
    onView?: (repair: Repair) => void
    /**
     * Soltar una tarjeta en la columna "Entregado" no la entrega directo:
     * abre el mismo diálogo que el botón "Entregar" (pregunta resultado y
     * ofrece cobrar) para no marcar entregado en silencio arrastrando.
     */
    onRequestDeliver?: (repair: Repair) => void
}

const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: '0.5',
            },
        },
    }),
}

const ACTIVE_STATUSES: RepairStatus[] = ['recibido', 'diagnostico', 'reparacion', 'pausado', 'listo']
const ALL_STATUSES: RepairStatus[] = ['recibido', 'diagnostico', 'reparacion', 'pausado', 'listo', 'entregado', 'cancelado']

export function RepairKanban({ repairs, onStatusChange, onEdit, onView, onRequestDeliver }: RepairKanbanProps) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const [processScope, setProcessScope] = useState<'all' | 'active'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('repair_kanban_scope')
            if (saved === 'all' || saved === 'active') return saved
        }
        return 'all'
    })

    const handleScopeChange = (scope: 'all' | 'active') => {
        setProcessScope(scope)
        try {
            localStorage.setItem('repair_kanban_scope', scope)
        } catch {}
    }

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

    // Sync kanbanOrder when repairs prop changes externally (refresh, real-time updates)
    // Only re-sync when no drag is active to avoid interrupting the user
    React.useEffect(() => {
        if (activeId !== null) return // Don't sync during drag
        const synced: Record<RepairStatus, string[]> = {
            recibido: [],
            diagnostico: [],
            reparacion: [],
            pausado: [],
            listo: [],
            entregado: [],
            cancelado: []
        }
        repairs.forEach(r => {
            if (synced[r.status]) {
                synced[r.status].push(r.id)
            }
        })
        setKanbanOrder(synced)
    }, [repairs, activeId])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

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

        if (newStatus === 'entregado') {
            // No se entrega con un simple drag: se pregunta el resultado y se
            // ofrece cobrar, igual que el botón "Entregar". La tarjeta no se
            // mueve sola; se mueve de verdad cuando el diálogo confirma y
            // llega el estado actualizado por props.
            const draggedRepair = repairs.find(r => r.id === activeRepairId)
            if (draggedRepair) onRequestDeliver?.(draggedRepair)
            return
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
            } catch (_error) {
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
    const visibleStatuses = processScope === 'active' ? ACTIVE_STATUSES : ALL_STATUSES
    const activeCount = repairs.filter(r => ACTIVE_STATUSES.includes(r.status)).length

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col h-full gap-2">
                {/* Barra compacta de control de procesos */}
                <div className="flex items-center justify-between gap-2 px-1 flex-wrap shrink-0">
                    <div className="inline-flex items-center rounded-lg border border-border/70 bg-card/60 p-0.5 shadow-2xs backdrop-blur-xs">
                        <button
                            type="button"
                            onClick={() => handleScopeChange('active')}
                            className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer",
                                processScope === 'active'
                                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                    : "text-muted-foreground hover:text-foreground font-medium"
                            )}
                        >
                            <span>⚡ Procesos Activos ({activeCount})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleScopeChange('all')}
                            className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer",
                                processScope === 'all'
                                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                    : "text-muted-foreground hover:text-foreground font-medium"
                            )}
                        >
                            <span>Todos los Procesos ({repairs.length})</span>
                        </button>
                    </div>

                    <span className="text-[11px] text-muted-foreground/80 font-medium">
                        {processScope === 'active'
                            ? '5 etapas activas en taller'
                            : '7 etapas completas del flujo'}
                    </span>
                </div>

                {/* Columnas Kanban */}
                <div className="flex flex-1 gap-2 overflow-x-auto pb-2 px-0.5">
                    {visibleStatuses.map((status) => {
                        const config = statusConfig[status]
                        const repairIds = kanbanOrder[status] || []
                        const columnRepairs = repairIds
                            .map(id => repairs.find(r => r.id === id))
                            .filter((r): r is Repair => !!r)

                        return (
                            <KanbanColumn
                                key={status}
                                id={status}
                                status={status}
                                title={config.label}
                                icon={config.icon}
                                count={columnRepairs.length}
                            >
                                <SortableContext
                                    items={repairIds}
                                >
                                    {columnRepairs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-6 px-2 text-center rounded-lg border border-dashed border-border/60 bg-muted/20">
                                            <Package className="h-5 w-5 mb-1 opacity-35 text-muted-foreground stroke-[1.5]" />
                                            <p className="text-[11px] font-medium text-muted-foreground/70">Sin reparaciones</p>
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
            </div>

            <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (
                    <RepairCardOverlay repair={getRepairById(activeId)} />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}

const columnStyles: Record<RepairStatus, {
    headerBg: string
    iconColor: string
    badgeColor: string
    borderColor: string
}> = {
    recibido: {
        headerBg: 'bg-amber-500/10 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-500/25',
        iconColor: 'text-amber-600 dark:text-amber-400',
        badgeColor: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30',
        borderColor: 'hover:border-amber-400/50',
    },
    diagnostico: {
        headerBg: 'bg-indigo-500/10 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 border-indigo-500/25',
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        badgeColor: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border-indigo-500/30',
        borderColor: 'hover:border-indigo-400/50',
    },
    reparacion: {
        headerBg: 'bg-blue-500/10 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border-blue-500/25',
        iconColor: 'text-blue-600 dark:text-blue-400',
        badgeColor: 'bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-500/30',
        borderColor: 'hover:border-blue-400/50',
    },
    pausado: {
        headerBg: 'bg-purple-500/10 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 border-purple-500/25',
        iconColor: 'text-purple-600 dark:text-purple-400',
        badgeColor: 'bg-purple-500/15 text-purple-800 dark:text-purple-200 border-purple-500/30',
        borderColor: 'hover:border-purple-400/50',
    },
    listo: {
        headerBg: 'bg-cyan-500/10 dark:bg-cyan-950/30 text-cyan-900 dark:text-cyan-200 border-cyan-500/25',
        iconColor: 'text-cyan-600 dark:text-cyan-400',
        badgeColor: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 border-cyan-500/30',
        borderColor: 'hover:border-cyan-400/50',
    },
    entregado: {
        headerBg: 'bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-500/25',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        badgeColor: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30',
        borderColor: 'hover:border-emerald-400/50',
    },
    cancelado: {
        headerBg: 'bg-rose-500/10 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 border-rose-500/25',
        iconColor: 'text-rose-600 dark:text-rose-400',
        badgeColor: 'bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/30',
        borderColor: 'hover:border-rose-400/50',
    },
}

interface KanbanColumnProps {
    id: string
    status: RepairStatus
    title: string
    icon: React.ComponentType<{ className?: string }>
    count: number
    children: React.ReactNode
}

function KanbanColumn({ id, status, title, icon: Icon, count, children }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useSortable({
        id: id,
        data: {
            type: 'Column',
        },
    })

    const style = columnStyles[status] || columnStyles.recibido

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex h-full w-[215px] min-w-[215px] max-w-[225px] shrink-0 flex-col rounded-xl border border-border/70 bg-card/60 dark:bg-muted/10 p-1.5 shadow-2xs transition-all backdrop-blur-xs",
                style.borderColor,
                isOver && "ring-2 ring-primary/40 border-primary/50 bg-primary/5"
            )}
        >
            {/* Column Header */}
            <div className={cn("mb-1.5 flex items-center justify-between rounded-lg border px-2 py-1 shadow-2xs backdrop-blur-xs", style.headerBg)}>
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className="flex h-4.5 w-4.5 items-center justify-center rounded bg-background/85 shadow-2xs shrink-0">
                        <Icon className={cn("h-2.5 w-2.5", style.iconColor)} />
                    </div>
                    <span className="font-bold text-[11px] tracking-tight truncate">{title}</span>
                </div>
                <Badge
                    variant="outline"
                    className={cn("h-4 px-1 py-0 font-mono text-[9px] font-bold shadow-2xs border shrink-0", style.badgeColor)}
                >
                    {count}
                </Badge>
            </div>

            {/* Column Cards */}
            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-0.5">
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
        transform: CSS.Transform?.toString(transform),
        transition,
    }

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-25 rounded-xl scale-98 transition-all pointer-events-none"
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
            onClick={() => onView ? onView(repair) : onEdit(repair)}
            className="cursor-grab active:cursor-grabbing transition-transform"
        >
            <RepairCardContent repair={repair} />
        </div>
    )
}

function RepairCardOverlay({ repair }: { repair?: Repair }) {
    if (!repair) return null
    return (
        <div className="cursor-grabbing rotate-1 scale-[1.02] shadow-2xl rounded-xl ring-2 ring-primary/40 pointer-events-none">
            <RepairCardContent repair={repair} />
        </div>
    )
}

function RepairCardContent({ repair }: { repair: Repair }) {
    return <RepairCard repair={repair} compact />
}

