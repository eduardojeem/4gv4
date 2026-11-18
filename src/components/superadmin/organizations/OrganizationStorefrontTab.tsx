'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, Eye, Globe, Lock, Palette, Sparkles, Store, Wand2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BrandColorScope, StorefrontTemplateThumbnail } from '@/components/admin/website/StorefrontTemplateThumbnail'
import { cn } from '@/lib/utils'
import type { StorefrontStylePreference } from '@/lib/website/storefront-style'
import type { OrganizationStorefront, StorefrontLockedTemplate, StorefrontTemplateItem } from '@/lib/superadmin/organization-storefront'
import { OrganizationTemplatePreviewDialog } from './OrganizationTemplatePreviewDialog'

export type OrganizationBusinessProfileView = {
  verticalLabel: string
  verticalIcon: string
  operatingModel: string
  primaryActivity: string
  specialties: string[]
  attentionMode: string | null
  appointmentMode: string | null
}

/**
 * Pestaña «Tienda y negocio» de la ficha de Super Admin: qué plantilla usa la
 * tienda, cuáles le habilita su plan (con una miniatura y un ejemplo sobre su
 * tienda real) y qué tipo de negocio es.
 */
export function OrganizationStorefrontTab({
  storefront,
  business,
  slug,
  planName,
  storefrontPublic,
  marketplacePublic,
  organizationName = slug,
  businessVertical,
}: {
  storefront: OrganizationStorefront
  business: OrganizationBusinessProfileView
  slug: string
  planName: string
  storefrontPublic: boolean
  marketplacePublic: boolean
  organizationName?: string
  businessVertical?: string | null
}) {
  const [previewStyle, setPreviewStyle] = useState<StorefrontStylePreference | null>(null)
  const enabledCount = storefront.enabled?.reduce((sum, group) => sum + group.templates.length, 0) ?? 0
  const lockedCount = storefront.notIncluded?.length ?? 0

  return (
    <BrandColorScope brandColor={storefront.look.brandColor} customBrandColor={storefront.look.customBrandColor} className="space-y-6">
      {/* Plantilla en uso */}
      <Card className="overflow-hidden rounded-2xl border-border shadow-none">
        <div className="grid gap-0 md:grid-cols-[minmax(0,320px)_1fr]">
          <button
            type="button"
            onClick={() => setPreviewStyle(storefront.chosen)}
            className="group relative block border-b border-border bg-muted/40 p-4 text-left md:border-b-0 md:border-r"
            aria-label={`Ver ejemplo de ${storefront.isAuto ? storefront.resolvedLabel : storefront.chosenLabel} en la tienda`}
          >
            <StorefrontTemplateThumbnail style={storefront.resolvedStyle} className="aspect-[4/3] w-full rounded-xl border shadow-sm transition-transform group-hover:scale-[1.01]" />
            <span className="absolute bottom-6 right-6 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">
              <Eye aria-hidden className="size-3.5" />Ver ejemplo
            </span>
          </button>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Palette aria-hidden className="size-3.5 text-primary" />Plantilla en uso</p>
                <h3 className="mt-1 text-xl font-bold">{storefront.isAuto ? storefront.resolvedLabel : storefront.chosenLabel}</h3>
                {storefront.resolvedTagline && <p className="text-sm text-muted-foreground">{storefront.resolvedTagline}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="min-h-11 gap-2 rounded-xl" onClick={() => setPreviewStyle(storefront.chosen)}><Eye aria-hidden className="size-4" />Ver ejemplo</Button>
                <Button asChild variant="outline" className="min-h-11 gap-2 rounded-xl">
                  <Link href={`/${slug}/inicio`} target="_blank">Ver tienda <ExternalLink aria-hidden className="size-3.5" /></Link>
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {storefront.isAuto && (
                <Badge variant="outline" className="gap-1 rounded-full px-2.5 py-1 text-xs"><Wand2 aria-hidden className="size-3" />Automático según el rubro ({business.verticalLabel})</Badge>
              )}
              {!storefront.isAuto && storefront.chosen === storefront.suggestedStyle && (
                <Badge variant="outline" className="gap-1 rounded-full px-2.5 py-1 text-xs"><Sparkles aria-hidden className="size-3" />La sugerida para su rubro</Badge>
              )}
              {storefront.inPlan ? (
                <Badge variant="outline" className="gap-1 rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 aria-hidden className="size-3" />Incluida en su plan {planName}</Badge>
              ) : null}
              <Badge variant="outline" className={cn('gap-1 rounded-full px-2.5 py-1 text-xs', !storefrontPublic && 'text-muted-foreground')}><Globe aria-hidden className="size-3" />{storefrontPublic ? 'Tienda publicada' : 'Tienda sin publicar'}</Badge>
            </div>

            {!storefront.inPlan && (
              <p role="note" className="rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                Su plan {planName} no incluye esta plantilla: la conserva de antes, pero si la cambia no podrá volver a elegirla.
              </p>
            )}

            {storefront.resolvedDescription && <p className="text-sm leading-6 text-muted-foreground">{storefront.resolvedDescription}</p>}
            {storefront.resolvedFeatures.length > 0 && (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {storefront.resolvedFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm"><CheckCircle2 aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />{feature}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {/* Habilitadas y no incluidas */}
      <Card className="space-y-5 rounded-2xl border-border p-5 shadow-none">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Plantillas de su plan {planName}</h3>
            <p className="text-sm text-muted-foreground">
              {storefront.enabled === null
                ? 'No se pudo leer el catálogo de plantillas por plan.'
                : `${enabledCount} habilitada${enabledCount === 1 ? '' : 's'}${lockedCount ? ` · ${lockedCount} no incluida${lockedCount === 1 ? '' : 's'}` : ''}. Tocá una para ver un ejemplo en su tienda.`}
            </p>
          </div>
        </div>

        {storefront.enabled?.map((group) => (
          <section key={group.tier} aria-label={`Habilitadas: ${group.label}`} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {group.templates.map((template) => (
                <li key={template.value}><TemplateCard template={template} onPreview={() => setPreviewStyle(template.value)} /></li>
              ))}
            </ul>
          </section>
        ))}

        {storefront.notIncluded && storefront.notIncluded.length > 0 && (
          <section aria-label="No incluidas en su plan" className="space-y-2 border-t border-border pt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Lock aria-hidden className="size-3" />No incluidas en su plan</p>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {storefront.notIncluded.map((template) => (
                <li key={template.value}><TemplateCard template={template} locked onPreview={() => setPreviewStyle(template.value)} /></li>
              ))}
            </ul>
          </section>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 rounded-2xl border-border p-5 shadow-none">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>{business.verticalIcon}</span>
            <h3 className="text-base font-semibold">Tipo de negocio</h3>
          </div>
          <dl className="grid gap-3 text-sm">
            <Row label="Rubro" value={business.verticalLabel} />
            <Row label="Modelo de operación" value={business.operatingModel} />
            <Row label="Actividad principal" value={business.primaryActivity} />
            {business.specialties.length ? <Row label="Especialidades" value={business.specialties.join(', ')} /> : null}
            {business.attentionMode ? <Row label="Dónde atiende" value={business.attentionMode} /> : null}
            {business.appointmentMode ? <Row label="Turnos" value={business.appointmentMode} /> : null}
          </dl>
        </Card>

        <Card className="space-y-3 rounded-2xl border-border p-5 shadow-none">
          <div className="flex items-center gap-2">
            <Store aria-hidden className="size-4 text-primary" />
            <h3 className="text-base font-semibold">Visibilidad</h3>
          </div>
          <dl className="grid gap-3 text-sm">
            <Row label="Tienda pública" value={storefrontPublic ? 'Publicada' : 'No publicada'} />
            <Row label="Aparece en el marketplace" value={marketplacePublic ? 'Sí' : 'No'} />
            <Row label="Dirección" value={`/${slug}`} mono />
          </dl>
        </Card>
      </div>

      {previewStyle && (
        <OrganizationTemplatePreviewDialog
          open
          onOpenChange={(open) => { if (!open) setPreviewStyle(null) }}
          storefront={storefront}
          initialStyle={previewStyle}
          slug={slug}
          organizationName={organizationName}
          businessVertical={businessVertical}
          storefrontPublic={storefrontPublic}
          planName={planName}
        />
      )}
    </BrandColorScope>
  )
}

function TemplateCard({
  template,
  locked = false,
  onPreview,
}: {
  template: StorefrontTemplateItem | StorefrontLockedTemplate
  locked?: boolean
  onPreview: () => void
}) {
  const availableIn = 'availableIn' in template ? template.availableIn : undefined
  return (
    <button
      type="button"
      onClick={onPreview}
      aria-label={`Ver ejemplo de ${template.label}${template.current ? ' (en uso)' : ''}${locked ? ', no incluida en su plan' : ''}`}
      className={cn(
        'group flex h-full w-full flex-col overflow-hidden rounded-xl border text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        template.current ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <div className={cn('relative bg-muted/40 p-2', locked && 'opacity-60 grayscale-[40%]')}>
        <StorefrontTemplateThumbnail style={template.preview} className="aspect-[4/3] w-full rounded-lg border" />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold shadow-sm"><Eye aria-hidden className="size-3.5" />Ver ejemplo</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {locked && <Lock aria-hidden className="size-3 shrink-0 text-muted-foreground" />}
          <span className="truncate">{template.label}</span>
        </span>
        {template.tagline && <span className="line-clamp-2 text-xs text-muted-foreground">{template.tagline}</span>}
        <span className="mt-auto flex flex-wrap gap-1 pt-1">
          {template.current && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">En uso</span>}
          {template.suggested && <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"><Sparkles aria-hidden className="size-2.5" />Para su rubro</span>}
          {locked && <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{availableIn ? `Desde ${availableIn}` : 'Sin plan que la incluya'}</span>}
        </span>
      </div>
    </button>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right font-medium', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}
