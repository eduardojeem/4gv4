'use client'

import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react'
import type { PromotionStats as Stats } from '@/types/promotion'
import { cn } from '@/lib/utils'

interface PromotionStatsProps {
  stats: Stats
  loading?: boolean
}

// ---------------------------------------------------------------------------
// Hero metric
// ---------------------------------------------------------------------------

type Tone = 'indigo' | 'emerald' | 'cyan' | 'amber' | 'violet'

const toneClasses: Record<Tone, { wrap: string; iconBg: string }> = {
  indigo:  { wrap: 'from-indigo-500/10 to-transparent border-indigo-200/50 dark:border-indigo-900/50',     iconBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  emerald: { wrap: 'from-emerald-500/10 to-transparent border-emerald-200/50 dark:border-emerald-900/50', iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  cyan:    { wrap: 'from-cyan-500/10 to-transparent border-cyan-200/50 dark:border-cyan-900/50',          iconBg: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' },
  amber:   { wrap: 'from-amber-500/10 to-transparent border-amber-200/50 dark:border-amber-900/50',       iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  violet:  { wrap: 'from-violet-500/10 to-transparent border-violet-200/50 dark:border-violet-900/50',    iconBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
}

function MetricCard({
  label, value, sub, icon: Icon, tone, badge,
}: {
  label: string
  value: number | string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
  badge?: string
}) {
  const t = toneClasses[tone]
  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-gradient-to-br p-5', t.wrap)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            {badge && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                ⚠ {badge}
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50 truncate">{value}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">{sub}</p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', t.iconBg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function PromotionStats({ stats, loading }: PromotionStatsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top row: 4 main metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total promociones"
          value={stats.total}
          sub={`${stats.active} activas en el sistema`}
          icon={BarChart3}
          tone="indigo"
        />
        <MetricCard
          label="Activas"
          value={stats.active}
          sub="en funcionamiento"
          icon={CheckCircle2}
          tone="emerald"
        />
        <MetricCard
          label="Programadas"
          value={stats.scheduled}
          sub="próximas a iniciar"
          icon={Clock}
          tone="cyan"
        />
        <MetricCard
          label="Por expirar"
          value={stats.expiringSoon}
          sub="en 7 días o menos"
          icon={AlertTriangle}
          tone={stats.expiringSoon > 0 ? 'amber' : 'emerald'}
          badge={stats.expiringSoon > 0 ? 'Atender' : undefined}
        />
      </div>

      {/* Bottom row: secondary metrics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Uso total"
          value={stats.totalUsage.toLocaleString('es-PY')}
          sub="aplicaciones de promociones"
          icon={TrendingUp}
          tone="violet"
        />
        <div className="overflow-hidden rounded-2xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Estado general
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-50">{stats.expired}</strong> expiradas
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-50">{stats.inactive}</strong> inactivas
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Promociones sin actividad o fuera de período
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
