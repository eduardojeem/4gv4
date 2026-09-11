'use client'

import React, { memo, useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  Clock,
  Eye,
  Key,
  Laptop,
  Lock,
  MessageCircle,
  PackageCheck,
  Phone,
  Search,
  Shield,
  Smartphone,
  Tablet,
  Wrench,
  CheckCircle2,
  PauseCircle,
  ShieldAlert,
} from 'lucide-react'
import type { Repair, RepairStatus } from '@/types/repairs'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { getWarrantyStatus } from '@/lib/warranty-utils'

interface TechnicianListViewProps {
  repairs: Repair[]
  onView: (repair: Repair) => void
  onEdit: (repair: Repair) => void
  onDeliver?: (repair: Repair) => void
  onStatusChange?: (id: string, status: RepairStatus) => void
  onClaimWarranty?: (repair: Repair) => void
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  recibido: {
    label: 'Recibido',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: Clock,
  },
  diagnostico: {
    label: 'En Diagnóstico',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    icon: Search,
  },
  reparacion: {
    label: 'En Reparación',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    icon: Wrench,
  },
  pausado: {
    label: 'Pausado',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    icon: PauseCircle,
  },
  listo: {
    label: 'Listo para Entrega',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    icon: CheckCircle2,
  },
  entregado: {
    label: 'Entregado',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
    icon: PackageCheck,
  },
  cancelado: {
    label: 'Cancelado',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    icon: AlertCircle,
  },
}

function getDeviceIcon(type?: string) {
  switch (type) {
    case 'smartphone':
      return Smartphone
    case 'tablet':
      return Tablet
    case 'laptop':
    case 'desktop':
      return Laptop
    default:
      return Smartphone
  }
}

/** Determina si una reparación entregada califica para garantía activa */
function checkWarrantyEligibility(repair: Repair): {
  isEligible: boolean
  label: string
  status: 'active' | 'expiring' | 'expired' | 'none'
} {
  const ws = getWarrantyStatus(repair.warrantyExpiresAt)
  if (ws === 'active' || ws === 'expiring') {
    return {
      isEligible: true,
      label: ws === 'expiring' ? 'Garantía por vencer' : 'Garantía activa',
      status: ws,
    }
  }

  // Si no tiene fecha explícita pero tiene meses de garantía y fue entregado
  if (repair.warrantyMonths && repair.warrantyMonths > 0 && ws !== 'expired') {
    return {
      isEligible: true,
      label: `${repair.warrantyMonths} m. de garantía`,
      status: 'active',
    }
  }

  if (ws === 'expired') {
    return { isEligible: false, label: 'Garantía vencida', status: 'expired' }
  }

  return { isEligible: false, label: 'Sin garantía', status: 'none' }
}

