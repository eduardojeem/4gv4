'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Globe } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import type { SiteAnalyticsRangeDays, SiteAnalyticsSummary } from '@/lib/site-analytics/shared'

const numberFormat = new Intl.NumberFormat('es-PY')

/** Resumen de la tienda online dentro de Analytics; el detalle vive en Visitas web. */
export function WebsiteSnapshotCard({ days, rangeNote }: { days: SiteAnalyticsRangeDays; rangeNote?: string }) {
  const [summary, setSummary] = useState<SiteAnalyticsSummary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/admin/analytics/website?days=${days}`, { cache: 'no-store', signal: controller.signal })
      .then((response) => response.json())
      .then((json: { success?: boolean; data?: { summary?: SiteAnalyticsSummary } }) => {
        if (!json.success || !json.data?.summary) throw new Error('sin datos')
        setSummary(json.data.summary)
        setFailed(false)
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setFailed(true)
      })
    return () => controller.abort()
  }, [days])

  const stats = summary
    ? [
        { label: 'Visitas', value: numberFormat.format(summary.totals.page_views) },
        { label: 'Visitantes', value: numberFormat.format(summary.totals.visitors) },
        { label: 'Pedidos web', value: numberFormat.format(summary.sales.orders) },
        { label: 'Vendido online', value: formatCurrency(summary.sales.revenue) },
      ]
    : null

  return (
    <Card className="border border-gray-200 shadow-sm dark:border-slate-800">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Tienda online
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {rangeNote ?? 'Mismo período que el resto del tablero'}
            </p>
          </div>
          <Link
            href="/admin/visitas"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Ver visitas web
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {failed ? (
          <p className="text-sm text-muted-foreground">No se pudieron cargar las visitas de la tienda.</p>
        ) : !stats ? (
          <div className="grid grid-cols-2 gap-3" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-0 rounded-lg border border-gray-200 px-3 py-2 dark:border-slate-800">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-0.5 truncate text-base font-semibold tabular-nums text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
