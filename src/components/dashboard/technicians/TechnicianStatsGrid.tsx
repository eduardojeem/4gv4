'use client'

import { Award, CheckCircle2, Clock, Gauge, TrendingUp, Users, Wrench } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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

interface StatCardProps {
  label: string
  value: string | number
  sub: string
  icon: React.ElementType
  accent: 'blue' | 'emerald' | 'rose' | 'amber' | 'indigo' | 'cyan'
}

const ACCENT_STYLES = {
  blue: {
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    border: 'border-l-4 border-l-blue-500',
    valueText: 'text-foreground',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    border: 'border-l-4 border-l-emerald-500',
    valueText: 'text-emerald-600 dark:text-emerald-400',
  },
  rose: {
    iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    border: 'border-l-4 border-l-rose-500',
    valueText: 'text-rose-600 dark:text-rose-400',
  },
  amber: {
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    border: 'border-l-4 border-l-amber-500',
    valueText: 'text-amber-600 dark:text-amber-400',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    border: 'border-l-4 border-l-indigo-500',
    valueText: 'text-foreground',
  },
  cyan: {
    iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    border: 'border-l-4 border-l-cyan-500',
    valueText: 'text-foreground',
  },
} as const

function StatCard({ label, value, sub, icon: Icon, accent }: StatCardProps) {
  const style = ACCENT_STYLES[accent]

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-border/70 bg-card/80 backdrop-blur-sm transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        style.border,
      )}
    >
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </span>
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-xs', style.iconBg)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2">
          <p className={cn('text-xl sm:text-2xl font-bold tracking-tight tabular-nums truncate', style.valueText)}>
            {value}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>
        </div>
      </CardContent>
    </Card>
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
      <StatCard
        label="Equipo Técnico"
        value={totalTechnicians}
        sub="Personal asignado"
        icon={Users}
        accent="blue"
      />

      <StatCard
        label="Disponibles"
        value={techniciansWithoutLoad}
        sub="Sin carga actual"
        icon={CheckCircle2}
        accent="emerald"
      />

      <StatCard
        label="Sobrecargados"
        value={highLoadTechnicians}
        sub={highLoadTechnicians > 0 ? 'Conviene redistribuir' : 'Carga balanceada'}
        icon={TrendingUp}
        accent={highLoadTechnicians > 0 ? 'rose' : 'amber'}
      />

      <StatCard
        label="En Proceso"
        value={totalActiveJobs}
        sub="Reparaciones activas"
        icon={Wrench}
        accent="indigo"
      />

      <StatCard
        label="Promedio Carga"
        value={`${avgJobsPerTech.toFixed(1)}`}
        sub="Órdenes por técnico"
        icon={Gauge}
        accent="cyan"
      />

      {topCloserName ? (
        <StatCard
          label="Mayor Rendimiento"
          value={topCloserName}
          sub="Más cierres en el mes"
          icon={Award}
          accent="amber"
        />
      ) : avgCompletionTime ? (
        <StatCard
          label="Tiempo Promedio"
          value={avgCompletionTime}
          sub="Para entrega final"
          icon={Clock}
          accent="cyan"
        />
      ) : null}
    </div>
  )
}
