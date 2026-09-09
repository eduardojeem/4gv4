'use client'

import { AlertTriangle, CalendarClock, CheckCircle2, TimerReset, TrendingUp } from 'lucide-react'
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

type SubscriptionStatsProps = {
  stats: Stats
  onNavigate?: (tab: string) => void
}

type KpiItem = {
  label: string
  value: string | number
  helper: string
  colorClass: string
  bgClass: string
  iconClass: string
  Icon: React.ComponentType<{ className?: string }>
  navigateTo?: string
  highlight?: boolean
}

export function SubscriptionStats({ stats, onNavigate }: SubscriptionStatsProps) {
  const items: KpiItem[] = [
    {
      label: 'Activas',
      value: stats.active,
      helper: `${stats.activeRate}% conversión`,
      colorClass: 'text-emerald-700 dark:text-emerald-300',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
      Icon: CheckCircle2,
    },
    {
      label: 'En Trial',
      value: stats.trialing,
      helper: 'Evaluando plan',
      colorClass: 'text-cyan-700 dark:text-cyan-300',
      bgClass: 'bg-cyan-50 dark:bg-cyan-950/30',
      iconClass: 'text-cyan-600 dark:text-cyan-400',
      Icon: CalendarClock,
      navigateTo: 'trials',
    },
    {
      label: 'Renuevan pronto',
      value: stats.renewingSoon,
      helper: 'Próximos 14 días',
      colorClass: 'text-amber-700 dark:text-amber-300',
      bgClass: 'bg-amber-50 dark:bg-amber-950/30',
      iconClass: 'text-amber-600 dark:text-amber-400',
      Icon: TimerReset,
      navigateTo: 'renewals',
    },
    {
      label: 'En Riesgo',
      value: stats.atRisk,
      helper: stats.atRisk > 0 ? 'past_due / unpaid' : 'Todo al día',
      colorClass: stats.atRisk > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-400',
      bgClass: stats.atRisk > 0 ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-slate-50 dark:bg-slate-800/30',
      iconClass: stats.atRisk > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400',
      Icon: AlertTriangle,
      navigateTo: 'attention',
      highlight: stats.atRisk > 0,
    },
    {
      label: 'MRR Estimado',
      value: formatMoney(stats.estimatedMrr),
      helper: `${stats.canceling} cancelan al cierre`,
      colorClass: 'text-violet-700 dark:text-violet-300',
      bgClass: 'bg-violet-50 dark:bg-violet-950/30',
      iconClass: 'text-violet-600 dark:text-violet-400',
      Icon: TrendingUp,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => {
        const isClickable = !!item.navigateTo && !!onNavigate
        const Tag = isClickable ? 'button' : 'div'

        return (
          <Tag
            key={item.label}
            type={isClickable ? 'button' : undefined}
            onClick={isClickable ? () => onNavigate!(item.navigateTo!) : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
              item.highlight
                ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20'
                : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900',
              isClickable && 'cursor-pointer hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700',
              item.highlight && isClickable && 'hover:bg-rose-50 dark:hover:bg-rose-950/30'
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                item.bgClass
              )}
            >
              <item.Icon className={cn('h-4.5 w-4.5', item.iconClass)} />
            </div>

            {/* Text */}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {item.label}
              </p>
              <p className={cn('mt-0.5 text-lg font-black leading-none tracking-tight', item.colorClass)}>
                {item.value}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                {item.helper}
              </p>
            </div>
          </Tag>
        )
      })}
    </div>
  )
}