export const TechnicianListView = memo<TechnicianListViewProps>(
  function TechnicianListView({
    repairs,
    onView,
    onEdit,
    onDeliver,
    onStatusChange,
    onClaimWarranty,
  }) {
    const [subFilter, setSubFilter] = useState<string>('all')
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [pageSize, setPageSize] = useState<number>(20)

    // Reset page to 1 on subFilter change
    const handleSubFilterChange = (tabId: string) => {
      setSubFilter(tabId)
      setCurrentPage(1)
    }

    // Filter by internal status tab
    const filteredBySub = useMemo(() => {
      if (subFilter === 'all') return repairs
      if (subFilter === 'urgent') {
        return repairs.filter(
          r => r.urgency === 'urgent' && r.status !== 'entregado' && r.status !== 'cancelado'
        )
      }
      return repairs.filter(r => r.status === subFilter || r.dbStatus === subFilter)
    }, [repairs, subFilter])

    const totalPages = Math.max(1, Math.ceil(filteredBySub.length / pageSize))
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)

    // Slice for 20 items per page pagination
    const paginatedRepairs = useMemo(() => {
      const start = (safeCurrentPage - 1) * pageSize
      return filteredBySub.slice(start, start + pageSize)
    }, [filteredBySub, safeCurrentPage, pageSize])

    // Quick counts for tabs
    const counts = useMemo(() => {
      const total = repairs.length
      const recibidos = repairs.filter(r => (r.dbStatus || r.status) === 'recibido').length
      const diagnostico = repairs.filter(r => (r.dbStatus || r.status) === 'diagnostico').length
      const reparacion = repairs.filter(r => (r.dbStatus || r.status) === 'reparacion').length
      const pausados = repairs.filter(r => (r.dbStatus || r.status) === 'pausado').length
      const listos = repairs.filter(r => (r.dbStatus || r.status) === 'listo').length
      const entregados = repairs.filter(r => (r.dbStatus || r.status) === 'entregado').length
      const urgentes = repairs.filter(
        r => r.urgency === 'urgent' && r.status !== 'entregado' && r.status !== 'cancelado'
      ).length
      return { total, recibidos, diagnostico, reparacion, pausados, listos, entregados, urgentes }
    }, [repairs])

    if (repairs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/30 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
            <Wrench className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
            Sin reparaciones asignadas
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            No se encontraron equipos con los filtros activos. Cambia el criterio de búsqueda o revisa tus filtros.
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {/* Status Quick-Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'Todas', count: counts.total },
            { id: 'recibido', label: 'Recibidas', count: counts.recibidos },
            { id: 'diagnostico', label: 'En Diagnóstico', count: counts.diagnostico },
            { id: 'reparacion', label: 'En Reparación', count: counts.reparacion },
            { id: 'pausado', label: 'Pausadas', count: counts.pausados },
            { id: 'listo', label: 'Listas para entrega', count: counts.listos },
            { id: 'entregado', label: 'Entregadas', count: counts.entregados },
            ...(counts.urgentes > 0
              ? [{ id: 'urgent', label: '⚡ Urgentes', count: counts.urgentes, isUrgent: true }]
              : []),
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSubFilterChange(tab.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap',
                subFilter === tab.id
                  ? tab.isUrgent
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900'
                  : tab.isUrgent
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  subFilter === tab.id
                    ? 'bg-white/20 text-white dark:text-slate-900 dark:bg-slate-900/20'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Clean Responsive Table */}
        <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-2.5 pl-4 pr-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Ticket / Equipo
                  </TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Cliente & Contacto
                  </TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 min-w-[200px]">
                    Falla Declarada / Diagnóstico
                  </TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 text-center">
                    Prioridad
                  </TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 min-w-[190px]">
                    Estado Técnico
                  </TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Presupuesto
                  </TableHead>
                  <TableHead className="py-2.5 pl-2 pr-4 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBySub.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      No hay reparaciones en este estado específico.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRepairs.map(repair => {
                    const statusKey = (repair.dbStatus || repair.status || 'recibido').toLowerCase()
                    const isDelivered = statusKey === 'entregado'
                    const isCancelled = statusKey === 'cancelado'
                    const statusMeta = STATUS_CONFIG[statusKey] || STATUS_CONFIG.recibido
                    const DeviceIcon = getDeviceIcon(repair.deviceType)
                    const isUrgent = repair.urgency === 'urgent' && !isDelivered && !isCancelled
                    const warrantyInfo = checkWarrantyEligibility(repair)

                    const timeAgo = (() => {
                      try {
                        if (!repair.createdAt) return '—'
                        const d = new Date(repair.createdAt)
                        if (isNaN(d.getTime())) return '—'
                        return formatDistanceToNow(d, { addSuffix: true, locale: es })
                      } catch {
                        return '—'
                      }
                    })()

                    const cleanPhone = (repair.customer.phone || '').replace(/\D/g, '')

                    return (
                      <TableRow
                        key={repair.id}
                        onClick={() => onView(repair)}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-slate-50/90 even:bg-slate-50/40 dark:hover:bg-slate-800/50 dark:even:bg-slate-900/20',
                          isUrgent && 'bg-rose-50/20 dark:bg-rose-950/10'
                        )}
                      >
                        {/* Ticket & Dispositivo */}
                        <TableCell className="py-2.5 pl-4 pr-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                              <DeviceIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                                  {repair.ticketNumber || `#${repair.id.slice(0, 6)}`}
                                </span>
                                <span className="text-[10px] text-slate-400">· {timeAgo}</span>
                              </div>
                              <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate max-w-[160px]">
                                {repair.device || `${repair.brand || ''} ${repair.model || ''}`.trim() || 'Dispositivo'}
                              </p>

                              {/* Access / Unlock Key badge */}
                              {repair.accessPassword ? (
                                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 w-fit">
                                  <Key className="h-2.5 w-2.5 text-amber-600" />
                                  <span>Clave: {repair.accessPassword}</span>
                                </div>
                              ) : repair.accessType === 'pattern' ? (
                                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800 w-fit">
                                  <Lock className="h-2.5 w-2.5 text-purple-600" />
                                  <span>Con Patrón</span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>

                        {/* Cliente & Contacto */}
                        <TableCell className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                              {repair.customer.name}
                            </span>
                            {repair.customer.phone ? (
                              <div className="mt-0.5 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                <a
                                  href={`tel:${cleanPhone}`}
                                  className="text-[11px] text-slate-500 hover:text-slate-700 hover:underline flex items-center gap-1"
                                  title="Llamar al cliente"
                                >
                                  <Phone className="h-3 w-3 text-slate-400" />
                                  {repair.customer.phone}
                                </a>
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-600 hover:text-emerald-700"
                                  title="Abrir WhatsApp"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">Sin teléfono</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Problema / Diagnóstico */}
                        <TableCell className="px-3 py-2.5">
                          <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed max-w-xs">
                            {repair.issue || repair.description || 'Sin descripción de falla'}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                            {(repair.parts?.length ?? 0) > 0 && (
                              <span className="rounded bg-slate-100 px-1 py-0.2 font-medium dark:bg-slate-800">
                                {repair.parts?.length} repuesto{(repair.parts?.length ?? 0) !== 1 ? 's' : ''}
                              </span>
                            )}
                            {(repair.notes?.length ?? 0) > 0 && (
                              <span className="rounded bg-slate-100 px-1 py-0.2 font-medium dark:bg-slate-800">
                                {repair.notes?.length} nota{(repair.notes?.length ?? 0) !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Prioridad */}
                        <TableCell className="px-3 py-2.5 text-center whitespace-nowrap">
                          {isUrgent ? (
                            <Badge
                              variant="destructive"
                              className="gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-2xs animate-pulse"
                            >
                              <AlertCircle className="h-3 w-3" />
                              Urgente
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-slate-500 font-semibold px-2 py-0.5 border-slate-200 dark:border-slate-700"
                            >
                              Normal
                            </Badge>
                          )}
                        </TableCell>

                        {/* Estado Técnico (Validación Mejorada: Oculta opciones si fue entregado o permite procesar garantía) */}
                        <TableCell className="px-3 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {isDelivered ? (
                            /* Si ya fue entregado: NO mostrar opciones de retroceso arbitrario. Mostrar insignia + Opción de Garantía */
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="gap-1 bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 font-bold px-2 py-0.5 text-[11px]"
                                >
                                  <PackageCheck className="h-3 w-3 text-teal-600" />
                                  Entregado
                                </Badge>
                              </div>

                              {/* Opción de procesar garantía si cumple */}
                              {warrantyInfo.isEligible ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-fit gap-1 text-[10px] font-bold border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 px-2 shadow-2xs cursor-pointer"
                                  onClick={() => onClaimWarranty?.(repair)}
                                  title="Registrar reingreso por garantía para este equipo"
                                >
                                  <Shield className="h-3 w-3 text-amber-600" />
                                  Procesar Garantía
                                </Button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {warrantyInfo.label}
                                </span>
                              )}
                            </div>
                          ) : isCancelled ? (
                            /* Si está cancelado */
                            <Badge variant="outline" className="gap-1 bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-bold px-2 py-0.5">
                              <AlertCircle className="h-3 w-3" />
                              Cancelado
                            </Badge>
                          ) : onStatusChange ? (
                            /* En curso: opciones de progreso técnico controladas */
                            <Select
                              value={statusKey}
                              onValueChange={v => {
                                if (v === 'listo' && onDeliver) {
                                  // Cuando cambia a listo
                                  onStatusChange(repair.id, 'listo')
                                } else {
                                  onStatusChange(repair.id, v as RepairStatus)
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs font-bold border-slate-200/90 dark:border-slate-800 shadow-2xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="recibido">📥 Recibido</SelectItem>
                                <SelectItem value="diagnostico">🔬 En Diagnóstico</SelectItem>
                                <SelectItem value="reparacion">⚙️ En Reparación</SelectItem>
                                <SelectItem value="pausado">⏸️ Pausado / Repuesto</SelectItem>
                                <SelectItem value="listo">✅ Listo para Entrega</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={cn('gap-1 text-[11px] font-bold px-2 py-0.5', statusMeta.badgeClass)}>
                              {statusMeta.label}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Presupuesto */}
                        <TableCell className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                            {repair.finalCost
                              ? `Gs. ${Number(repair.finalCost).toLocaleString('es-PY')}`
                              : repair.estimatedCost
                              ? `Est: Gs. ${Number(repair.estimatedCost).toLocaleString('es-PY')}`
                              : 'Por cotizar'}
                          </div>
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                              title="Ver ficha completa de reparación"
                              onClick={() => onView(repair)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* Si está listo: Botón de Entrega */}
                            {onDeliver && statusKey === 'listo' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                title="Marcar como entregado al cliente"
                                onClick={() => onDeliver(repair)}
                              >
                                <PackageCheck className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Si fue entregado y tiene garantía: Acceso directo a garantía */}
                            {isDelivered && warrantyInfo.isEligible && onClaimWarranty && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                title="Procesar reingreso por garantía"
                                onClick={() => onClaimWarranty(repair)}
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                            )}

                            {!isDelivered && !isCancelled && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                title="Editar orden de trabajo"
                                onClick={() => onEdit(repair)}
                              >
                                <Wrench className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Table Footer Summary & Pagination */}
          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 px-4 py-3 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
              <div>
                Mostrando <strong className="text-slate-800 dark:text-slate-200">
                  {filteredBySub.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
                </strong> a{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {Math.min(safeCurrentPage * pageSize, filteredBySub.length)}
                </strong> de{' '}
                <strong className="text-slate-800 dark:text-slate-200">{filteredBySub.length}</strong> reparaciones
                {filteredBySub.length !== repairs.length && ` (filtradas de ${repairs.length} en total)`}
              </div>
              <div className="flex items-center gap-2">
                {counts.urgentes > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-2 py-0">
                    {counts.urgentes} urgentes activas
                  </Badge>
                )}
              </div>
            </div>

            {filteredBySub.length > pageSize && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex justify-center sm:justify-end">
                <Pagination
                  currentPage={safeCurrentPage}
                  totalPages={totalPages}
                  itemsPerPage={pageSize}
                  totalItems={filteredBySub.length}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setPageSize(size)
                    setCurrentPage(1)
                  }}
                  itemsPerPageOptions={[10, 20, 50, 100]}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
)

TechnicianListView.displayName = 'TechnicianListView'
