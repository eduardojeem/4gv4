'use client'

import { Barcode, CheckCircle2, FolderTree, Sparkles, Store, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatCell = {
  id: string
  label: string
  value: number
  hint: string
  warn?: boolean
  icon: React.ElementType
  color: 'blue' | 'emerald' | 'amber' | 'purple' | 'slate'
}

interface GlobalProductStatsProps {
  activeCount: number
  usedCount: number
  uncategorizedCount: number
  unbrandedCount: number
  candidatesCount: number
  currentFilter: string
  onSelectFilter: (filterId: string) => void
}

export function GlobalProductStats({
  activeCount,
  usedCount,
  uncategorizedCount,
  unbrandedCount,
  candidatesCount,
  currentFilter,
  onSelectFilter,
}: GlobalProductStatsProps) {
  const stats: StatCell[] = [
    {
      id: 'all',
      label: 'Catálogo Activo',
      value: activeCount,
      hint: 'Fichas oficiales disponibles',
      icon: Barcode,
      color: 'blue',
    },
    {
      id: 'used',
      label: 'En Uso por Tiendas',
      value: usedCount,
      hint: `${activeCount > 0 ? Math.round((usedCount / activeCount) * 100) : 0}% del catálogo adoptado`,
      icon: Store,
      color: 'emerald',
    },
    {
      id: 'no-category',
      label: 'Sin Categoría',
      value: uncategorizedCount,
      hint: uncategorizedCount === 0 ? 'Todas categorizadas' : 'Requieren clasificación',
      warn: uncategorizedCount > 0,
      icon: FolderTree,
      color: 'amber',
    },
    {
      id: 'no-brand',
      label: 'Sin Marca Global',
      value: unbrandedCount,
      hint: unbrandedCount === 0 ? 'Todas vinculadas a marca' : 'Pendientes de vincular',
      warn: unbrandedCount > 0,
      icon: Tag,
      color: 'purple',
    },
  ]

  const colorStyles = {
    blue: {
      bg: 'bg-blue-50/70 dark:bg-blue-950/20',
      border: 'border-blue-200/80 dark:border-blue-900/40',
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      activeRing: 'ring-2 ring-blue-500/50 border-blue-500',
    },
    emerald: {
      bg: 'bg-emerald-50/70 dark:bg-emerald-950/20',
      border: 'border-emerald-200/80 dark:border-emerald-900/40',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      activeRing: 'ring-2 ring-emerald-500/50 border-emerald-500',
    },
    amber: {
      bg: 'bg-amber-50/70 dark:bg-amber-950/20',
      border: 'border-amber-200/80 dark:border-amber-900/40',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      activeRing: 'ring-2 ring-amber-500/50 border-amber-500',
    },
    purple: {
      bg: 'bg-purple-50/70 dark:bg-purple-950/20',
      border: 'border-purple-200/80 dark:border-purple-900/40',
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      activeRing: 'ring-2 ring-purple-500/50 border-purple-500',
    },
    slate: {
      bg: 'bg-slate-50/70 dark:bg-slate-900/30',
      border: 'border-slate-200/80 dark:border-slate-800',
      iconBg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
      activeRing: 'ring-2 ring-slate-500/50 border-slate-500',
    },
  }

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        const style = colorStyles[stat.color]
        const isSelected = currentFilter === stat.id

        return (
          <button
            key={stat.id}
            type="button"
            onClick={() => onSelectFilter(stat.id)}
            className={cn(
              'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
              style.bg,
              style.border,
              isSelected ? style.activeRing : 'shadow-xs',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                {stat.label}
              </span>
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110', style.iconBg)}>
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className={cn('text-2xl font-black tabular-nums tracking-tight text-foreground', stat.warn && 'text-amber-600 dark:text-amber-400')}>
                  {stat.value.toLocaleString('es-PY')}
                </span>
                {stat.warn && (
                  <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Atención requerida" />
                )}
              </div>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground truncate">
                {stat.hint}
              </p>
            </div>

            {isSelected && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-primary" />
            )}
          </button>
        )
      })}
    </div>
  )
}
