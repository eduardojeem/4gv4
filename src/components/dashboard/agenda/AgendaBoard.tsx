'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Globe, Loader2, Plus, RefreshCw, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { APPOINTMENT_STATUS_LABELS } from '@/lib/agenda/agenda-api'
import { addDays, minutesOf, timeOf, todayIn, utcToZoned, weekdayOf, WEEKDAY_LABELS } from '@/lib/agenda/time'
import { AppointmentDialog, STATUS_COLORS, type DialogState } from '@/components/dashboard/agenda/AppointmentDialog'
import type { AgendaData, Appointment } from '@/components/dashboard/agenda/types'

const HOUR_HEIGHT = 64
const UNASSIGNED = '__unassigned__'

type View = 'day' | 'week'

/** Rango horario a mostrar: el horario de atención del día, o 08–20 si está cerrado. */
function dayWindow(data: AgendaData, date: string, appointments: Appointment[]) {
  const ranges = data.settings.opening_hours[weekdayOf(date)] ?? []
  let start = ranges.length ? Math.min(...ranges.map(([from]) => minutesOf(from))) : 8 * 60
  let end = ranges.length ? Math.max(...ranges.map(([, to]) => minutesOf(to))) : 20 * 60
  for (const appointment of appointments) {
    start = Math.min(start, utcToZoned(appointment.starts_at, data.timeZone).minutes)
    const endLocal = utcToZoned(appointment.ends_at, data.timeZone)
    end = Math.max(end, endLocal.date === date ? endLocal.minutes : 24 * 60)
  }
  return { start: Math.floor(start / 60) * 60, end: Math.min(24 * 60, Math.ceil(end / 60) * 60), ranges }
}

function AppointmentBlock({ appointment, data, top, height, color, onOpen }: {
  appointment: Appointment
  data: AgendaData
  top: number
  height: number
  color: string
  onOpen: () => void
}) {
  const muted = appointment.status === 'cancelled' || appointment.status === 'no_show'
  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onOpen() }}
      className={cn(
        'absolute inset-x-1 overflow-hidden rounded-lg border-l-4 bg-card px-2 py-1 text-left text-xs shadow-sm ring-1 ring-border transition hover:z-10 hover:shadow-md',
        muted && 'opacity-50',
        appointment.status === 'pending' && 'ring-2 ring-amber-400',
      )}
      style={{ top, height: Math.max(22, height), borderLeftColor: color }}
    >
      <p className="truncate font-semibold">{utcToZoned(appointment.starts_at, data.timeZone).time} {appointment.customer_name}</p>
      {height > 34 && <p className="truncate text-muted-foreground">{appointment.service_name}</p>}
      {height > 52 && <Badge variant="secondary" className={cn('mt-0.5 h-4 px-1.5 text-[10px]', STATUS_COLORS[appointment.status])}>{APPOINTMENT_STATUS_LABELS[appointment.status]}</Badge>}
    </button>
  )
}

