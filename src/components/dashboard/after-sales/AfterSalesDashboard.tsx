'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { ChevronDown, Eye, HelpCircle, Inbox, Plus, RefreshCw, Search, ShoppingBag, Wrench, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CreateAfterSalesCaseDialog } from './CreateAfterSalesCaseDialog'
import {
    NEXT_ACTIONS,
    REQUEST_META,
    STATUS_META,
    formatDate,
    formatMoney,
    type CaseStatus,
    type RequestType,
} from './after-sales-meta'

interface AfterSalesCase {
    id: string
    case_number: string | null
    source_type: 'repair' | 'sale'
    request_type: RequestType
    status: CaseStatus
    quantity: number
    reason: string
    notes: string | null
    refund_amount: number | null
    refund_method: 'cash' | 'store_credit' | null
    restock_action: 'sellable' | 'quarantine' | 'none' | null
    product_id: string | null
    repair_id: string | null
    generated_repair_id: string | null
    created_at: string
    resolved_at: string | null
    repairs?: {
        ticket_number: string | null
        device_brand: string | null
        device_model: string | null
        warranty_type?: string | null
        warranty_months?: number | null
    } | null
    sales?: { code: string | null; total_amount: number | null; created_at: string | null } | null
    products?: { name: string | null; sku: string | null } | null
    customers?: { name: string | null; phone: string | null } | null
    generated_repair?: {
        ticket_number: string | null
    } | null
}


