'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangle, CalendarCheck2, CheckCircle2, ExternalLink, Loader2, PackageCheck, Save, Scissors, Settings2, ShoppingBag, Sparkles, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { cn } from '@/lib/utils'
import type { BookingSectionSettings } from '@/types/website-settings'

const BOOKING_PRESETS = [
  {
    name: 'Servicio Técnico / Taller',
    icon: Wrench,
    badge: 'Atención en taller',
    title: 'Agendá tu cita técnica o diagnóstico',
    subtitle: 'Reservá un horario para revisar tu equipo, solicitar presupuesto o consultar con un técnico.',
    showTeam: false,
  },
  {
    name: 'Asesoramiento / Compra VIP',
    icon: ShoppingBag,
    badge: 'Atención personalizada',
    title: 'Agendá una cita de compra o demostración',
    subtitle: 'Coordiná una atención personalizada para cotizar, ver equipos o consultar sobre tu compra.',
    showTeam: false,
  },
  {
    name: 'Retiro o Entrega Programada',
    icon: PackageCheck,
    badge: 'Visita programada',
    title: 'Coordiná tu visita o retiro',
    subtitle: 'Elegí el día y horario que mejor te quede para retirar tus compras o dejar tu equipo en nuestro local.',
    showTeam: false,
  },
  {
    name: 'Turnos & Servicios Personales',
    icon: Scissors,
    badge: 'Turnos online',
    title: 'Reservá tu turno',
    subtitle: 'Elegí el servicio, quién te atiende y el horario que te quede más cómodo.',
    showTeam: true,
  },
] as const

type AgendaStatus =
  | { state: 'loading' }
  | { state: 'unavailable' }
  | { state: 'ready'; onlineBooking: boolean; services: number; onlineServices: number; professionals: number }

/**
 * La sección «Reservá tu turno» del inicio. La reserva en sí (servicios,
 * horarios, quién atiende) se configura en la agenda; acá se decide si se
 * muestra en la tienda y con qué textos.
 */
