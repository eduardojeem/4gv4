'use client'

import { memo, useMemo } from 'react'
import { AlertTriangle, PackageCheck, TimerReset, UserRoundMinus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Repair } from '@/types/repairs'
import { cn } from '@/lib/utils'

interface RepairStatsProps {
  repairs: Repair[]
  visibleCount?: number
}

function StatCard({
  title,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  title: string
  value: string | number
  helper: string
  tone: string
  icon: React.ElementType
}) {
  return (
    <Card className={cn('gap-0 overflow-hidden border p-0 shadow-sm', tone)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{title}</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="text-sm opacity-75">{helper}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-2.5 shadow-sm dark:bg-slate-950/40">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

export const RepairStats = memo(function RepairStats({ repairs, visibleCount }: RepairStatsProps) {
  const stats = useMemo(() => {
    const active = repairs.filter((repair) => repair.status !== 'entregado' && repair.status !== 'cancelado')
    const urgent = active.filter((repair) => repair.urgency === 'urgent')
    const ready = repairs.filter((repair) => repair.status === 'listo')
    const unassigned = active.filter((repair) => !repair.technician?.id)

    return {
      active: active.length,
      urgent: urgent.length,
      ready: ready.length,
      unassigned: unassigned.length,
    }
  }, [repairs])

  const statCards = [
    {
      title: 'En proceso',
      value: stats.active,
      helper: `${visibleCount ?? repairs.length} visibles en esta vista`,
      icon: TimerReset,
      tone:
        'border-slate-200/80 bg-white text-slate-950 dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-50',
    },
    {
      title: 'Urgentes',
      value: stats.urgent,
      helper: 'Casos para mirar primero',
      icon: AlertTriangle,
      tone:
        'border-red-200/80 bg-red-50/80 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-50',
    },
    {
      title: 'Listas',
      value: stats.ready,
      helper: 'Equipos que ya se pueden entregar',
      icon: PackageCheck,
      tone:
        'border-emerald-200/80 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-50',
    },
    {
      title: 'Sin tecnico',
      value: stats.unassigned,
      helper: 'Todavia no tienen responsable',
      icon: UserRoundMinus,
      tone:
        'border-amber-200/80 bg-amber-50/80 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-50',
    },
  ] as const

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {statCards.map((card) => (
        <StatCard
          key={card.title}
          title={card.title}
          value={card.value}
          helper={card.helper}
          icon={card.icon}
          tone={card.tone}
        />
      ))}
    </div>
  )
})
