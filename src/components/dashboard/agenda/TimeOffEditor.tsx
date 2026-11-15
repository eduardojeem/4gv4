'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CalendarOff, CheckCircle2, Globe, Loader2, Trash2 } from 'lucide-react'
import type { AgendaProfessional } from '@/lib/agenda/agenda-server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { addDays, todayIn, utcToZoned, zonedToUtc } from '@/lib/agenda/time'
import { appointmentWhen } from '@/lib/agenda/messages'
import { closureWhen, describeClosure, publicMessageProblem } from '@/lib/agenda/closures'

export type TimeOffEditorProps = { professionals: AgendaProfessional[]; timeZone: string; hideHeading?: boolean }
type Block = { id: string; professional_id: string | null; starts_at: string; ends_at: string; reason: string | null; public_message?: string | null }
type Conflict = { id: string; customer_name: string; service_name: string; starts_at: string }
type Check = { key: string; state: 'checking' | 'ok' | 'conflicts' | 'error'; conflicts: Conflict[]; total: number; message?: string }

const REASONS = ['Vacaciones', 'Feriado', 'Capacitación', 'Trámite', 'Almuerzo', 'Mantenimiento']

/** Fecha y hora locales de la tienda → instante; null si no existe (cambio de hora) o falta algo. */
function toInstant(date: string, time: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const stamp = zonedToUtc(date, time, timeZone)
  const local = utcToZoned(stamp, timeZone)
  if (local.date !== date || local.time !== time) return null
  return new Date(stamp).toISOString()
}

/**
 * El período de la ausencia. «Todo el día» va de la medianoche del primer día
 * a la del día siguiente al último: así un cierre de un día no deja una hora suelta.
 */
export function timeOffInterval(input: { allDay: boolean; fromDate: string; toDate: string; fromTime: string; toTime: string }, timeZone: string) {
  const startsAt = input.allDay ? toInstant(input.fromDate, '00:00', timeZone) : toInstant(input.fromDate, input.fromTime, timeZone)
  const endsAt = input.allDay
    ? (/^\d{4}-\d{2}-\d{2}$/.test(input.toDate) ? toInstant(addDays(input.toDate, 1), '00:00', timeZone) : null)
    : toInstant(input.toDate, input.toTime, timeZone)
  if (!startsAt || !endsAt) return { error: 'Completá desde cuándo y hasta cuándo.' as const }
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return { error: 'El fin tiene que ser después del inicio.' as const }
  if (Date.parse(endsAt) - Date.parse(startsAt) > 180 * 86_400_000) return { error: 'Como máximo 180 días seguidos.' as const }
  return { startsAt, endsAt }
}

/**
 * Pausas y cierres: vacaciones, feriados o una tarde libre, de la tienda o de un
 * profesional. Revisa sola los turnos que choquen y, si es de toda la tienda,
 * puede avisarlo en la página web con un texto propio (el motivo queda interno).
 */
