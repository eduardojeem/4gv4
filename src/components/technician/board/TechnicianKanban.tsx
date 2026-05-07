'use client'

import { useState, type ComponentType, type ReactNode } from 'react'
import type { Repair, DbRepairStatus } from '@/types/repairs'
import { statusConfig } from '@/config/repair-constants'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Package } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable } from '@dnd-kit/sortable'
import { RepairCard } from '@/components/dashboard/repairs/RepairCard'
import { CSS } from '@dnd-kit/utilities'

interface TechnicianKanbanProps {
  repairs: Repair[]
  kanbanOrder: Record<DbRepairStatus, string[]>
  onDragStart: (id: string) => void
  onDropTo: (status: DbRepairStatus) => void
  onEdit: (repair: Repair) => void
  onView?: (repair: Repair) => void
  showMyRepairsOnly?: boolean
}

export function TechnicianKanban({
  repairs,
  kanbanOrder,
  onDragStart,
  onDropTo,
  onEdit,
  onView,
  showMyRepairsOnly,
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event
    setActiveId(null)

    if (!over) return

    const overId = over.id as string
    let nextStatus: DbRepairStatus | undefined

    if (overId in statusConfig) {
      nextStatus = overId as DbRepairStatus
    } else {
      for (const [status, ids] of Object.entries(kanbanOrder)) {
        if (ids.includes(overId)) {
          nextStatus = status as DbRepairStatus
          break
        }
      }
    }

    if (nextStatus) {
      onDropTo(nextStatus)
    }
  }

  const getRepairById = (id: string) => repairs.find((repair) => repair.id === id)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {(Object.keys(statusConfig) as DbRepairStatus[]).map((status) => {
          const config = statusConfig[status]
          const repairIds = kanbanOrder[status] || []
          const columnRepairs = repairIds
            .map((id) => repairs.find((repair) => repair.id === id))
            .filter((repair): repair is Repair => Boolean(repair))

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
              <SortableContext items={repairIds}>
                {columnRepairs.length === 0 ? (
                  <div className="flex min-h-[9rem] flex-col items-center justify-center rounded-lg border-2 border-dashed bg-white/60 p-4 text-center text-xs text-muted-foreground dark:bg-slate-950/20">
                    <Package className="mb-2 h-6 w-6 opacity-50" />
                    <p>{showMyRepairsOnly ? 'No tienes reparaciones asignadas' : 'Sin reparaciones'}</p>
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
        {activeId ? <RepairCardOverlay repair={getRepairById(activeId)} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

interface KanbanColumnProps {
  id: string
  title: string
  icon: ComponentType<{ className?: string }>
  count: number
  color: string
  bg: string
  columnBg?: string
  children: ReactNode
}

function KanbanColumn({
  id,
  title,
  icon: Icon,
  count,
  color,
  bg,
  columnBg,
  children,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: {
      type: 'Column',
    },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[26rem] min-w-0 flex-col rounded-xl border border-border/60 p-2 shadow-sm transition-all',
        columnBg || 'bg-muted/30',
        isOver && 'ring-2 ring-primary/30 shadow-md'
      )}
    >
      <div className={cn('mb-2 flex items-center justify-between rounded-lg border p-3 shadow-sm', bg)}>
        <div className="flex min-w-0 items-center gap-2 font-semibold">
          <Icon className={cn('h-4 w-4 shrink-0', color.split(' ')[1])} />
          <span className="truncate">{title}</span>
        </div>
        <Badge variant="secondary" className="bg-white/70">
          {count}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-1 lg:max-h-[calc(100vh-18rem)]">
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
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  }

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="opacity-30">
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
      onClick={() => (onView ? onView(repair) : onEdit(repair))}
      className="cursor-grab active:cursor-grabbing"
    >
      <RepairCard repair={repair} />
    </div>
  )
}

function RepairCardOverlay({ repair }: { repair?: Repair }) {
  if (!repair) return null

  return (
    <div className="rotate-2 scale-105 cursor-grabbing shadow-xl">
      <RepairCard repair={repair} />
    </div>
  )
}
