'use client'

import Link from 'next/link'
import { ExternalLink, Gauge, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { SuperAdminSubscription } from './types'
import { PlanBadge, StatusBadge } from './subscription-badges'
import {
  daysUntil,
  getRecommendation,
  isAttention,
  periodLabel,
  periodProgress,
} from './utils'

type Props = {
  subscription: SuperAdminSubscription
  onOpenDetail: (subscription: SuperAdminSubscription) => void
}

export function SubscriptionCard({ subscription: sub, onOpenDetail }: Props) {
  const renewalDays = daysUntil(sub.current_period_ends_at)
  const attention = isAttention(sub)
  const progress = periodProgress(sub)

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900',
        attention
          ? 'border-orange-200 dark:border-orange-900/50'
          : 'border-slate-200 dark:border-slate-800'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {attention && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-orange-400" aria-hidden />
            )}
            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
              {sub.organization_name}
            </p>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {sub.organization_slug ? `/${sub.organization_slug}` : sub.organization_id.slice(0, 12) + '…'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <PlanBadge plan={sub.plan} />
          <StatusBadge status={sub.status} />
        </div>
      </div>

      {/* Recommendation */}
      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Acción sugerida</p>
        <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{getRecommendation(sub)}</p>
      </div>

      {/* Period progress */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{periodLabel(sub)}</span>
          <span>
            {renewalDays === null
              ? 'Sin vencimiento'
              : renewalDays < 0
                ? `${Math.abs(renewalDays)}d vencido`
                : renewalDays === 0
                  ? 'Vence hoy'
                  : `${renewalDays}d restantes`}
          </span>
        </div>
        <Progress
          value={progress}
          className={cn(
            'h-1.5',
            renewalDays !== null && renewalDays < 0
              ? '[&>div]:bg-rose-500'
              : renewalDays !== null && renewalDays <= 7
                ? '[&>div]:bg-orange-500'
                : '[&>div]:bg-emerald-500'
          )}
        />
      </div>

      {/* Meta */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>{sub.owner_name || sub.owner_email || 'Sin owner'}</span>
        <span>{sub.provider}</span>
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => onOpenDetail(sub)}
        >
          <Gauge className="h-3.5 w-3.5" />
          Detalle
        </Button>
        {sub.organization_slug && (
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link href={`/${sub.organization_slug}/inicio`}>
              <ExternalLink className="h-3.5 w-3.5" />
              Tienda
            </Link>
          </Button>
        )}
        {sub.cancel_at_period_end && (
          <Badge
            variant="outline"
            className="h-7 gap-1 border-rose-200 bg-rose-50 text-xs text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
          >
            <XCircle className="h-3 w-3" />
            Cancela al cierre
          </Badge>
        )}
      </div>
    </div>
  )
}