export function TimeOffEditor({ professionals, timeZone, hideHeading = false }: TimeOffEditorProps) {
  const today = todayIn(timeZone)
  const [who, setWho] = useState('all')
  const [allDay, setAllDay] = useState(true)
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [fromTime, setFromTime] = useState('12:00')
  const [toTime, setToTime] = useState('14:00')
  const [reason, setReason] = useState('')
  const [announce, setAnnounce] = useState(false)
  const [publicMessage, setPublicMessage] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [publicMessageAvailable, setPublicMessageAvailable] = useState(true)
  const [check, setCheck] = useState<Check | null>(null)
  const [retryCheck, setRetryCheck] = useState(0)
  const saveLock = useRef(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const professionalName = (id: string | null) => professionals.find((item) => item.id === id)?.name ?? 'Toda la tienda'
  const storeWide = who === 'all'
  const interval = useMemo(() => timeOffInterval({ allDay, fromDate, toDate, fromTime, toTime }, timeZone), [allDay, fromDate, toDate, fromTime, toTime, timeZone])
  const key = 'error' in interval ? null : `${who}|${interval.startsAt}|${interval.endsAt}`
  const currentCheck = check && check.key === key ? check : null
  const noticeProblem = announce ? (publicMessage.trim() ? publicMessageProblem(publicMessage, storeWide ? null : who) : 'Escribí qué van a leer tus clientes.') : null

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/agenda/time-off', { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las ausencias.')
      setBlocks(body.blocks ?? [])
      setPublicMessageAvailable(body.publicMessageAvailable !== false)
      setLoadError(null)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'No se pudieron cargar las ausencias.')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  // Los turnos que chocan se revisan solos al cambiar el período o a quién afecta.
  useEffect(() => {
    if ('error' in interval || !key) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setCheck({ key, state: 'checking', conflicts: [], total: 0 })
      try {
        const params = new URLSearchParams({ starts_at: interval.startsAt, ends_at: interval.endsAt })
        if (!storeWide) params.set('professional_id', who)
        const response = await fetch(`/api/agenda/time-off?${params}`)
        const body = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok) setCheck({ key, state: 'error', conflicts: [], total: 0, message: body.error || 'No se pudieron revisar los turnos.' })
        else setCheck({ key, state: (body.total ?? 0) > 0 ? 'conflicts' : 'ok', conflicts: body.conflicts ?? [], total: body.total ?? 0 })
      } catch {
        if (!cancelled) setCheck({ key, state: 'error', conflicts: [], total: 0, message: 'No se pudieron revisar los turnos. Revisá tu conexión.' })
      }
    }, 400)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [interval, key, storeWide, who, retryCheck])

  const pickReason = (value: string) => {
    setReason(value)
    if (announce && !publicMessage.trim()) setPublicMessage(`Cerrado por ${value.toLowerCase()}`)
  }

  const quick = (from: string, to: string) => { setAllDay(true); setFromDate(from); setToDate(to) }

  const save = async () => {
    if (saveLock.current || 'error' in interval || currentCheck?.state !== 'ok' || noticeProblem) return
    saveLock.current = true
    setSaving(true)
    try {
      const response = await fetch('/api/agenda/time-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professional_id: storeWide ? null : who,
          starts_at: interval.startsAt,
          ends_at: interval.endsAt,
          reason: reason.trim() || null,
          ...(storeWide && announce && publicMessageAvailable ? { public_message: publicMessage.trim() } : {}),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo guardar la ausencia.')
        // Pudo haber aparecido un turno entre la revisión y el guardado.
        setCheck(null)
        setRetryCheck(value => value + 1)
        return
      }
      if (body.publicMessageSaved === false) toast.warning('La ausencia se guardó, pero no el aviso en la web.', { description: 'Probá de nuevo desde la lista.' })
      else toast.success(storeWide && announce ? 'Ausencia guardada y avisada en tu página' : 'Ausencia guardada')
      setReason('')
      setAnnounce(false)
      setPublicMessage('')
      setCheck(null)
      await load()
    } catch {
      toast.error('No se pudo guardar la ausencia. Revisá tu conexión.')
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  const remove = async (block: Block) => {
    if (!window.confirm('¿Quitar esta ausencia y volver a ofrecer esos horarios?')) return
    const response = await fetch('/api/agenda/time-off', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: block.id }) }).catch(() => null)
    if (!response?.ok) return toast.error('No se pudo quitar la ausencia.')
    toast.success('Ausencia quitada')
    await load()
  }

  const setNotice = async (block: Block, message: string | null) => {
    const response = await fetch('/api/agenda/time-off', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: block.id, public_message: message }) }).catch(() => null)
    const body = await response?.json().catch(() => ({}))
    if (!response?.ok) return toast.error(body?.error || 'No se pudo guardar el aviso.')
    toast.success(message ? 'Aviso publicado en tu página' : 'Aviso quitado de tu página')
    await load()
  }

  const preview = storeWide && announce && !('error' in interval) && publicMessage.trim().length >= 3
    ? describeClosure({ startsAt: interval.startsAt, endsAt: interval.endsAt, message: publicMessage }, timeZone)
    : null
  const canSave = !('error' in interval) && currentCheck?.state === 'ok' && !noticeProblem && !saving

  return (
    <section className="space-y-6">
      {!hideHeading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pausas y ausencias</h2>
            <p className="text-xs text-muted-foreground">
              Bloqueá días completos o franjas horarias por feriados, vacaciones o pausas del personal.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
            {blocks.length} {blocks.length === 1 ? 'ausencia registrada' : 'ausencias registradas'}
          </span>
        </div>
      )}

      <fieldset disabled={saving} className="space-y-5 rounded-2xl border bg-card p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Programar pausa o cierre</h3>
            <p className="text-xs text-muted-foreground">
              Elegí las fechas y horarios. El sistema comprobará automáticamente que no haya turnos asignados.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="time-off-who" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            A quién afecta
          </Label>
          <select
            id="time-off-who"
            value={who}
            onChange={(event) => {
              setWho(event.target.value)
              if (event.target.value !== 'all') setAnnounce(false)
            }}
            className="h-10 w-full rounded-xl border bg-background px-3 text-sm font-medium transition-colors focus:border-primary focus:outline-hidden"
          >
            <option value="all">Toda la tienda (cerrado)</option>
            {professionals
              .filter((item) => item.is_active)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Período de ausencia
            </Label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <Switch checked={allDay} onCheckedChange={setAllDay} aria-label="Todo el día" />
              <span>Todo el día</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5" aria-label="Atajos de fecha">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-full text-xs font-medium"
              onClick={() => quick(today, today)}
            >
              Hoy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-full text-xs font-medium"
              onClick={() => quick(addDays(today, 1), addDays(today, 1))}
            >
              Mañana
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-full text-xs font-medium"
              onClick={() => quick(today, addDays(today, 6))}
            >
              Los próximos 7 días
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="time-off-from" className="text-xs text-muted-foreground">
                Desde
              </Label>
              <div className="flex gap-2">
                <Input
                  id="time-off-from"
                  type="date"
                  min={today}
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value)
                    if (event.target.value > toDate) setToDate(event.target.value)
                  }}
                  className="h-10 rounded-xl"
                />
                {!allDay && (
                  <Input
                    type="time"
                    aria-label="Hora de inicio"
                    value={fromTime}
                    onChange={(event) => setFromTime(event.target.value)}
                    className="h-10 w-28 rounded-xl font-semibold tabular-nums"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="time-off-to" className="text-xs text-muted-foreground">
                Hasta
              </Label>
              <div className="flex gap-2">
                <Input
                  id="time-off-to"
                  type="date"
                  min={fromDate}
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="h-10 rounded-xl"
                />
                {!allDay && (
                  <Input
                    type="time"
                    aria-label="Hora de fin"
                    value={toTime}
                    onChange={(event) => setToTime(event.target.value)}
                    className="h-10 w-28 rounded-xl font-semibold tabular-nums"
                  />
                )}
              </div>
            </div>
          </div>

          {'error' in interval && (
            <p role="alert" className="text-xs font-semibold text-destructive">
              {interval.error}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="time-off-reason" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Motivo <span className="font-normal text-muted-foreground">(interno, opcional)</span>
          </Label>
          <Input
            id="time-off-reason"
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej.: vacaciones de fin de año"
            className="h-10 rounded-xl"
          />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {REASONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => pickReason(item)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                  reason === item
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {storeWide && (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
            <label className="flex cursor-pointer items-start justify-between gap-3 text-sm">
              <span>
                <span className="flex items-center gap-1.5 font-bold">
                  <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
                  Avisar en la página web
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  Tus clientes ven el aviso de cierre arriba de tu tienda desde dos semanas antes. El motivo interno no se publica.
                </span>
              </span>
              <Switch
                checked={announce}
                disabled={!publicMessageAvailable}
                onCheckedChange={(on) => {
                  setAnnounce(on)
                  if (on && !publicMessage.trim()) setPublicMessage(reason.trim() ? `Cerrado por ${reason.trim().toLowerCase()}` : 'Cerrado')
                }}
                aria-label="Avisar en la página web"
              />
            </label>

            {!publicMessageAvailable && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Para avisarlo en la web falta aplicar la migración del aviso de ausencias.
              </p>
            )}

            {announce && publicMessageAvailable && (
              <div className="space-y-2 border-t pt-2">
                <Label htmlFor="time-off-public" className="text-xs text-muted-foreground">
                  Qué leen tus clientes
                </Label>
                <Input
                  id="time-off-public"
                  maxLength={160}
                  value={publicMessage}
                  onChange={(event) => setPublicMessage(event.target.value)}
                  placeholder="Ej.: Cerrado por vacaciones"
                  className="h-10 rounded-xl"
                  aria-invalid={Boolean(noticeProblem)}
                />
                {noticeProblem && <p role="alert" className="text-xs text-destructive">{noticeProblem}</p>}
                {preview && (
                  <p className="flex flex-wrap items-center gap-x-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                    <CalendarOff className="h-3.5 w-3.5" aria-hidden="true" />
                    <strong>{preview.title}</strong>
                    <span>· {preview.detail}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Revisión en vivo de conflictos */}
        <div role="status" aria-live="polite" className="text-sm">
          {currentCheck?.state === 'checking' && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Revisando turnos…
            </p>
          )}
          {currentCheck?.state === 'ok' && (
            <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              No hay turnos en ese período.
            </p>
          )}
          {currentCheck?.state === 'error' && (
            <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-xs font-medium text-destructive">{currentCheck.message}</p>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRetryCheck((value) => value + 1)}>
                Revisar turnos de nuevo
              </Button>
            </div>
          )}
          {currentCheck?.state === 'conflicts' && (
            <div className="space-y-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
              <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                {currentCheck.total} {currentCheck.total === 1 ? 'turno choca' : 'turnos chocan'} con la ausencia. Movelos o cancelalos antes de guardarla.
              </p>
              <ul className="space-y-1 rounded-lg bg-background/60 p-2.5 text-xs">
                {currentCheck.conflicts.slice(0, 5).map((row) => (
                  <li key={row.id} className="flex items-center gap-1.5 text-foreground">
                    <span className="font-semibold">{row.customer_name}</span>
                    <span>·</span>
                    <span className="text-muted-foreground">{row.service_name}</span>
                    <span>·</span>
                    <span className="capitalize text-muted-foreground">{appointmentWhen(row.starts_at, timeZone)}</span>
                  </li>
                ))}
              </ul>
              <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs font-semibold">
                <Link href="/dashboard/agenda">Ir a la agenda</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            No se cancelan turnos automáticamente. Si hay turnos en ese horario, se deben reubicar primero.
          </p>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => void save()}
            className="h-10 min-w-32 gap-1.5 rounded-xl font-bold shadow-xs"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar ausencia
          </Button>
        </div>
      </fieldset>

      {/* Lista de ausencias */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Próximas ausencias</h3>
          {blocks.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {blocks.length} {blocks.length === 1 ? 'activa' : 'activas'}
            </span>
          )}
        </div>

        {loadError && (
          <div role="alert" className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <p>{loadError}</p>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void load()}>
              Reintentar lista
            </Button>
          </div>
        )}

        {!loadError && blocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/10 p-6 text-center text-xs text-muted-foreground">
            No hay ausencias próximas.
          </div>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card shadow-2xs">
            {blocks.map((block) => {
              const active = Date.parse(block.starts_at) <= Date.now()
              return (
                <li
                  key={block.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm transition-colors hover:bg-muted/15"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="font-bold text-foreground">{professionalName(block.professional_id)}</span>
                      {active && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          En curso
                        </span>
                      )}
                      {block.public_message && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          <Globe className="h-3 w-3" />
                          Se avisa en la web
                        </span>
                      )}
                      {block.reason && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {block.reason}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {closureWhen({ startsAt: block.starts_at, endsAt: block.ends_at }, timeZone)}
                    </p>
                    {block.public_message && (
                      <p className="text-xs italic text-foreground/80">
                        En la web: «{block.public_message}»
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!block.professional_id && publicMessageAvailable && (
                      block.public_message ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          onClick={() => void setNotice(block, null)}
                        >
                          Quitar aviso
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-xs font-medium text-primary hover:text-primary"
                          onClick={() => {
                            const text = window.prompt(
                              '¿Qué leen tus clientes?',
                              block.reason ? `Cerrado por ${block.reason.toLowerCase()}` : 'Cerrado'
                            )
                            if (text?.trim()) void setNotice(block, text.trim())
                          }}
                        >
                          Avisar en la web
                        </Button>
                      )
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Quitar ausencia"
                      onClick={() => void remove(block)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
