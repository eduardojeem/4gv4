'use client'
import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { ServiceBusinessFields } from '@/components/admin/settings/ServiceBusinessFields'
import { SERVICE_WEBSITE_VARIANTS, SERVICE_VARIANT_PRESETS, ServiceWebsiteOptionsSchema, type ServiceWebsiteOptions, type ServiceWebsiteProposal } from '@/lib/website/service-website-proposal'
import { ServiceWebsiteProposalPreview } from './ServiceWebsiteProposalPreview'
import type { Service } from '@/types/website-settings'
import type { PublicAgendaInfo } from '@/components/public/inicio/ServicesHome'

type Preview = { proposal: ServiceWebsiteProposal; revision: string; services: Service[]; agenda?: PublicAgendaInfo | null }
export function ServiceWebsitePreparationDialog({ open, onOpenChange, onApplied }: {
  open: boolean; onOpenChange: (open: boolean) => void; onApplied: () => void
}) {
  const profile = useSubscriptionStatus()
  const [options, setOptions] = useState<ServiceWebsiteOptions>(() => {
    const variant = profile.businessVertical === 'barbershop' ? 'barber' : 'professional'
    const preset = SERVICE_VARIANT_PRESETS[variant]
    return { variant, specialties: profile.serviceSpecialties ?? [], accentColor: preset.color, title: preset.title, subtitle: preset.subtitle }
  })
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const edit = (patch: Partial<ServiceWebsiteOptions>) => { setOptions(value => ({ ...value, ...patch })); setPreview(null); setError('') }
  const submit = async (apply: boolean) => {
    if (pending.current || (apply && !preview)) return
    const validation = ServiceWebsiteOptionsSchema.safeParse(options)
    if (!validation.success) { setError(validation.error.issues[0]?.message || 'Revisá el título, el color y las especialidades.'); return }
    pending.current = true; setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/website/service-proposal', { method: apply ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validation.data, ...(apply ? { revision: preview!.revision } : {}) }) })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        if (response.status === 409) setPreview(null)
        throw new Error(body?.error || 'No se pudo preparar la página. Volvé a intentar.')
      }
      if (apply) { onApplied(); onOpenChange(false) }
      else setPreview({ proposal: body.proposal, revision: body.revision, services: body.services ?? [], agenda: body.agenda ?? null })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo preparar la página.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending.current) onOpenChange(value) }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>Preparar mi página de servicios</DialogTitle>
        <DialogDescription>Elegí un estilo y revisá los textos. Nada se publica hasta confirmar. Los servicios, precios, profesionales y reservas se conservan.</DialogDescription></DialogHeader>
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="service-template">Estilo de página</Label><select id="service-template" value={options.variant} className="h-10 w-full rounded-md border bg-background px-3 text-base"
            onChange={event => { const variant = event.target.value as ServiceWebsiteOptions['variant']; const preset = SERVICE_VARIANT_PRESETS[variant]; edit({ variant, accentColor: preset.color, title: preset.title, subtitle: preset.subtitle }) }}>
            {SERVICE_WEBSITE_VARIANTS.map(variant => <option key={variant} value={variant}>{SERVICE_VARIANT_PRESETS[variant].label}</option>)}
          </select></div>
          <div className="space-y-1"><Label htmlFor="service-accent">Color de marca</Label><Input id="service-accent" type="color" value={options.accentColor} onChange={event => edit({ accentColor: event.target.value })} className="h-10" /></div>
        </div>
        <ServiceBusinessFields specialtiesOnly value={{ serviceSpecialties: options.specialties }} disabled={busy}
          onChange={value => edit({ specialties: value.serviceSpecialties ?? [] })} />
        <p className="text-xs text-muted-foreground">En esta propuesta, las especialidades describen la portada. Para cambiar dónde y cómo atendés, guardá el perfil del negocio.</p>
        <div className="space-y-1"><Label htmlFor="service-title">Título de portada</Label><Input id="service-title" maxLength={120} value={options.title} onChange={event => edit({ title: event.target.value })} className="text-base" /></div>
        <div className="space-y-1"><Label htmlFor="service-subtitle">Descripción</Label><textarea id="service-subtitle" maxLength={400} value={options.subtitle} onChange={event => edit({ subtitle: event.target.value })} className="min-h-20 w-full rounded-md border bg-background p-3 text-base" /></div>
      </fieldset>
      {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>}
      {preview && <><ServiceWebsiteProposalPreview proposal={preview.proposal} services={preview.services} agenda={preview.agenda} />
        <div className="rounded-md border p-3 text-sm"><p className="font-semibold">Se aplicará al sitio público:</p><ul className="mt-2 list-disc pl-5">{preview.proposal.summary.map(item => <li key={item}>{item}</li>)}</ul></div></>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button variant="outline" disabled={busy} onClick={() => void submit(false)}>{busy ? 'Procesando…' : 'Generar vista previa'}</Button>
        {preview && <Button disabled={busy} onClick={() => void submit(true)}>Confirmar y aplicar</Button>}
      </div>
    </DialogContent>
  </Dialog>
}
