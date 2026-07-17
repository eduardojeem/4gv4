'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { WorkStatusBadge } from './WorkStatusBadge'
import { User, Wrench, CheckCircle2, ArrowRight, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
  rating?: number
  workloadPercentage: number
}

const progressColor = (pct: number) =>
  pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-primary'

export const TechnicianCard = memo(function TechnicianCard({
  id,
  name,
  avatar,
  specialty,
  loadState,
  activeJobs,
  completedThisMonth,
  totalCompleted,
  rating,
  workloadPercentage,
}: TechnicianCardProps) {
  const router = useRouter()

  const dotColor =
    loadState === 'no_load'
      ? 'bg-emerald-500 shadow-emerald-500/50'
      : loadState === 'light_load'
        ? 'bg-blue-500 shadow-blue-500/50'
        : loadState === 'medium_load'
          ? 'bg-amber-500 shadow-amber-500/50'
          : 'bg-red-500 shadow-red-500/50'

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      onClick={() => router.push(`/dashboard/repairs/technicians/${id}`)}
      className={cn(
        'group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-border/50',
        'bg-background/60 p-5 backdrop-blur-md',
        'transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/8',
      )}
    >
      {/* Subtle top gradient on hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header row */}
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition-transform duration-300 group-hover:scale-105">
              {avatar ? (
                <img src={avatar} alt={name} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span>{initials || <User className="h-5 w-5" />}</span>
              )}
            </div>
            {/* Status dot */}
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background shadow-sm',
                dotColor,
              )}
            />
          </div>
          {/* Name & specialty */}
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold leading-tight tracking-tight transition-colors duration-200 group-hover:text-primary">
              {name}
            </h3>
            <p className="truncate text-sm text-muted-foreground">
              {specialty || 'Técnico general'}
            </p>
          </div>
        </div>
        <WorkStatusBadge status={loadState} variant="sm" />
      </div>

      {/* Stats pills */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 rounded-xl bg-muted/40 px-3 py-2.5 transition-colors duration-200 group-hover:bg-muted/60">
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Activos</span>
          </div>
          <span className="text-2xl font-bold leading-none tracking-tight">{activeJobs}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-muted/40 px-3 py-2.5 transition-colors duration-200 group-hover:bg-muted/60">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Este mes</span>
          </div>
          <span className="text-2xl font-bold leading-none tracking-tight">{completedThisMonth}</span>
        </div>
      </div>

      {/* Rating + total */}
      <div className="flex items-center justify-between text-sm">
        {rating !== undefined ? (
          <div className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-1">
            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
            <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
              {rating.toFixed(1)}
            </span>
          </div>
        ) : (
          <span />
        )}
        <span className="text-xs text-muted-foreground">
          <span className="font-bold text-foreground">{totalCompleted}</span> históricos
        </span>
      </div>

      {/* Workload bar */}
      <div className="space-y-1.5 rounded-xl bg-muted/20 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Carga</span>
          <span className={cn('font-bold tabular-nums', workloadPercentage > 80 ? 'text-red-600' : workloadPercentage > 50 ? 'text-amber-600' : 'text-foreground')}>
            {workloadPercentage}%
          </span>
        </div>
        <Progress
          value={workloadPercentage}
          className="h-1.5 bg-muted-foreground/10"
          indicatorClassName={progressColor(workloadPercentage)}
        />
      </div>

      {/* CTA */}
      <Button
        variant="ghost"
        className="group/btn w-full justify-between border border-border/50 bg-background/50 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        onClick={(e) => {
          e.stopPropagation()
          router.push(`/dashboard/repairs/technicians/${id}`)
        }}
      >
        <span className="text-sm font-medium">Ver perfil</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
      </Button>
    </div>
  )
})
