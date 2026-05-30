'use client'

import type { ComponentType } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Gauge,
  TimerReset,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { formatMoney } from './utils'

type Stats = {
  active: number
  trialing: number
  renewingSoon: number
  atRisk: number
  canceling: number
  estimatedMrr: number
  activeRate: number
  total: number
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  variant = 'default',
  progress,
}: {
  label: string
  value: string | number
  helper: string
  icon: ComponentType<{ className?: string }>
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'revenue'
  progress?: number
}) {
  const iconColors: Record<string, string> = {
    default: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
    success: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
    warning: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400',
    danger: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400',
    info: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-400',
    revenue: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-400',
  }

  const valueColors: Record<string, string> = {
    default: 'text-slate-900 dark:text-slate-50',
    success: 'text-emerald-700 dark:text-emerald-300',
    warning: 'text-orange-700 dark:text-orange-300',
    danger: 'text-rose-700 dark:text-rose-300',
    info: 'text-cyan-700 dark:text-cyan-300',
    revenue: 'text-violet-700 dark:text-violet-300',
  }

  const progressColors: Record<string, string> = {
    default: '',
    success: '[&>div]:bg-emerald-500',
    warning: '[&>div]:bg-orange-500',
    danger: '[&>div]:bg-rose-500',
    info: '[&>div]:bg-cyan-500',
    revenue: '[&>div]:bg-violet-500',
  }

  return (
    <Card className="overflow-hidden rounded-xl border-0 shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-800/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className={cn('mt-2 text-2xl font-bold tracking-tight', valueColors[variant])}>
              {value}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{helper}</p>
          </div>
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconColors[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {progress !== undefined && (
          <div className="mt-3">
            <Progress value={progress} className={cn('h-1.5', progressColors[variant])} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SubscriptionStats({ stats }: { stats: Stats }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        label="Activas"
        value={stats.active}
        helper={`${stats.activeRate}% tasa de conversión`}
        icon={CheckCircle2}
        variant="success"
        progress={stats.activeRate}
      />
      <StatCard
        label="En trial"
        value={stats.trialing}
        helper="Evaluando plan de pago"
        icon={CalendarClock}
        variant="info"
      />
      <StatCard
        label="Renuevan pronto"
        value={stats.renewingSoon}
        helper="Vencen en los próximos 14 días"
        icon={TimerReset}
        variant="warning"
      />
      <StatCard
        label="En riesgo"
        value={stats.atRisk}
        helper="past_due o unpaid"
        icon={AlertTriangle}
        variant="danger"
      />
      <StatCard
        label="MRR estimado"
        value={formatMoney(stats.estimatedMrr)}
        helper={`${stats.canceling} cancelan al cierre`}
        icon={stats.estimatedMrr > 0 ? TrendingUp : Gauge}
        variant="revenue"
      />
    </section>
  )
}