export function BookingSectionEditor({ orgSlug }: { orgSlug: string | null }) {
  const { settings, isLoading, updateSetting } = useAdminWebsiteSettings()
  const saved = settings?.booking_section ?? getWebsiteSettingsDefaults().booking_section!
  const [draft, setDraft] = useState<BookingSectionSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [agenda, setAgenda] = useState<AgendaStatus>({ state: 'loading' })
  const value = draft ?? saved

  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(draft !== null)
    return () => dirtyCtx?.setDirty(false)
  }, [draft, dirtyCtx])

  useEffect(() => {
    let cancelled = false
    fetch('/api/agenda/settings', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok || body.available === false) return setAgenda({ state: 'unavailable' })
        const services = (body.services ?? []) as Array<{ online: boolean }>
        setAgenda({
          state: 'ready',
          onlineBooking: Boolean(body.settings?.online_booking),
          services: services.length,
          onlineServices: services.filter((service) => service.online).length,
          professionals: ((body.professionals ?? []) as Array<{ is_active: boolean }>).filter((item) => item.is_active).length,
        })
      })
      .catch(() => { if (!cancelled) setAgenda({ state: 'unavailable' }) })
    return () => { cancelled = true }
  }, [])

  const change = (patch: Partial<BookingSectionSettings>) => setDraft({ ...value, ...patch })

  const save = async () => {
    setSaving(true)
    try {
      const result = await updateSetting('booking_section', value)
      if (result?.success === false) {
        toast.error(result.error || 'No se pudo guardar')
        return
      }
      setDraft(null)
      toast.success('Sección de reservas guardada')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div aria-busy="true" className="h-40 animate-pulse rounded-xl bg-muted" />

  const ready = agenda.state === 'ready' && agenda.onlineBooking && agenda.onlineServices > 0
  const visibleOnStore = value.enabled && ready

  return (
    <div className="space-y-6">
      {/* Estado de la agenda: sin reservas online la sección no aparece aunque esté activada. */}
      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Agenda y reservas online</p>
              {agenda.state === 'loading' && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Revisando…</p>}
              {agenda.state === 'unavailable' && (
                <p className="text-xs text-muted-foreground">Tu plan no incluye la agenda (módulo Servicios) o todavía no está activada.</p>
              )}
              {agenda.state === 'ready' && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  <StatusLine ok={agenda.onlineBooking} text={agenda.onlineBooking ? 'Reservas online activadas' : 'Reservas online apagadas'} />
                  <StatusLine ok={agenda.onlineServices > 0} text={`${agenda.onlineServices} de ${agenda.services} servicios se pueden reservar online`} />
                  <StatusLine ok text={agenda.professionals > 0 ? `${agenda.professionals} profesionales atendiendo` : 'Una sola agenda (sin profesionales cargados)'} />
                </ul>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/dashboard/agenda/configuracion">
              <Settings2 aria-hidden="true" className="h-3.5 w-3.5" />
              Configurar agenda
            </Link>
          </Button>
        </div>
        {value.enabled && agenda.state === 'ready' && !ready && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            La sección está activada pero no se va a ver hasta que actives las reservas online y tengas al menos un servicio reservable.
          </p>
        )}
      </div>

      <div className="space-y-5 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="bookingEnabled" className="text-sm font-semibold">Mostrar sección de reservas / citas en el inicio</Label>
            <p className="text-xs text-muted-foreground">Tus clientes pueden agendar citas de servicio técnico, asesoramiento o turnos directamente en tu portada.</p>
          </div>
          <Switch id="bookingEnabled" checked={value.enabled} onCheckedChange={(enabled) => change({ enabled })} />
        </div>

        {/* Plantillas rápidas por rubro */}
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Plantillas sugeridas por tipo de negocio</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Cargá en un clic los textos recomendados para tu tipo de atención (podés modificarlos libremente):
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {BOOKING_PRESETS.map((preset) => {
              const Icon = preset.icon
              const isMatch = value.title === preset.title && value.badge === preset.badge
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => change({
                    badge: preset.badge,
                    title: preset.title,
                    subtitle: preset.subtitle,
                    showTeam: preset.showTeam,
                  })}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-colors',
                    isMatch
                      ? 'border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary'
                      : 'border-border/80 bg-card hover:border-primary/50 hover:bg-accent/40'
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{preset.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{preset.badge}: {preset.title}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bookingBadge">Etiqueta superior (Badge / Eyebrow)</Label>
            <Input
              id="bookingBadge"
              maxLength={60}
              value={value.badge || ''}
              onChange={(event) => change({ badge: event.target.value })}
              placeholder="Ej: Atención en taller, Showroom VIP, Turnos online"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bookingTitle">Título</Label>
            <Input id="bookingTitle" maxLength={80} value={value.title} onChange={(event) => change({ title: event.target.value })} placeholder="Reservá tu turno" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bookingSubtitle">Texto de apoyo</Label>
            <Textarea id="bookingSubtitle" rows={2} maxLength={200} value={value.subtitle} onChange={(event) => change({ subtitle: event.target.value })} placeholder="Elegí el servicio, el día y el horario que te quede cómodo." />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5 sm:col-span-2">
            <div>
              <Label htmlFor="bookingShowTeam" className="text-sm">Mostrar quién atiende (equipo / profesionales)</Label>
              <p className="text-xs text-muted-foreground">Recomendado para barberías y consultorios; podés apagarlo para servicio técnico o tienda general.</p>
            </div>
            <Switch id="bookingShowTeam" checked={value.showTeam} onCheckedChange={(showTeam) => change({ showTeam })} />
          </div>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <p className="text-xs font-medium">
          {visibleOnStore ? 'Visible en tu tienda' : value.enabled ? 'Activada, pendiente de la agenda' : 'Oculta en tu tienda'}
          {draft && <span className="ml-2 text-amber-600">· Cambios sin guardar</span>}
        </p>
        <div className="flex gap-2">
          {orgSlug && (
            <Button variant="ghost" size="sm" asChild className="gap-1.5">
              <a href={`/${orgSlug}/inicio#reservar`} target="_blank" rel="noopener noreferrer">
                Ver en la tienda <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {draft && <Button variant="outline" size="sm" onClick={() => setDraft(null)}>Descartar</Button>}
          <Button size="sm" onClick={() => void save()} disabled={!draft || saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={ok ? 'flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400' : 'flex items-center gap-1.5 text-amber-700 dark:text-amber-400'}>
      {ok ? <CheckCircle2 aria-hidden="true" className="h-3 w-3" /> : <AlertTriangle aria-hidden="true" className="h-3 w-3" />}
      {text}
    </li>
  )
}
