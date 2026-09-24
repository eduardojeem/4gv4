'use client'

import { useMemo, useState } from 'react'
import {
  PackageCheck,
  PauseCircle,
  UserMinus,
  ChevronDown,
  ChevronUp,
  Activity,
  Flame,
  Users,
  Smartphone,
  CheckCircle2, RotateCcw
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

export function RepairOperationsOverview({
  repairs,
  filteredCount,
  selectedBranchName,
  statusFilter = 'all',
  onStatusFilterSelect,
  defaultExpanded = false,
}: RepairOperationsOverviewProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded)

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev)
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
      .slice(0, 4)

    const maxTechnicianJobs = Math.max(1, ...technicianLoad.map((t) => t.activeJobs))

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
      maxTechnicianJobs,
      statusBreakdown,
    }
  }, [repairs])

  const signalCards = [
    {
      id: 'urgent',
      label: 'Urgentes',
      value: summary.urgentRepairs.length,
      helper: 'Prioridad alta de hoy',
      icon: Flame,
      color: 'rose',
      borderClass: 'border-rose-200 dark:border-rose-900/50 hover:border-rose-400 dark:hover:border-rose-700',
      bgClass: 'bg-rose-50/50 dark:bg-rose-950/20',
      iconBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
      textClass: 'text-rose-950 dark:text-rose-100',
      statusTarget: null,
    },
    {
      id: 'unassigned',
      label: 'Sin Técnico',
      value: summary.unassignedRepairs.length,
      helper: 'Requieren responsable',
      icon: UserMinus,
      color: 'amber',
      borderClass: 'border-amber-200 dark:border-amber-900/50 hover:border-amber-400 dark:hover:border-amber-700',
      bgClass: 'bg-amber-50/50 dark:bg-amber-950/20',
      iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
      textClass: 'text-amber-950 dark:text-amber-100',
      statusTarget: null,
    },
    {
      id: 'ready',
      label: 'Listas para Entrega',
      value: summary.readyRepairs.length,
      helper: 'Listas para cobro o retiro',
      icon: PackageCheck,
      color: 'emerald',
      borderClass: 'border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400 dark:hover:border-emerald-700',
      bgClass: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
      textClass: 'text-emerald-950 dark:text-emerald-100',
      statusTarget: 'listo' as RepairStatus,
    },
    {
      id: 'paused',
      label: 'En Pausa / Espera',
      value: summary.pausedRepairs.length,
      helper: 'Esperan repuesto o cliente',
      icon: PauseCircle,
      color: 'violet',
      borderClass: 'border-violet-200 dark:border-violet-900/50 hover:border-violet-400 dark:hover:border-violet-700',
      bgClass: 'bg-violet-50/50 dark:bg-violet-950/20',
      iconBg: 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300',
      textClass: 'text-violet-950 dark:text-violet-100',
      statusTarget: 'pausado' as RepairStatus,
    },
  ] as const

  const handleCardClick = (statusTarget: RepairStatus | null) => {
    if (!statusTarget || !onStatusFilterSelect) return
    if (statusFilter === statusTarget) {
      onStatusFilterSelect('all')
    } else {
      onStatusFilterSelect(statusTarget)
    }
  }

  return (
    <Card className="overflow-hidden border border-border/80 bg-card/95 shadow-2xs transition-all duration-200">
      {/* Cabecera Principal Ultra-Compacta */}
      <div className={cn("bg-gradient-to-r from-muted/40 via-background to-muted/20 px-3 py-1.5 sm:px-4 sm:py-1.5 transition-all", isExpanded ? "border-b border-border/60" : "")}>
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2.5">
          {/* Lado Izquierdo: Ícono micro, Título, Sucursal y Contador */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-tr from-amber-500 via-orange-500 to-cyan-600 text-white shadow-2xs">
              <Activity className="h-3 w-3" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-foreground truncate">
                Resumen de Atención Diaria
              </h2>
              {selectedBranchName && (
                <Badge variant="outline" className="text-[9px] font-medium rounded px-1 py-0 shrink-0">
                  {selectedBranchName}
                </Badge>
              )}
              <span className="text-[11px] text-muted-foreground font-normal truncate">
                · {filteredCount} de {repairs.length} órdenes visibles
              </span>
            </div>
          </div>

          {/* Centro / Chips interactivos compactos */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {signalCards.map((signal) => {
              const Icon = signal.icon
              const isFilterActive = signal.statusTarget && statusFilter === signal.statusTarget
              const isClickable = Boolean(signal.statusTarget && onStatusFilterSelect)

              return (
                <button
                  key={signal.id}
                  type="button"
                  onClick={() => handleCardClick(signal.statusTarget)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all shadow-2xs',
                    signal.borderClass,
                    signal.bgClass,
                    isFilterActive ? 'ring-2 ring-primary ring-offset-1 font-bold' : '',
                    isClickable ? 'hover:scale-[1.02] cursor-pointer' : 'cursor-default'
                  )}
                  title={signal.helper}
                >
                  <Icon className={cn('h-3 w-3 shrink-0', signal.textClass)} />
                  <span className={cn('font-bold tabular-nums', signal.textClass)}>{signal.value}</span>
                  <span className="text-muted-foreground">{signal.label}</span>
                </button>
              )
            })}
          </div>

          {/* Lado Derecho: Acción de Plegar / Ver Detalle */}
          <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
            {statusFilter !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStatusFilterSelect?.('all')}
                className="h-6.5 gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                title="Limpiar filtro de estado"
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">Restablecer</span>
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={toggleExpanded}
              className={cn(
                "h-6.5 gap-1 rounded-md px-2.5 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer",
                isExpanded
                  ? "border border-cyan-700 bg-cyan-700 text-white hover:bg-cyan-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 ring-2 ring-cyan-500/20 shadow-sm"
                  : "border border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 ring-2 ring-cyan-500/20 shadow-sm"
              )}
            >
              <span>{isExpanded ? 'Plegar detalles' : 'Ver detalle'}</span>
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <CardContent className="space-y-4 p-4 sm:p-5 animate-in fade-in-50 duration-200">
        {/* 4 Métricas Clave de Atención Operativa */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {signalCards.map((signal) => {
            const Icon = signal.icon
            const isFilterActive = signal.statusTarget && statusFilter === signal.statusTarget
            const isClickable = Boolean(signal.statusTarget && onStatusFilterSelect)

            return (
              <div
                key={signal.id}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={() => handleCardClick(signal.statusTarget)}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    handleCardClick(signal.statusTarget)
                  }
                }}
                className={cn(
                  'group relative overflow-hidden rounded-xl border p-3.5 transition-all duration-200',
                  signal.borderClass,
                  signal.bgClass,
                  isClickable ? 'cursor-pointer hover:shadow-xs hover:scale-[1.01]' : '',
                  isFilterActive ? 'ring-2 ring-primary ring-offset-1 bg-background shadow-xs' : ''
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      {signal.label}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className={cn('text-2xl font-black tabular-nums tracking-tight', signal.textClass)}>
                        {signal.value}
                      </span>
                      {isFilterActive && (
                        <Badge className="h-4 px-1 text-[9px] font-bold bg-primary text-primary-foreground">
                          Filtro activo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-2xs transition-transform group-hover:scale-105', signal.iconBg)}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground font-medium flex items-center justify-between">
                  <span>{signal.helper}</span>
                  {isClickable && (
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-primary">
                      {isFilterActive ? 'Quitar filtro' : 'Filtrar'}
                    </span>
                  )}
                </p>
              </div>
            )
          })}
        </div>

        {/* Flujo de Estados / Filtros de Pipeline */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-600 dark:bg-cyan-400" />
              Flujo de órdenes por estado
            </span>
            {statusFilter !== 'all' && (
              <span className="text-[11px] text-muted-foreground">
                Filtrando por: <strong>{statusConfig[statusFilter]?.label || statusFilter}</strong>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onStatusFilterSelect?.('all')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                statusFilter === 'all'
                  ? 'bg-foreground text-background shadow-2xs'
                  : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border/70'
              )}
            >
              <span>Todos</span>
              <span className={cn('rounded-md px-1.5 py-0.2 text-[10px] font-mono', statusFilter === 'all' ? 'bg-background/20 text-background' : 'bg-muted text-foreground')}>
                {repairs.length}
              </span>
            </button>

            {summary.statusBreakdown.map(({ status, count }) => {
              const config = statusConfig[status]
              const isActive = statusFilter === status
              const Icon = config.icon

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onStatusFilterSelect?.(status)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                    isActive
                      ? 'bg-foreground text-background font-semibold shadow-2xs ring-1 ring-foreground/20'
                      : 'bg-background hover:bg-muted text-foreground/80 hover:text-foreground border border-border/60'
                  )}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      isActive ? 'bg-background' : config.bgColor || 'bg-slate-400'
                    )}
                  />
                  <span>{config.label}</span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.2 text-[10px] font-mono tabular-nums',
                      isActive ? 'bg-background/20 text-background font-bold' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

          {/* Sección de Detalle Operativo: Cola y Carga por Técnico */}
          <div className="grid gap-4 lg:grid-cols-2 pt-2 border-t border-border/60">
            {/* Cola de Atención Prioritaria */}
            <div className="space-y-2.5 rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                <div className="flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Cola de Atención Prioritaria
                  </h3>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">Próximos a atender</span>
              </div>

              {summary.priorityQueue.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground bg-muted/10">
                  <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-600 opacity-60" />
                  No hay reparaciones pendientes con prioridad urgente.
                </div>
              ) : (
                <div className="space-y-2">
                  {summary.priorityQueue.map((repair) => (
                    <div
                      key={repair.id}
                      className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{repair.customer.name}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                            <Smartphone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{repair.brand} {repair.model}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {repair.urgency === 'urgent' && (
                            <Badge className="rounded-md bg-rose-600 text-white text-[9px] px-1 py-0">
                              Urgente
                            </Badge>
                          )}
                          <Badge className={cn('rounded-md px-1.5 py-0 text-[10px] border', statusConfig[repair.status]?.color)}>
                            {statusConfig[repair.status]?.label}
                          </Badge>
                        </div>
                      </div>
                      {repair.issue && (
                        <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-1 border-t border-border/40 pt-1">
                          <strong className="text-foreground/70">Falla:</strong> {repair.issue}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Carga de Trabajo por Técnico */}
            <div className="space-y-2.5 rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Carga de Trabajo por Técnico
                  </h3>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">Distribución en taller</span>
              </div>

              {summary.technicianLoad.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground bg-muted/10">
                  Sin técnicos asignados actualmente en trabajos activos.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {summary.technicianLoad.map((tech) => {
                    const percentage = Math.round((tech.activeJobs / summary.maxTechnicianJobs) * 100)
                    const isOverloaded = tech.activeJobs >= 4

                    return (
                      <div key={tech.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground truncate">{tech.name}</span>
                          <span className="font-mono text-[11px] font-bold tabular-nums text-muted-foreground">
                            {tech.activeJobs} {tech.activeJobs === 1 ? 'orden activa' : 'órdenes activas'}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-300',
                              isOverloaded ? 'bg-amber-500' : 'bg-cyan-600'
                            )}
                            style={{ width: `${Math.max(8, percentage)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
