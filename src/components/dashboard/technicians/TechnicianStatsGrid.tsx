'use client'

import { Award, Clock, Users, Wrench, Gauge, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TechnicianStatsGridProps {
  totalTechnicians: number
  techniciansWithoutLoad: number
  highLoadTechnicians: number
  totalActiveJobs: number
  avgJobsPerTech: number
  avgCompletionTime?: string
  topCloserName?: string
}

interface StatItemProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  tone: 'blue' | 'green' | 'red' | 'purple' | 'cyan' | 'orange'
  featured?: boolean
}

const toneMap: Record<StatItemProps['tone'], { icon: string; value: string; border: string; glow: string }> = {
  blue:   { icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300',   value: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-200/60 dark:border-blue-800/50',   glow: 'shadow-blue-500/10'   },
  green:  { icon: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300', value: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200/60 dark:border-emerald-800/50', glow: 'shadow-emerald-500/10' },
  red:    { icon: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300',       value: 'text-red-700 dark:text-red-300',       border: 'border-red-200/60 dark:border-red-800/50',       glow: 'shadow-red-500/10'    },
  purple: { icon: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300', value: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200/60 dark:border-violet-800/50', glow: 'shadow-violet-500/10' },
  cyan:   { icon: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300',   value: 'text-cyan-700 dark:text-cyan-300',   border: 'border-cyan-200/60 dark:border-cyan-800/50',   glow: 'shadow-cyan-500/10'   },
  orange: { icon: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300', value: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200/60 dark:border-orange-800/50', glow: 'shadow-orange-500/10' },
}

function StatItem({ label, value, sub, icon: Icon, tone, featured }: StatItemProps) {
  const t = toneMap[tone]
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-background/60 px-4 py-3.5 backdrop-blur-sm transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        t.border,
        t.glow && `hover:shadow-sm`,
        featured && 'col-span-2 sm:col-span-1 border-2',
      )}
    >
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', t.icon)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={cn('truncate text-xl font-bold leading-tight', t.value)}>
          {value}
        </p>
        {sub && (
          <p className="truncate text-[11px] text-muted-foreground/70">{sub}</p>
        )}
      </div>
    </div>
  )
}

export function TechnicianStatsGrid({
  totalTechnicians,
  techniciansWithoutLoad,
  highLoadTechnicians,
  totalActiveJobs,
  avgJobsPerTech,
  avgCompletionTime,
  topCloserName,
}: TechnicianStatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <StatItem
        label="Total técnicos"
        value={totalTechnicians}
        sub="En esta sucursal"
        icon={Users}
        tone="blue"
      />
      <StatItem
        label="Sin carga"
        value={techniciansWithoutLoad}
        sub="Disponibles ahora"
        icon={Gauge}
        tone="green"
      />
      <StatItem
        label="Carga alta"
        value={highLoadTechnicians}
        sub="Conviene repartir"
        icon={TrendingUp}
        tone="red"
      />
      <StatItem
        label="Trabajos activos"
        value={totalActiveJobs}
        sub="En curso ahora"
        icon={Wrench}
        tone="purple"
      />
      {avgCompletionTime && (
        <StatItem
          label="Tiempo promedio"
          value={avgCompletionTime}
          sub="Para cerrar un trabajo"
          icon={Clock}
          tone="cyan"
        />
      )}
      {topCloserName && (
        <StatItem
          label="Más cierres"
          value={topCloserName}
          sub="Este mes"
          icon={Award}
          tone="orange"
        />
      )}
    </div>
  )
}
