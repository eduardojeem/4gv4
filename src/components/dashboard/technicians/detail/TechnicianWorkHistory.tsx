'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Repair } from '@/types/repairs'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClipboardList, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { resolveRepairStatus } from '@/lib/constants/repair-status'
import { formatCurrency } from '@/lib/currency'
import { commissionableAmount, type CompensationConfig } from '@/lib/technician/earnings'

interface TechnicianWorkHistoryProps {
  repairs: Repair[]
  /** Config de compensación del técnico (para mostrar la ganancia por reparación). */
  compensation?: CompensationConfig
}

/** Ganancia del técnico en una reparación cerrada, según su compensación. */
function repairEarning(config: CompensationConfig, repair: Repair, status: string) {
  const earns =
    status !== 'cancelado' &&
    (config.accrual_status === 'entregado'
      ? status === 'entregado'
      : status === 'listo' || status === 'entregado')

  if (!earns) return { earns: false as const, commission: 0, fixed: 0, total: 0 }

  const commission =
    commissionableAmount(config, {
      labor_cost: repair.laborCost,
      final_cost: repair.finalCost,
      estimated_cost: repair.estimatedCost,
    }) * (config.commission_rate / 100)
  const fixed = config.fixed_per_repair
  return { earns: true as const, commission, fixed, total: commission + fixed }
}

const INITIAL_VISIBLE_ROWS = 25

const statusConfig: Record<string, { label: string; color: string }> = {
  listo: { label: 'Listo', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  entregado: { label: 'Entregado', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const STATUS_FALLBACK = { label: 'Sin estado', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }

export function TechnicianWorkHistory({ repairs, compensation }: TechnicianWorkHistoryProps) {
  const router = useRouter()
  const [visibleRows, setVisibleRows] = useState(INITIAL_VISIBLE_ROWS)

  // Mostramos la columna de ganancia solo si hay comisión o pago fijo configurado.
  const showEarnings = !!compensation && (compensation.commission_rate > 0 || compensation.fixed_per_repair > 0)

  const sortedRepairs = useMemo(() => {
    return [...repairs].sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return dateB - dateA
    })
  }, [repairs])

  const visibleRepairs = useMemo(() => {
    return sortedRepairs.slice(0, visibleRows)
  }, [sortedRepairs, visibleRows])

  if (repairs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Historial de trabajos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Sin trabajos completados</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando este técnico complete reparaciones aparecerán aquí.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Historial de trabajos
            <Badge variant="secondary" className="ml-1">{repairs.length}</Badge>
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            Mostrando {visibleRepairs.length} de {sortedRepairs.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead className="hidden md:table-cell">Problema</TableHead>
                <TableHead className="hidden sm:table-cell">Inicio</TableHead>
                <TableHead className="hidden sm:table-cell">Fin</TableHead>
                <TableHead className="hidden lg:table-cell">Duración</TableHead>
                {showEarnings && <TableHead className="text-right">Ganancia</TableHead>}
                <TableHead>Estado</TableHead>
                <TableHead className="w-[60px] text-right">Ver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRepairs.map((repair) => {
                const startDate = new Date(repair.createdAt)
                const endDate = repair.completedAt ? new Date(repair.completedAt) : null
                const duration = endDate
                  ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                  : null
                const resolvedStatus = resolveRepairStatus(repair)
                const statusInfo = statusConfig[resolvedStatus] ?? STATUS_FALLBACK

                return (
                  <TableRow key={repair.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {repair.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {repair.customer.name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {repair.device}
                        <div className="text-xs text-muted-foreground">
                          {repair.brand} {repair.model}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-[180px] truncate md:table-cell">
                      {repair.issue}
                    </TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">
                      {format(startDate, 'dd/MM/yy', { locale: es })}
                    </TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">
                      {endDate ? format(endDate, 'dd/MM/yy', { locale: es }) : '—'}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {duration !== null ? `${duration}d` : '—'}
                    </TableCell>
                    {showEarnings && compensation && (() => {
                      const earning = repairEarning(compensation, repair, resolvedStatus)
                      const parts: string[] = []
                      if (earning.fixed > 0) parts.push('Fijo')
                      if (earning.commission > 0) parts.push('Comisión')
                      return (
                        <TableCell className="text-right">
                          {earning.earns ? (
                            <div className="flex flex-col items-end">
                              <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                {formatCurrency(earning.total)}
                              </span>
                              {parts.length > 0 && (
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  {parts.join(' + ')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pendiente</span>
                          )}
                        </TableCell>
                      )
                    })()}
                    <TableCell>
                      <Badge variant="outline" className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/repairs?id=${repair.id}&edit=true`)}
                        aria-label={`Ver reparación ${repair.id.slice(0, 8)}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {visibleRows < sortedRepairs.length && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleRows((current) => current + INITIAL_VISIBLE_ROWS)}
            >
              Mostrar más ({sortedRepairs.length - visibleRows} restantes)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
