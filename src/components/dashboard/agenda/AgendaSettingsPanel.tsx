'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, CalendarOff, Clock, Copy, ExternalLink, Globe, Loader2, Plus, Save, Scissors, Trash2, Undo2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { AgendaProfessional, AgendaProfessionalRate, AgendaService, AgendaSettings } from '@/lib/agenda/agenda-server'
import { WEEKDAY_LABELS } from '@/lib/agenda/time'
import { missingSuggestedServices } from '@/lib/agenda/suggested-services'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { SuggestedServicesCard } from '@/components/dashboard/agenda/SuggestedServicesCard'
import { ProfessionalsManager } from '@/components/dashboard/agenda/ProfessionalsManager'
import { TimeOffEditor } from '@/components/dashboard/agenda/TimeOffEditor'
import { NewServiceDialog } from '@/components/dashboard/agenda/NewServiceDialog'
import { reservationReadiness } from '@/lib/agenda/reservation-readiness'

const RUBRO_LABELS: Record<string, string> = { barbershop: 'barbería y peluquería', beauty_services: 'belleza y cuidado personal' }
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type Config = {
  settings: AgendaSettings
  professionals: AgendaProfessional[]
  services: AgendaService[]
  currency: string
  bookingUrl: string
  timeZone: string
  capabilities?: { professionalBooking: boolean }
  professionalRates?: AgendaProfessionalRate[]
  settingsRevision?: number
  professionalCount?: number
  bookingContext?: { storefrontPublic: boolean; notificationEmail: string | null }
}

export type AgendaSection = 'horario' | 'equipo' | 'servicios' | 'reservas' | 'ausencias'

/** Lo que se guarda con «Guardar cambios». El equipo se guarda solo, al editar cada profesional. */
export function agendaDraftSnapshot(config: Pick<Config, 'settings' | 'services'>, advanced: boolean) {
  return JSON.stringify({
    settings: config.settings,
    services: config.services.map((service) => ({
      id: service.product_id,
      duration: service.duration_minutes,
      online: service.online,
      ...(advanced ? { buffer: service.buffer_minutes ?? 0 } : {}),
    })),
  })
}

/** «Lun a Vie y Sáb» no: la cuenta simple de días abiertos y el intervalo. */
export function openingSummary(settings: AgendaSettings) {
  const open = DAY_ORDER.filter((day) => (settings.opening_hours[day] ?? []).length > 0)
  if (open.length === 0) return 'Sin días de atención'
  const days = open.length === 7 ? 'Todos los días' : open.map((day) => WEEKDAY_LABELS[day].slice(0, 3)).join(' · ')
  return `${days} · cada ${settings.slot_minutes} min`
}

