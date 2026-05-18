'use client'

import { useMemo } from 'react'
import { AlertTriangle, PackageCheck, PauseCircle, UserMinus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { statusConfig } from '@/config/repair-constants'
import { cn } from '@/lib/utils'
import { Repair, RepairStatus } from '@/types/repairs'

interface RepairOperationsOverviewProps {
  repairs: Repair[]
  filteredCount: number
  selectedBranchName?: string | null
  statusFilter?: RepairStatus | 'all'
  onStatusFilterSelect?: (status: RepairStatus | 'all') => void
}

const STATUS_ORDER: RepairStatus[] = [
  'recibido',
  'diagnostico',
  'reparacion',
  'pausado',
  'listo',
  'entregado',
  'cancelado',
]

function getAgeInDays(dateValue?: string | null) {
  if (!dateValue) return 0
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return 0
  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function RepairOperationsOverview({
  repairs,
  filteredCount,
  selectedBranchName,
  statusFilter = 'all',
  onStatusFilterSelect,
}: RepairOperationsOverviewProps) {
  const summary = useMemo(() => {
    const activeRepairs = repairs.filter((repair) => repair.status !== 'entregado' && repair.status !== 'cancelado')
    const readyRepairs = repairs.filter((repair) => repair.status === 'listo')
    const pausedRepairs = repairs.filter((repair) => repair.status === 'pausado')
    const urgentRepairs = activeRepairs.filter((repair) => repair.urgency === 'urgent')
    const unassignedRepairs = activeRepairs.filter((repair) => !repair.technician?.id)

    const priorityQueue = [...activeRepairs]
      .sort((left, right) => {
        const urgencyDelta = Number(right.urgency === 'urgent') - Number(left.urgency === 'urgent')
        if (urgencyDelta !== 0) return urgencyDelta

        const readyDelta = Number(right.status === 'listo') - Number(left.status === 'listo')
        if (readyDelta !== 0) return readyDelta

        const priorityScore = { high: 3, medium: 2, low: 1 }
        const priorityDelta = priorityScore[right.priority] - priorityScore[left.priority]
        if (priorityDelta !== 0) return priorityDelta

        return getAgeInDays(right.createdAt) - getAgeInDays(left.createdAt)
      })
      .slice(0, 3)

    const technicianLoadMap = new Map<string, { id: string; name: string; activeJobs: number }>()

    for (const repair of activeRepairs) {
      const technicianId = repair.technician?.id || 'unassigned'
      const technicianName = repair.technician?.name || 'Sin asignar'
      const current = technicianLoadMap.get(technicianId) || {
        id: technicianId,
        name: technicianName,
        activeJobs: 0,
      }

      current.activeJobs += 1
      technicianLoadMap.set(technicianId, current)
    }

    const technicianLoad = [...technicianLoadMap.values()]
      .sort((left, right) => right.activeJobs - left.activeJobs)
      .slice(0, 3)

    const statusBreakdown = STATUS_ORDER.map((status) => ({
      status,
      count: repairs.filter((repair) => repair.status === status).length,
    }))

    return {
      activeRepairs,
      readyRepairs,
      pausedRepairs,
      urgentRepairs,
      unassignedRepairs,
      priorityQueue,
      technicianLoad,
      statusBreakdown,
    }
  }, [repairs])

  const signalCards = [
    {
      label: 'Urgentes',
      value: summary.urgentRepairs.length,
      helper: 'Conviene verlas primero',
      icon: AlertTriangle,
      tone:
        'border-red-200/80 bg-red-50/80 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100',
    },
    {
      label: 'Sin tecnico',
      value: summary.unassignedRepairs.length,
      helper: 'Todavia no tienen responsable',
      icon: UserMinus,
      tone:
        'border-amber-200/80 bg-amber-50/80 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100',
    },
    {
      label: 'Listas',
      value: summary.readyRepairs.length,
      helper: 'Se pueden entregar',
      icon: PackageCheck,
      tone:
        'border-emerald-200/80 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100',
    },
    {
      label: 'En pausa',
      value: summary.pausedRepairs.length,
      helper: 'Esperan piezas o respuesta',
      icon: PauseCircle,
      tone:
        'border-violet-200/80 bg-violet-50/80 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100',
    },
  ] as const

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
      <Card className="overflow-hidden border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
        <CardHeader className="border-b border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-cyan-950/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Que revisar hoy</CardTitle>
              <CardDescription className="mt-1">
                Un resumen simple para ver que necesita atencion
                {selectedBranchName ? ` en ${selectedBranchName}` : ''}.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-slate-300 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
            >
              {filteredCount} visibles
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {signalCards.map((signal) => {
              const Icon = signal.icon
              return (
                <div key={signal.label} className={cn('rounded-2xl border p-4 shadow-sm', signal.tone)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">{signal.label}</p>
                      <p className="mt-2 text-3xl font-semibold tabular-nums">{signal.value}</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 p-2.5 shadow-sm dark:bg-slate-900/60">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm opacity-80">{signal.helper}</p>
                </div>
              )
            })}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Estado de las reparaciones</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Puedes tocar un estado para ver solo esa parte del trabajo.
                </p>
              </div>
              {statusFilter !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => onStatusFilterSelect?.('all')}
                >
                  Ver todo
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {summary.statusBreakdown.map(({ status, count }) => {
                const config = statusConfig[status]
                const isActive = statusFilter === status

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onStatusFilterSelect?.(status)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-cyan-400 dark:bg-cyan-400/20 dark:text-cyan-50'
                        : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200'
                    )}
                  >
                    <span className="font-medium">{config.label}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', isActive ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-800')}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
        <CardHeader className="border-b border-slate-200/70 dark:border-slate-800/80">
          <CardTitle className="text-base">Para empezar rapido</CardTitle>
          <CardDescription>Lo mas importante para revisar primero y quien tiene mas trabajo.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mirar primero</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estos equipos merecen atencion antes que el resto.
              </p>
            </div>

            {summary.priorityQueue.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No hay reparaciones activas en esta vista.
              </div>
            ) : (
              summary.priorityQueue.map((repair) => (
                <div
                  key={repair.id}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-900/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {repair.customer.name}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {repair.device}
                      </p>
                    </div>
                    <Badge className={cn('rounded-full border px-2 py-0.5 text-[10px]', statusConfig[repair.status].color)}>
                      {statusConfig[repair.status].label}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{repair.issue}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Abierta hace {Math.max(1, Math.round(getAgeInDays(repair.createdAt)))} dias
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tecnicos ocupados</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ayuda a ver si alguien necesita apoyo.
              </p>
            </div>

            {summary.technicianLoad.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Todavia no hay tecnicos con trabajo activo visible.
              </div>
            ) : (
              summary.technicianLoad.map((technician) => (
                <div
                  key={technician.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 p-3 dark:border-slate-800/80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {technician.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {technician.activeJobs} reparaciones en curso
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                    {technician.activeJobs} activas
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
