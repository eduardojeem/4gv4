'use client'

import { useMemo, useState, useEffect } from 'react'
import { AlertTriangle, PackageCheck, PauseCircle, UserMinus, ChevronDown, ChevronUp, Activity, Sparkles } from 'lucide-react'
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
  defaultExpanded?: boolean
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

const OVERVIEW_EXPANDED_KEY = '4g_repairs_overview_expanded'

export function RepairOperationsOverview({
  repairs,
  filteredCount,
  selectedBranchName,
  statusFilter = 'all',
  onStatusFilterSelect,
  defaultExpanded = false,
}: RepairOperationsOverviewProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(OVERVIEW_EXPANDED_KEY)
      if (saved !== null) {
        setIsExpanded(saved === 'true')
      }
    } catch {}
  }, [])

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev
      try {
        localStorage.setItem(OVERVIEW_EXPANDED_KEY, next ? 'true' : 'false')
      } catch {}
      return next
    })
  }

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
      badgeTone: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
    },
    {
      label: 'Sin técnico',
      value: summary.unassignedRepairs.length,
      helper: 'Todavía no tienen responsable',
      icon: UserMinus,
      tone:
        'border-amber-200/80 bg-amber-50/80 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100',
      badgeTone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    },
    {
      label: 'Listas',
      value: summary.readyRepairs.length,
      helper: 'Se pueden entregar',
      icon: PackageCheck,
      tone:
        'border-emerald-200/80 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100',
      badgeTone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    },
    {
      label: 'En pausa',
      value: summary.pausedRepairs.length,
      helper: 'Esperan piezas o respuesta',
      icon: PauseCircle,
      tone:
        'border-violet-200/80 bg-violet-50/80 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100',
      badgeTone: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    },
  ] as const

  return (
    <div className="space-y-3">
      {/* Barra de Resumen Compacta Superior (Siempre Visible) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:px-4 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-gradient-to-r from-slate-50 via-white to-amber-50/40 dark:from-slate-950/90 dark:via-slate-900/70 dark:to-amber-950/20 shadow-xs backdrop-blur-md transition-all">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs">
              <Activity className="h-4 w-4" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
              Qué revisar hoy:
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {signalCards.map((s) => {
              const Icon = s.icon
              return (
                <span
                  key={s.label}
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all",
                    s.badgeTone,
                    s.value > 0 ? "opacity-100" : "opacity-60"
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span>{s.value}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </span>
              )
            })}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleExpanded}
          className="h-7 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 gap-1.5 self-end sm:self-auto rounded-xl"
        >
          <span>{isExpanded ? 'Plegar' : 'Ver detalle'}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Panel Detallado Expandible */}
      {isExpanded && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] animate-in fade-in-50 duration-200">
          <Card className="overflow-hidden border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
            <CardHeader className="border-b border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-cyan-950/20 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold">Resumen de Atención Diaria</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Indicadores operacionales que requieren acción
                    {selectedBranchName ? ` en ${selectedBranchName}` : ''}.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="rounded-full border-slate-300 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                >
                  {filteredCount} visibles
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {signalCards.map((signal) => {
                  const Icon = signal.icon
                  return (
                    <div key={signal.label} className={cn('rounded-xl border p-3 shadow-xs', signal.tone)}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{signal.label}</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums">{signal.value}</p>
                        </div>
                        <div className="rounded-xl bg-white/70 p-2 shadow-xs dark:bg-slate-900/60">
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs opacity-80">{signal.helper}</p>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Filtrar rápidamente por Estado</h3>
                  </div>
                  {statusFilter !== 'all' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 rounded-full px-2 text-[11px]"
                      onClick={() => onStatusFilterSelect?.('all')}
                    >
                      Ver todo
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {summary.statusBreakdown.map(({ status, count }) => {
                    const config = statusConfig[status]
                    const isActive = statusFilter === status

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => onStatusFilterSelect?.(status)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                          isActive
                            ? 'border-slate-900 bg-slate-900 text-white dark:border-cyan-400 dark:bg-cyan-400/20 dark:text-cyan-50'
                            : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200'
                        )}
                      >
                        <span className="font-medium">{config.label}</span>
                        <span className={cn('rounded-full px-1.5 py-0.2 text-[10px]', isActive ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-800')}>
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
            <CardHeader className="border-b border-slate-200/70 dark:border-slate-800/80 py-3.5">
              <CardTitle className="text-base font-bold">Para empezar rápido</CardTitle>
              <CardDescription className="text-xs">Prioridades y técnicos con mayor carga.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Atención urgente</h3>

                {summary.priorityQueue.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 text-center">
                    No hay reparaciones activas en esta vista.
                  </div>
                ) : (
                  summary.priorityQueue.map((repair) => (
                    <div
                      key={repair.id}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 dark:border-slate-800/80 dark:bg-slate-900/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {repair.customer.name}
                          </p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {repair.device}
                          </p>
                        </div>
                        <Badge className={cn('rounded-full border px-1.5 py-0 text-[9px]', statusConfig[repair.status].color)}>
                          {statusConfig[repair.status].label}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-600 dark:text-slate-300">{repair.issue}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Carga por Técnico</h3>

                {summary.technicianLoad.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 text-center">
                    Sin técnicos con trabajo asignado.
                  </div>
                ) : (
                  summary.technicianLoad.map((technician) => (
                    <div
                      key={technician.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 p-2 dark:border-slate-800/80 text-xs"
                    >
                      <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {technician.name}
                      </span>
                      <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                        {technician.activeJobs} activas
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