export function AgendaSettingsPanel() {
  const [config, setConfig] = useState<Config | null>(null)
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [section, setSection] = useState<AgendaSection>('horario')
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [newServiceOpen, setNewServiceOpen] = useState(false)
  const [daysText, setDaysText] = useState('30')
  const [conflict, setConflict] = useState(false)
  const { businessVertical, serviceSpecialties } = useSubscriptionStatus()
  // Snapshot del servidor; las altas no reenvían configuración global.
  const savedSettingsRef = useRef<AgendaSettings | null>(null)
  const savedConfigRef = useRef<Config | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/agenda/settings', { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No se pudo cargar la configuración.')
      setLoadError(null)
      setAvailable(body.available !== false)
      if (body.available) {
        savedSettingsRef.current = body.settings
        savedConfigRef.current = body
        setConfig(body)
        setDaysText(String(body.settings.max_days_ahead))
        setConflict(false)
        setSavedSnapshot(agendaDraftSnapshot(body, body.capabilities?.professionalBooking === true))
      }
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.')
    }
  }, [])
  useEffect(() => { void load() }, [load])
  const configuredDays = config?.settings.max_days_ahead
  useEffect(() => {
    if (configuredDays !== undefined) setDaysText(String(configuredDays))
  }, [configuredDays])

  /**
   * Trae lo nuevo (un servicio recién creado) sin perder lo que se está editando:
   * el horario y los servicios ya listados conservan sus cambios sin guardar.
   */
  const refreshKeepingDrafts = useCallback(async () => {
    const response = await fetch('/api/agenda/settings', { cache: 'no-store' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.available) throw new Error('No se pudo refrescar la lista de servicios.')
    const isAdvanced = body.capabilities?.professionalBooking === true
    savedSettingsRef.current = body.settings
    savedConfigRef.current = body
    setSavedSnapshot(agendaDraftSnapshot(body, isAdvanced))
    setConfig(draft => draft && agendaDraftSnapshot(draft, isAdvanced) !== savedSnapshot ? {
      ...body,
      settingsRevision: draft.settingsRevision,
      settings: draft.settings,
      services: (body.services as AgendaService[]).map((service) => {
        const edited = draft.services.find((item) => item.product_id === service.product_id)
        return edited ? { ...service, duration_minutes: edited.duration_minutes, online: edited.online, buffer_minutes: edited.buffer_minutes } : service
      }),
    } : body)
  }, [savedSnapshot])

  // La sección se recuerda en la dirección (#equipo), para volver o compartirla.
  useEffect(() => {
    const sync = () => {
      const fromHash = window.location.hash.replace('#', '') as AgendaSection
      if (['horario', 'equipo', 'servicios', 'reservas', 'ausencias'].includes(fromHash)) setSection(fromHash)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const goTo = (next: AgendaSection) => {
    setSection(next)
    window.history.replaceState(null, '', `#${next}`)
  }

  const advanced = config?.capabilities?.professionalBooking === true
  const daysValid = /^\d+$/.test(daysText) && Number(daysText) >= 1 && Number(daysText) <= 180
  const dirty = Boolean(config) && (agendaDraftSnapshot(config!, advanced) !== savedSnapshot || daysText !== String(config!.settings.max_days_ahead))

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const sections = useMemo(() => {
    if (!config) return []
    const activeTeam = config.professionals.filter((professional) => professional.is_active).length
    const onlineServices = config.services.filter((service) => service.online).length
    return [
      { id: 'horario' as const, label: 'Horario', icon: Clock, summary: openingSummary(config.settings) },
      { id: 'equipo' as const, label: 'Quién atiende', icon: Users, summary: activeTeam === 0 ? 'Una sola agenda' : `${activeTeam} ${activeTeam === 1 ? 'profesional' : 'profesionales'}` },
      { id: 'servicios' as const, label: 'Servicios', icon: Scissors, summary: config.services.length === 0 ? 'Sin servicios' : `${config.services.length} · ${onlineServices} online` },
      { id: 'reservas' as const, label: 'Reservas online', icon: Globe, summary: !config.settings.online_booking ? 'Apagadas' : reservationReadiness({ ...config, storefrontPublic: config.bookingContext?.storefrontPublic === true }).ready ? 'Configuración lista' : 'Revisar configuración' },
      ...(advanced ? [{ id: 'ausencias' as const, label: 'Ausencias', icon: CalendarOff, summary: 'Vacaciones y pausas' }] : []),
    ]
  }, [config, advanced])

  if (!available) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">La agenda todavía no está activada en la base de datos.</p>
  }
  if (!config) {
    return loadError ? (
      <div role="alert" className="space-y-2"><p>{loadError}</p><Button onClick={() => void load()}>Reintentar</Button></div>
    ) : (
      <p className="flex items-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
    )
  }

  const settings = config.settings
  const setSettings = (patch: Partial<AgendaSettings>) => setConfig((current) => (current ? { ...current, settings: { ...current.settings, ...patch } } : current))
  const setRanges = (day: number, ranges: Array<[string, string]>) => {
    const opening = { ...settings.opening_hours }
    if (ranges.length) opening[day] = ranges
    else delete opening[day]
    setSettings({ opening_hours: opening })
  }
  const setService = (productId: string, patch: Partial<AgendaService>) =>
    setConfig((current) => (current ? { ...current, services: current.services.map((service) => (service.product_id === productId ? { ...service, ...patch, configured: true } : service)) } : current))

  const discard = () => {
    const saved = savedConfigRef.current
    if (!saved) return
    // El equipo no se descarta: ya está guardado.
    setConfig((current) => (current ? { ...current, settings: saved.settings, services: saved.services, settingsRevision: saved.settingsRevision } : current))
    setDaysText(String(saved.settings.max_days_ahead))
  }

  const save = async () => {
    if (!daysValid || (settings.booking_message?.length ?? 0) > 500) {
      toast.error('Revisá los días de anticipación y el mensaje (máximo 500 caracteres).')
      goTo('reservas')
      return
    }
    const invalid = DAY_ORDER.find((day) => (settings.opening_hours[day] ?? []).some(([from, to]) => !from || !to || from >= to))
    if (invalid !== undefined) {
      toast.error(`Revisá el horario del ${WEEKDAY_LABELS[invalid].toLowerCase()}: el inicio tiene que ser antes del cierre.`)
      goTo('horario')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/agenda/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(Object.entries(settings).filter(([key]) => advanced || key !== 'professional_selection')),
          max_days_ahead: Number(daysText),
          ...(advanced ? { expected_revision: config.settingsRevision } : {}),
          services: config.services.map((service) => ({
            product_id: service.product_id,
            duration_minutes: service.duration_minutes,
            online: service.online,
            ...(advanced ? { buffer_minutes: service.buffer_minutes ?? 0 } : {}),
          })),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (body.code === 'AGENDA_SETTINGS_CHANGED') setConflict(true)
        toast.error(body.error || 'No se pudo guardar')
        return
      }
      toast.success('Cambios guardados')
      await load()
    } catch {
      toast.error('No se pudo guardar. Revisá tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(config.bookingUrl); toast.success('Enlace copiado') }
    catch { toast.error('No se pudo copiar. Seleccioná el enlace y copialo manualmente.') }
  }
  const readiness = reservationReadiness({ ...config, storefrontPublic: config.bookingContext?.storefrontPublic === true })
  const saved = savedConfigRef.current
  const linkReady = saved ? reservationReadiness({ ...saved, storefrontPublic: saved.bookingContext?.storefrontPublic === true }).ready : false
  const mondayRanges = settings.opening_hours[1] ?? []

  return (
    <div className="space-y-5">
      {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
      {conflict && <div role="alert" className="rounded-xl border border-amber-300 p-4 text-sm"><p>Otra persona modificó la agenda. Tu borrador sigue aquí; no se sobrescribió la configuración guardada.</p><Button variant="outline" className="mt-2" disabled={saving} onClick={() => { if (window.confirm('Recargar descarta tu borrador y trae la configuración actual. ¿Continuar?')) void load() }}>Recargar y descartar borrador</Button></div>}

      <div className="space-y-1">
        <Link href="/dashboard/agenda" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Agenda</Link>
        <h1 className="text-2xl font-bold tracking-tight">Configurar la agenda</h1>
        <p className="text-sm text-muted-foreground">Elegí una sección. Lo del equipo se guarda al editar a cada profesional; lo demás, con «Guardar cambios».</p>
      </div>

      {!advanced && (
        <p className="rounded-lg border p-3 text-sm text-muted-foreground">La agenda básica sigue disponible. Para activar tarifas, horarios individuales y ausencias, falta aplicar la migración transaccional de reservas.</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Secciones de la configuración" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:sticky lg:top-4 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
          {sections.map(({ id, label, icon: Icon, summary }) => (
            <button
              key={id}
              type="button"
              onClick={() => goTo(id)}
              aria-current={section === id ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors lg:w-full lg:py-3',
                section === id ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-transparent bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground lg:bg-transparent',
              )}
            >
              <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', section === id && 'text-primary')} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="hidden truncate text-xs text-muted-foreground lg:block">{summary}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {section === 'horario' && (
            <SectionCard title="Horario de atención" description="Fuera de este horario no se ofrecen turnos online. Un administrador puede agendar fuera de horario con una advertencia; nunca sobre otro turno o ausencia.">
              <div className="divide-y">
                {DAY_ORDER.map((day) => {
                  const ranges = settings.opening_hours[day] ?? []
                  return (
                    <div key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <label className="flex w-32 items-center gap-2 text-sm font-medium">
                        <Switch checked={ranges.length > 0} onCheckedChange={(on) => setRanges(day, on ? [['08:00', '18:00']] : [])} aria-label={`Atiende el ${WEEKDAY_LABELS[day]}`} />
                        {WEEKDAY_LABELS[day]}
                      </label>
                      {ranges.length === 0 ? <span className="text-sm text-muted-foreground">Cerrado</span> : (
                        <div className="flex flex-wrap items-center gap-2">
                          {ranges.map(([from, to], index) => (
                            <span key={index} className={cn('flex items-center gap-1 rounded-lg border bg-background px-1.5 py-1', from >= to && 'border-destructive')}>
                              <Input type="time" className="h-8 w-[104px] border-0 shadow-none" value={from} onChange={(event) => setRanges(day, ranges.map((range, i) => (i === index ? [event.target.value, range[1]] : range)))} aria-label={`${WEEKDAY_LABELS[day]}: desde`} />
                              <span className="text-xs text-muted-foreground">a</span>
                              <Input type="time" className="h-8 w-[104px] border-0 shadow-none" value={to} onChange={(event) => setRanges(day, ranges.map((range, i) => (i === index ? [range[0], event.target.value] : range)))} aria-label={`${WEEKDAY_LABELS[day]}: hasta`} />
                              {ranges.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Quitar tramo" onClick={() => setRanges(day, ranges.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>}
                            </span>
                          ))}
                          {ranges.length < 3 && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setRanges(day, [...ranges, ['14:00', '18:00']])}><Plus className="h-3 w-3" /> Otro tramo</Button>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Label>Turnos cada</Label>
                  <Select value={String(settings.slot_minutes)} onValueChange={(value) => setSettings({ slot_minutes: Number(value) })}>
                    <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{[10, 15, 20, 30, 45, 60].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} min</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {mondayRanges.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const opening = { ...settings.opening_hours }
                      DAY_ORDER.forEach((day) => { if (day !== 1 && (opening[day] ?? []).length > 0) opening[day] = mondayRanges.map(([from, to]) => [from, to] as [string, string]) })
                      setSettings({ opening_hours: opening })
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Usar el horario del lunes en los demás días abiertos
                  </Button>
                )}
              </div>
            </SectionCard>
          )}

          {section === 'equipo' && (
            <SectionCard title="Quién atiende" description="Cada profesional tiene su columna en la agenda, sus servicios y, si querés, su horario y sus tarifas. Su foto y especialidad se ven en tu tienda. Los cambios se guardan al momento.">
              <ProfessionalsManager
                professionals={config.professionals}
                services={config.services}
                rates={config.professionalRates ?? []}
                currency={config.currency}
                advanced={advanced}
                onProfessionalsChange={(update) => setConfig((current) => (current ? { ...current, professionals: update(current.professionals) } : current))}
                onRatesChange={(professionalId, rates) => setConfig((current) => (current ? { ...current, professionalRates: [...(current.professionalRates ?? []).filter((row) => row.professional_id !== professionalId), ...rates] } : current))}
              />
            </SectionCard>
          )}

          <div hidden={section !== 'servicios'}>
            <SectionCard
              title="Servicios"
              description="Lo que se reserva y se cobra. Decí cuánto dura cada uno y si se puede reservar online."
              action={<Button onClick={() => setNewServiceOpen(true)} className="min-h-10"><Plus className="h-4 w-4" /> Nuevo servicio</Button>}
            >
              <div className="space-y-4">
                {(() => {
                  const missing = missingSuggestedServices(businessVertical, config.services.map((service) => service.name), serviceSpecialties)
                  return savedSettingsRef.current ? (
                    <SuggestedServicesCard
                      suggestions={missing}
                      currency={config.currency}
                      rubroLabel={RUBRO_LABELS[businessVertical] ?? 'tu rubro'}
                      onAdded={refreshKeepingDrafts}
                    />
                  ) : null
                })()}
                {config.services.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center">
                    <p className="font-semibold">Todavía no tenés servicios</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Agregá el primero (ej.: «Corte de cabello») con su precio y duración.</p>
                    <Button variant="outline" className="mt-4 min-h-10" onClick={() => setNewServiceOpen(true)}><Plus className="h-4 w-4" /> Nuevo servicio</Button>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {config.services.map((service) => (
                      <li key={service.product_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
                        <span className="min-w-0 flex-1 basis-40">
                          <span className="block font-medium">{service.name}</span>
                          <span className="text-xs text-muted-foreground">{service.hide_price ? 'Precio a consultar' : formatCurrency(service.price, { currency: config.currency })}</span>
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          Dura
                          <Input type="number" min={5} step={5} className="h-9 w-20 text-sm" value={service.duration_minutes} aria-label={`Duración de ${service.name}`} onChange={(event) => setService(service.product_id, { duration_minutes: Math.max(5, Number(event.target.value) || 5) })} />
                          min
                        </label>
                        {advanced && (
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            Margen
                            <Input type="number" min={0} max={120} step={1} className="h-9 w-20 text-sm" value={service.buffer_minutes ?? 0} aria-label={`Margen de ${service.name}`} onChange={(event) => setService(service.product_id, { buffer_minutes: Number(event.target.value) })} />
                            min
                          </label>
                        )}
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Switch checked={service.online} onCheckedChange={(on) => setService(service.product_id, { online: on })} aria-label={`Reservable online: ${service.name}`} /> Online
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {config.services.length > 0 && (
                  <p className="text-xs text-muted-foreground">Para cambiar el nombre, el precio o la foto de un servicio, editalo en <Link href="/dashboard/products" className="underline">Productos</Link>.</p>
                )}
                {savedSettingsRef.current && (
                  <NewServiceDialog
                    open={newServiceOpen}
                    onOpenChange={setNewServiceOpen}
                    existingNames={config.services.map((service) => service.name)}
                    currency={config.currency}
                    onCreated={refreshKeepingDrafts}
                  />
                )}
              </div>
            </SectionCard>
          </div>

          {section === 'reservas' && (
            <SectionCard title="Reservas online" description="Tus clientes eligen servicio, día y horario desde tu tienda, y el turno aparece en la agenda.">
              <div className="space-y-5 text-sm">
                <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
                  <h3 className="font-semibold">Estado de las reservas</h3>
                  <p>{!settings.online_booking ? 'Reservas online apagadas' : readiness.ready ? 'Configuración básica lista' : 'Faltan requisitos para ofrecer reservas'}</p>
                  <ul className="space-y-1">{readiness.checks.map(check => <li key={check.label}>{check.ok ? '✓' : 'Pendiente:'} {check.label}</li>)}</ul>
                  {readiness.uncovered.length > 0 && <p>Sin personal online habilitado: {readiness.uncovered.join(', ')}.</p>}
                  <p className="text-xs text-muted-foreground">Revisa requisitos básicos, no garantiza horarios libres: al reservar también se consideran turnos y ausencias.</p>
                </div>
                <h3 className="font-semibold">Cómo reserva el cliente</h3>
                <div className="divide-y rounded-xl border">
                  <ToggleRow title="Aceptar reservas desde la tienda" checked={settings.online_booking} onChange={(on) => setSettings({ online_booking: on })} />
                  <ToggleRow title="Confirmarlas yo antes" detail="Si está apagado, quedan confirmadas solas." checked={settings.require_confirmation} onChange={(on) => setSettings({ require_confirmation: on })} />
                  <ToggleRow title="Avisarme por email" detail="Cuando un cliente reserva, cambia o cancela. Llega al email de contacto de la tienda; igual lo ves en la campanita de la Agenda." checked={settings.notify_email !== false} onChange={(on) => setSettings({ notify_email: on })} />
                </div>

                <h3 className="font-semibold">Avisos y enlace</h3>
                <p>{config.bookingContext?.notificationEmail ? `Email de contacto: ${config.bookingContext.notificationEmail}` : <>No hay un email de contacto válido. <Link className="underline" href="/admin/website">Configurá el contacto de tu tienda</Link> para recibir estos avisos.</>}</p>
                {dirty && <p className="text-xs text-muted-foreground">El enlace utiliza la configuración guardada, no los cambios pendientes.</p>}
                {(
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-3">
                    <code className="min-w-0 flex-1 truncate text-xs">{config.bookingUrl}</code>
                    <Button size="sm" variant="outline" disabled={!linkReady} onClick={() => void copyLink()}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                    {linkReady && <Button size="sm" variant="ghost" asChild><a href={config.bookingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ver</a></Button>}
                  </div>
                )}

                {advanced && (
                  <label className="block space-y-1.5">
                    <span className="font-medium">Elección del profesional</span>
                    <select className="min-h-10 w-full rounded-md border bg-background px-3 text-sm" value={settings.professional_selection ?? 'optional'} onChange={(event) => setSettings({ professional_selection: event.target.value as NonNullable<AgendaSettings['professional_selection']> })}>
                      <option value="disabled">Asignación automática (sin selector)</option>
                      <option value="optional">El cliente puede elegir o pedir cualquiera</option>
                      <option value="required">El cliente debe elegir con quién atenderse</option>
                    </select>
                    <span className="block text-xs text-muted-foreground">La asignación automática confirma un profesional concreto y su tarifa antes de reservar. Si exigís elegir, necesitás al menos uno activo y que se pueda reservar online.</span>
                  </label>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Anticipación mínima</Label>
                    <Select value={String(settings.min_notice_minutes)} onValueChange={(value) => setSettings({ min_notice_minutes: Number(value) })}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>{[[0, 'Sin mínimo'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [1440, '1 día']].map(([value, label]) => <SelectItem key={value} value={String(value)}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Cuánto antes del turno se puede reservar.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="max-days-ahead">Hasta cuántos días adelante</Label>
                    <Input id="max-days-ahead" inputMode="numeric" className="h-11 text-base" value={daysText} aria-invalid={!daysValid} aria-describedby="days-help" onChange={(event) => { setDaysText(event.target.value); if (/^\d+$/.test(event.target.value) && Number(event.target.value) >= 1 && Number(event.target.value) <= 180) setSettings({ max_days_ahead: Number(event.target.value) }) }} />
                    <p id="days-help" className={cn('text-xs', daysValid ? 'text-muted-foreground' : 'text-destructive')}>Ingresá un número entero de 1 a 180 días.</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="booking-message">Mensaje para el cliente <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <Textarea id="booking-message" rows={3} maxLength={500} className="text-base" aria-describedby="message-count" value={settings.booking_message ?? ''} placeholder="Ej.: llegá 5 minutos antes. Si no podés venir, cancelá desde el enlace." onChange={(event) => setSettings({ booking_message: event.target.value })} />
                  <p id="message-count" className="text-xs text-muted-foreground">{settings.booking_message?.length ?? 0}/500 caracteres</p>
                </div>
              </div>
            </SectionCard>
          )}

          {section === 'ausencias' && advanced && (
            <SectionCard title="Pausas y ausencias" description="Vacaciones, almuerzo o un cierre excepcional, de toda la tienda o de un profesional.">
              <TimeOffEditor professionals={config.professionals} timeZone={config.timeZone} hideHeading />
            </SectionCard>
          )}
        </div>
      </div>

      {dirty && (
        <div role="region" aria-label="Cambios sin guardar" className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
          <p className="text-sm font-medium">Tenés cambios sin guardar</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={discard} disabled={saving}><Undo2 className="h-4 w-4" /> Descartar</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar cambios</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionCard({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`section-${title}`} className="rounded-xl border bg-card p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id={`section-${title}`} className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function ToggleRow({ title, detail, checked, onChange }: { title: string; detail?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 p-3">
      <span>
        <span className="block font-medium">{title}</span>
        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </label>
  )
}
