'use client'

import { AlertTriangle, ArrowRight, CheckCircle2, Lightbulb, Sparkles, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  describeHealthScore,
  type InventoryHealth,
  type InventoryIssueSample,
  type InventoryRecommendation,
} from '@/lib/inventory/inventory-health'

const SEVERITY = {
  critical: { icon: XCircle, tone: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', label: 'Urgente' },
  warning: { icon: AlertTriangle, tone: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', label: 'Importante' },
  tip: { icon: Lightbulb, tone: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10', label: 'Sugerencia' },
} as const

const SCORE_TONE = {
  good: 'bg-emerald-500',
  fair: 'bg-amber-500',
  poor: 'bg-rose-500',
} as const

/**
 * El asistente lee el estado real del inventario y propone qué hacer primero.
 * Corre con los datos de la empresa, sin servicios externos.
 */
export function InventoryAssistant({
  health,
  recommendations,
  loading,
  onAction,
  onOpenSample,
}: {
  health: InventoryHealth | null
  recommendations: InventoryRecommendation[]
  loading: boolean
  onAction: (recommendation: InventoryRecommendation) => void
  onOpenSample: (sample: InventoryIssueSample) => void
}) {
  const score = health && health.evaluated > 0 ? describeHealthScore(health.score) : null
  const visible = recommendations.slice(0, 6)

  return (
    <section aria-labelledby="inventory-assistant-title" className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 id="inventory-assistant-title" className="text-base font-semibold text-foreground">Asistente de inventario</h2>
            <p className="text-xs text-muted-foreground">
              Revisa tu catálogo y te dice qué conviene resolver primero.
            </p>
          </div>
        </div>

        {score && health && (
          <div className="min-w-48 space-y-1.5 sm:text-right">
            <p className="text-xs text-muted-foreground">
              {score.label} · <span className="tabular-nums text-foreground">{health.score}/100</span>
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={health.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Salud del inventario"
            >
              <div className={cn('h-full rounded-full transition-all', SCORE_TONE[score.tone])} style={{ width: `${health.score}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2" aria-label="Analizando inventario">
            {[0, 1, 2].map((index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/60" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm text-foreground">Todo en orden</p>
              <p className="text-xs text-muted-foreground">No hay agotados, márgenes negativos ni datos faltantes importantes.</p>
            </div>
          </div>
        ) : (
          <ol className="space-y-2">
            {visible.map((recommendation) => {
              const severity = SEVERITY[recommendation.severity]
              const Icon = severity.icon
              return (
                <li key={recommendation.key} className="rounded-xl border bg-background p-3 sm:p-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', severity.bg)} aria-hidden="true">
                      <Icon className={cn('h-4 w-4', severity.tone)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className={cn('mr-1.5 text-[11px] uppercase tracking-wide', severity.tone)}>{severity.label}</span>
                        {recommendation.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{recommendation.detail}</p>
                      {recommendation.samples.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {recommendation.samples.map((sample) => (
                            <button
                              key={sample.id}
                              type="button"
                              onClick={() => onOpenSample(sample)}
                              className="max-w-52 truncate rounded-full border bg-muted/40 px-2.5 py-0.5 text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                              title={sample.sku ? `${sample.name} · ${sample.sku}` : sample.name}
                            >
                              {sample.name}
                            </button>
                          ))}
                          {recommendation.count > recommendation.samples.length && (
                            <span className="px-1 py-0.5 text-[11px] text-muted-foreground">
                              y {(recommendation.count - recommendation.samples.length).toLocaleString('es-PY')} más
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {'href' in recommendation.action ? (
                      <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5 self-start">
                        <Link href={recommendation.action.href}>
                          {recommendation.action.label} <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="shrink-0 gap-1.5 self-start" onClick={() => onAction(recommendation)}>
                        {recommendation.action.label} <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        {recommendations.length > visible.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Y {recommendations.length - visible.length} sugerencias más cuando resuelvas estas.
          </p>
        )}
      </div>
    </section>
  )
}

export default InventoryAssistant
