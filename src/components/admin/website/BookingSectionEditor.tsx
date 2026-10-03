'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangle, CalendarCheck2, CheckCircle2, ExternalLink, Loader2, Save, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { BookingSectionSettings } from '@/types/website-settings'

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
            <Label htmlFor="bookingEnabled" className="text-sm font-semibold">Mostrar «Reservá tu turno» en el inicio</Label>
            <p className="text-xs text-muted-foreground">El cliente elige servicio, profesional y horario sin salir de tu tienda.</p>
          </div>
          <Switch id="bookingEnabled" checked={value.enabled} onCheckedChange={(enabled) => change({ enabled })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bookingTitle">Título</Label>
            <Input id="bookingTitle" maxLength={80} value={value.title} onChange={(event) => change({ title: event.target.value })} placeholder="Reservá tu turno" />
          </div>
          <div className="space-y-1.5 sm:row-span-2">
            <Label htmlFor="bookingSubtitle">Texto de apoyo</Label>
            <Textarea id="bookingSubtitle" rows={3} maxLength={200} value={value.subtitle} onChange={(event) => change({ subtitle: event.target.value })} placeholder="Elegí el servicio, el día y el horario que te quede cómodo." />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
            <div>
              <Label htmlFor="bookingShowTeam" className="text-sm">Mostrar al equipo</Label>
              <p className="text-xs text-muted-foreground">Los profesionales de la agenda.</p>
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
