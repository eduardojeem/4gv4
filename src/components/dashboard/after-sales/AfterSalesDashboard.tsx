'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Eye, Inbox, Plus, RefreshCw, Search, ShoppingBag, Wrench, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { normalizeAfterSalesCase } from '@/lib/after-sales/compat'
import { ProductThumb } from '@/components/suppliers/order-ui'
import { CreateAfterSalesCaseDialog } from './CreateAfterSalesCaseDialog'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { AFTER_SALES_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { SourcesBrowser } from './SourcesBrowser'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
        warranty_expires_at?: string | null
        problem_description?: string | null
        delivered_at?: string | null
        final_cost?: number | null
    } | null
    sales?: { code: string | null; total_amount: number | null; created_at: string | null } | null
    products?: { name: string | null; sku: string | null; image_url?: string | null } | null
    replacement_product?: { name: string | null; image_url: string | null } | null
    replacement_quantity?: number | null
    price_difference?: number | null
    customers?: { name: string | null; phone: string | null } | null
    generated_repair?: {
        ticket_number: string | null
        status?: string | null
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
    const searchParams = useSearchParams()
    const [cases, setCases] = useState<AfterSalesCase[]>([])
    const [loading, setLoading] = useState(true)
    // Los casos siguen siendo la vista principal: el listado de comprobantes es
    // el punto de entrada cuando el cliente llega con un ticket en la mano.
    const [view, setView] = useState<'cases' | 'sources'>('cases')
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all')
    const [typeFilter, setTypeFilter] = useState<'all' | RequestType>('all')
    const [pendingId, setPendingId] = useState<string | null>(null)
    // Los totales se cuentan en la base: calcularlos sobre la pagina cargada
    // los dejaba cortos apenas la organizacion pasaba los 200 casos.
    const [totals, setTotals] = useState<{
        open: number; approved: number; completed: number; rejected: number
        refunds: number; quarantined: number
    } | null>(null)
    const [totalCases, setTotalCases] = useState(0)
    const [confirming, setConfirming] = useState<{ item: AfterSalesCase; status: CaseStatus; label: string } | null>(null)
    const [selectedCase, setSelectedCase] = useState<AfterSalesCase | null>(null)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [refundAmount, setRefundAmount] = useState('')
    const [refundMethod, setRefundMethod] = useState<'cash' | 'store_credit' | null>(null)
    const [restockAction, setRestockAction] = useState<'sellable' | 'quarantine' | 'none'>('none')
    const [rejectionReason, setRejectionReason] = useState('')

    useEffect(() => {
        if (searchParams?.get('new') === 'true') {
            setIsCreateDialogOpen(true)
        }
    }, [searchParams])

    const loadCases = useCallback(async (options?: { isSilent?: boolean }) => {
        if (!options?.isSilent) {
            setLoading(true)
        }
        try {
            try {
                const summaryRes = await fetch('/api/after-sales/summary', { cache: 'no-store' })
                if (summaryRes.ok) {
                    const summaryPayload = await summaryRes.json().catch(() => null)
                    if (summaryPayload?.success && summaryPayload.data) {
                        setTotals(summaryPayload.data)
                    }
                }
            } catch {
                /* los totales son accesorios: la lista manda */
            }

            const response = await fetch('/api/after-sales?limit=200', { cache: 'no-store' })
            const payload = await response.json().catch(() => null) as { success?: boolean; data?: AfterSalesCase[]; error?: string; pagination?: { total?: number } } | null

            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || 'No se pudieron cargar los casos.')
            }

            setCases(
                Array.isArray(payload?.data)
                    ? payload.data.map((item) => normalizeAfterSalesCase(item as unknown as Record<string, unknown>) as unknown as AfterSalesCase)
                    : []
            )
            setTotalCases(Number(payload?.pagination?.total) || 0)
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

    const summary = useMemo(() => totals ?? {
        open: cases.filter((item) => item.status === 'open').length,
        approved: cases.filter((item) => item.status === 'approved').length,
        completed: cases.filter((item) => item.status === 'completed').length,
        rejected: cases.filter((item) => item.status === 'rejected').length,
        refunds: cases
            .filter((item) => item.status === 'completed')
            .reduce((sum, item) => sum + (Number(item.refund_amount) || 0), 0),
        quarantined: 0,
    }, [cases, totals])

    /** Dias que lleva abierto un caso, para que los viejos salten a la vista. */
    const ageInDays = (iso: string) => {
        const created = new Date(iso).getTime()
        if (!Number.isFinite(created)) return 0
        return Math.floor((Date.now() - created) / 86400000)
    }

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
            setRejectionReason('')
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
                    <SectionGuideButton guide={AFTER_SALES_GUIDE} />
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


            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {([
                    {
                        key: 'open' as const,
                        label: 'Abiertos',
                        value: String(summary.open),
                        hint: 'Esperando resolucion',
                        filter: 'open' as const,
                        accent: 'border-slate-200 dark:border-white/10',
                    },
                    {
                        key: 'approved' as const,
                        label: 'Aprobados',
                        value: String(summary.approved),
                        hint: 'Pendientes de completar',
                        filter: 'approved' as const,
                        accent: 'border-blue-200 dark:border-blue-900/40',
                    },
                    {
                        key: 'refunds' as const,
                        label: 'Reintegrado',
                        value: formatMoney(summary.refunds),
                        hint: 'En casos completados',
                        filter: null,
                        accent: 'border-emerald-200 dark:border-emerald-900/40',
                    },
                    {
                        key: 'quarantined' as const,
                        label: 'Mercaderia con falla',
                        value: `${summary.quarantined} u.`,
                        hint: 'Devuelta, no vendible',
                        filter: null,
                        accent: 'border-amber-200 dark:border-amber-900/40',
                    },
                ] as Array<{
                    key: string; label: string; value: string; hint: string
                    filter: CaseStatus | null; accent: string
                }>).map((card) => {
                    // Solo filtran las tarjetas accionables. Antes "Reintegrado" y
                    // "Mercaderia con falla" filtraban por completado, y como esos
                    // casos no tienen acciones, la lista quedaba sin botones sin
                    // que se entendiera por que.
                    const clickable = card.filter !== null
                    const active = clickable && statusFilter === card.filter
                    const toggle = () => {
                        if (!clickable) return
                        setStatusFilter(active ? 'all' : card.filter!)
                    }
                    return (
                        <Card
                            key={card.key}
                            role={clickable ? 'button' : undefined}
                            tabIndex={clickable ? 0 : undefined}
                            onClick={toggle}
                            onKeyDown={(event) => {
                                if (!clickable) return
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    toggle()
                                }
                            }}
                            className={cn(
                                'transition-all',
                                clickable && 'cursor-pointer hover:shadow-sm',
                                card.accent,
                                active && 'ring-2 ring-blue-500/40'
                            )}
                        >
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">{card.label}</p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
                                <p className="text-xs text-muted-foreground">{card.hint}</p>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <Tabs value={view} onValueChange={(value) => setView(value as 'cases' | 'sources')} className="space-y-5">
                <TabsList>
                    <TabsTrigger value="cases">Casos de posventa</TabsTrigger>
                    <TabsTrigger value="sources">Ventas y reparaciones</TabsTrigger>
                </TabsList>

                <TabsContent value="sources" className="mt-0">
                    <SourcesBrowser />
                </TabsContent>

                <TabsContent value="cases" className="mt-0 space-y-5">
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
                <>
                {/* Un filtro activo explica por que faltan casos o botones. */}
                {hasFilters && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs dark:border-blue-900/40 dark:bg-blue-950/20">
                        <span className="font-medium text-blue-900 dark:text-blue-200">Filtro activo:</span>
                        {statusFilter !== 'all' && (
                            <Badge variant="outline" className={STATUS_META[statusFilter]?.className}>
                                {STATUS_META[statusFilter]?.label}
                            </Badge>
                        )}
                        {typeFilter !== 'all' && (
                            <Badge variant="outline" className={REQUEST_META[typeFilter]?.className}>
                                {REQUEST_META[typeFilter]?.label}
                            </Badge>
                        )}
                        {search.trim() && (
                            <Badge variant="outline">Busqueda: {search.trim()}</Badge>
                        )}
                        <span className="text-blue-800/80 dark:text-blue-300/80">
                            {visibleCases.length} de {cases.length} casos
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-7 text-xs text-blue-900 dark:text-blue-200"
                            onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all') }}
                        >
                            <X className="mr-1 h-3 w-3" />
                            Ver todos
                        </Button>
                    </div>
                )}

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
                                        {item.products?.name ? (
                                            <ProductThumb
                                                url={item.products.image_url}
                                                name={item.products.name}
                                                size={44}
                                            />
                                        ) : null}
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-sm font-semibold">{item.case_number || 'Sin número'}</span>
                                                <Badge variant="outline" className={requestMeta.className}>{requestMeta.label}</Badge>
                                                <Badge variant="outline" className={statusMeta.className}>{statusMeta.label}</Badge>
                                            </div>
                                            <p className="mt-1.5 text-sm">{item.reason}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {item.products?.name || item.repairs?.ticket_number || (item.source_type === 'repair' ? 'Reparación' : 'Venta')}
                                                {item.quantity > 1 ? ` · ${item.quantity} u.` : ''}
                                                {item.customers?.name ? ` · ${item.customers.name}` : ''}
                                            </p>
                                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <span>Abierto el {formatDate(item.created_at)}</span>
                                                {/* Un reclamo abierto que se estanca es plata y confianza que se pierden. */}
                                                {item.status === 'open' && ageInDays(item.created_at) >= 7 && (
                                                    <span className={cn(
                                                        'rounded px-1.5 py-0.5 font-medium',
                                                        ageInDays(item.created_at) >= 15
                                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                                    )}>
                                                        hace {ageInDays(item.created_at)} días
                                                    </span>
                                                )}
                                                {item.resolved_at ? <span>· Resuelto el {formatDate(item.resolved_at)}</span> : null}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex w-full shrink-0 flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                                        {item.refund_amount != null ? (
                                            <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(item.refund_amount)}</span>
                                        ) : null}
                                        {actions.length === 0 && (
                                            <span className="text-[11px] text-muted-foreground sm:mr-auto">
                                                Este caso ya está {statusMeta.label.toLowerCase()} y no admite más cambios.
                                                Si hace falta, registrá uno nuevo.
                                            </span>
                                        )}
                                        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 flex-1 gap-1 text-xs sm:flex-none"
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
                                                            'h-9 flex-1 gap-1.5 text-xs sm:flex-none',
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
                </>
            )}

            {/* La lista trae 200 por pedido: decirlo evita creer que no hay mas. */}
            {totalCases > cases.length && (
                <p className="text-center text-xs text-muted-foreground">
                    Mostrando {cases.length} de {totalCases} casos. Usá los filtros o el buscador para acotar.
                </p>
            )}
                </TabsContent>
            </Tabs>

            {/* Case Detail Dialog */}
            <Dialog open={Boolean(selectedCase)} onOpenChange={(open) => !open && setSelectedCase(null)}>
                <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <DialogTitle className="font-mono text-lg">
                                {selectedCase?.case_number || 'Sin numero'}
                            </DialogTitle>
                            {selectedCase && (
                                <>
                                    {/* El origen primero: decide todo lo demas (que se repone,
                                        si genera retrabajo, contra que garantia se mide). */}
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            'gap-1',
                                            selectedCase.source_type === 'repair'
                                                ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                                                : 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200'
                                        )}
                                    >
                                        {selectedCase.source_type === 'repair'
                                            ? <><Wrench className="h-3 w-3" /> Reparación</>
                                            : <><ShoppingBag className="h-3 w-3" /> Venta</>}
                                    </Badge>
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
                        <div className="grid gap-4 py-1 lg:grid-cols-2">
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
                                        {selectedCase.repairs?.problem_description && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="shrink-0 opacity-70">Falla original</dt>
                                                <dd className="min-w-0 truncate text-right font-medium">
                                                    {selectedCase.repairs.problem_description}
                                                </dd>
                                            </div>
                                        )}
                                        {selectedCase.repairs?.delivered_at && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="opacity-70">Entregada</dt>
                                                <dd className="font-medium">{formatDate(selectedCase.repairs.delivered_at)}</dd>
                                            </div>
                                        )}
                                        {selectedCase.repairs?.final_cost != null && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="opacity-70">Cobrado</dt>
                                                <dd className="font-medium">{formatMoney(selectedCase.repairs.final_cost)}</dd>
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
                                        {selectedCase.repairs?.warranty_expires_at && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="opacity-70">Garantía vence</dt>
                                                <dd className={cn(
                                                    'font-semibold',
                                                    new Date(selectedCase.repairs.warranty_expires_at).getTime() < Date.now()
                                                        && 'text-amber-600 dark:text-amber-400'
                                                )}>
                                                    {formatDate(selectedCase.repairs.warranty_expires_at)}
                                                    {new Date(selectedCase.repairs.warranty_expires_at).getTime() < Date.now() ? ' (vencida)' : ''}
                                                </dd>
                                            </div>
                                        )}
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
                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="opacity-70">Producto</dt>
                                            <dd className="flex min-w-0 items-center gap-2 text-right font-medium">
                                                <span className="min-w-0 truncate">
                                                    {selectedCase.products?.name || 'Sin producto asociado'}
                                                    {selectedCase.products?.sku ? <span className="opacity-70"> · {selectedCase.products.sku}</span> : null}
                                                </span>
                                                {selectedCase.products?.name && (
                                                    <ProductThumb
                                                        url={selectedCase.products.image_url}
                                                        name={selectedCase.products.name}
                                                        size={40}
                                                    />
                                                )}
                                            </dd>
                                        </div>

                                        {selectedCase.replacement_product && (
                                            <div className="mt-1 flex items-center justify-between gap-3 border-t border-violet-200 pt-2 dark:border-violet-900/40">
                                                <dt className="opacity-70">Se lleva en cambio</dt>
                                                <dd className="flex min-w-0 items-center gap-2 text-right font-medium">
                                                    <span className="min-w-0 truncate">
                                                        {selectedCase.replacement_product.name}
                                                        {selectedCase.replacement_quantity ? <span className="opacity-70"> · {selectedCase.replacement_quantity} u.</span> : null}
                                                    </span>
                                                    <ProductThumb
                                                        url={selectedCase.replacement_product.image_url}
                                                        name={selectedCase.replacement_product.name || 'Producto'}
                                                        size={40}
                                                    />
                                                </dd>
                                            </div>
                                        )}

                                        {selectedCase.price_difference != null && selectedCase.price_difference !== 0 && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="opacity-70">Diferencia</dt>
                                                <dd className="font-semibold">
                                                    {selectedCase.price_difference > 0
                                                        ? `El cliente abona ${formatMoney(selectedCase.price_difference)}`
                                                        : `Se le devuelven ${formatMoney(Math.abs(selectedCase.price_difference))}`}
                                                </dd>
                                            </div>
                                        )}
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
                            <div className="space-y-3">
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
                                <div className="grid gap-2 sm:grid-cols-2 lg:col-span-2">
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
                            <div className="rounded-xl border bg-muted/20 p-3 lg:col-span-2">
                                <ol className="space-y-1.5 text-xs sm:flex sm:items-center sm:gap-6 sm:space-y-0">
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

                            <DialogFooter className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t lg:col-span-2">
                                {/* Que implica el proximo paso, para no tener que saberlo de memoria. */}
                                <p className="mr-auto max-w-md text-left text-[11px] text-muted-foreground">
                                    {selectedCase.status === 'open'
                                        ? selectedCase.request_type === 'repair_warranty'
                                            ? 'Aprobar crea la reparación de retrabajo sin costo. Rechazar cierra el caso sin efectos.'
                                            : 'Aprobar habilita completarlo. Recién al completar se mueve el dinero y la mercadería.'
                                        : selectedCase.status === 'approved'
                                            ? 'Al completar se aplica el reintegro y el destino de la mercadería.'
                                            : `Este caso ya está ${STATUS_META[selectedCase.status]?.label.toLowerCase()} y no admite más cambios.`}
                                </p>
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
                    setRejectionReason('')
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
                            {/* Cerrar el caso no cierra el retrabajo: son dos cosas
                                distintas y nada las sincroniza. Se avisa, pero no se
                                bloquea, porque puede haber razones legitimas para
                                cerrar el caso administrativo antes de entregar. */}
                            {confirming.item.generated_repair
                                && confirming.item.generated_repair.status !== 'entregado' && (
                                <div role="status" className="rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                                    <p className="font-semibold">El retrabajo todavía no fue entregado</p>
                                    <p className="mt-0.5">
                                        La reparación {confirming.item.generated_repair.ticket_number ?? 'de garantía'} sigue
                                        abierta en el taller. Podés cerrar el caso igual, pero el equipo continúa sin entregarse.
                                    </p>
                                </div>
                            )}

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

                    {confirming?.status === 'rejected' && (
                        <div className="space-y-2">
                            <label htmlFor="rejection-reason" className="text-sm font-medium">
                                Motivo del rechazo <span className="text-destructive">*</span>
                            </label>
                            <Textarea
                                id="rejection-reason"
                                value={rejectionReason}
                                onChange={(event) => setRejectionReason(event.target.value)}
                                placeholder="Explicá por qué no corresponde aprobar este reclamo..."
                                rows={3}
                                maxLength={1000}
                            />
                            <div className="flex flex-wrap gap-1.5" aria-label="Motivos frecuentes de rechazo">
                                {['Fuera del plazo', 'Daño por mal uso', 'No se comprobó la falla', 'No cumple la política'].map((reason) => (
                                    <Button
                                        key={reason}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[11px]"
                                        onClick={() => setRejectionReason(reason)}
                                    >
                                        {reason}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                El motivo quedará guardado en las notas internas del caso.
                            </p>
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
                                        : confirming.status === 'rejected'
                                            ? { notes: rejectionReason.trim() }
                                            : undefined
                                )
                            }}
                            disabled={
                                Boolean(pendingId)
                                || (needsRefundMethod && !refundMethod)
                                || (confirming?.status === 'rejected' && rejectionReason.trim().length < 5)
                            }
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
