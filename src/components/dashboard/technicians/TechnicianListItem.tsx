'use client'

import { memo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Clock3, User, Wrench } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { WorkStatusBadge } from './WorkStatusBadge'
import { cn } from '@/lib/utils'
import type { TechnicianLoadState } from '@/hooks/use-technician-stats'

interface TechnicianListItemProps {
  id: string
  name: string
  specialty?: string
  loadState: TechnicianLoadState
  activeJobs: number
  completedThisMonth: number
  totalCompleted: number
  avgCompletionDays: number
  workloadPercentage: number
}

const progressColor = (pct: number) =>
  pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-primary'

export const TechnicianListItem = memo(function TechnicianListItem({
  id,
  name,
  specialty,
  loadState,
  activeJobs,
  completedThisMonth,
  totalCompleted,
  avgCompletionDays,
  workloadPercentage,
}: TechnicianListItemProps) {
  const router = useRouter()

  const avgLabel = avgCompletionDays > 0 ? `${avgCompletionDays.toFixed(1)} días` : '—'

  return (
    <div
      onClick={() => router.push(`/dashboard/repairs/technicians/${id}`)}
      className={cn(
        'group relative grid cursor-pointer items-center gap-4 rounded-xl px-4 py-3.5 transition-all duration-200',
        'hover:bg-muted/40',
        'md:grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_minmax(180px,1fr)_auto]',
      )}
    >
      {/* Hover left accent */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-0.5 rounded-full bg-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      {/* Col 1 — Identity */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-md shadow-indigo-500/20 transition-transform duration-200 group-hover:scale-105">
            <User className="h-4 w-4" />
          </div>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
              loadState === 'no_load' ? 'bg-emerald-500' :
              loadState === 'light_load' ? 'bg-blue-500' :
              loadState === 'medium_load' ? 'bg-amber-500' : 'bg-red-500',
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold transition-colors duration-200 group-hover:text-primary">
            {name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{specialty || 'Técnico general'}</p>
          <div className="mt-1">
            <WorkStatusBadge status={loadState} variant="sm" />
          </div>
        </div>
      </div>

      {/* Col 2 — Quick stats (inline pills) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 dark:bg-orange-900/20">
          <Wrench className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-xs font-bold text-orange-700 dark:text-orange-400">{activeJobs}</span>
          <span className="text-[10px] text-orange-600/70 dark:text-orange-400/70">activos</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-900/20">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{completedThisMonth}</span>
          <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">mes</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-cyan-50 px-2.5 py-1.5 dark:bg-cyan-900/20">
          <Clock3 className="h-3.5 w-3.5 text-cyan-500" />
          <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400">{avgLabel}</span>
        </div>
      </div>

      {/* Col 3 — Workload bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Carga</span>
          <span
            className={cn(
              'tabular-nums',
              workloadPercentage > 80 ? 'text-red-600' :
              workloadPercentage > 50 ? 'text-amber-600' : 'text-foreground',
            )}
          >
            {workloadPercentage}%
          </span>
        </div>
        <Progress
          value={workloadPercentage}
          className="h-1.5 bg-muted-foreground/10"
          indicatorClassName={progressColor(workloadPercentage)}
        />
        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">{totalCompleted}</span> cerrados en total
        </p>
      </div>

      {/* Col 4 — Action */}
      <div className="flex justify-end">
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground transition-all duration-200 group-hover:border-primary/30 group-hover:bg-primary/5 group-hover:text-primary">
          Ver perfil
          <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  )
})
