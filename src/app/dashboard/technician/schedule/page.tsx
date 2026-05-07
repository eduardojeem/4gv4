'use client'

import React, { memo, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import { Repair } from '@/types/repairs'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  CalendarDays, Clock, ChevronLeft, ChevronRight,
  CalendarCheck, AlertTriangle, Wrench, Zap, Info
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Slot = { start: Date; end: Date }

// ─── Date helpers ─────────────────────────────────────────────────────────────

const getWeekStart = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const addDays = (date: Date, days: number) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const hoursRange = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, i) => start + i)

/** Compare a repair's estimatedCompletion to a slot by date + hour (ignores ms/tz drift) */
const repairMatchesSlot = (repair: Repair, slot: Slot): boolean => {
  if (!repair.estimatedCompletion) return false
  const d = new Date(repair.estimatedCompletion)
  return (
    d.getFullYear() === slot.start.getFullYear() &&
    d.getMonth() === slot.start.getMonth() &&
    d.getDate() === slot.start.getDate() &&
    d.getHours() === slot.start.getHours()
  )
}

const isToday = (date: Date) => {
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

const isCurrentHour = (date: Date, hour: number) =>
  isToday(date) && new Date().getHours() === hour

// ─── Color helpers ────────────────────────────────────────────────────────────

const urgencyColors = {
  urgent: {
    card: 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    slot: 'bg-red-100 border-red-400 dark:bg-red-950/40 dark:border-red-600',
    dot: 'bg-red-500',
  },
  normal: {
    card: 'border-l-4 border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    slot: 'bg-blue-100 border-blue-400 dark:bg-blue-950/40 dark:border-blue-600',
    dot: 'bg-blue-500',
  },
}

const priorityLabel: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

// ─── DraggableRepair ──────────────────────────────────────────────────────────

const DraggableRepair = memo(function DraggableRepair({
  repair,
  isSelected,
  onSelect,
}: {
  repair: Repair
  isSelected: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: repair.id })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const colors = urgencyColors[repair.urgency] ?? urgencyColors.normal

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={cn(
        'rounded-lg p-2.5 cursor-grab select-none transition-all',
        colors.card,
        isDragging && 'opacity-40 shadow-xl scale-95',
        isSelected && 'ring-2 ring-primary ring-offset-1',
        'hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">
            {repair.device}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {repair.customer.name}
          </div>
        </div>
        <div className={cn('h-2 w-2 rounded-full mt-1 flex-shrink-0', colors.dot)} />
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', colors.badge)}>
          {repair.urgency === 'urgent' ? '⚡ Urgente' : 'Normal'}
        </span>
        {repair.priority === 'high' && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
            Prioridad alta
          </span>
        )}
        <span className="text-[10px] text-gray-400 flex items-center gap-0.5 ml-auto">
          <Clock className="h-2.5 w-2.5" />
          {repair.estimatedDuration || 60}m
        </span>
      </div>
    </div>
  )
})

// ─── DroppableSlot ────────────────────────────────────────────────────────────

const DroppableSlot = memo(function DroppableSlot({
  slot,
  assigned,
  hasConflict,
}: {
  slot: Slot
  assigned?: Repair
  hasConflict?: boolean
}) {
  const overId = slot.start.toISOString()
  const { isOver, setNodeRef } = useDroppable({ id: overId })
  const h = slot.start.getHours()
  const isCurrent = isCurrentHour(slot.start, h)
  const colors = assigned ? (urgencyColors[assigned.urgency] ?? urgencyColors.normal) : null

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border rounded-md h-14 mx-0.5 px-1.5 flex flex-col justify-center transition-colors relative overflow-hidden',
        isCurrent && !assigned && 'bg-yellow-50/60 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-700',
        assigned && colors?.slot,
        !assigned && !isCurrent && isOver && 'bg-primary/10 border-primary/50 border-dashed',
        !assigned && !isCurrent && !isOver && 'hover:bg-gray-50 dark:hover:bg-slate-800/50 border-gray-100 dark:border-slate-800',
        hasConflict && 'ring-2 ring-red-400'
      )}
    >
      {assigned ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default">
                <div className="text-[11px] font-semibold truncate text-gray-900 dark:text-gray-100 leading-tight">
                  {assigned.device}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate leading-tight">
                  {assigned.customer.name}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1 text-xs">
                <div className="font-semibold">{assigned.device}</div>
                <div>{assigned.customer.name} · {assigned.customer.phone}</div>
                <div className="text-muted-foreground">{assigned.issue}</div>
                <div className="flex gap-2">
                  <span>Urgencia: {assigned.urgency === 'urgent' ? '⚡ Urgente' : 'Normal'}</span>
                  <span>Prioridad: {priorityLabel[assigned.priority] ?? assigned.priority}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span className={cn(
          'text-[10px]',
          isOver ? 'text-primary font-medium' : 'text-gray-300 dark:text-gray-600'
        )}>
          {isOver ? '+ Soltar aquí' : ''}
        </span>
      )}
      {hasConflict && (
        <div className="absolute top-0.5 right-0.5">
          <AlertTriangle className="h-3 w-3 text-red-500" />
        </div>
      )}
      {isCurrent && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400" />
      )}
    </div>
  )
})

