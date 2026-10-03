'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Copy, Globe, Loader2, Plus, Save, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/currency'
import type { AgendaProfessional, AgendaService, AgendaSettings } from '@/lib/agenda/agenda-server'
import { WEEKDAY_LABELS } from '@/lib/agenda/time'
import { missingSuggestedServices } from '@/lib/agenda/suggested-services'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { SuggestedServicesCard } from '@/components/dashboard/agenda/SuggestedServicesCard'
import { ProfessionalServicesPicker } from '@/components/dashboard/agenda/ProfessionalServicesPicker'
import { ProfessionalPhotoButton } from '@/components/dashboard/agenda/ProfessionalPhotoButton'

const RUBRO_LABELS: Record<string, string> = { barbershop: 'barbería y peluquería' }

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type Config = {
  settings: AgendaSettings
  professionals: AgendaProfessional[]
  services: AgendaService[]
  currency: string
  bookingUrl: string
}

export function AgendaSettingsPanel() {
  const [config, setConfig] = useState<Config | null>(null)
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const { businessVertical } = useSubscriptionStatus()
  // Lo guardado, para crear servicios sugeridos sin guardar de rebote lo que se está editando.
  const savedSettingsRef = useRef<AgendaSettings | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/agenda/settings', { cache: 'no-store' })
    const body = await response.json().catch(() => ({}))
    setAvailable(body.available !== false)
    if (body.available) {
      savedSettingsRef.current = body.settings
      setConfig(body)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  if (!available) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">La agenda todavía no está activada en la base de datos.</p>
  }
  if (!config) return <p className="flex items-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>

  const settings = config.settings
  const setSettings = (patch: Partial<AgendaSettings>) => setConfig({ ...config, settings: { ...settings, ...patch } })
  const setRanges = (day: number, ranges: Array<[string, string]>) => {
    const opening = { ...settings.opening_hours }
    if (ranges.length) opening[day] = ranges
    else delete opening[day]
    setSettings({ opening_hours: opening })
  }
  const setService = (productId: string, patch: Partial<AgendaService>) =>
    setConfig({ ...config, services: config.services.map((service) => (service.product_id === productId ? { ...service, ...patch, configured: true } : service)) })

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/agenda/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          services: config.services.map((service) => ({ product_id: service.product_id, duration_minutes: service.duration_minutes, online: service.online })),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo guardar')
        return
      }
      toast.success('Agenda configurada')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const addProfessional = async () => {
    if (!newName.trim()) return
    const response = await fetch('/api/agenda/professionals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: COLORS[config.professionals.length % COLORS.length], sort_order: config.professionals.length }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return toast.error(body.error || 'No se pudo agregar')
    setNewName('')
    setConfig({ ...config, professionals: [...config.professionals, body.professional] })
  }

  const updateProfessional = async (professional: AgendaProfessional, patch: Partial<AgendaProfessional>) => {
    const response = await fetch('/api/agenda/professionals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: professional.id, ...patch }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return toast.error(body.error || 'No se pudo guardar')
    // La respuesta no trae sus servicios: se conservan los que ya tenía.
    setConfig({ ...config, professionals: config.professionals.map((item) => (item.id === professional.id ? { ...item, ...body.professional } : item)) })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/dashboard/agenda" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Agenda</Link>
          <h1 className="text-2xl font-bold tracking-tight">Configurar la agenda</h1>
        </div>
        <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar</Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Horario de atención</CardTitle><CardDescription>Fuera de este horario no se ofrecen turnos online. En el panel igual podés agendar cuando quieras.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {DAY_ORDER.map((day) => {
              const ranges = settings.opening_hours[day] ?? []
              return (
                <div key={day} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
                  <label className="flex w-28 items-center gap-2 text-sm font-medium">
                    <Switch checked={ranges.length > 0} onCheckedChange={(on) => setRanges(day, on ? [['08:00', '18:00']] : [])} aria-label={`Atiende el ${WEEKDAY_LABELS[day]}`} />
                    {WEEKDAY_LABELS[day].slice(0, 3)}
                  </label>
                  {ranges.length === 0 ? <span className="text-xs text-muted-foreground">Cerrado</span> : (
                    <div className="flex flex-wrap items-center gap-2">
                      {ranges.map(([from, to], index) => (
                        <span key={index} className="flex items-center gap-1">
                          <Input type="time" className="h-8 w-[104px]" value={from} onChange={(event) => setRanges(day, ranges.map((range, i) => (i === index ? [event.target.value, range[1]] : range)))} aria-label="Desde" />
                          <span className="text-xs">a</span>
                          <Input type="time" className="h-8 w-[104px]" value={to} onChange={(event) => setRanges(day, ranges.map((range, i) => (i === index ? [range[0], event.target.value] : range)))} aria-label="Hasta" />
                          {ranges.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Quitar tramo" onClick={() => setRanges(day, ranges.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </span>
                      ))}
                      {ranges.length < 3 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRanges(day, [...ranges, ['14:00', '18:00']])}><Plus className="h-3 w-3" /> Tramo</Button>}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="flex items-center gap-2 pt-2 text-sm">
              <Label>Turnos cada</Label>
              <Select value={String(settings.slot_minutes)} onValueChange={(value) => setSettings({ slot_minutes: Number(value) })}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{[10, 15, 20, 30, 45, 60].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} min</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Quién atiende</CardTitle><CardDescription>Cada profesional tiene su columna. Con la cámara subís su foto y con la tijera elegís qué servicios hace (si no elegís, hace todos). Foto y especialidad se ven en tu tienda. Sin profesionales, la agenda es una sola.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {config.professionals.map((professional) => (
                <div key={professional.id} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
                  <input type="color" value={professional.color} aria-label={`Color de ${professional.name}`} className="h-8 w-8 cursor-pointer rounded border" onChange={(event) => void updateProfessional(professional, { color: event.target.value })} />
                  <ProfessionalPhotoButton professional={professional} onUploaded={async (url) => { await updateProfessional(professional, { photo_url: url }) }} />
                  <Input defaultValue={professional.name} className="h-8" onBlur={(event) => { if (event.target.value.trim() && event.target.value.trim() !== professional.name) void updateProfessional(professional, { name: event.target.value.trim() }) }} />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch checked={professional.is_active} onCheckedChange={(on) => void updateProfessional(professional, { is_active: on })} aria-label="Activo" /> Activo
                  </label>
                  <ProfessionalServicesPicker
                    professional={professional}
                    services={config.services}
                    onSaved={(serviceIds) => setConfig({ ...config, professionals: config.professionals.map((item) => (item.id === professional.id ? { ...item, service_ids: serviceIds } : item)) })}
                  />
                  {/* Se muestra en la tienda debajo del nombre. */}
                  <Input
                    defaultValue={professional.specialty ?? ''}
                    maxLength={80}
                    placeholder="Especialidad (ej.: Barbero · fades)"
                    aria-label={`Especialidad de ${professional.name}`}
                    className="h-8 basis-full sm:ml-20"
                    onBlur={(event) => {
                      const specialty = event.target.value.trim()
                      if (specialty !== (professional.specialty ?? '')) void updateProfessional(professional, { specialty: specialty || null })
                    }}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Input value={newName} placeholder="Nombre del profesional" className="h-8" onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addProfessional() }} />
                <Button size="sm" variant="outline" onClick={() => void addProfessional()} disabled={!newName.trim()}><UserPlus className="h-4 w-4" /> Agregar</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4" /> Reservas online</CardTitle>
              <CardDescription>Tus clientes eligen servicio, día y horario desde tu tienda, y el turno aparece en la agenda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="flex items-center justify-between gap-3">Aceptar reservas desde la tienda <Switch checked={settings.online_booking} onCheckedChange={(on) => setSettings({ online_booking: on })} /></label>
              <label className="flex items-center justify-between gap-3">Confirmarlas yo antes (si no, quedan confirmadas solas) <Switch checked={settings.require_confirmation} onCheckedChange={(on) => setSettings({ require_confirmation: on })} /></label>
              <label className="flex items-center justify-between gap-3">
                <span>
                  Avisarme por email cuando un cliente reserva, cambia o cancela
                  <span className="block text-xs text-muted-foreground">Llega al email de contacto de la tienda. Igual lo ves en la campanita de la Agenda.</span>
                </span>
                <Switch checked={settings.notify_email !== false} onCheckedChange={(on) => setSettings({ notify_email: on })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Anticipación mínima</Label>
                  <Select value={String(settings.min_notice_minutes)} onValueChange={(value) => setSettings({ min_notice_minutes: Number(value) })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{[[0, 'Sin mínimo'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [1440, '1 día']].map(([value, label]) => <SelectItem key={value} value={String(value)}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta cuántos días adelante</Label>
                  <Input type="number" min={1} max={180} className="h-8" value={settings.max_days_ahead} onChange={(event) => setSettings({ max_days_ahead: Math.min(180, Math.max(1, Number(event.target.value) || 1)) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mensaje para el cliente (opcional)</Label>
                <Textarea rows={2} value={settings.booking_message ?? ''} placeholder="Ej.: llegá 5 minutos antes. Si no podés venir, cancelá desde el enlace." onChange={(event) => setSettings({ booking_message: event.target.value })} />
              </div>
              {settings.online_booking && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                  <code className="min-w-0 flex-1 truncate text-xs">{config.bookingUrl}</code>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => void navigator.clipboard.writeText(config.bookingUrl).then(() => toast.success('Enlace copiado'))}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Servicios</CardTitle>
          <CardDescription>Son los productos con unidad «servicio». Decí cuánto dura cada uno y si se puede reservar online.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const missing = missingSuggestedServices(businessVertical, config.services.map((service) => service.name))
            return missing.length > 0 && savedSettingsRef.current ? (
              <SuggestedServicesCard
                key={missing.map((service) => service.name).join('|')}
                suggestions={missing}
                currency={config.currency}
                savedSettings={savedSettingsRef.current}
                rubroLabel={RUBRO_LABELS[businessVertical] ?? 'tu rubro'}
                onAdded={load}
              />
            ) : null
          })()}
          {config.services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no tenés servicios. Cargalos en <Link href="/dashboard/products" className="underline">Productos</Link> con la unidad «servicio» (ej.: «Corte de cabello», «Lavado completo»).</p>
          ) : (
            <ul className="divide-y">
              {config.services.map((service) => (
                <li key={service.product_id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{service.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{service.hide_price ? 'Precio a consultar' : formatCurrency(service.price, { currency: config.currency })}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Input type="number" min={5} step={5} className="h-8 w-20" value={service.duration_minutes} aria-label={`Duración de ${service.name}`} onChange={(event) => setService(service.product_id, { duration_minutes: Math.max(5, Number(event.target.value) || 5) })} />
                    <span className="text-xs text-muted-foreground">min</span>
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch checked={service.online} onCheckedChange={(on) => setService(service.product_id, { online: on })} aria-label={`Reservable online: ${service.name}`} /> Online
                  </label>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
