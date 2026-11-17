'use client'

import Link from 'next/link'
import { CheckCircle2, ExternalLink, Lock, Palette, Store, Wand2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { OrganizationStorefront } from '@/lib/superadmin/organization-storefront'

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
 * tienda, cuáles le habilita su plan y qué tipo de negocio es.
 */
export function OrganizationStorefrontTab({
  storefront,
  business,
  slug,
  planName,
  storefrontPublic,
  marketplacePublic,
}: {
  storefront: OrganizationStorefront
  business: OrganizationBusinessProfileView
  slug: string
  planName: string
  storefrontPublic: boolean
  marketplacePublic: boolean
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card className="space-y-5 rounded-2xl border-border p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold">Plantilla de la tienda</h3>
          </div>
          <Link href={`/${slug}/inicio`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Ver tienda <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">En uso</p>
          <p className="mt-1 text-lg font-bold">{storefront.isAuto ? storefront.resolvedLabel : storefront.chosenLabel}</p>
          {storefront.isAuto ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5" /> Elegida en «Automático» según el rubro ({business.verticalLabel}).
            </p>
          ) : null}
          {storefront.inPlan ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Incluida en su plan {planName}.
            </p>
          ) : (
            <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50/80 p-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Su plan {planName} no incluye esta plantilla: la conserva de antes, pero si la cambia no podrá volver a elegirla.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold">Habilitadas por su plan</p>
          {storefront.enabled === null ? (
            <p className="text-sm text-muted-foreground">No se pudo leer el catálogo de plantillas por plan.</p>
          ) : (
            storefront.enabled.map((group) => (
              <div key={group.tier} className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.templates.map((template) => (
                    <Badge
                      key={template.value}
                      variant="outline"
                      className={cn('rounded-full px-2.5 py-1 text-xs font-medium', template.current && 'border-primary bg-primary/10 text-primary')}
                    >
                      {template.label}{template.current ? ' · en uso' : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {storefront.notIncluded && storefront.notIncluded.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">No incluidas</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {storefront.notIncluded.map((template) => (
                <li key={template.value} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Lock className="h-3.5 w-3.5" />{template.label}</span>
                  <span className="text-xs text-muted-foreground">{template.availableIn ? `Desde ${template.availableIn}` : 'Sin plan activo que la incluya'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="space-y-6">
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
            <Store className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold">Visibilidad</h3>
          </div>
          <dl className="grid gap-3 text-sm">
            <Row label="Tienda pública" value={storefrontPublic ? 'Publicada' : 'No publicada'} />
            <Row label="Aparece en el marketplace" value={marketplacePublic ? 'Sí' : 'No'} />
            <Row label="Dirección" value={`/${slug}`} mono />
          </dl>
        </Card>
      </div>
    </div>
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
