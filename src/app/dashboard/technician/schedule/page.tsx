'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createSupabaseClient } from '@/lib/supabase/client'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import { Repair } from '@/types/repairs'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

type Slot = { start: Date; end: Date }

const startOfWeek = (date: Date) => {
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

function DraggableRepair({ repair, isSelected }: { repair: Repair; isSelected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: repair.id })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`border rounded p-2 cursor-grab transition select-none ${
        isDragging ? 'opacity-40 shadow-lg' : ''
      } ${isSelected ? 'bg-accent' : 'hover:bg-muted'}`}
    >
      <div className="text-sm font-medium">{repair.device} • {repair.customer.name}</div>
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Badge variant={repair.urgency === 'urgent' ? 'destructive' : 'outline'}>{repair.urgency}</Badge>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> {repair.estimatedDuration || 60} min
        </span>
      </div>
    </div>
  )
}

function DroppableSlot({
  slot,
  assigned,
  selectedRepairId,
  onClickAssign,
}: {
  slot: Slot
  assigned?: Repair
  selectedRepairId: string | null
  onClickAssign: (slot: Slot) => void
}) {
  const overId = slot.start.toISOString()
  const { isOver, setNodeRef } = useDroppable({ id: overId })
  const h = slot.start.getHours()

  return (
    <div
      ref={setNodeRef}
      onClick={() => selectedRepairId && onClickAssign(slot)}
      className={`border rounded h-14 mx-1 px-2 flex items-center justify-between transition-colors ${
        assigned
          ? 'bg-primary/10 border-primary'
          : isOver
          ? 'bg-accent border-primary/50'
          : 'hover:bg-muted'
      }`}
    >
      {assigned ? (
        <div className="text-xs">
          <div className="font-medium truncate">{assigned.device}</div>
          <div className="text-muted-foreground truncate">{assigned.customer.name}</div>
        </div>
      ) : (
        <span className="text-[11px] text-muted-foreground">Disponible</span>
      )}
      <span className="text-[10px] text-muted-foreground">{h}:00</span>
    </div>
  )
}

export default function TechnicianSchedulePage() {
  const { repairs, refreshRepairs } = useRepairs()
  const { user } = useAuth()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [hourStart, setHourStart] = useState(8)
  const [hourEnd, setHourEnd] = useState(18)
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [filter, setFilter] = useState('all')

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
    if (filter === 'urgent') return unscheduled.filter(r => r.urgency === 'urgent')
    if (filter === 'pending')
      return unscheduled.filter(
        r => r.dbStatus === 'recibido' || r.dbStatus === 'diagnostico'
      )
    return unscheduled
  }, [unscheduled, filter])

  const findRepairInSlot = (slot: Slot) => {
    const startIso = slot.start.toISOString()
    return scheduled.find(
      r => r.estimatedCompletion && new Date(r.estimatedCompletion).toISOString() === startIso
    )
  }

  const persistSlot = async (repairId: string, iso: string) => {
    if (!canViewAllRepairs && !scopedRepairs.some(r => r.id === repairId)) {
      toast.error('No tienes permisos para reprogramar esta reparación')
      return
    }

    setIsSaving(true)
    try {
      const supabase = createSupabaseClient()
      const { error } = await supabase
        .from('repairs')
        .update({ estimated_completion: iso })
        .eq('id', repairId)
      if (error) throw error
    } catch {
      // silent — refreshRepairs will reconcile state
    } finally {
      setIsSaving(false)
      refreshRepairs()
    }
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    const overId = e.over?.id as string | undefined
    const repairId = e.active.id as string
    if (!overId) return
    await persistSlot(repairId, overId)
  }

  const assignToSlot = (repairId: string, slot: Slot) => {
    persistSlot(repairId, slot.start.toISOString())
  }

  useEffect(() => {
    if (scopedRepairs.length && !selectedRepairId) {
      setSelectedRepairId(unscheduled[0]?.id || null)
    }
  }, [scopedRepairs, selectedRepairId, unscheduled])

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="ml-2">
            {weekStart.toLocaleDateString()} – {addDays(weekStart, 6).toLocaleDateString()}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(hourStart)} onValueChange={v => setHourStart(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Inicio" />
            </SelectTrigger>
            <SelectContent>
              {hoursRange(6, 12).map(h => (
                <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(hourEnd)} onValueChange={v => setHourEnd(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Fin" />
            </SelectTrigger>
            <SelectContent>
              {hoursRange(13, 22).map(h => (
                <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filtro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="urgent">Urgentes</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid gap-4 lg:grid-cols-4">
          {/* Unscheduled list */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" /> Reparaciones sin agenda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredUnscheduled.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin reparaciones pendientes
                  </p>
                )}
                {filteredUnscheduled.map(r => (
                  <div key={r.id} onClick={() => setSelectedRepairId(r.id)}>
                    <DraggableRepair repair={r} isSelected={selectedRepairId === r.id} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weekly grid */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" /> Agenda semanal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid" style={{ gridTemplateColumns: `80px repeat(7, 1fr)` }}>
                <div className="text-xs text-muted-foreground" />
                {days.map(d => (
                  <div
                    key={d.toDateString()}
                    className="text-xs font-medium text-center pb-1"
                  >
                    {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                  </div>
                ))}
                <Separator className="col-span-8 my-2" />
                {hours.map(h => (
                  <React.Fragment key={`hour-${h}`}>
                    <div className="text-xs text-muted-foreground px-2 py-3">{h}:00</div>
                    {days.map((d, di) => {
                      const slot: Slot = {
                        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0),
                        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h + 1, 0, 0),
                      }
                      const assigned = findRepairInSlot(slot)
                      return (
                        <DroppableSlot
                          key={`${h}-${di}`}
                          slot={slot}
                          assigned={assigned}
                          selectedRepairId={selectedRepairId}
                          onClickAssign={s =>
                            selectedRepairId && assignToSlot(selectedRepairId, s)
                          }
                        />
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Button variant="outline" onClick={() => refreshRepairs()} disabled={isSaving}>
                  Refrescar
                </Button>
                <Badge variant="outline">{isSaving ? 'Guardando…' : 'Listo'}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </DndContext>
    </div>
  )
}
