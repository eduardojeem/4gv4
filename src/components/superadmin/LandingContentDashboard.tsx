'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  EyeOff,
  LayoutTemplate,
  Rocket,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  summarizeLandings,
  type LandingAssessment,
  type LandingCheckKey,
  type LandingStatus,
} from '@/lib/superadmin/landing-readiness'
import { cn } from '@/lib/utils'
import type { CommerceSummary } from '@/lib/superadmin/landing-commerce'
import { resolveCommerceRange, type CommerceRange } from '@/lib/superadmin/commerce-range'
import { LandingCommercePanel } from './LandingCommercePanel'
import { LandingStoresSection } from './LandingStoresSection'
import {
  EMPTY_LANDING_FILTERS,
  LANDING_FILTER_PARAMS,
  serializeLandingFilters,
  toggleInList,
  type LandingFilters,
} from '@/lib/superadmin/landing-filters'

/**
 * Las landings de las tiendas, desde el lado del visitante.
 *
 * La pantalla anterior sumaba contenido suelto (servicios y testimonios de
 * todas las empresas juntos) y contaba como «hero personalizado» portadas de la
 * plantilla. No decía cuál tienda está lista para vender ni qué le falta a cada
 * una. Acá cada tienda tiene su estado, su lista de lo que falta y un enlace
 * para verla.
 */

export type LandingRow = {
  id: string
  name: string
  slug: string
  plan: string | null
  logoUrl: string | null
  /** `company_info.brandColor`: un color con nombre o `custom`. */
  brandColor?: string | null
  customBrandColor?: string | null
  vertical?: string | null
  marketplacePublic: boolean
  activeProducts: number | null
  assessment: LandingAssessment
}

const STATUS_META: Record<LandingStatus, { label: string; hint: string; icon: React.ElementType; pill: string; tile: string }> = {
  ready: {
    label: 'Lista para vender',
    hint: 'Publicada y con lo imprescindible',
    icon: Rocket,
    pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    tile: 'text-emerald-600 dark:text-emerald-400',
  },
  incomplete: {
    label: 'Incompleta',
    hint: 'Publicada, pero le falta algo imprescindible',
    icon: AlertTriangle,
    pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    tile: 'text-amber-600 dark:text-amber-400',
  },
  hidden: {
    label: 'No publicada',
    hint: 'Nadie puede entrar a la landing',
    icon: EyeOff,
    pill: 'bg-muted text-muted-foreground',
    tile: 'text-muted-foreground',
  },
  maintenance: {
    label: 'En mantenimiento',
    hint: 'El visitante ve un aviso en vez de la tienda',
    icon: Wrench,
    pill: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
    tile: 'text-orange-600 dark:text-orange-400',
  },
}

