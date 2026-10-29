'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Circle, Rocket, Store } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { BUSINESS_VERTICAL_LABELS } from '@/lib/organization/business-labels'
import { countryLabel } from '@/lib/regional/country-labels'
import type { SharedSettings } from '@/hooks/use-shared-settings'
import { cn } from '@/lib/utils'

export type SettingsTarget = 'negocio' | 'fiscal' | 'rubro'

export type SettingsSetupStatus = {
  onboardingStatus: 'completed' | 'in_progress' | 'not_started'
  branch: { name: string; city: string } | null
  storefront: { public: boolean; slug: string | null }
  logo: boolean | null
  payments: boolean | null
  products: boolean | null
  hasBusinessData: boolean
}

type SetupItem = {
  key: string
  label: string
  done: boolean
} & ({ tab: SettingsTarget; field: string } | { href: string })

/** Lo que falta, en el orden en que conviene completarlo. Solo cuenta lo ya guardado. */
export function buildSetupItems(saved: SharedSettings, status: SettingsSetupStatus | null): SetupItem[] {
  const items: SetupItem[] = [
    { key: 'country', label: 'Confirmá el país', done: Boolean(saved.countryCode), tab: 'fiscal', field: 'setting-country' },
    { key: 'phone', label: 'Teléfono de contacto', done: Boolean(saved.companyPhone.trim()), tab: 'negocio', field: 'companyPhone' },
    { key: 'address', label: 'Dirección y ciudad', done: Boolean(saved.companyAddress.trim() && saved.city.trim()), tab: 'negocio', field: 'companyAddress' },
    { key: 'email', label: 'Email del negocio', done: Boolean(saved.companyEmail.trim()), tab: 'negocio', field: 'companyEmail' },
    { key: 'ruc', label: 'RUC para tus comprobantes', done: Boolean(saved.companyRuc.trim()), tab: 'fiscal', field: 'companyRuc' },
  ]
  if (status) {
    if (status.logo !== null) items.push({ key: 'logo', label: 'Subí tu logo', done: status.logo, href: '/admin/website' })
    if (status.products !== null) items.push({ key: 'product', label: 'Cargá tu primer producto', done: status.products, href: '/dashboard/products/new' })
    if (status.payments !== null) items.push({ key: 'payments', label: 'Elegí cómo te pagan en la tienda', done: status.payments, href: '/admin/website?section=checkout' })
    items.push({ key: 'storefront', label: 'Publicá tu tienda online', done: status.storefront.public, href: '/admin/website' })
  }
  return items
}

export function SettingsSetupCard({
  saved,
  status,
  onGoTo,
}: {
  saved: SharedSettings
  status: SettingsSetupStatus | null
  onGoTo: (tab: SettingsTarget, field?: string) => void
}) {
  const profile = useSubscriptionStatus()
  const items = buildSetupItems(saved, status)
  const pending = items.filter((item) => !item.done)
  const doneCount = items.length - pending.length
  const percent = items.length ? Math.round((doneCount / items.length) * 100) : 100

  const summary: Array<{ label: string; value: string; target?: SettingsTarget }> = [
    { label: 'Negocio', value: saved.companyName || '—', target: 'negocio' },
    { label: 'País y moneda', value: `${countryLabel(saved.countryCode) || 'Sin confirmar'} · ${saved.currency}`, target: 'fiscal' },
    { label: 'Rubro', value: BUSINESS_VERTICAL_LABELS[profile.businessVertical] ?? '—', target: 'rubro' },
    {
      label: 'Sucursal principal',
      value: status?.branch ? [status.branch.name, status.branch.city].filter(Boolean).join(' · ') || '—' : status ? 'Sin sucursal' : '…',
    },
    {
      label: 'Tienda online',
      value: status ? (status.storefront.public ? 'Publicada' : 'Sin publicar') : '…',
    },
  ]

  return (
    <Card role="region" className="overflow-hidden border-border/80 shadow-sm" aria-labelledby="setup-card-title">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="setup-card-title" className="text-base font-semibold text-foreground">Tu negocio</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {!status
                  ? 'Revisando qué falta…'
                  : pending.length === 0
                  ? 'Está todo cargado. Podés cambiar cualquier dato cuando quieras.'
                  : `Te ${pending.length === 1 ? 'falta 1 dato' : `faltan ${pending.length} datos`} para dejarlo completo. Nada de esto te impide vender.`}
              </p>
            </div>
          </div>
          {status ? (
            <Badge variant="outline" className="w-fit shrink-0 text-xs font-semibold" aria-label={`${doneCount} de ${items.length} listos`}>
              {doneCount} de {items.length} listos
            </Badge>
          ) : null}
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${status ? percent : 0}%` }} />
        </div>

        {status?.onboardingStatus === 'in_progress' ? (
          <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-foreground">
              <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Dejaste la configuración inicial a medias. Lo que cambies acá se mantiene cuando la retomes.
            </p>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/admin/onboarding">Continuar configuración inicial</Link>
            </Button>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {summary.map((entry) => (
            <div key={entry.label} className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{entry.label}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-foreground" title={entry.value}>
                {entry.target ? (
                  <button type="button" className="max-w-full truncate text-left hover:text-primary hover:underline" onClick={() => onGoTo(entry.target!)}>
                    {entry.value}
                  </button>
                ) : entry.value}
              </dd>
            </div>
          ))}
        </dl>

        {!status ? null : pending.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Datos pendientes">
            {pending.map((item) => {
              const content = (
                <>
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </>
              )
              const className = cn(
                'group flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-dashed px-3 py-2 text-left text-sm text-foreground transition-colors',
                'hover:border-primary/50 hover:bg-primary/5',
              )
              return (
                <li key={item.key}>
                  {'href' in item ? (
                    <Link href={item.href} className={className}>{content}</Link>
                  ) : (
                    <button type="button" className={className} onClick={() => onGoTo(item.tab, item.field)}>{content}</button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Configuración completa
          </p>
        )}
      </CardContent>
    </Card>
  )
}
