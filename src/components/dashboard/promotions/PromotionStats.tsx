'use client'

import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingUp,
  Tag,
  Percent,
} from 'lucide-react'
import type { PromotionStats as Stats, PromotionFilters } from '@/types/promotion'
import { cn } from '@/lib/utils'

interface PromotionStatsProps {
  stats: Stats
  loading?: boolean
  onFilterClick?: (status: PromotionFilters['status']) => void
  activeStatus?: PromotionFilters['status']
}

type Tone = 'indigo' | 'emerald' | 'cyan' | 'amber' | 'violet'

const toneClasses: Record<Tone, { wrap: string; iconBg: string; textHighlight: string; border: string }> = {
  indigo: {
    wrap: 'from-indigo-500/10 via-indigo-500/5 to-transparent hover:border-indigo-500/40',
    iconBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    textHighlight: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-200/60 dark:border-indigo-900/40',
  },
  emerald: {
    wrap: 'from-emerald-500/10 via-emerald-500/5 to-transparent hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    textHighlight: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200/60 dark:border-emerald-900/40',
  },
  cyan: {
    wrap: 'from-cyan-500/10 via-cyan-500/5 to-transparent hover:border-cyan-500/40',
    iconBg: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
    textHighlight: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-200/60 dark:border-cyan-900/40',
  },
  amber: {
    wrap: 'from-amber-500/10 via-amber-500/5 to-transparent hover:border-amber-500/40',
    iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    textHighlight: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200/60 dark:border-amber-900/40',
  },
  violet: {
    wrap: 'from-violet-500/10 via-violet-500/5 to-transparent hover:border-violet-500/40',
    iconBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    textHighlight: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200/60 dark:border-violet-900/40',
  },
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  badge,
  onClick,
  isActive,
}: {
  label: string
  value: number | string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
  badge?: string
  onClick?: () => void
  isActive?: boolean
}) {
  const t = toneClasses[tone]
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 sm:p-5 transition-all duration-200 shadow-xs',
        t.border,
        t.wrap,
        onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99]',
        isActive && 'ring-2 ring-cyan-500 shadow-md bg-cyan-50/20 dark:bg-cyan-950/20'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </p>
            {badge && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 animate-pulse">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50 truncate tracking-tight">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
            {sub}
          </p>
        </div>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-110 shadow-xs',
            t.iconBg
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {onClick && (
        <div className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
          <span>Filtrar</span>
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </div>
      )}
    </div>
  )
}

export function PromotionStats({
  stats,
  loading,
  onFilterClick,
  activeStatus,
}: PromotionStatsProps) {
  if (loading) {
    return (
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3.5">
      {/* Top 4 Metrics */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Promociones"
          value={stats.total}
          sub={`${stats.active} vigentes en el sistema`}
          icon={BarChart3}
          tone="indigo"
          onClick={() => onFilterClick?.('all')}
          isActive={activeStatus === 'all'}
        />
        <MetricCard
          label="Activas Ahora"
          value={stats.active}
          sub="en funcionamiento en POS y web"
          icon={CheckCircle2}
          tone="emerald"
          onClick={() => onFilterClick?.('active')}
          isActive={activeStatus === 'active'}
        />
        <MetricCard
          label="Programadas"
          value={stats.scheduled}
          sub="inician automáticamente"
          icon={Clock}
          tone="cyan"
          onClick={() => onFilterClick?.('scheduled')}
          isActive={activeStatus === 'scheduled'}
        />
        <MetricCard
          label="Por Expirar"
          value={stats.expiringSoon}
          sub="en 7 días o menos"
          icon={AlertTriangle}
          tone={stats.expiringSoon > 0 ? 'amber' : 'emerald'}
          badge={stats.expiringSoon > 0 ? '⚠ Atender' : undefined}
          onClick={() => onFilterClick?.('expired')}
          isActive={activeStatus === 'expired'}
        />
      </div>

      {/* Secondary Row: Usage & Breakdown */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <MetricCard
          label="Aplicaciones Totales"
          value={stats.totalUsage.toLocaleString('es-PY')}
          sub="veces que clientes usaron promociones"
          icon={TrendingUp}
          tone="violet"
        />
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/60 p-4 sm:p-5 dark:border-slate-800/80 dark:bg-slate-900/60 shadow-xs backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Estado General de Catálogo
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-xs" />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    <strong className="font-bold text-slate-900 dark:text-slate-50">{stats.expired}</strong> expiradas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-400 shadow-xs" />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    <strong className="font-bold text-slate-900 dark:text-slate-50">{stats.inactive}</strong> inactivas
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Mantén limpio tu catálogo desactivando promociones vencidas.
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