const RESTOCK_OPTIONS: Array<{
    value: 'sellable' | 'quarantine' | 'none'
    label: string
    hint: string
    activeClass: string
}> = [
    {
        value: 'sellable',
        label: 'Vuelve al stock',
        hint: 'El producto esta sano y se puede volver a vender.',
        activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
    },
    {
        value: 'quarantine',
        label: 'Vuelve con falla',
        hint: 'Ingresa como mercaderia defectuosa; no se suma al stock vendible.',
        activeClass: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
    },
    {
        value: 'none',
        label: 'No vuelve nada',
        hint: 'El cliente se queda con el producto.',
        activeClass: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
]

export function AfterSalesDashboard() {
    const [cases, setCases] = useState<AfterSalesCase[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all')
    const [typeFilter, setTypeFilter] = useState<'all' | RequestType>('all')
    const [pendingId, setPendingId] = useState<string | null>(null)
    const [confirming, setConfirming] = useState<{ item: AfterSalesCase; status: CaseStatus; label: string } | null>(null)
    const [selectedCase, setSelectedCase] = useState<AfterSalesCase | null>(null)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [refundAmount, setRefundAmount] = useState('')
    const [refundMethod, setRefundMethod] = useState<'cash' | 'store_credit' | null>(null)
    const [restockAction, setRestockAction] = useState<'sellable' | 'quarantine' | 'none'>('none')

    const loadCases = useCallback(async (options?: { isSilent?: boolean }) => {
        if (!options?.isSilent) {
            setLoading(true)
        }
        try {
            const response = await fetch('/api/after-sales?limit=200', { cache: 'no-store' })
            const payload = await response.json().catch(() => null) as { success?: boolean; data?: AfterSalesCase[]; error?: string } | null

            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || 'No se pudieron cargar los casos.')
            }

            setCases(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            toast.error('No se pudieron cargar los casos de posventa', {
                description: error instanceof Error ? error.message : 'Intenta nuevamente.',
            })
            setCases([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadCases()
    }, [loadCases])

    const visibleCases = useMemo(() => {
        const term = search.trim().toLowerCase()
        return cases.filter((item) => {
            if (statusFilter !== 'all' && item.status !== statusFilter) return false
            if (typeFilter !== 'all' && item.request_type !== typeFilter) return false
            if (!term) return true
            return [item.case_number, item.reason, item.notes]
                .some((field) => (field || '').toLowerCase().includes(term))
        })
    }, [cases, search, statusFilter, typeFilter])

    const summary = useMemo(() => ({
        open: cases.filter((item) => item.status === 'open').length,
        approved: cases.filter((item) => item.status === 'approved').length,
        refunds: cases
            .filter((item) => item.status === 'completed')
            .reduce((sum, item) => sum + (Number(item.refund_amount) || 0), 0),
    }), [cases])

    const hasFilters = search.trim() !== '' || statusFilter !== 'all' || typeFilter !== 'all'

    const applyStatus = async (item: AfterSalesCase, status: CaseStatus, extra?: Record<string, unknown>) => {
        setPendingId(item.id)
        try {
            const response = await fetch(`/api/after-sales/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, ...extra }),
            })
            const payload = await response.json().catch(() => null) as {
                success?: boolean
                error?: string
                warrantyRepair?: { ticketNumber: string | null }
                refund?: { method: string; amount: number }
                restock?: { restocked: number; action: string }
            } | null

            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || 'No se pudo actualizar el caso.')
            }

            // El efecto es lo que importa: si se creó el retrabajo o se movió la
            // plata, el mensaje lo dice en lugar de un genérico "aprobado".
            const restockNote = payload?.restock?.restocked
                ? `Volvieron ${payload.restock.restocked} u. al stock.`
                : ''

            const detail = payload?.warrantyRepair
                ? `Se creó la reparación de garantía ${payload.warrantyRepair.ticketNumber || ''}`.trim()
                : payload?.refund
                    ? payload.refund.method === 'cash'
                        ? `Salieron ${formatMoney(payload.refund.amount)} de caja.`
                        : `Se acreditaron ${formatMoney(payload.refund.amount)} como saldo a favor.`
                    : undefined

            const description = [detail, restockNote].filter(Boolean).join(' ')
            toast.success(`Caso ${STATUS_META[status].label.toLowerCase()}`, description ? { description } : undefined)
            setConfirming(null)
            setRefundAmount('')
            setRefundMethod(null)
            await loadCases({ isSilent: true })
        } catch (error) {
            toast.error('No se pudo actualizar el caso', {
                description: error instanceof Error ? error.message : 'Intenta nuevamente.',
            })
        } finally {
            setPendingId(null)
        }
    }

    const parsedRefund = Number((refundAmount || '').replace(/[^\d]/g, '')) || 0
    const needsRefundMethod = confirming?.status === 'completed' && parsedRefund > 0
    const isWarrantyApproval =
        confirming?.status === 'approved' && confirming.item.request_type === 'repair_warranty'

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Posventa</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Garantías, cambios y devoluciones originados en ventas o reparaciones.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="default" size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setIsCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Nuevo Reclamo
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void loadCases()} disabled={loading}>
                        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* Interactive Explanatory Guide Banner */}
            <Card className="border border-blue-200/60 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/40 shadow-sm dark:border-white/10 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-purple-950/10 rounded-2xl">
                <details className="group [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between p-4 focus:outline-none">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm dark:bg-blue-500">
                                <HelpCircle className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    ¿Cómo funciona el flujo de Devoluciones y Garantías?
                                    <Badge variant="outline" className="border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-200 text-[10px]">
                                        Guía Rápida
                                    </Badge>
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Aprende dónde iniciar reclamos y cómo se procesan las devoluciones de dinero o reparaciones.
                                </p>
                            </div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                    </summary>

                    <CardContent className="border-t border-blue-100/80 dark:border-white/5 p-4 pt-3 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl bg-white/80 dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 space-y-1.5">
                                <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 text-[11px]">1</span>
                                    <span>¿Dónde se inicia?</span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                    En <strong>POS Dashboard / Historial de Ventas</strong> (`/dashboard/pos/dashboard`), en <strong>Reparaciones</strong> (`/dashboard/repairs`), o con el botón <strong>+ Nuevo Reclamo</strong>.
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-white/80 dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 space-y-1.5">
                                <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 text-[11px]">2</span>
                                    <span>Garantía de Taller</span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                    Al aprobar una garantía de reparación, se genera automáticamente una <strong>Orden de Retrabajo en Taller (₲ 0)</strong> para el equipo del cliente.
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-white/80 dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 space-y-1.5">
                                <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 text-[11px]">3</span>
                                    <span>Devolución de Dinero</span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                    Al completar una devolución, puedes elegir emitir el dinero <strong>Por Caja Chica</strong> (salida auditada) o como <strong>Saldo a Favor</strong> del cliente.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </details>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Abiertos</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.open}</p>
                        <p className="text-xs text-muted-foreground">Esperando resolución</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Aprobados</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.approved}</p>
                        <p className="text-xs text-muted-foreground">Pendientes de completar</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Reembolsado</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(summary.refunds)}</p>
                        <p className="text-xs text-muted-foreground">En casos completados</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-3">
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar por número o motivo…"
                        className="h-9 pl-9"
                        aria-label="Buscar casos de posventa"
                    />
                </div>

                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                    <SelectTrigger className="h-9 w-[160px] text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        {(Object.keys(STATUS_META) as CaseStatus[]).map((key) => (
                            <SelectItem key={key} value={key}>{STATUS_META[key].label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
                    <SelectTrigger className="h-9 w-[200px] text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        {(Object.keys(REQUEST_META) as RequestType[]).map((key) => (
                            <SelectItem key={key} value={key}>{REQUEST_META[key].label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <span className="text-xs text-muted-foreground">{visibleCases.length} de {cases.length}</span>

                {hasFilters ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 gap-1.5 text-xs"
                        onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all') }}
                    >
                        <X className="h-3.5 w-3.5" />
                        Limpiar
                    </Button>
                ) : null}
            </div>

            {loading ? (
                <div className="space-y-2" aria-busy="true" aria-label="Cargando casos">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-[88px] w-full rounded-xl" />
                    ))}
                </div>
            ) : visibleCases.length === 0 ? (
                <Card>
                    <CardContent role="status" className="flex flex-col items-center gap-2 py-14 text-center">
                        <div className="rounded-2xl bg-muted p-4">
                            <Inbox className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-base font-semibold">
                            {hasFilters ? 'Ningún caso coincide' : 'Todavía no hay casos de posventa'}
                        </p>
                        <p className="max-w-md text-sm text-muted-foreground">
                            {hasFilters
                                ? 'Probá con otro término o cambiá los filtros.'
                                : 'Los casos se abren desde una venta o una reparación, cuando el cliente pide una garantía, un cambio o una devolución.'}
                        </p>
                        {hasFilters ? (
                            <Button variant="outline" size="sm" className="mt-2" onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all') }}>
                                Limpiar filtros
                            </Button>
                        ) : null}
                    </CardContent>
                </Card>
            ) : (
                <ul role="list" className="space-y-2">
                    {visibleCases.map((item) => {
                        const requestMeta = REQUEST_META[item.request_type] ?? REQUEST_META.return
                        const statusMeta = STATUS_META[item.status] ?? STATUS_META.open
                        const RequestIcon = requestMeta.icon
                        const actions = NEXT_ACTIONS[item.status] ?? []
                        const isPending = pendingId === item.id

                        return (
                            <li key={item.id} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/20">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex min-w-0 flex-1 gap-3">
                                        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', requestMeta.className)}>
                                            <RequestIcon className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-sm font-semibold">{item.case_number || 'Sin número'}</span>
                                                <Badge variant="outline" className={requestMeta.className}>{requestMeta.label}</Badge>
                                                <Badge variant="outline" className={statusMeta.className}>{statusMeta.label}</Badge>
                                            </div>
                                            <p className="mt-1.5 text-sm">{item.reason}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {item.quantity > 1 ? `${item.quantity} unidades · ` : ''}
                                                Origen: {item.source_type === 'repair' ? 'reparación' : 'venta'} ·
                                                {' '}Abierto el {formatDate(item.created_at)}
                                                {item.resolved_at ? ` · Resuelto el ${formatDate(item.resolved_at)}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-2">
                                        {item.refund_amount != null ? (
                                            <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(item.refund_amount)}</span>
                                        ) : null}
                                        {actions.length === 0 && (
                                            <span className="text-[11px] text-muted-foreground text-right max-w-[190px]">
                                                Este caso ya está {statusMeta.label.toLowerCase()} y no admite más cambios.
                                                Si hace falta, registrá uno nuevo.
                                            </span>
                                        )}
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1 text-xs"
                                                onClick={() => setSelectedCase(item)}
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                Ver detalle
                                            </Button>
                                            {actions.map((action) => {
                                                const ActionIcon = action.icon
                                                return (
                                                    <Button
                                                        key={action.status}
                                                        variant={action.status === 'approved' || action.status === 'completed' ? 'default' : 'outline'}
                                                        size="sm"
                                                        className={cn(
                                                            'h-8 gap-1.5 text-xs',
                                                            action.status === 'approved' && 'bg-blue-600 hover:bg-blue-700 text-white',
                                                            action.status === 'completed' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                                                            action.destructive && 'text-destructive hover:text-destructive'
                                                        )}
                                                        disabled={isPending}
                                                        onClick={() => {
                                                    // El destino por defecto espeja defaultRestockAction de la API.
                                                    setRestockAction(
                                                        item.request_type === 'product_warranty'
                                                            ? 'quarantine'
                                                            : item.request_type === 'exchange' || item.request_type === 'return'
                                                                ? 'sellable'
                                                                : 'none'
                                                    )
                                                    setConfirming({ item, status: action.status, label: action.label })
                                                }}
                                                    >
                                                        <ActionIcon className="h-3.5 w-3.5" />
                                                        {action.label}
                                                    </Button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}

            {/* Case Detail Dialog */}
            <Dialog open={Boolean(selectedCase)} onOpenChange={(open) => !open && setSelectedCase(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <DialogTitle className="font-mono text-lg">
                                {selectedCase?.case_number || 'Sin numero'}
                            </DialogTitle>
                            {selectedCase && (
                                <>
                                    <Badge variant="outline" className={REQUEST_META[selectedCase.request_type]?.className}>
                                        {REQUEST_META[selectedCase.request_type]?.label}
                                    </Badge>
                                    <Badge variant="outline" className={STATUS_META[selectedCase.status]?.className}>
                                        {STATUS_META[selectedCase.status]?.label}
                                    </Badge>
                                </>
                            )}
                        </div>
                        <DialogDescription className="text-xs">
                            {selectedCase?.customers?.name
                                ? <>Reclamo de <span className="font-medium text-foreground">{selectedCase.customers.name}</span>{selectedCase.customers.phone ? ` · ${selectedCase.customers.phone}` : ''}</>
                                : 'Reclamo sin cliente asociado.'}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedCase && (
                        <div className="space-y-4 py-1">
                            {/* Que se reclama: el bloque cambia segun el origen */}
                            {selectedCase.source_type === 'repair' ? (
                                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                                            <Wrench className="h-3.5 w-3.5" />
                                            Reparacion de origen
                                        </p>
                                        {selectedCase.repairs?.ticket_number && (
                                            <Badge variant="outline" className="border-blue-300 bg-blue-100 font-mono text-[11px] text-blue-800 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                                                {selectedCase.repairs.ticket_number}
                                            </Badge>
                                        )}
                                    </div>
                                    <dl className="mt-2 space-y-1 text-xs text-blue-900 dark:text-blue-200">
                                        {(selectedCase.repairs?.device_brand || selectedCase.repairs?.device_model) && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="opacity-70">Equipo</dt>
                                                <dd className="font-medium">{selectedCase.repairs?.device_brand} {selectedCase.repairs?.device_model}</dd>
                                            </div>
                                        )}
                                        {selectedCase.repairs?.warranty_months ? (
                                            <div className="flex justify-between gap-3">
                                                <dt className="opacity-70">Cobertura original</dt>
                                                <dd className="font-medium">
                                                    {selectedCase.repairs.warranty_months} meses ·{' '}
                                                    {selectedCase.repairs.warranty_type === 'labor'
                                                        ? 'mano de obra'
                                                        : selectedCase.repairs.warranty_type === 'parts'
                                                            ? 'repuestos'
                                                            : 'completa'}
                                                </dd>
                                            </div>
                                        ) : null}
                                    </dl>

                                    {selectedCase.generated_repair?.ticket_number ? (
                                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-blue-200 pt-2.5 text-xs text-blue-900 dark:border-blue-900/40 dark:text-blue-200">
                                            <span>Retrabajo generado</span>
                                            <Badge className="bg-emerald-600 font-mono text-[11px] text-white">
                                                {selectedCase.generated_repair.ticket_number}
                                            </Badge>
                                        </div>
                                    ) : selectedCase.status === 'open' ? (
                                        <p className="mt-2.5 border-t border-blue-200 pt-2.5 text-[11px] text-blue-700 dark:border-blue-900/40 dark:text-blue-300">
                                            Al aprobar se crea la reparacion de retrabajo con costo en cero.
                                        </p>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3.5 dark:border-violet-900/40 dark:bg-violet-950/20">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="flex items-center gap-1.5 text-xs font-bold text-violet-900 dark:text-violet-200">
                                            <ShoppingBag className="h-3.5 w-3.5" />
                                            Venta de origen
                                        </p>
                                        {selectedCase.sales?.code && (
                                            <Badge variant="outline" className="border-violet-300 bg-violet-100 font-mono text-[11px] text-violet-800 dark:border-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
                                                {selectedCase.sales.code}
                                            </Badge>
                                        )}
                                    </div>
                                    <dl className="mt-2 space-y-1 text-xs text-violet-900 dark:text-violet-200">
                                        <div className="flex justify-between gap-3">
                                            <dt className="opacity-70">Producto</dt>
                                            <dd className="font-medium text-right">
                                                {selectedCase.products?.name || 'Sin producto asociado'}
                                                {selectedCase.products?.sku ? <span className="opacity-70"> · {selectedCase.products.sku}</span> : null}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                            <dt className="opacity-70">Cantidad reclamada</dt>
                                            <dd className="font-medium">{selectedCase.quantity} u.</dd>
                                        </div>
                                        {selectedCase.sales?.total_amount != null && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="opacity-70">Total de la venta</dt>
                                                <dd className="font-medium">{formatMoney(selectedCase.sales.total_amount)}</dd>
                                            </div>
                                        )}
                                    </dl>

                                    {!selectedCase.product_id && (
                                        <p className="mt-2.5 border-t border-violet-200 pt-2.5 text-[11px] text-amber-700 dark:border-violet-900/40 dark:text-amber-400">
                                            Sin producto asociado no se puede reingresar mercaderia al stock al completar.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Lo que dijo el cliente y lo que anoto el mostrador */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Motivo del cliente
                                    </p>
                                    <p className="rounded-lg border bg-card p-3 text-xs leading-relaxed">{selectedCase.reason}</p>
                                </div>
                                <div>
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Notas internas
                                    </p>
                                    <p className={cn(
                                        'rounded-lg border bg-card p-3 text-xs leading-relaxed',
                                        !selectedCase.notes && 'text-muted-foreground italic'
                                    )}>
                                        {selectedCase.notes || 'Sin notas.'}
                                    </p>
                                </div>
                            </div>

                            {/* Resolucion: que paso con la plata y con la mercaderia */}
                            {(selectedCase.refund_amount != null || selectedCase.restock_action) && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {selectedCase.refund_amount != null && (
                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                                                Reintegro
                                            </p>
                                            <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                                                {formatMoney(selectedCase.refund_amount)}
                                            </p>
                                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                                {selectedCase.refund_method === 'cash'
                                                    ? 'Salio por caja'
                                                    : selectedCase.refund_method === 'store_credit'
                                                        ? 'Acreditado como saldo a favor'
                                                        : 'Metodo sin definir'}
                                            </p>
                                        </div>
                                    )}

                                    {selectedCase.restock_action && (
                                        <div className="rounded-xl border bg-muted/30 p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Mercaderia
                                            </p>
                                            <p className="mt-0.5 text-sm font-semibold">
                                                {selectedCase.restock_action === 'sellable'
                                                    ? 'Volvio al stock'
                                                    : selectedCase.restock_action === 'quarantine'
                                                        ? 'Volvio con falla'
                                                        : 'No volvio nada'}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {selectedCase.restock_action === 'sellable'
                                                    ? `${selectedCase.quantity} u. reingresadas como vendibles.`
                                                    : selectedCase.restock_action === 'quarantine'
                                                        ? 'No se sumo al stock vendible.'
                                                        : 'El cliente se quedo el producto.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Linea de tiempo */}
                            <div className="rounded-xl border bg-muted/20 p-3">
                                <ol className="space-y-1.5 text-xs">
                                    <li className="flex justify-between gap-3">
                                        <span className="text-muted-foreground">Abierto</span>
                                        <span className="font-medium">{formatDate(selectedCase.created_at)}</span>
                                    </li>
                                    {selectedCase.resolved_at && (
                                        <li className="flex justify-between gap-3">
                                            <span className="text-muted-foreground">
                                                {selectedCase.status === 'completed' ? 'Completado' : 'Cerrado'}
                                            </span>
                                            <span className="font-medium">{formatDate(selectedCase.resolved_at)}</span>
                                        </li>
                                    )}
                                </ol>
                            </div>

                            <DialogFooter className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t">
                                <Button variant="outline" size="sm" onClick={() => setSelectedCase(null)}>
                                    Cerrar
                                </Button>
                                {(NEXT_ACTIONS[selectedCase.status] ?? []).map((action) => {
                                    const ActionIcon = action.icon
                                    return (
                                        <Button
                                            key={action.status}
                                            variant={action.status === 'approved' || action.status === 'completed' ? 'default' : 'outline'}
                                            size="sm"
                                            className={cn(
                                                'gap-1.5 text-xs',
                                                action.status === 'approved' && 'bg-blue-600 hover:bg-blue-700 text-white',
                                                action.status === 'completed' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                                                action.destructive && 'text-destructive hover:text-destructive'
                                            )}
                                            onClick={() => {
                                                const currentCase = selectedCase
                                                // Mismo default que en la lista: sin esto, completar desde el
                                                // detalle dejaba la mercaderia sin reingresar al stock.
                                                setRestockAction(
                                                    currentCase.request_type === 'product_warranty'
                                                        ? 'quarantine'
                                                        : currentCase.request_type === 'exchange' || currentCase.request_type === 'return'
                                                            ? 'sellable'
                                                            : 'none'
                                                )
                                                setSelectedCase(null)
                                                setConfirming({ item: currentCase, status: action.status, label: action.label })
                                            }}
                                        >
                                            <ActionIcon className="h-3.5 w-3.5" />
                                            {action.label}
                                        </Button>
                                    )
                                })}
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={Boolean(confirming)}
                onOpenChange={(open) => {
                    if (open) return
                    setConfirming(null)
                    setRefundAmount('')
                    setRefundMethod(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirming ? `${confirming.label} el caso ${confirming.item.case_number || ''}?` : ''}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirming?.status === 'completed'
                                ? 'El caso queda cerrado. Si cargás un monto, el reintegro se registra al confirmar.'
                                : isWarrantyApproval
                                    ? 'Se va a crear una reparación de garantía copiando el equipo y el cliente de la original, con costo en cero.'
                                    : confirming?.status === 'approved'
                                        ? 'El caso queda aprobado y pendiente de completarse.'
                                        : 'El caso queda cerrado y no se puede reabrir. Si hace falta, se registra uno nuevo.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {confirming?.status === 'completed' && (
                        <div className="space-y-3">
                            {confirming.item.source_type === 'sale' && (
                                <div className="space-y-1.5">
                                    <span className="text-sm font-medium">Que pasa con la mercaderia</span>
                                    <div className="grid gap-2">
                                        {RESTOCK_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setRestockAction(option.value)}
                                                className={cn(
                                                    'rounded-lg border p-2.5 text-left text-sm transition-colors',
                                                    restockAction === option.value
                                                        ? option.activeClass
                                                        : 'hover:bg-muted/60'
                                                )}
                                            >
                                                <span className="font-medium">{option.label}</span>
                                                <span className="mt-0.5 block text-[11px] opacity-80">{option.hint}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {restockAction === 'sellable' && !confirming.item.product_id && (
                                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                            Este caso no tiene un producto asociado, asi que no se puede reingresar al stock.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label htmlFor="refund-amount" className="text-sm font-medium">
                                    Monto a reintegrar
                                </label>
                                <Input
                                    id="refund-amount"
                                    inputMode="numeric"
                                    value={refundAmount}
                                    onChange={(event) => setRefundAmount(event.target.value)}
                                    placeholder="0"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Dejalo vacío si no hay dinero de por medio.
                                </p>
                            </div>

                            {parsedRefund > 0 && (
                                <div className="space-y-1.5">
                                    <span className="text-sm font-medium">Cómo se devuelve</span>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setRefundMethod('cash')}
                                            className={cn(
                                                'rounded-lg border p-3 text-left text-sm transition-colors',
                                                refundMethod === 'cash'
                                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                                                    : 'hover:bg-muted/60'
                                            )}
                                        >
                                            <span className="font-medium">Por caja</span>
                                            <span className="mt-0.5 block text-[11px] opacity-80">
                                                Registra una salida en la caja abierta.
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRefundMethod('store_credit')}
                                            className={cn(
                                                'rounded-lg border p-3 text-left text-sm transition-colors',
                                                refundMethod === 'store_credit'
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300'
                                                    : 'hover:bg-muted/60'
                                            )}
                                        >
                                            <span className="font-medium">Saldo a favor</span>
                                            <span className="mt-0.5 block text-[11px] opacity-80">
                                                Queda acreditado a nombre del cliente.
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={Boolean(pendingId)}>Volver</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault()
                                if (!confirming) return
                                void applyStatus(
                                    confirming.item,
                                    confirming.status,
                                    confirming.status === 'completed'
                                        ? {
                                            restock_action: restockAction,
                                            ...(parsedRefund > 0
                                                ? { refund_amount: parsedRefund, refund_method: refundMethod }
                                                : {}),
                                        }
                                        : undefined
                                )
                            }}
                            disabled={Boolean(pendingId) || (needsRefundMethod && !refundMethod)}
                        >
                            {pendingId ? 'Aplicando…' : 'Confirmar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Case Dialog */}
            <CreateAfterSalesCaseDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                sourceType="sale"
                allowedRequestTypes={['return', 'exchange', 'product_warranty']}
                onCreated={() => {
                    void loadCases({ isSilent: true })
                }}
            />
        </div>
    )
}