export function LandingContentDashboard({
  rows,
  failed,
  referenceTime,
  commerce,
  range: rangeProp,
  firstYear,
  initialFilters,
}: {
  rows: LandingRow[]
  failed: boolean
  referenceTime: string
  /** `null` cuando no se pudieron leer las ventas; sin pasar, no se muestra el panel. */
  commerce?: CommerceSummary | null
  /** El período de las métricas; sin pasar, los últimos 30 días. */
  range?: CommerceRange
  /** El primer año que se puede elegir. */
  firstYear?: number
  /** Los filtros que vinieron en la dirección. */
  initialFilters?: LandingFilters
}) {
  const [filters, setFilters] = useState<LandingFilters>(initialFilters ?? EMPTY_LANDING_FILTERS)

  // Los filtros quedan en la dirección para compartirla o volver atrás, sin
  // pedirle de nuevo los datos al servidor.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // `periodo` es de las métricas: se conserva.
    LANDING_FILTER_PARAMS.forEach((key) => params.delete(key))
    Object.entries(serializeLandingFilters(filters)).forEach(([key, value]) => params.set(key, value))
    const next = params.toString()
    if (next === window.location.search.replace(/^\?/, '')) return
    window.history.replaceState(window.history.state, '', next ? `?${next}` : window.location.pathname)
  }, [filters])
  const now = new Date(referenceTime).getTime()
  const range = rangeProp ?? resolveCommerceRange({}, now)

  const summary = useMemo(() => summarizeLandings(rows.map((row) => row.assessment)), [rows])

  // Las mismas etiquetas que usa cada tienda, en el mismo orden.
  const checkCatalog = rows[0]?.assessment.checks ?? []

  const toggleStatus = (status: LandingStatus) =>
    setFilters((current) => ({ ...current, statuses: toggleInList(current.statuses, status) }))
  const toggleMissing = (check: LandingCheckKey) =>
    setFilters((current) => ({ ...current, missing: toggleInList(current.missing, check) }))

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-xs text-muted-foreground">
          <Link href="/superadmin/web-content">
            <ArrowLeft className="h-3.5 w-3.5" />
            Contenido web
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <LayoutTemplate className="h-3.5 w-3.5" />
          Landings
        </div>
        <h1 className="text-2xl font-bold text-foreground">Landings de las tiendas</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Cuánto venden y cuánta gente visita la página de cada tienda, qué ve el visitante al entrar y qué le falta para vender.
        </p>
      </header>

      {commerce !== undefined && (
        <LandingCommercePanel
          commerce={commerce}
          range={range}
          now={now}
          firstYear={firstYear}
          stores={rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug }))}
          keepQuery={serializeLandingFilters(filters)}
        />
      )}

      <h2 className="-mb-2 text-base font-bold text-foreground">Estado de las landings</h2>

      {failed && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudieron leer las tiendas o su contenido. Lo que ves puede estar incompleto.
        </div>
      )}

      {/* Estado: cada cuadro filtra la lista */}
      <section aria-label="Estado de las landings" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(['ready', 'incomplete', 'hidden', 'maintenance'] as LandingStatus[]).map((status) => {
          const meta = STATUS_META[status]
          const Icon = meta.icon
          const active = filters.statuses.includes(status)
          const count = summary.byStatus[status]
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => toggleStatus(status)}
              className={cn(
                'rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-muted/50',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                <Icon className={cn('h-4 w-4', meta.tile)} aria-hidden="true" />
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                {count}
                <span className="ml-1 text-sm font-medium text-muted-foreground">de {summary.total}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{meta.hint}</p>
            </button>
          )
        })}
      </section>

      {/* Qué falta, en toda la plataforma */}
      <section aria-labelledby="landing-gaps" className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-5 py-3">
          <div>
            <h2 id="landing-gaps" className="text-sm font-bold text-foreground">Qué tienen las tiendas</h2>
            <p className="text-xs text-muted-foreground">Tocá una fila para ver las tiendas a las que les falta.</p>
          </div>
          <span className="text-xs text-muted-foreground">
            Portada propia en <strong className="text-foreground">{summary.heroCustom}</strong> de {summary.total}
          </span>
        </div>
        <ul className="grid gap-x-8 px-5 py-2 md:grid-cols-2">
          {checkCatalog.map((check) => {
            const have = summary.byCheck[check.key] ?? 0
            const percent = summary.total > 0 ? Math.round((have / summary.total) * 100) : 0
            const missing = summary.total - have
            const active = filters.missing.includes(check.key)
            return (
              <li key={check.key}>
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={missing === 0}
                  onClick={() => toggleMissing(check.key)}
                  className={cn(
                    'w-full rounded-lg px-2 py-2 text-left transition-colors disabled:cursor-default',
                    active ? 'bg-primary/10' : 'enabled:hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      {check.label}
                      {check.essential && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Imprescindible
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      <strong className="text-foreground">{have}</strong> / {summary.total}
                      {missing > 0 && <span className="ml-1.5 text-amber-700 dark:text-amber-300">· faltan {missing}</span>}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full', percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <LandingStoresSection
        rows={rows}
        filters={filters}
        onFiltersChange={setFilters}
        commerce={commerce}
        range={range}
        now={now}
      />
    </div>
  )
}
