'use client'

import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { SuperAdminSubscription } from './types'
import { StatusBadge } from './subscription-badges'
import { getRecommendation, isAttention } from './utils'

type Stats = {
  active: number
  trialing: number
  atRisk: number
  canceling: number
  activeRate: number
}

type Props = {
  attentionList: SuperAdminSubscription[]
  stats: Stats
  onOpenDetail: (subscription: SuperAdminSubscription) => void
}

export function SubscriptionSidebar({ attentionList, stats, onOpenDetail }: Props) {
  return (
    <aside className="space-y-4">
      {/* Attention queue */}
      <Card className="rounded-xl border-0 shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-800/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Cola de atención</CardTitle>
          <p className="text-xs text-slate-400">Casos más urgentes del filtro actual.</p>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {attentionList.length > 0 ? (
            attentionList.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className="w-full rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-left transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800/70"
                onClick={() => onOpenDetail(sub)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {sub.organization_name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{getRecommendation(sub)}</p>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center dark:border-slate-700">
              <Sparkles className="mx-auto h-5 w-5 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-xs text-slate-400">Sin casos urgentes.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health summary */}
      <Card className="rounded-xl border-0 shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-800/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Salud de la cartera</CardTitle>
          <p className="text-xs text-slate-400">Conversión y riesgo en un vistazo.</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Conversion rate */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Conversión activa</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.activeRate}%
              </span>
            </div>
            <Progress
              value={stats.activeRate}
              className={[
                'h-2',
                stats.activeRate >= 70
                  ? '[&>div]:bg-emerald-500'
                  : stats.activeRate >= 40
                    ? '[&>div]:bg-orange-500'
                    : '[&>div]:bg-rose-500',
              ].join(' ')}
            />
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Activas', value: stats.active, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Trials', value: stats.trialing, color: 'text-cyan-600 dark:text-cyan-400' },
              { label: 'En riesgo', value: stats.atRisk, color: 'text-rose-600 dark:text-rose-400' },
              { label: 'Cancelan', value: stats.canceling, color: 'text-orange-600 dark:text-orange-400' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-lg bg-slate-50 p-2.5 text-center dark:bg-slate-800/60"
              >
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{label}</p>
              </div>
            ))}
          </div>

          <Button asChild variant="outline" className="w-full gap-2 text-sm">
            <Link href="/superadmin/plans">
              Gestionar planes
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </aside>
  )
}
