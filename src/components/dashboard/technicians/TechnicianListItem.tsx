'use client'

import { memo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Clock3, History, User, Wrench } from 'lucide-react'
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

const getProgressTheme = (percentage: number) => {
  if (percentage > 80) return { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' }
  if (percentage > 50) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' }
  if (percentage > 0) return { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
}

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
  const progressTheme = getProgressTheme(workloadPercentage)

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      onClick={() => router.push(`/dashboard/repairs/technicians/${id}`)}
      className={cn(
        'group relative flex flex-col gap-3 sm:gap-4 rounded-xl p-3 sm:p-4 transition-all duration-200 cursor-pointer',
        'hover:bg-muted/30 border border-transparent hover:border-border/60',
        'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_minmax(180px,1.2fr)_auto] md:items-center',
      )}
    >
      {/* Col 1 — Identity */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs shadow-inner border border-primary/20 transition-transform duration-200 group-hover:scale-105">
            {initials || <User className="h-4 w-4" />}
          </div>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background shadow-xs',
              loadState === 'no_load' && 'bg-emerald-500',
              loadState === 'light_load' && 'bg-blue-500',
              loadState === 'medium_load' && 'bg-amber-500',
              loadState === 'high_load' && 'bg-rose-500 animate-pulse',
            )}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
              {name}
            </p>
            <WorkStatusBadge status={loadState} variant="sm" className="hidden sm:inline-flex" />
          </div>
          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {specialty || 'Técnico especialista'}
          </p>
        </div>
      </div>

      {/* Col 2 — Quick stats pills */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1 text-xs">
          <Wrench className="h-3.5 w-3.5 text-orange-500" />
          <span className="font-bold tabular-nums text-foreground">{activeJobs}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium">activos</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{completedThisMonth}</span>
          <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 uppercase font-medium">mes</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1 text-xs">
          <History className="h-3.5 w-3.5 text-indigo-500" />
          <span className="font-bold tabular-nums text-foreground">{totalCompleted}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium">total</span>
        </div>
      </div>

      {/* Col 3 — Workload bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground font-medium">Carga:</span>
          <span className={cn('font-bold tabular-nums text-xs', progressTheme.text)}>
            {activeJobs} de 6 ({workloadPercentage}%)
          </span>
        </div>
        <Progress
          value={workloadPercentage}
          className="h-1.5 bg-muted/60"
          indicatorClassName={progressTheme.bar}
        />
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock3 className="h-3 w-3 text-muted-foreground" />
          <span>Tiempo prom: <strong className="text-foreground">{avgLabel}</strong></span>
        </div>
      </div>

      {/* Col 4 — Action button */}
      <div className="flex items-center justify-end shrink-0 pt-1 sm:pt-0">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:text-primary shadow-2xs">
          <span>Ver perfil</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  )
})
