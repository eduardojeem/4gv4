'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createSupabaseClient } from '@/lib/supabase/client'
import { useRepairs } from '@/contexts/RepairsContext'
import { Repair } from '@/types/repairs'
import { DndContext } from '@/components/stubs/HeavyDependencyStubs';
import { CalendarDays, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

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

const hoursRange = (start: number, end: number) => Array.from({ length: end - start }, (_, i) => start + i)

export default function TechnicianSchedulePage() {
  const { repairs, refreshRepairs } = useRepairs()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [hourStart, setHourStart] = useState(8)
  const [hourEnd, setHourEnd] = useState(18)
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const hours = useMemo(() => hoursRange(hourStart, hourEnd), [hourStart, hourEnd])

  const scheduled = useMemo(() => repairs.filter(r => !!r.estimatedCompletion), [repairs])
  const unscheduled = useMemo(() => repairs.filter(r => !r.estimatedCompletion), [repairs])

  const filteredUnscheduled = useMemo(() => {
    if (filter === 'urgent') return unscheduled.filter(r => r.urgency === 'urgent')
    if (filter === 'pending') return unscheduled.filter(r => r.dbStatus === 'recibido' || r.dbStatus === 'diagnostico')
    return unscheduled
  }, [unscheduled, filter])

  const slotKey = (slot: Slot) => `${slot.start.toISOString()}_${slot.end.toISOString()}`

  const findRepairInSlot = (slot: Slot) => {
    const startIso = slot.start.toISOString()
    return scheduled.find(r => r.estimatedCompletion && new Date(r.estimatedCompletion).toISOString() === startIso)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    const overId = e.over?.id as string | undefined
    const repairId = e.active.id as string
    if (!overId) return
    const iso = overId
    setIsSaving(true)
    try {
      const supabase = createSupabaseClient()
      const { error } = await supabase
        .from('repairs')
        .update({ estimated_completion: iso })
        .eq('id', repairId)
      if (error) throw error
    } catch {}
    setIsSaving(false)
    refreshRepairs()
  }

  const assignToSlot = async (repairId: string, slot: Slot) => {
    setIsSaving(true)
    try {
      const supabase = createSupabaseClient()
      const { error } = await supabase
        .from('repairs')
        .update({ estimated_completion: slot.start.toISOString() })
        .eq('id', repairId)
      if (error) throw error
    } catch {}
    setIsSaving(false)
    refreshRepairs()
  }

  useEffect(() => {
    if (repairs.length && !selectedRepairId) setSelectedRepairId(unscheduled[0]?.id || null)
  }, [repairs])

  return (
    <div className="space-y-6">
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
          <Select value={String(hourStart)} onValueChange={(v) => setHourStart(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Inicio" /></SelectTrigger>
            <SelectContent>
              {hoursRange(6, 12).map(h => (<SelectItem key={h} value={String(h)}>{h}:00</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={String(hourEnd)} onValueChange={(v) => setHourEnd(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Fin" /></SelectTrigger>
            <SelectContent>
              {hoursRange(13, 22).map(h => (<SelectItem key={h} value={String(h)}>{h}:00</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Filtro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="urgent">Urgentes</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Reparaciones sin agenda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredUnscheduled.map((r) => (
                <div
                  key={r.id}
                  id={r.id}
                  onClick={() => setSelectedRepairId(r.id)}
                  draggable
                  className={`border rounded p-2 cursor-grab transition ${selectedRepairId === r.id ? 'bg-accent' : 'hover:bg-muted'}`}
                >
                  <div className="text-sm font-medium">{r.device} • {r.customer.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Badge variant={r.urgency === 'urgent' ? 'destructive' : 'outline'}>{r.urgency}</Badge>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.estimatedDuration || 60} min</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Agenda semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <DndContext onDragEnd={handleDragEnd}>
              <div className="grid" style={{ gridTemplateColumns: `80px repeat(7, 1fr)` }}>
                <div className="text-xs text-muted-foreground" />
                {days.map(d => (
                  <div key={d.toDateString()} className="text-xs font-medium text-center">{d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</div>
                ))}
                <Separator className="col-span-8 my-2" />
                {hours.map(h => (
                  <React.Fragment key={`hour-${h}`}>
                    <div className="text-xs text-muted-foreground px-2 py-3">{h}:00</div>
                    {days.map((d, di) => {
                      const slot: Slot = { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h + 1, 0, 0) }
                      const overId = slot.start.toISOString()
                      const assigned = findRepairInSlot(slot)
                      return (
                        <div
                          key={`${h}-${di}`}
                          id={overId}
                          onClick={() => selectedRepairId && assignToSlot(selectedRepairId, slot)}
                          className={`border rounded h-14 mx-1 px-2 flex items-center justify-between ${assigned ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}`}
                        >
                          {assigned ? (
                            <div className="text-xs">
                              <div className="font-medium">{assigned.device}</div>
                              <div className="text-muted-foreground">{assigned.customer.name}</div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Disponible</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{h}:00</span>
                        </div>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
            </DndContext>
            <div className="flex items-center gap-2 mt-4">
              <Button variant="outline" onClick={() => refreshRepairs()} disabled={isSaving}>Refrescar</Button>
              <Badge variant="outline">{isSaving ? 'Guardando…' : 'Listo'}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}