export function AgendaBoard() {
  const [data, setData] = useState<AgendaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState<string | null>(null)
  const [view, setView] = useState<View>('day')
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const load = useCallback(async (target: string | null, mode: View) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ days: mode === 'week' ? '7' : '1' })
      if (target) params.set('date', target)
      const response = await fetch(`/api/agenda?${params}`, { cache: 'no-store' })
      const body = await response.json().catch(() => null)
      if (body) {
        setData(body)
        if (!target && body.date) setDate(body.date)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(date, view) }, [load, date, view])

  const today = data ? todayIn(data.timeZone) : null
  const activeProfessionals = useMemo(() => (data?.professionals ?? []).filter((professional) => professional.is_active), [data])

  const columns = useMemo(() => {
    if (!data) return []
    const list: Array<{ id: string | null; key: string; name: string; color: string }> = activeProfessionals.length
      ? activeProfessionals.map((professional) => ({ id: professional.id, key: professional.id, name: professional.name, color: professional.color }))
      : [{ id: null, key: 'agenda', name: 'Agenda', color: '#6366f1' }]
    const known = new Set(activeProfessionals.map((professional) => professional.id))
    // Turnos de un profesional dado de baja (o sin asignar con profesionales cargados).
    if (activeProfessionals.length && data.appointments.some((a) => !a.professional_id || !known.has(a.professional_id))) {
      list.push({ id: UNASSIGNED, key: UNASSIGNED, name: 'Sin asignar', color: '#94a3b8' })
    }
    return list
  }, [data, activeProfessionals])

  const columnFor = (appointment: Appointment) => {
    if (!activeProfessionals.length) return 'agenda'
    return appointment.professional_id && activeProfessionals.some((p) => p.id === appointment.professional_id) ? appointment.professional_id : UNASSIGNED
  }

  const replace = (appointment: Appointment) => {
    setData((current) => {
      if (!current) return current
      const exists = current.appointments.some((item) => item.id === appointment.id)
      const appointments = exists
        ? current.appointments.map((item) => (item.id === appointment.id ? appointment : item))
        : [...current.appointments, appointment].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      return { ...current, appointments }
    })
  }

  if (loading && !data) {
    return <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando agenda…</p>
  }
  if (!data || !data.available || !date) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        La agenda todavía no está activada en la base de datos. Pedile al administrador de la plataforma que aplique la actualización.
      </p>
    )
  }

  const dayAppointments = data.appointments.filter((appointment) => utcToZoned(appointment.starts_at, data.timeZone).date === date)
  const frame = dayWindow(data, date, dayAppointments)
  const height = ((frame.end - frame.start) / 60) * HOUR_HEIGHT
  const hours = Array.from({ length: (frame.end - frame.start) / 60 }, (_, index) => frame.start + index * 60)
  const step = view === 'week' ? 7 : 1
  const active = dayAppointments.filter((a) => a.status !== 'cancelled')
  const dayTotal = active.filter((a) => a.status !== 'no_show').reduce((sum, a) => sum + Number(a.price), 0)

  const createAt = (columnId: string | null, minute: number) => {
    const slot = data.settings.slot_minutes
    const rounded = Math.floor(minute / slot) * slot
    setDialog({ mode: 'create', date, time: timeOf(Math.min(rounded, 23 * 60 + 55)), professionalId: columnId && columnId !== UNASSIGNED ? columnId : null })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">Turnos del día por profesional. Tocá un horario libre para agendar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.settings.online_booking ? (
            <Button variant="outline" size="sm" asChild>
              <a href={`/${data.storeSlug}/turnos`} target="_blank" rel="noreferrer"><Globe className="h-4 w-4 text-emerald-600" /> Reservas online activas</a>
            </Button>
          ) : data.canConfigure && (
            <Button variant="outline" size="sm" asChild><Link href="/dashboard/agenda/configuracion"><Globe className="h-4 w-4" /> Activar reservas online</Link></Button>
          )}
          {data.canConfigure && <Button variant="outline" size="sm" asChild><Link href="/dashboard/agenda/configuracion"><Settings2 className="h-4 w-4" /> Configurar</Link></Button>}
          <Button size="sm" onClick={() => setDialog({ mode: 'create', date, time: timeOf(Math.max(frame.start, 9 * 60)), professionalId: null })}>
            <Plus className="h-4 w-4" /> Nuevo turno
          </Button>
        </div>
      </div>

      {data.pendingCount > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Tenés <b>{data.pendingCount}</b> turno{data.pendingCount === 1 ? '' : 's'} por confirmar (los marcados en amarillo). Abrilos para confirmar por WhatsApp.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Anterior" onClick={() => setDate(addDays(date, -step))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => today && setDate(today)} disabled={date === today}>Hoy</Button>
          <Button variant="outline" size="icon" aria-label="Siguiente" onClick={() => setDate(addDays(date, step))}><ChevronRight className="h-4 w-4" /></Button>
          <Input type="date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} className="h-9 w-40" aria-label="Elegir día" />
          <span className="text-sm font-semibold">
            {view === 'day'
              ? `${WEEKDAY_LABELS[weekdayOf(date)]} ${date.split('-').reverse().join('/')}`
              : `Semana del ${date.split('-').reverse().join('/')}`}
          </span>
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-3">
          {view === 'day' && <span className="text-xs text-muted-foreground">{active.length} turno{active.length === 1 ? '' : 's'} · {formatCurrency(dayTotal, { currency: data.currency })}</span>}
          <div className="inline-flex rounded-lg border p-0.5 text-sm">
            {(['day', 'week'] as const).map((mode) => (
              <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={cn('rounded-md px-3 py-1', view === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                {mode === 'day' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'day' ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="flex min-w-fit">
            <div className="sticky left-0 z-10 w-14 shrink-0 border-r bg-card">
              <div className="h-10 border-b" />
              <div className="relative" style={{ height }}>
                {hours.map((minute, index) => (
                  <span key={minute} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: index * HOUR_HEIGHT }}>{index === 0 ? '' : timeOf(minute)}</span>
                ))}
              </div>
            </div>
            {columns.map((column) => (
              <div key={column.key} className="min-w-[180px] flex-1 border-r last:border-r-0">
                <div className="flex h-10 items-center gap-2 border-b px-3 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                  <span className="truncate">{column.name}</span>
                </div>
                <div
                  role="grid"
                  aria-label={`Horarios de ${column.name}`}
                  className="relative cursor-copy"
                  style={{ height }}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    createAt(column.id, frame.start + ((event.clientY - rect.top) / HOUR_HEIGHT) * 60)
                  }}
                >
                  {/* Horario cerrado en gris; las líneas marcan cada hora. */}
                  {hours.map((minute, index) => {
                    const open = frame.ranges.some(([from, to]) => minute >= minutesOf(from) && minute < minutesOf(to))
                    return <div key={minute} className={cn('absolute inset-x-0 border-t border-border/60', !open && 'bg-muted/50')} style={{ top: index * HOUR_HEIGHT, height: HOUR_HEIGHT }} />
                  })}
                  {date === today && (() => {
                    const now = utcToZoned(Date.now(), data.timeZone).minutes
                    return now >= frame.start && now <= frame.end
                      ? <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500" style={{ top: ((now - frame.start) / 60) * HOUR_HEIGHT }} />
                      : null
                  })()}
                  {dayAppointments.filter((appointment) => columnFor(appointment) === column.key).map((appointment) => {
                    const startMin = utcToZoned(appointment.starts_at, data.timeZone).minutes
                    const duration = (Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at)) / 60_000
                    return (
                      <AppointmentBlock
                        key={appointment.id}
                        appointment={appointment}
                        data={data}
                        color={column.color}
                        top={((startMin - frame.start) / 60) * HOUR_HEIGHT}
                        height={(duration / 60) * HOUR_HEIGHT - 2}
                        onOpen={() => setDialog({ mode: 'view', appointment })}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, index) => addDays(date, index)).map((day) => {
            const list = data.appointments.filter((appointment) => utcToZoned(appointment.starts_at, data.timeZone).date === day)
            return (
              <div key={day} className={cn('min-h-32 rounded-xl border bg-card p-2', day === today && 'ring-2 ring-primary')}>
                <button type="button" className="mb-2 w-full text-left text-xs font-semibold hover:underline" onClick={() => { setDate(day); setView('day') }}>
                  {WEEKDAY_LABELS[weekdayOf(day)].slice(0, 3)} {day.split('-').reverse().slice(0, 2).join('/')}
                  <span className="ml-1 font-normal text-muted-foreground">({list.filter((a) => a.status !== 'cancelled').length})</span>
                </button>
                <ul className="space-y-1">
                  {list.map((appointment) => {
                    const color = data.professionals.find((p) => p.id === appointment.professional_id)?.color ?? '#6366f1'
                    return (
                      <li key={appointment.id}>
                        <button
                          type="button"
                          onClick={() => setDialog({ mode: 'view', appointment })}
                          className={cn('w-full rounded-md border-l-4 bg-muted/40 px-1.5 py-1 text-left text-xs hover:bg-muted', (appointment.status === 'cancelled' || appointment.status === 'no_show') && 'opacity-50')}
                          style={{ borderLeftColor: color }}
                        >
                          <span className="font-semibold">{utcToZoned(appointment.starts_at, data.timeZone).time}</span> {appointment.customer_name}
                          {appointment.status === 'pending' && <span className="ml-1 text-amber-600">●</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {data.services.length === 0 && data.canConfigure && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          Tip: cargá tus servicios como productos con unidad «servicio» y configurá cuánto dura cada uno, así se eligen al agendar y se pueden reservar online.
        </p>
      )}

      <AppointmentDialog
        state={dialog}
        data={data}
        onClose={() => setDialog(null)}
        onEdit={(appointment) => setDialog({ mode: 'edit', appointment })}
        onSaved={(appointment) => {
          replace(appointment)
          setDialog({ mode: 'view', appointment })
          if (appointment.status !== 'pending') void load(date, view)
        }}
      />
    </div>
  )
}