// ─── DayLoadBar ───────────────────────────────────────────────────────────────

function DayLoadBar({ count, total }: { count: number; total: number }) {
  if (total === 0) return null
  const pct = Math.min(Math.round((count / total) * 100), 100)
  const color = pct >= 80 ? 'bg-red-400' : pct >= 50 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-1 w-full bg-gray-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden cursor-default">
            <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span className="text-xs">{count} de {total} slots ocupados ({pct}%)</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TechnicianSchedulePage() {
  const { repairs, refreshRepairs } = useRepairs()
  const { user } = useAuth()

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [hourStart, setHourStart] = useState(8)
  const [hourEnd, setHourEnd] = useState(18)
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  const today = useMemo(() => getWeekStart(new Date()), [])
  const isCurrentWeek = weekStart.toDateString() === today.toDateString()

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )
  const hours = useMemo(() => hoursRange(hourStart, hourEnd), [hourStart, hourEnd])
  const canViewAllRepairs = user?.role === 'admin'

  const scopedRepairs = useMemo(() => {
    if (canViewAllRepairs) return repairs
    if (!user?.id) return []
    return repairs.filter(r => r.technician?.id === user.id)
  }, [repairs, user?.id, canViewAllRepairs])

  const scheduled = useMemo(() => scopedRepairs.filter(r => !!r.estimatedCompletion), [scopedRepairs])
  const unscheduled = useMemo(() => scopedRepairs.filter(r => !r.estimatedCompletion), [scopedRepairs])

  const filteredUnscheduled = useMemo(() => {
    let list = unscheduled
    if (filter === 'urgent') list = list.filter(r => r.urgency === 'urgent')
    else if (filter === 'pending') list = list.filter(r => r.dbStatus === 'recibido' || r.dbStatus === 'diagnostico')
    // Sort: urgent first, then by priority
    return [...list].sort((a, b) => {
      if (a.urgency === 'urgent' && b.urgency !== 'urgent') return -1
      if (b.urgency === 'urgent' && a.urgency !== 'urgent') return 1
      const pOrder = { high: 0, medium: 1, low: 2 }
      return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1)
    })
  }, [unscheduled, filter])

  // Build a slot→repair map for O(1) lookup
  const slotMap = useMemo(() => {
    const map = new Map<string, Repair>()
    scheduled.forEach(r => {
      if (!r.estimatedCompletion) return
      const d = new Date(r.estimatedCompletion)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
      if (map.has(key)) {
        // Mark conflict — store both (we'll detect via a separate set)
      }
      map.set(key, r)
    })
    return map
  }, [scheduled])

  // Detect conflicting slots (multiple repairs in same slot)
  const conflictKeys = useMemo(() => {
    const counts = new Map<string, number>()
    scheduled.forEach(r => {
      if (!r.estimatedCompletion) return
      const d = new Date(r.estimatedCompletion)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return new Set([...counts.entries()].filter(([, v]) => v > 1).map(([k]) => k))
  }, [scheduled])

  const getSlotKey = (slot: Slot) =>
    `${slot.start.getFullYear()}-${slot.start.getMonth()}-${slot.start.getDate()}-${slot.start.getHours()}`

  const findRepairInSlot = (slot: Slot) => slotMap.get(getSlotKey(slot))

  // Per-day load: how many slots in this week are occupied
  const dayLoad = useMemo(() => {
    return days.map(d => {
      const count = scheduled.filter(r => {
        if (!r.estimatedCompletion) return false
        const rd = new Date(r.estimatedCompletion)
        return rd.getFullYear() === d.getFullYear() &&
          rd.getMonth() === d.getMonth() &&
          rd.getDate() === d.getDate()
      }).length
      return count
    })
  }, [days, scheduled])

  // ── Persistence ──────────────────────────────────────────────────────────────

  const persistSlot = async (repairId: string, iso: string) => {
    if (!canViewAllRepairs && !scopedRepairs.some(r => r.id === repairId)) {
      toast.error('No tienes permisos para reprogramar esta reparación')
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('repairs')
        .update({ estimated_completion: iso })
        .eq('id', repairId)
      if (error) throw error
      toast.success('Reparación agendada correctamente')
      setSelectedRepairId(null)
      refreshRepairs()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`No se pudo agendar la reparación: ${msg}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    const overId = e.over?.id as string | undefined
    const repairId = e.active.id as string
    if (!overId) return
    await persistSlot(repairId, overId)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header / Controls ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Semana siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekStart(today)}
              className="gap-1.5"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Hoy
            </Button>
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
            {weekStart.toLocaleDateString('es', { day: 'numeric', month: 'short' })}
            {' – '}
            {addDays(weekStart, 6).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {isCurrentWeek && (
            <Badge variant="secondary" className="text-xs">Esta semana</Badge>
          )}
        </div>

        {/* Filters & hour range */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Filtro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="urgent">⚡ Urgentes</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(hourStart)} onValueChange={v => setHourStart(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue placeholder="Inicio" />
            </SelectTrigger>
            <SelectContent>
              {hoursRange(6, 14).map(h => (
                <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-400">–</span>
          <Select value={String(hourEnd)} onValueChange={v => setHourEnd(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue placeholder="Fin" />
            </SelectTrigger>
            <SelectContent>
              {hoursRange(13, 23).map(h => (
                <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Conflict warning ── */}
      {conflictKeys.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{conflictKeys.size}</strong> conflicto{conflictKeys.size > 1 ? 's' : ''} detectado{conflictKeys.size > 1 ? 's' : ''} — hay slots con más de una reparación asignada.
          </span>
        </div>
      )}

      {/* ── Main grid ── */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid gap-4 lg:grid-cols-4">

          {/* ── Unscheduled panel ── */}
          <Card className="lg:col-span-1 border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-blue-500" />
                  Sin agendar
                </div>
                <Badge variant="secondary" className="text-xs">{filteredUnscheduled.length}</Badge>
              </CardTitle>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Arrastrá al calendario para agendar
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredUnscheduled.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Wrench className="h-8 w-8 text-gray-200 dark:text-gray-700 mb-2" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {filter !== 'all' ? 'Sin resultados para este filtro' : 'Todas las reparaciones están agendadas'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                  {filteredUnscheduled.map(r => (
                    <DraggableRepair
                      key={r.id}
                      repair={r}
                      isSelected={selectedRepairId === r.id}
                      onSelect={() => setSelectedRepairId(prev => prev === r.id ? null : r.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Weekly grid ── */}
          <Card className="lg:col-span-3 border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Agenda semanal
                </CardTitle>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {isSaving && (
                    <span className="flex items-center gap-1 text-blue-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Guardando…
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-red-300" /> Urgente
                    <span className="h-2 w-2 rounded-sm bg-blue-300 ml-1" /> Normal
                    <span className="h-2 w-2 rounded-sm bg-yellow-200 border border-yellow-300 ml-1" /> Ahora
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <div
                className="grid min-w-[600px]"
                style={{ gridTemplateColumns: `64px repeat(7, 1fr)` }}
              >
                {/* Day headers */}
                <div className="border-b border-gray-100 dark:border-slate-800" />
                {days.map((d, di) => {
                  const todayDay = isToday(d)
                  return (
                    <div
                      key={d.toDateString()}
                      className={cn(
                        'border-b border-gray-100 dark:border-slate-800 px-1 pb-1 pt-2',
                        todayDay && 'bg-blue-50/50 dark:bg-blue-950/20'
                      )}
                    >
                      <div className={cn(
                        'text-xs font-semibold text-center',
                        todayDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                      )}>
                        {d.toLocaleDateString('es', { weekday: 'short' }).toUpperCase()}
                      </div>
                      <div className={cn(
                        'text-sm font-bold text-center',
                        todayDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                      )}>
                        {d.getDate()}
                      </div>
                      <DayLoadBar count={dayLoad[di]} total={hours.length} />
                    </div>
                  )
                })}

                {/* Hour rows */}
                {hours.map(h => (
                  <React.Fragment key={`hour-${h}`}>
                    <div className="text-[11px] text-gray-400 dark:text-gray-600 px-2 py-1 flex items-center border-b border-gray-50 dark:border-slate-900">
                      {h}:00
                    </div>
                    {days.map((d, di) => {
                      const slot: Slot = {
                        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0),
                        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h + 1, 0, 0),
                      }
                      const assigned = findRepairInSlot(slot)
                      const key = getSlotKey(slot)
                      const hasConflict = conflictKeys.has(key)
                      return (
                        <DroppableSlot
                          key={`${h}-${di}`}
                          slot={slot}
                          assigned={assigned}
                          hasConflict={hasConflict}
                        />
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Info className="h-3.5 w-3.5" />
                  Arrastrá una reparación del panel izquierdo a un slot para agendarla
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refreshRepairs()}
                  disabled={isSaving}
                  className="text-xs h-7"
                >
                  Actualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DndContext>
    </div>
  )
}
