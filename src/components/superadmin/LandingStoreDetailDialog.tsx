'use client'

import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Building2, Check, Copy, ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { describeLastAccess } from '@/lib/superadmin/last-access'
import { describeStoreBrand, storeBrandScope } from '@/lib/superadmin/store-brand'
import type { StoreCommerce } from '@/lib/superadmin/landing-commerce'
import type { CommerceRange } from '@/lib/superadmin/commerce-range'
import { STATUS_PILLS, type LandingStoreRowData } from './landing-store-meta'
import { formatGs } from './LandingCommercePanel'
import { cn } from '@/lib/utils'

/**
 * Todo lo de una tienda en un lugar: cómo vende, qué le falta a su landing y
 * qué tiene cargado. Antes había que armarlo mirando la fila, la tarjeta y la
 * ficha de la organización.
 */
export function LandingStoreDetailDialog({
  row,
  sales,
  range,
  now,
  onClose,
}: {
  row: LandingStoreRowData | null
  sales: StoreCommerce | null
  /** `null` cuando no hay métricas comerciales. */
  range: CommerceRange | null
  now: number
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {row && <DetailBody row={row} sales={sales} range={range} now={now} />}
      </DialogContent>
    </Dialog>
  )
}

function DetailBody({
  row,
  sales,
  range,
  now,
}: {
  row: LandingStoreRowData
  sales: StoreCommerce | null
  range: CommerceRange | null
  now: number
}) {
  const { assessment } = row
  const status = STATUS_PILLS[assessment.status]
  const brand = storeBrandScope(row.brandColor, row.customBrandColor)
  const storeUrl = `/${row.slug}/inicio`
  const updated = assessment.lastUpdatedAt ? describeLastAccess(assessment.lastUpdatedAt, now).label.toLowerCase() : null
  const delta = sales && sales.previousSold > 0 ? Math.round(((sales.sold - sales.previousSold) / sales.previousSold) * 100) : null
  const essentials = assessment.checks.filter((check) => check.essential)
  const suggested = assessment.checks.filter((check) => !check.essential)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${storeUrl}`)
      toast.success('Enlace de la tienda copiado')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  const extras = [
    ['Banners con imagen', assessment.activeSlides],
    ['Testimonios', assessment.testimonials],
    ['Barra de confianza', assessment.trustItems],
    ['Marcas', assessment.brandItems],
    ['Pasos de «cómo comprar»', assessment.processSteps],
  ] as const

  return (
    <>
      {/* Encabezado con el color de la tienda */}
      <div {...brand} data-testid="store-detail-brand">
        <div className="relative h-24 bg-primary" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-black/25" />
        </div>
        {/* `relative z-10`: sin eso la franja tapaba el logo. */}
        <DialogHeader className="relative z-10 -mt-10 space-y-2 px-6 text-left">
          {row.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.logoUrl} alt={`Logo de ${row.name}`} className="h-20 w-20 shrink-0 rounded-2xl border-4 border-background bg-background object-contain p-1 shadow-sm" />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-background bg-primary text-2xl font-bold text-primary-foreground shadow-sm">
              {row.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <DialogTitle className="truncate text-lg">{row.name}</DialogTitle>
            <DialogDescription className="truncate">/{row.slug}</DialogDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn('rounded-full px-2 py-0.5 font-semibold', status.pill)}>{status.label}</span>
            <span className="text-muted-foreground">
              {assessment.checks.filter((check) => check.ok).length} de {assessment.checks.length} puntos
            </span>
            <span className="text-muted-foreground">· {updated ? `editada ${updated}` : 'nunca editada'}</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
              <a href={storeUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir la tienda
              </a>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void copyLink()}>
              <Copy className="h-3.5 w-3.5" /> Copiar enlace
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Link href={`/superadmin/organizations/${encodeURIComponent(row.slug)}`}>
                <Building2 className="h-3.5 w-3.5" /> Ficha de la organización
              </Link>
            </Button>
          </div>
        </DialogHeader>
      </div>

      <div className="space-y-6 px-6 pb-6 pt-5">
        {/* Comercial */}
        <section aria-labelledby="detail-commerce" className="space-y-2">
          <h3 id="detail-commerce" className="text-sm font-semibold text-foreground">
            {range ? `Cómo vendió ${range.label}` : 'Cómo vendió'}
          </h3>
          {!range ? (
            <p className="text-xs text-muted-foreground">No se pudieron leer las ventas.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Vendido" value={formatGs(sales?.sold ?? 0)}>
                {delta !== null && (
                  <span className={cn('inline-flex items-center gap-0.5 font-semibold', delta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
                    {delta >= 0 ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
                    {delta >= 0 ? '+' : ''}{delta}% vs. anterior
                  </span>
                )}
              </Metric>
              <Metric label="En el local" value={formatGs(sales?.counterRevenue ?? 0)}>
                {sales?.counterSales ?? 0} {(sales?.counterSales ?? 0) === 1 ? 'venta' : 'ventas'}
              </Metric>
              <Metric label="Pedidos web" value={String(sales?.onlineOrders ?? 0)}>
                {formatGs(sales?.onlineRevenue ?? 0)} cobrados
              </Metric>
              <Metric label="Visitantes" value={sales?.visitors == null ? '—' : sales.visitors.toLocaleString('es-PY')}>
                {sales?.views == null ? 'Sin registro de visitas' : `${sales.views.toLocaleString('es-PY')} páginas vistas`}
              </Metric>
              <Metric label="Conversión" value={sales?.conversion == null ? '—' : `${sales.conversion.toLocaleString('es-PY')}%`}>
                visitantes que pidieron
              </Metric>
              <Metric label="Productos activos" value={row.activeProducts == null ? '—' : row.activeProducts.toLocaleString('es-PY')}>
                {row.marketplacePublic ? 'También en el marketplace' : 'Fuera del marketplace'}
              </Metric>
            </dl>
          )}
        </section>

        {/* Preparación */}
        <section aria-labelledby="detail-readiness" className="grid gap-4 sm:grid-cols-2">
          <h3 id="detail-readiness" className="sr-only">Qué tiene la landing</h3>
          {([['Imprescindible', essentials], ['Recomendado', suggested]] as const).map(([title, checks]) => (
            <div key={title} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
              <ul className="space-y-1.5">
                {checks.map((check) => (
                  <li key={check.key} className="flex items-start gap-2 text-sm">
                    {check.ok ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="tiene" />
                    ) : (
                      <X className={cn('mt-0.5 h-4 w-4 shrink-0', check.essential ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')} aria-label="falta" />
                    )}
                    <span className="min-w-0">
                      <span className={check.ok ? 'text-foreground' : 'font-medium text-foreground'}>{check.label}</span>
                      {!check.ok && <span className="block text-xs text-muted-foreground">{check.hint}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Contenido */}
        <section aria-labelledby="detail-content" className="space-y-3">
          <h3 id="detail-content" className="text-sm font-semibold text-foreground">Contenido de la página</h3>
          <div className="rounded-lg border border-border px-3 py-2.5 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Portada</p>
            {assessment.heroTitle ? (
              <p className="mt-0.5 text-foreground">
                «{assessment.heroTitle}»
                {!assessment.heroCustom && (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">texto de la plantilla</span>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-muted-foreground">Sin portada cargada</p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
            {extras.map(([label, count]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular-nums text-foreground">{count > 0 ? count : '—'}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Ofertas</dt>
              <dd className="text-foreground">{assessment.offersEnabled ? 'Activa' : '—'}</dd>
            </div>
            <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-3">
              <dt className="text-muted-foreground">Color de marca</dt>
              <dd className="flex items-center gap-1.5 text-foreground" {...brand}>
                <span className="h-3 w-3 rounded-full bg-primary ring-1 ring-border" aria-hidden="true" />
                {describeStoreBrand(row.brandColor, row.customBrandColor)}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  )
}

function Metric({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-bold tabular-nums text-foreground">{value}</dd>
      {children && <dd className="mt-0.5 truncate text-[11px] text-muted-foreground">{children}</dd>}
    </div>
  )
}
