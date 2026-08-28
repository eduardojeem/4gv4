'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Power,
  PowerOff,
  Percent,
  Tag,
  AlertTriangle,
  Loader2,
  X,
  Check,
  Calendar,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Promotion } from '@/types/promotion'

type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'inactive'

const STATUS_CONFIG: Record<PromotionStatus, { label: string; className: string; dot: string }> = {
  active: {
    label: 'Activa',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  scheduled: {
    label: 'Programada',
    className: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-300',
    dot: 'bg-cyan-500',
  },
  expired: {
    label: 'Expirada',
    className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
  inactive: {
    label: 'Inactiva',
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
}

interface PromotionRowActions {
  onEdit?: (promotion: Promotion) => void
  onDelete?: (promotion: Promotion) => void
  onDuplicate?: (promotion: Promotion) => void
  onToggleStatus?: (promotion: Promotion) => void
}

interface PromotionListProps extends PromotionRowActions {
  promotions: Promotion[]
  loading?: boolean
  getPromotionStatus: (promotion: Promotion) => PromotionStatus
  isPromotionExpiringSoon: (promotion: Promotion) => boolean
  onBulkActivate?: (ids: string[]) => void | Promise<unknown>
  onBulkDeactivate?: (ids: string[]) => void | Promise<unknown>
  onBulkDelete?: (ids: string[]) => void | Promise<unknown>
}

function StatusBadge({ status }: { status: PromotionStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn('gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', cfg.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </Badge>
  )
}

function usagePercentOf(promotion: Promotion): number | null {
  if (!promotion.usage_limit) return null
  return Math.min(100, Math.round(((promotion.usage_count || 0) / promotion.usage_limit) * 100))
}

function UsageBar({ percent }: { percent: number }) {
  return (
    <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          percent >= 80 ? 'bg-rose-500' : percent >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/** Botón de copiar código con feedback visual */
function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success(`Código "${code}" copiado al portapapeles`)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar código al portapapeles"
      className="group inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-500 dark:hover:bg-cyan-950/50 dark:hover:text-cyan-200 transition-colors"
    >
      <span>{code}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  )
}

function ActionsMenu({
  promotion,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
}: PromotionRowActions & { promotion: Promotion }) {
  const hasActions = Boolean(onEdit || onDuplicate || onToggleStatus || onDelete)
  if (!hasActions) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
        {onEdit && (
          <DropdownMenuItem onClick={() => onEdit(promotion)} className="gap-2 text-xs">
            <Edit className="h-3.5 w-3.5 text-blue-600" />
            Editar detalles
          </DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem onClick={() => onDuplicate(promotion)} className="gap-2 text-xs">
            <Copy className="h-3.5 w-3.5 text-cyan-600" />
            Duplicar promoción
          </DropdownMenuItem>
        )}
        {onToggleStatus && (
          <DropdownMenuItem onClick={() => onToggleStatus(promotion)} className="gap-2 text-xs">
            {promotion.is_active ? (
              <>
                <PowerOff className="h-3.5 w-3.5 text-amber-600" /> Desactivar
              </>
            ) : (
              <>
                <Power className="h-3.5 w-3.5 text-emerald-600" /> Activar
              </>
            )}
          </DropdownMenuItem>
        )}
        {onDelete && (onEdit || onDuplicate || onToggleStatus) && <DropdownMenuSeparator />}
        {onDelete && (
          <DropdownMenuItem
            onClick={() => onDelete(promotion)}
            className="gap-2 text-xs text-rose-600 focus:text-rose-700 dark:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar promoción
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Mobile card layout (< md)
function MobileCard({
  promotion,
  status,
  expiringSoon,
  selectable,
  selected,
  onToggleSelect,
  rowActions,
}: {
  promotion: Promotion
  status: PromotionStatus
  expiringSoon: boolean
  selectable: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
  rowActions: PromotionRowActions
}) {
  const usagePercent = usagePercentOf(promotion)

  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl border p-4 transition-all duration-200',
        selected
          ? 'border-cyan-500 bg-cyan-50/40 dark:border-cyan-600 dark:bg-cyan-950/20'
          : 'border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/60'
      )}
    >
      {selectable && (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(promotion.id)}
          aria-label={`Seleccionar ${promotion.name}`}
          className="mt-1 rounded-md"
        />
      )}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-bold text-slate-900 dark:text-slate-50 text-sm">
                {promotion.name}
              </p>
              {expiringSoon && (
                <span title="Expira pronto">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500 animate-bounce" />
                </span>
              )}
            </div>
            <div className="mt-1">
              <CopyCodeButton code={promotion.code} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <StatusBadge status={status} />
            <ActionsMenu promotion={promotion} {...rowActions} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50/80 p-2.5 text-xs dark:bg-slate-950/50">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Descuento
            </p>
            <p className="mt-0.5 flex items-center gap-1 font-extrabold text-cyan-600 dark:text-cyan-400 text-sm">
              {promotion.type === 'percentage' ? (
                <>
                  <Percent className="h-3.5 w-3.5" /> {promotion.value}%
                </>
              ) : (
                <>
                  <Tag className="h-3.5 w-3.5" /> {formatCurrency(promotion.value)}
                </>
              )}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Uso / Cupo
            </p>
            <p className="mt-0.5 tabular-nums font-semibold text-slate-700 dark:text-slate-300">
              {promotion.usage_count || 0}
              {promotion.usage_limit && (
                <span className="text-slate-400 font-normal"> / {promotion.usage_limit}</span>
              )}
            </p>
            {usagePercent !== null && <UsageBar percent={usagePercent} />}
          </div>
          {(promotion.start_date || promotion.end_date) && (
            <div className="col-span-2 text-[11px] text-slate-500 border-t border-slate-200/60 pt-2 dark:border-slate-800">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" />
                {promotion.start_date && (
                  <span>
                    Desde:{' '}
                    <strong className="text-slate-700 dark:text-slate-300">
                      {format(parseISO(promotion.start_date), 'dd/MM/yy')}
                    </strong>
                  </span>
                )}
                {promotion.end_date && (
                  <span className={cn('ml-2', expiringSoon && 'font-bold text-amber-600 dark:text-amber-400')}>
                    Hasta:{' '}
                    <strong>{format(parseISO(promotion.end_date), 'dd/MM/yy')}</strong>
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {rowActions.onToggleStatus && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">Estado activo</span>
            <Switch
              checked={promotion.is_active}
              onCheckedChange={() => rowActions.onToggleStatus?.(promotion)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function PromotionList({
  promotions,
  loading,
  getPromotionStatus,
  isPromotionExpiringSoon,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  onBulkActivate,
  onBulkDeactivate,
  onBulkDelete,
}: PromotionListProps) {
  const rowActions: PromotionRowActions = { onEdit, onDelete, onDuplicate, onToggleStatus }
  const hasBulk = Boolean(onBulkActivate || onBulkDeactivate || onBulkDelete)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  // Descartar ids que salieron de la vista
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(promotions.map((p) => p.id))
      let changed = false
      const next = new Set<string>()
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [promotions])

  const selectedCount = selected.size
  const allVisibleSelected = promotions.length > 0 && promotions.every((p) => selected.has(p.id))
  const someVisibleSelected = selectedCount > 0 && !allVisibleSelected

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(() => (allVisibleSelected ? new Set() : new Set(promotions.map((p) => p.id))))
  }

  const clearSelection = () => setSelected(new Set())

  const runBulk = async (fn?: (ids: string[]) => void | Promise<unknown>) => {
    if (!fn || selectedCount === 0) return
    setBulkBusy(true)
    try {
      await fn(Array.from(selected))
      clearSelection()
    } finally {
      setBulkBusy(false)
    }
  }

  if (loading) {
    return (
      <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800/80">
        <CardContent className="p-6">
          <div className="space-y-3.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (promotions.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-slate-300 dark:border-slate-800">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400 shadow-xs">
            <Tag className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
            No se encontraron promociones
          </h3>
          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            No hay promociones que coincidan con los filtros aplicados. Intenta restablecer los filtros o crear una nueva campaña.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/80 shadow-xs dark:border-slate-800/80">
      <CardContent className="p-0">
        {/* Floating Bulk Action Bar */}
        {hasBulk && selectedCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-200 bg-cyan-50/90 px-4 py-3 dark:border-cyan-900/60 dark:bg-cyan-950/40 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Badge className="bg-cyan-600 text-white font-bold text-xs px-2 py-0.5">
                {selectedCount}
              </Badge>
              <span className="text-xs font-semibold text-cyan-950 dark:text-cyan-100">
                promocion{selectedCount !== 1 ? 'es' : ''} seleccionada{selectedCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />}
              {onBulkActivate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg border-emerald-300 bg-white text-xs text-emerald-700 hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-400"
                  disabled={bulkBusy}
                  onClick={() => void runBulk(onBulkActivate)}
                >
                  <Power className="h-3.5 w-3.5" /> Activar
                </Button>
              )}
              {onBulkDeactivate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg border-amber-300 bg-white text-xs text-amber-700 hover:bg-amber-50 dark:bg-slate-900 dark:text-amber-400"
                  disabled={bulkBusy}
                  onClick={() => void runBulk(onBulkDeactivate)}
                >
                  <PowerOff className="h-3.5 w-3.5" /> Desactivar
                </Button>
              )}
              {onBulkDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg border-rose-300 bg-white text-xs text-rose-600 hover:bg-rose-50 dark:bg-slate-900 dark:text-rose-400"
                  disabled={bulkBusy}
                  onClick={() => setConfirmBulkDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 rounded-lg text-xs text-slate-500 hover:text-slate-900"
                disabled={bulkBusy}
                onClick={clearSelection}
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Mobile View: Cards (< md) */}
        <div className="grid gap-3 p-3 md:hidden">
          {promotions.map((promotion) => {
            const status = getPromotionStatus(promotion)
            const expiringSoon = isPromotionExpiringSoon(promotion)
            const isSelected = selected.has(promotion.id)

            return (
              <MobileCard
                key={promotion.id}
                promotion={promotion}
                status={status}
                expiringSoon={expiringSoon}
                selectable={hasBulk}
                selected={isSelected}
                onToggleSelect={toggleOne}
                rowActions={rowActions}
              />
            )
          })}
        </div>

        {/* Desktop View: Table (>= md) */}
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200/80 bg-slate-50/80 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
                {hasBulk && (
                  <TableHead className="w-12 px-4">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAll}
                      aria-label="Seleccionar todas"
                      className="rounded-md"
                    />
                  </TableHead>
                )}
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Promoción / Código
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Descuento
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Estado
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Uso / Cupo
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Vigencia
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">
                  Activo
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((promotion) => {
                const status = getPromotionStatus(promotion)
                const expiringSoon = isPromotionExpiringSoon(promotion)
                const usagePercent = usagePercentOf(promotion)
                const isSelected = selected.has(promotion.id)

                return (
                  <TableRow
                    key={promotion.id}
                    data-state={isSelected ? 'selected' : undefined}
                    className="border-slate-100 transition-colors hover:bg-slate-50/80 data-[state=selected]:bg-cyan-50/40 dark:border-slate-800 dark:hover:bg-slate-850 dark:data-[state=selected]:bg-cyan-950/20"
                  >
                    {hasBulk && (
                      <TableCell className="px-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(promotion.id)}
                          aria-label={`Seleccionar ${promotion.name}`}
                          className="rounded-md"
                        />
                      </TableCell>
                    )}

                    {/* Promoción & Código */}
                    <TableCell className="py-3.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {promotion.name}
                          </span>
                          {expiringSoon && (
                            <span title="Expira en menos de 7 días">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                            </span>
                          )}
                        </div>
                        <div>
                          <CopyCodeButton code={promotion.code} />
                        </div>
                      </div>
                    </TableCell>

                    {/* Descuento */}
                    <TableCell>
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-extrabold text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200">
                        {promotion.type === 'percentage' ? (
                          <>
                            <Percent className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                            {promotion.value}%
                          </>
                        ) : (
                          <>
                            <Tag className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                            {formatCurrency(promotion.value)}
                          </>
                        )}
                      </div>
                    </TableCell>

                    {/* Estado */}
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>

                    {/* Uso / Cupo */}
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                          {promotion.usage_count || 0}
                          {promotion.usage_limit && (
                            <span className="text-slate-400 font-normal"> / {promotion.usage_limit}</span>
                          )}
                        </p>
                        {usagePercent !== null && <UsageBar percent={usagePercent} />}
                      </div>
                    </TableCell>

                    {/* Vigencia */}
                    <TableCell>
                      <div className="flex flex-col text-xs text-slate-500">
                        {promotion.start_date && (
                          <span className="text-[11px]">
                            Desde: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{format(parseISO(promotion.start_date), 'dd/MM/yyyy')}</strong>
                          </span>
                        )}
                        {promotion.end_date && (
                          <span className={cn('text-[11px]', expiringSoon && 'text-amber-600 dark:text-amber-400 font-bold')}>
                            Hasta: <strong className={cn(!expiringSoon && 'text-slate-700 dark:text-slate-300 font-semibold')}>{format(parseISO(promotion.end_date), 'dd/MM/yyyy')}</strong>
                          </span>
                        )}
                        {!promotion.start_date && !promotion.end_date && (
                          <span className="text-slate-400 italic text-[11px]">Sin límite de fecha</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Switch directo Activo / Inactivo */}
                    <TableCell className="text-center">
                      {onToggleStatus && (
                        <Switch
                          checked={promotion.is_active}
                          onCheckedChange={() => onToggleStatus(promotion)}
                          title={promotion.is_active ? 'Desactivar promoción' : 'Activar promoción'}
                        />
                      )}
                    </TableCell>

                    {/* Acciones */}
                    <TableCell>
                      <ActionsMenu promotion={promotion} {...rowActions} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Confirm Bulk Delete Dialog */}
      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedCount} promociones?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente las {selectedCount} promociones seleccionadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmBulkDelete(false)
                void runBulk(onBulkDelete)
              }}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar {selectedCount}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
