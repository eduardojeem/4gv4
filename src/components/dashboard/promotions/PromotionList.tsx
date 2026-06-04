'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { Promotion } from '@/types/promotion'

type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'inactive'

// Tone system consistente con el resto del proyecto
const STATUS_CONFIG: Record<PromotionStatus, { label: string; className: string }> = {
    active:    { label: 'Activa',     className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300' },
    scheduled: { label: 'Programada', className: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/20 dark:text-cyan-300' },
    expired:   { label: 'Expirada',   className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' },
    inactive:  { label: 'Inactiva',   className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300' },
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
    // Bulk actions. When provided, a selection column + toolbar appear.
    onBulkActivate?: (ids: string[]) => void | Promise<unknown>
    onBulkDeactivate?: (ids: string[]) => void | Promise<unknown>
    onBulkDelete?: (ids: string[]) => void | Promise<unknown>
}

function StatusBadge({ status }: { status: PromotionStatus }) {
    const cfg = STATUS_CONFIG[status]
    return (
        <Badge variant="outline" className={cn('rounded-full text-[11px]', cfg.className)}>
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
        <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
                className={cn(
                    'h-full rounded-full',
                    percent >= 80 ? 'bg-red-500' : percent >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                )}
                style={{ width: `${percent}%` }}
            />
        </div>
    )
}

function ActionsMenu({ promotion, onEdit, onDelete, onDuplicate, onToggleStatus }: PromotionRowActions & { promotion: Promotion }) {
    const hasActions = Boolean(onEdit || onDuplicate || onToggleStatus || onDelete)
    if (!hasActions) return null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(promotion)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                    </DropdownMenuItem>
                )}
                {onDuplicate && (
                    <DropdownMenuItem onClick={() => onDuplicate(promotion)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicar
                    </DropdownMenuItem>
                )}
                {onToggleStatus && (
                    <DropdownMenuItem onClick={() => onToggleStatus(promotion)}>
                        {promotion.is_active
                            ? <><PowerOff className="mr-2 h-4 w-4" /> Desactivar</>
                            : <><Power className="mr-2 h-4 w-4" /> Activar</>
                        }
                    </DropdownMenuItem>
                )}
                {onDelete && (onEdit || onDuplicate || onToggleStatus) && (
                    <DropdownMenuSeparator />
                )}
                {onDelete && (
                    <DropdownMenuItem
                        onClick={() => onDelete(promotion)}
                        className="text-red-600 focus:text-red-700"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// Mobile card — stacked layout for < md, replaces the horizontal-scroll table.
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
        <div className={cn('flex gap-3 p-4', selected && 'bg-indigo-50/60 dark:bg-indigo-950/20')}>
            {selectable && (
                <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(promotion.id)}
                    aria-label={`Seleccionar ${promotion.name}`}
                    className="mt-1"
                />
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <p className="truncate font-medium text-slate-900 dark:text-slate-100">{promotion.name}</p>
                            {expiringSoon && (
                                <span title="Expira pronto">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                </span>
                            )}
                        </div>
                        <code className="text-xs text-slate-400">{promotion.code}</code>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <StatusBadge status={status} />
                        <ActionsMenu promotion={promotion} {...rowActions} />
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">Tipo / Valor</p>
                        <p className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                            {promotion.type === 'percentage'
                                ? <><Percent className="h-3.5 w-3.5 text-slate-400" /> {promotion.value}%</>
                                : <><Tag className="h-3.5 w-3.5 text-slate-400" /> {formatCurrency(promotion.value)}</>
                            }
                        </p>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">Uso</p>
                        <p className="tabular-nums text-slate-700 dark:text-slate-200">
                            {promotion.usage_count || 0}
                            {promotion.usage_limit && <span className="text-slate-400"> / {promotion.usage_limit}</span>}
                        </p>
                        {usagePercent !== null && <UsageBar percent={usagePercent} />}
                    </div>
                    {(promotion.start_date || promotion.end_date) && (
                        <div className="col-span-2 text-xs text-slate-500">
                            {promotion.start_date && (
                                <span>Inicio: <span className="text-slate-700 dark:text-slate-300">{format(parseISO(promotion.start_date), 'dd/MM/yy')}</span></span>
                            )}
                            {promotion.start_date && promotion.end_date && <span className="px-1.5">·</span>}
                            {promotion.end_date && (
                                <span className={cn(expiringSoon && 'font-medium text-amber-600 dark:text-amber-400')}>
                                    Fin: <span className={cn(!expiringSoon && 'text-slate-700 dark:text-slate-300')}>{format(parseISO(promotion.end_date), 'dd/MM/yy')}</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
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

    // Drop ids that left the visible list (e.g. after filtering or a refresh)
    // so the selection count and "select all" state stay accurate.
    useEffect(() => {
        setSelected((prev) => {
            if (prev.size === 0) return prev
            const visible = new Set(promotions.map((p) => p.id))
            let changed = false
            const next = new Set<string>()
            prev.forEach((id) => { if (visible.has(id)) next.add(id); else changed = true })
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
            <Card>
                <CardContent className="p-6">
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (promotions.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <Tag className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">No hay promociones</h3>
                    <p className="mt-1 max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
                        No se encontraron promociones con los filtros aplicados. Ajustá los filtros o creá una nueva.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                {/* Bulk action toolbar */}
                {hasBulk && selectedCount > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-indigo-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-indigo-950/30">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''}
                        </span>
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                            {onBulkActivate && (
                                <Button variant="outline" size="sm" className="gap-1.5" disabled={bulkBusy} onClick={() => void runBulk(onBulkActivate)}>
                                    <Power className="h-3.5 w-3.5" /> Activar
                                </Button>
                            )}
                            {onBulkDeactivate && (
                                <Button variant="outline" size="sm" className="gap-1.5" disabled={bulkBusy} onClick={() => void runBulk(onBulkDeactivate)}>
                                    <PowerOff className="h-3.5 w-3.5" /> Desactivar
                                </Button>
                            )}
                            {onBulkDelete && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/20"
                                    disabled={bulkBusy}
                                    onClick={() => setConfirmBulkDelete(true)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500" disabled={bulkBusy} onClick={clearSelection}>
                                <X className="h-3.5 w-3.5" /> Limpiar
                            </Button>
                        </div>
                    </div>
                )}

                {/* Desktop / tablet: table */}
                <div className="hidden overflow-x-auto md:block">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                                {hasBulk && (
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                                            onCheckedChange={toggleAll}
                                            aria-label="Seleccionar todas"
                                        />
                                    </TableHead>
                                )}
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Promoción</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tipo</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Valor</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Estado</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Uso</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fechas</TableHead>
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
                                        className="border-slate-100 transition-colors hover:bg-slate-50 data-[state=selected]:bg-indigo-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40 dark:data-[state=selected]:bg-indigo-950/20"
                                    >
                                        {hasBulk && (
                                            <TableCell>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleOne(promotion.id)}
                                                    aria-label={`Seleccionar ${promotion.name}`}
                                                />
                                            </TableCell>
                                        )}

                                        {/* Promoción */}
                                        <TableCell className="py-3">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-slate-900 dark:text-slate-100">{promotion.name}</p>
                                                {expiringSoon && (
                                                    <span title="Expira pronto">
                                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                                    </span>
                                                )}
                                            </div>
                                            <code className="text-xs text-slate-400">{promotion.code}</code>
                                        </TableCell>

                                        {/* Tipo */}
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                                                {promotion.type === 'percentage'
                                                    ? <><Percent className="h-3.5 w-3.5 text-slate-400" /> Porcentaje</>
                                                    : <><Tag className="h-3.5 w-3.5 text-slate-400" /> Fijo</>
                                                }
                                            </div>
                                        </TableCell>

                                        {/* Valor */}
                                        <TableCell className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                                            {promotion.type === 'percentage'
                                                ? `${promotion.value}%`
                                                : formatCurrency(promotion.value)
                                            }
                                        </TableCell>

                                        {/* Estado */}
                                        <TableCell><StatusBadge status={status} /></TableCell>

                                        {/* Uso */}
                                        <TableCell>
                                            <div className="min-w-[90px]">
                                                <div className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                                                    {promotion.usage_count || 0}
                                                    {promotion.usage_limit && (
                                                        <span className="text-slate-400"> / {promotion.usage_limit}</span>
                                                    )}
                                                </div>
                                                {usagePercent !== null && <UsageBar percent={usagePercent} />}
                                            </div>
                                        </TableCell>

                                        {/* Fechas */}
                                        <TableCell>
                                            <div className="space-y-0.5 text-xs">
                                                {promotion.start_date && (
                                                    <div className="text-slate-500">
                                                        Inicio: <span className="text-slate-700 dark:text-slate-300">{format(parseISO(promotion.start_date), 'dd/MM/yy')}</span>
                                                    </div>
                                                )}
                                                {promotion.end_date && (
                                                    <div className={cn('text-slate-500', expiringSoon && 'font-medium text-amber-600 dark:text-amber-400')}>
                                                        Fin: <span className={cn(!expiringSoon && 'text-slate-700 dark:text-slate-300')}>{format(parseISO(promotion.end_date), 'dd/MM/yy')}</span>
                                                    </div>
                                                )}
                                                {!promotion.start_date && !promotion.end_date && (
                                                    <span className="text-slate-300">Sin fechas</span>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Acciones */}
                                        <TableCell className="text-right">
                                            <ActionsMenu promotion={promotion} {...rowActions} />
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile: stacked cards */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                    {promotions.map((promotion) => (
                        <MobileCard
                            key={promotion.id}
                            promotion={promotion}
                            status={getPromotionStatus(promotion)}
                            expiringSoon={isPromotionExpiringSoon(promotion)}
                            selectable={hasBulk}
                            selected={selected.has(promotion.id)}
                            onToggleSelect={toggleOne}
                            rowActions={rowActions}
                        />
                    ))}
                </div>
            </CardContent>

            {/* Bulk delete confirmation */}
            <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar {selectedCount} promocion{selectedCount !== 1 ? 'es' : ''}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Las promociones seleccionadas serán eliminadas permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={bulkBusy}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            disabled={bulkBusy}
                            onClick={(e) => {
                                e.preventDefault()
                                void runBulk(onBulkDelete).then(() => setConfirmBulkDelete(false))
                            }}
                        >
                            {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    )
}
