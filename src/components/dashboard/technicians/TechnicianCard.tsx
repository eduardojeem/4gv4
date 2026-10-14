'use client'

import { memo } from 'react'
import { useRouter } from 'next/navigation'
import { AppImage } from '@/components/ui/app-image'
import { WorkStatusBadge } from './WorkStatusBadge'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  History,
  User,
  Wrench,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { TechnicianLoadState } from '@/hooks/use-technician-stats'

interface TechnicianCardProps {
  id: string
  name: string
  avatar?: string
  specialty?: string
  loadState: TechnicianLoadState
  activeJobs: number
  completedThisMonth: number
  totalCompleted: number
  avgCompletionDays?: number
  rating?: number
  workloadPercentage: number
}

const getProgressTheme = (percentage: number) => {
  if (percentage > 80) return { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' }
  if (percentage > 50) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' }
  if (percentage > 0) return { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
}

export const TechnicianCard = memo(function TechnicianCard({
  id,
  name,
  avatar,
  specialty,
  loadState,
  activeJobs,
  completedThisMonth,
  totalCompleted,
  avgCompletionDays,
  workloadPercentage,
}: TechnicianCardProps) {
  const router = useRouter()

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const progressTheme = getProgressTheme(workloadPercentage)

  return (
    <article
      onClick={() => router.push(`/dashboard/repairs/technicians/${id}`)}
      className={cn(
        'group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-border/70',
        'bg-card/90 p-5 shadow-xs backdrop-blur-md',
        'transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5',
      )}
    >
      {/* Accent hover top indicator */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/80 to-primary/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="space-y-4">
        {/* Header: Avatar, Name, Specialty & Load Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-sm shadow-inner transition-transform duration-200 group-hover:scale-105 border border-primary/20">
                {avatar ? (
                  <AppImage src={avatar} alt={name} className="h-12 w-12 rounded-2xl object-cover" />
                ) : (
                  <span>{initials || <User className="h-5 w-5" />}</span>
                )}
              </div>
              {/* Pulse status indicator */}
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background shadow-2xs',
                  loadState === 'no_load' && 'bg-emerald-500',
                  loadState === 'light_load' && 'bg-blue-500',
                  loadState === 'medium_load' && 'bg-amber-500',
                  loadState === 'high_load' && 'bg-rose-500 animate-pulse',
                )}
              />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-base font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                {name}
              </h3>
              <p className="truncate text-xs font-medium text-muted-foreground mt-0.5">
                {specialty || 'Técnico especialista'}
              </p>
            </div>
          </div>

          <WorkStatusBadge status={loadState} variant="sm" className="shrink-0" />
        </div>

        {/* Capacity & Workload Bar */}
        <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Carga de trabajo:
            </span>
            <span className={cn('font-bold tabular-nums text-xs', progressTheme.text)}>
              {activeJobs} de 6 {activeJobs === 1 ? 'orden' : 'órdenes'} ({workloadPercentage}%)
            </span>
          </div>
          <Progress
            value={workloadPercentage}
            className="h-2 bg-muted/60"
            indicatorClassName={progressTheme.bar}
          />
        </div>

        {/* Mini Stats Matrix */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border/40 bg-muted/15 p-2 transition-colors group-hover:bg-muted/30">
            <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Wrench className="h-3 w-3 text-orange-500" />
              <span>Activos</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground mt-0.5">
              {activeJobs}
            </p>
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/15 p-2 transition-colors group-hover:bg-muted/30">
            <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>Este mes</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
              {completedThisMonth}
            </p>
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/15 p-2 transition-colors group-hover:bg-muted/30">
            <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <History className="h-3 w-3 text-indigo-500" />
              <span>Total</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground mt-0.5">
              {totalCompleted}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Info & Action */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1 text-[11px]">
          <Clock3 className="h-3.5 w-3.5 text-muted-foreground/80" />
          <span>Entrega prom:</span>
          <strong className="text-foreground font-semibold">
            {avgCompletionDays && avgCompletionDays > 0 ? `${avgCompletionDays.toFixed(1)} días` : '—'}
          </strong>
        </div>

        <span className="inline-flex items-center gap-1 font-semibold text-primary group-hover:translate-x-0.5 transition-transform duration-200">
          Ver perfil
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  )
})
