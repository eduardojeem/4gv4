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
import { Pagination } from '@/components/ui/pagination'
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
    AlertCircle,
    AlertTriangle,
    Banknote,
    Calendar,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Eye,
    FileText,
    Inbox,
    LayoutGrid,
    List,
    Mail,
    PackageCheck,
    PackageX,
    Phone,
    Plus,
    RefreshCw,
    Search,
    ShieldAlert,
    ShieldCheck,
    ShoppingBag,
    Sparkles,
    Table2,
    User,
    Wrench,
    X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { normalizeAfterSalesCase } from '@/lib/after-sales/compat'
import { ProductThumb } from '@/components/suppliers/order-ui'
import { CreateAfterSalesCaseDialog } from './CreateAfterSalesCaseDialog'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { AFTER_SALES_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { SourcesBrowser } from './SourcesBrowser'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
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
    customers?: { name: string | null; phone: string | null; email?: string | null } | null
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
    const subscription = useSubscriptionStatus() as { effectiveModules?: string[]; tieneTaller?: boolean }
    const tieneTaller = Array.isArray(subscription?.effectiveModules)
        ? subscription.effectiveModules.includes('repairs')
        : Boolean(subscription?.tieneTaller ?? false)

    const searchParams = useSearchParams()
    const [cases, setCases] = useState<AfterSalesCase[]>([])
    const [loading, setLoading] = useState(true)
    // Los casos siguen siendo la vista principal: el listado de comprobantes es
    // el punto de entrada cuando el cliente llega con un ticket en la mano.
    const [view, setView] = useState<'cases' | 'sources'>('cases')
    const [caseViewMode, setCaseViewMode] = useState<'list' | 'card' | 'table'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('after_sales_view_mode')
            if (saved === 'list' || saved === 'card' || saved === 'table') return saved
        }
        return 'list'
    })

    const handleViewModeChange = (mode: 'list' | 'card' | 'table') => {
        setCaseViewMode(mode)
        try {
            localStorage.setItem('after_sales_view_mode', mode)
        } catch {}
    }

    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all')
    const [typeFilter, setTypeFilter] = useState<'all' | RequestType>('all')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(15)
    const [pagination, setPagination] = useState<{
        page: number
        limit: number
        total: number
        totalPages: number
    }>({
        page: 1,
        limit: 15,
        total: 0,
        totalPages: 1,
    })
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
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [reworkConsent, setReworkConsent] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
        }, 300)
        return () => clearTimeout(timer)
    }, [search])

    useEffect(() => {
        setPage(1)
    }, [debouncedSearch, statusFilter, typeFilter])

    useEffect(() => {
        if (!tieneTaller && typeFilter === 'repair_warranty') {
            setTypeFilter('all')
        }
    }, [tieneTaller, typeFilter])

    useEffect(() => {
        if (searchParams?.get('new') === 'true') {
            setIsCreateDialogOpen(true)
        }
    }, [searchParams])

    const loadCases = useCallback(async (options?: { isSilent?: boolean; pageOverride?: number; limitOverride?: number }) => {
        const targetPage = options?.pageOverride ?? page
        const targetLimit = options?.limitOverride ?? pageSize

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

            const params = new URLSearchParams()
            params.set('page', String(targetPage))
            params.set('limit', String(targetLimit))
            if (statusFilter !== 'all') params.set('status', statusFilter)
            if (typeFilter !== 'all') params.set('request_type', typeFilter)
            if (!tieneTaller) params.set('source_type', 'sale')
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())

            const response = await fetch(`/api/after-sales?${params.toString()}`, { cache: 'no-store' })
            const payload = await response.json().catch(() => null) as {
                success?: boolean
                data?: AfterSalesCase[]
                error?: string
                pagination?: { page?: number; limit?: number; total?: number; totalPages?: number }
            } | null

            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || 'No se pudieron cargar los casos.')
            }

            const rawData = Array.isArray(payload?.data)
                ? payload.data.map((item) => normalizeAfterSalesCase(item as unknown as Record<string, unknown>) as unknown as AfterSalesCase)
                : []

            setCases(rawData)
            const total = Number(payload?.pagination?.total ?? rawData.length)
            const totalPages = Number(payload?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / targetLimit)))
            setPagination({
                page: targetPage,
                limit: targetLimit,
                total,
                totalPages,
            })
            setTotalCases(total)
        } catch (error) {
            toast.error('No se pudieron cargar los casos de posventa', {
                description: error instanceof Error ? error.message : 'Intenta nuevamente.',
            })
            setCases([])
        } finally {
            setLoading(false)
        }
    }, [page, pageSize, statusFilter, typeFilter, tieneTaller, debouncedSearch])

    useEffect(() => {
        void loadCases()
    }, [loadCases])

    const effectiveCases = useMemo(() => {
        if (tieneTaller) return cases
        return cases.filter((item) => item.source_type !== 'repair')
    }, [cases, tieneTaller])

    const visibleCases = useMemo(() => {
        const term = debouncedSearch.trim().toLowerCase()
        return cases.filter((item) => {
            if (!tieneTaller && item.source_type === 'repair') return false
            if (statusFilter !== 'all' && item.status !== statusFilter) return false
            if (typeFilter !== 'all' && item.request_type !== typeFilter) return false
            if (!term) return true
            return [item.case_number, item.reason, item.notes]
                .some((field) => (field || '').toLowerCase().includes(term))
        })
    }, [cases, debouncedSearch, statusFilter, typeFilter, tieneTaller])

    const summary = useMemo(() => totals ?? {
        open: effectiveCases.filter((item) => item.status === 'open').length,
        approved: effectiveCases.filter((item) => item.status === 'approved').length,
        completed: effectiveCases.filter((item) => item.status === 'completed').length,
        rejected: effectiveCases.filter((item) => item.status === 'rejected').length,
        refunds: effectiveCases
            .filter((item) => item.status === 'completed')
            .reduce((sum, item) => sum + (Number(item.refund_amount) || 0), 0),
        quarantined: 0,
    }, [effectiveCases, totals])

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
            setResolutionNotes('')
            setReworkConsent(false)
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

    const originalTotal = confirming?.item.source_type === 'sale'
        ? Number(confirming.item.sales?.total_amount) || null
        : Number(confirming?.item.repairs?.final_cost) || null

    const refundExceedsOriginal = Boolean(originalTotal !== null && originalTotal > 0 && parsedRefund > originalTotal)

    const hasPendingRework = Boolean(
        confirming?.status === 'completed'
        && confirming.item.generated_repair
        && confirming.item.generated_repair.status !== 'entregado'
    )

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Posventa</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {tieneTaller
                            ? 'Garantías, cambios y devoluciones originados en ventas o reparaciones.'
                            : 'Garantías, cambios y devoluciones originados en ventas de mostrador.'}
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
                        label: 'Casos Abiertos',
                        value: String(summary.open),
                        hint: 'Esperando resolución técnica',
                        filter: 'open' as const,
                        icon: Clock,
                        tone: 'text-amber-600 dark:text-amber-400',
                        badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                        accent: 'border-amber-200/80 dark:border-amber-900/40 hover:border-amber-300',
                    },
                    {
                        key: 'approved' as const,
                        label: 'Casos Aprobados',
                        value: String(summary.approved),
                        hint: 'Listos para completar cierre',
                        filter: 'approved' as const,
                        icon: CheckCircle2,
                        tone: 'text-blue-600 dark:text-blue-400',
                        badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
                        accent: 'border-blue-200/80 dark:border-blue-900/40 hover:border-blue-300',
                    },
                    {
                        key: 'refunds' as const,
                        label: 'Reintegros',
                        value: formatMoney(summary.refunds),
                        hint: 'Devoluciones acreditadas',
                        filter: null,
                        icon: Banknote,
                        tone: 'text-rose-600 dark:text-rose-400',
                        badgeBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
                        accent: 'border-rose-200/80 dark:border-rose-900/40 hover:border-rose-300',
                    },
                    {
                        key: 'completed' as const,
                        label: 'Completados',
                        value: String(summary.completed),
                        hint: 'Casos cerrados y auditados',
                        filter: 'completed' as const,
                        icon: PackageCheck,
                        tone: 'text-emerald-600 dark:text-emerald-400',
                        badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                        accent: 'border-emerald-200/80 dark:border-emerald-900/40 hover:border-emerald-300',
                    },
                ]).map((card) => {
                    const CardIcon = card.icon
                    const active = card.filter ? statusFilter === card.filter : false
                    const clickable = card.filter !== null
                    const toggle = () => {
                        if (!card.filter) return
                        setStatusFilter((current) => current === card.filter ? 'all' : card.filter!)
                    }
                    return (
                        <Card
                            key={card.key}
                            role={clickable ? 'button' : undefined}
                            tabIndex={clickable ? 0 : undefined}
                            aria-pressed={clickable ? active : undefined}
                            onClick={toggle}
                            onKeyDown={(event) => {
                                if (!clickable) return
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    toggle()
                                }
                            }}
                            className={cn(
                                'transition-all duration-200 shadow-xs',
                                clickable && 'cursor-pointer hover:shadow-md',
                                card.accent,
                                active && 'ring-2 ring-primary shadow-md border-primary'
                            )}
                        >
                            <CardContent className="p-4 flex flex-col justify-between h-full">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</p>
                                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', card.badgeBg)}>
                                        <CardIcon className={cn('h-4 w-4', card.tone)} />
                                    </span>
                                </div>
                                <div className="mt-2.5">
                                    <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{card.value}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <Tabs value={view} onValueChange={(value) => setView(value as 'cases' | 'sources')} className="space-y-5">
                <TabsList>
                    <TabsTrigger value="cases">Casos de posventa</TabsTrigger>
                    <TabsTrigger value="sources">
                        {tieneTaller ? 'Ventas y reparaciones' : 'Comprobantes de venta'}
                    </TabsTrigger>
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
                        {(Object.keys(REQUEST_META) as RequestType[])
                            .filter((key) => tieneTaller || key !== 'repair_warranty')
                            .map((key) => (
                                <SelectItem key={key} value={key}>{REQUEST_META[key].label}</SelectItem>
                            ))}
                    </SelectContent>
                </Select>

                <span className="text-xs text-muted-foreground">
                    {pagination.total > 0
                        ? `${pagination.total} caso${pagination.total === 1 ? '' : 's'}`
                        : '0 casos'}
                </span>

                {hasFilters ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 gap-1.5 text-xs"
                        onClick={() => { setSearch(''); setDebouncedSearch(''); setStatusFilter('all'); setTypeFilter('all'); setPage(1) }}
                    >
                        <X className="h-3.5 w-3.5" />
                        Limpiar
                    </Button>
                ) : null}

                {/* Selector de Vistas: Lista, Tarjetas, Tabla */}
                <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-background shadow-2xs ml-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => handleViewModeChange('list')}
                        className={cn(
                            "h-8 px-2.5 text-xs gap-1.5 transition-colors cursor-pointer",
                            caseViewMode === 'list'
                                ? "bg-primary text-primary-foreground font-bold shadow-xs hover:bg-primary/90 hover:text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Vista Lista"
                        aria-label="Vista Lista"
                        aria-pressed={caseViewMode === 'list'}
                    >
                        <List className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Lista</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => handleViewModeChange('card')}
                        className={cn(
                            "h-8 px-2.5 text-xs gap-1.5 transition-colors cursor-pointer",
                            caseViewMode === 'card'
                                ? "bg-primary text-primary-foreground font-bold shadow-xs hover:bg-primary/90 hover:text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Vista Tarjetas"
                        aria-label="Vista Tarjetas"
                        aria-pressed={caseViewMode === 'card'}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Tarjetas</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => handleViewModeChange('table')}
                        className={cn(
                            "h-8 px-2.5 text-xs gap-1.5 transition-colors cursor-pointer",
                            caseViewMode === 'table'
                                ? "bg-primary text-primary-foreground font-bold shadow-xs hover:bg-primary/90 hover:text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Vista Tabla"
                        aria-label="Vista Tabla"
                        aria-pressed={caseViewMode === 'table'}
                    >
                        <Table2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Tabla</span>
                    </Button>
                </div>
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
                            <Button variant="outline" size="sm" className="mt-2" onClick={() => { setSearch(''); setDebouncedSearch(''); setStatusFilter('all'); setTypeFilter('all'); setPage(1) }}>
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
                            {pagination.total} caso{pagination.total === 1 ? '' : 's'} encontrado{pagination.total === 1 ? '' : 's'}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-7 text-xs text-blue-900 dark:text-blue-200"
                            onClick={() => { setSearch(''); setDebouncedSearch(''); setStatusFilter('all'); setTypeFilter('all'); setPage(1) }}
                        >
                            <X className="mr-1 h-3 w-3" />
                            Ver todos
                        </Button>
                    </div>
                )}

                {caseViewMode === 'table' ? (
                    <div className="rounded-xl border bg-card shadow-2xs overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableHead className="font-bold text-xs w-[140px]">Caso</TableHead>
                                    <TableHead className="font-bold text-xs w-[170px]">Tipo y Origen</TableHead>
                                    <TableHead className="font-bold text-xs">Cliente</TableHead>
                                    <TableHead className="font-bold text-xs">Producto / Equipo</TableHead>
                                    <TableHead className="font-bold text-xs max-w-[200px]">Motivo</TableHead>
                                    <TableHead className="font-bold text-xs w-[110px]">Reintegro</TableHead>
                                    <TableHead className="font-bold text-xs w-[110px]">Estado</TableHead>
                                    <TableHead className="text-right font-bold text-xs w-[180px]">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleCases.map((item) => {
                                    const requestMeta = REQUEST_META[item.request_type] ?? REQUEST_META.return
                                    const statusMeta = STATUS_META[item.status] ?? STATUS_META.open
                                    const actions = NEXT_ACTIONS[item.status] ?? []
                                    const isPending = pendingId === item.id

                                    return (
                                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="align-middle">
                                                <span className="font-mono text-xs font-bold text-foreground block">
                                                    {item.case_number || 'Sin número'}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Clock className="h-2.5 w-2.5 shrink-0" />
                                                    {formatDate(item.created_at)}
                                                </span>
                                            </TableCell>

                                            <TableCell className="align-middle">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <Badge variant="outline" className={cn('text-[10px] font-semibold', requestMeta.className)}>
                                                        {requestMeta.label}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                                        {item.source_type === 'repair' ? <Wrench className="h-2.5 w-2.5" /> : <ShoppingBag className="h-2.5 w-2.5" />}
                                                        {item.source_type === 'repair'
                                                            ? `Rep. #${item.repairs?.ticket_number ?? '—'}`
                                                            : `Vta. #${item.sales?.code ?? '—'}`}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-middle">
                                                <span className="text-xs font-medium text-foreground block truncate max-w-[130px]">
                                                    {item.customers?.name || 'Cliente no registrado'}
                                                </span>
                                                {item.customers?.phone && (
                                                    <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <Phone className="h-2.5 w-2.5" />
                                                        {item.customers.phone}
                                                    </span>
                                                )}
                                            </TableCell>

                                            <TableCell className="align-middle">
                                                {item.products?.name ? (
                                                    <div className="flex items-center gap-2 max-w-[180px]">
                                                        <div className="h-7 w-7 shrink-0 overflow-hidden rounded border bg-muted/20">
                                                            <ProductThumb
                                                                url={item.products.image_url}
                                                                name={item.products.name}
                                                                size={28}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="text-xs font-medium text-foreground truncate block">{item.products.name}</span>
                                                            <span className="text-[10px] text-muted-foreground font-mono">{item.quantity} un.</span>
                                                        </div>
                                                    </div>
                                                ) : item.repairs?.device_brand || item.repairs?.device_model ? (
                                                    <div className="min-w-0 max-w-[180px]">
                                                        <span className="text-xs font-medium text-foreground truncate block">
                                                            {[item.repairs.device_brand, item.repairs.device_model].filter(Boolean).join(' ')}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground truncate block">
                                                            {item.repairs.problem_description || 'Sin descripción'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>

                                            <TableCell className="align-middle max-w-[200px]">
                                                <p className="text-xs text-foreground/90 truncate" title={item.reason}>
                                                    {item.reason}
                                                </p>
                                            </TableCell>

                                            <TableCell className="align-middle">
                                                {item.refund_amount != null ? (
                                                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                                        {formatMoney(item.refund_amount)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/60">—</span>
                                                )}
                                            </TableCell>

                                            <TableCell className="align-middle">
                                                <Badge variant="outline" className={cn('text-[10px] font-bold', statusMeta.className)}>
                                                    {statusMeta.label}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="text-right align-middle">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs font-medium gap-1"
                                                        onClick={() => setSelectedCase(item)}
                                                        title="Ver detalle"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        <span className="hidden xl:inline">Detalle</span>
                                                    </Button>
                                                    {actions.map((action) => {
                                                        const ActionIcon = action.icon
                                                        return (
                                                            <Button
                                                                key={action.status}
                                                                variant={action.status === 'approved' || action.status === 'completed' ? 'default' : 'outline'}
                                                                size="sm"
                                                                className={cn(
                                                                    'h-7 px-2 text-xs font-medium gap-1 shadow-2xs',
                                                                    action.status === 'approved' && 'bg-blue-600 hover:bg-blue-700 text-white',
                                                                    action.status === 'completed' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                                                                    action.destructive && 'text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive'
                                                                )}
                                                                disabled={isPending}
                                                                onClick={() => {
                                                                    setRestockAction(
                                                                        item.request_type === 'product_warranty'
                                                                            ? 'quarantine'
                                                                            : item.request_type === 'exchange' || item.request_type === 'return'
                                                                                ? 'sellable'
                                                                                : 'none'
                                                                    )
                                                                    setConfirming({ item, status: action.status, label: action.label })
                                                                }}
                                                                title={action.label}
                                                            >
                                                                <ActionIcon className="h-3 w-3" />
                                                                <span className="hidden xl:inline">{action.label}</span>
                                                            </Button>
                                                        )
                                                    })}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                ) : caseViewMode === 'card' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                        {visibleCases.map((item) => {
                            const requestMeta = REQUEST_META[item.request_type] ?? REQUEST_META.return
                            const statusMeta = STATUS_META[item.status] ?? STATUS_META.open
                            const RequestIcon = requestMeta.icon
                            const actions = NEXT_ACTIONS[item.status] ?? []
                            const isPending = pendingId === item.id

                            return (
                                <Card
                                    key={item.id}
                                    className="group relative flex flex-col justify-between rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/40 text-card-foreground shadow-2xs"
                                >
                                    <div className="space-y-3">
                                        {/* Header: Código + Badges */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-xs', requestMeta.className)}>
                                                    <RequestIcon className="h-4.5 w-4.5" />
                                                </span>
                                                <div className="min-w-0">
                                                    <span className="font-mono text-sm font-bold text-foreground truncate block">
                                                        {item.case_number || 'Sin número'}
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                        <Clock className="h-3 w-3 shrink-0" />
                                                        {formatDate(item.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className={cn('text-[10px] shrink-0 font-bold', statusMeta.className)}>
                                                {statusMeta.label}
                                            </Badge>
                                        </div>

                                        {/* Origen + Tipo Badges */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    'text-[10px] gap-1 font-semibold',
                                                    item.source_type === 'repair'
                                                        ? 'border-blue-200 bg-blue-50/80 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300'
                                                        : 'border-violet-200 bg-violet-50/80 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300'
                                                )}
                                            >
                                                {item.source_type === 'repair' ? <Wrench className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                                                {item.source_type === 'repair'
                                                    ? `Reparación #${item.repairs?.ticket_number ?? '—'}`
                                                    : `Venta #${item.sales?.code ?? '—'}`}
                                            </Badge>
                                            <Badge variant="outline" className={cn('text-[10px] font-medium', requestMeta.className)}>
                                                {requestMeta.label}
                                            </Badge>
                                        </div>

                                        {/* Producto o Equipo */}
                                        {item.products?.name ? (
                                            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/25 border border-border/40">
                                                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-muted/20">
                                                    <ProductThumb
                                                        url={item.products?.image_url}
                                                        name={item.products?.name || ''}
                                                        size={36}
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-semibold text-foreground truncate">{item.products.name}</p>
                                                    <p className="text-[10px] text-muted-foreground font-mono">
                                                        {item.quantity} un.{item.products.sku ? ` · SKU: ${item.products.sku}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : item.repairs?.device_brand || item.repairs?.device_model ? (
                                            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/25 border border-border/40">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/30">
                                                    <Wrench className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-semibold text-foreground truncate">
                                                        {[item.repairs.device_brand, item.repairs.device_model].filter(Boolean).join(' ')}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground truncate">
                                                        {item.repairs.problem_description || 'Sin descripción'}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* Motivo */}
                                        <div className="rounded-lg bg-muted/30 p-2.5 border border-border/30">
                                            <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-relaxed">
                                                <span className="text-muted-foreground font-normal">Motivo: </span>
                                                {item.reason}
                                            </p>
                                        </div>

                                        {/* Reintegro si aplica */}
                                        {item.refund_amount != null && (
                                            <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50">
                                                <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                                                    {item.refund_method === 'cash' ? 'Reintegro en caja' : item.refund_method === 'store_credit' ? 'Saldo a favor' : 'Reintegro'}
                                                </span>
                                                <span className="font-bold text-xs text-emerald-700 dark:text-emerald-300 tabular-nums">
                                                    {formatMoney(item.refund_amount)}
                                                </span>
                                            </div>
                                        )}

                                        {/* Cliente */}
                                        {item.customers?.name && (
                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
                                                <span className="flex items-center gap-1.5 font-medium text-foreground/90 truncate max-w-[160px]">
                                                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    {item.customers.name}
                                                </span>
                                                {item.customers.phone && (
                                                    <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 shrink-0">
                                                        <Phone className="h-2.5 w-2.5" />
                                                        {item.customers.phone}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer Acciones */}
                                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border/40">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 flex-1 gap-1 text-xs font-medium"
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
                                                        'h-8 px-2.5 gap-1 text-xs font-medium shadow-xs',
                                                        action.status === 'approved' && 'bg-blue-600 hover:bg-blue-700 text-white',
                                                        action.status === 'completed' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                                                        action.destructive && 'text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive'
                                                    )}
                                                    disabled={isPending}
                                                    onClick={() => {
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
                                                    <span className="hidden sm:inline">{action.label}</span>
                                                </Button>
                                            )
                                        })}
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                    <ul role="list" className="space-y-3">
                        {visibleCases.map((item) => {
                            const requestMeta = REQUEST_META[item.request_type] ?? REQUEST_META.return
                            const statusMeta = STATUS_META[item.status] ?? STATUS_META.open
                            const RequestIcon = requestMeta.icon
                            const actions = NEXT_ACTIONS[item.status] ?? []
                            const isPending = pendingId === item.id

                            return (
                                <li
                                    key={item.id}
                                    className="group relative rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/30"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs', requestMeta.className)}>
                                                <RequestIcon className="h-5 w-5" />
                                            </span>
                                            {item.products?.name ? (
                                                <div className="shrink-0 overflow-hidden rounded-lg border bg-muted/20">
                                                    <ProductThumb
                                                        url={item.products.image_url}
                                                        name={item.products.name}
                                                        size={48}
                                                    />
                                                </div>
                                            ) : null}
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-mono text-sm font-bold tracking-tight">
                                                        {item.case_number || 'Sin número'}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'gap-1 text-[11px] font-medium',
                                                            item.source_type === 'repair'
                                                                ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300'
                                                                : 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300'
                                                        )}
                                                    >
                                                        {item.source_type === 'repair' ? (
                                                            <>
                                                                <Wrench className="h-3 w-3" />
                                                                Reparación {item.repairs?.ticket_number ? `· ${item.repairs.ticket_number}` : ''}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ShoppingBag className="h-3 w-3" />
                                                                Venta {item.sales?.code ? `· ${item.sales.code}` : ''}
                                                            </>
                                                        )}
                                                    </Badge>
                                                    <Badge variant="outline" className={cn('text-[11px]', requestMeta.className)}>
                                                        {requestMeta.label}
                                                    </Badge>
                                                    <Badge variant="outline" className={cn('text-[11px]', statusMeta.className)}>
                                                        {statusMeta.label}
                                                    </Badge>
                                                </div>

                                                <p className="text-sm font-medium text-foreground leading-snug pt-0.5">
                                                    {item.reason}
                                                </p>

                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    {(item.products?.name || item.repairs?.device_brand || item.repairs?.device_model) && (
                                                        <span className="font-medium text-foreground/80">
                                                            {item.products?.name
                                                                ? `${item.products.name}${item.quantity > 1 ? ` (${item.quantity} u.)` : ''}`
                                                                : `${item.repairs?.device_brand || ''} ${item.repairs?.device_model || ''}`.trim()}
                                                        </span>
                                                    )}
                                                    {item.customers?.name && (
                                                        <span className="flex items-center gap-1">
                                                            <User className="h-3 w-3 opacity-70" />
                                                            {item.customers.name}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3 opacity-70" />
                                                        Abierto {formatDate(item.created_at)}
                                                    </span>
                                                    {item.status === 'open' && ageInDays(item.created_at) >= 7 && (
                                                        <span className={cn(
                                                            'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                                                            ageInDays(item.created_at) >= 15
                                                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                                        )}>
                                                            hace {ageInDays(item.created_at)} días
                                                        </span>
                                                    )}
                                                    {item.resolved_at ? (
                                                        <span className="text-emerald-600 dark:text-emerald-400">
                                                            · Resuelto el {formatDate(item.resolved_at)}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>

                                        {item.refund_amount != null && (
                                            <div className="shrink-0 text-right">
                                                <div className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-bold tabular-nums text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                    <Banknote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                                    {formatMoney(item.refund_amount)}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    {item.refund_method === 'cash' ? 'Caja' : item.refund_method === 'store_credit' ? 'Saldo a favor' : 'Reintegro'}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-3 flex w-full flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                        {actions.length === 0 ? (
                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/70" />
                                                Este caso ya está {statusMeta.label.toLowerCase()} y no admite más cambios.
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                                {item.status === 'open' ? 'Pendiente de evaluación técnica.' : 'Aprobado: listo para aplicar reintegro o stock.'}
                                            </span>
                                        )}
                                        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 flex-1 gap-1.5 text-xs font-medium sm:flex-none"
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
                                                            'h-8 flex-1 gap-1.5 text-xs font-medium sm:flex-none shadow-xs',
                                                            action.status === 'approved' && 'bg-blue-600 hover:bg-blue-700 text-white',
                                                            action.status === 'completed' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                                                            action.destructive && 'text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive'
                                                        )}
                                                        disabled={isPending}
                                                        onClick={() => {
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
                                </li>
                            )
                        })}
                    </ul>
                )}
                </>
            )}

            {/* Paginación de casos */}
            {!loading && (
                <div className="pt-2">
                    {pagination.totalPages > 1 ? (
                        <div className="pt-2">
                            <Pagination
                                currentPage={pagination.page}
                                totalPages={pagination.totalPages}
                                itemsPerPage={pagination.limit}
                                totalItems={pagination.total}
                                onPageChange={(newPage) => {
                                    setPage(newPage)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                                onItemsPerPageChange={(newSize) => {
                                    setPageSize(newSize)
                                    setPage(1)
                                }}
                                itemsPerPageOptions={[10, 15, 25, 50]}
                            />
                        </div>
                    ) : pagination.total > 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-2">
                            Mostrando todos los {pagination.total} casos
                        </p>
                    ) : null}
                </div>
            )}
                </TabsContent>
            </Tabs>

            {/* Case Detail Dialog */}
            <Dialog open={Boolean(selectedCase)} onOpenChange={(open) => !open && setSelectedCase(null)}>
                <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader className="space-y-3 pb-2 border-b">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <DialogTitle className="font-mono text-xl font-bold tracking-tight">
                                    {selectedCase?.case_number || 'Sin número'}
                                </DialogTitle>
                                {selectedCase && (
                                    <>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'gap-1 font-medium',
                                                selectedCase.source_type === 'repair'
                                                    ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                                                    : 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200'
                                            )}
                                        >
                                            {selectedCase.source_type === 'repair'
                                                ? <><Wrench className="h-3.5 w-3.5" /> Reparación</>
                                                : <><ShoppingBag className="h-3.5 w-3.5" /> Venta</>}
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
                        </div>
                        <DialogDescription asChild>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {selectedCase?.customers?.name ? (
                                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                        {selectedCase.customers.name}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                        Cliente ocasional / Sin registrar
                                    </span>
                                )}
                                {selectedCase?.customers?.phone && (
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                        <Phone className="h-3 w-3" />
                                        {selectedCase.customers.phone}
                                    </span>
                                )}
                                {selectedCase?.customers?.email && (
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                        <Mail className="h-3 w-3" />
                                        {selectedCase.customers.email}
                                    </span>
                                )}
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    {selectedCase && (
                        <div className="grid gap-4 py-2 lg:grid-cols-2">
                            {/* Origen del reclamo */}
                            {selectedCase.source_type === 'repair' ? (
                                <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 space-y-3">
                                    <div className="flex items-center justify-between gap-2 border-b border-blue-200/60 pb-2 dark:border-blue-900/40">
                                        <p className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                                            <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            Reparación de origen
                                        </p>
                                        {selectedCase.repairs?.ticket_number && (
                                            <Badge variant="outline" className="border-blue-300 bg-blue-100 font-mono text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                                                {selectedCase.repairs.ticket_number}
                                            </Badge>
                                        )}
                                    </div>
                                    <dl className="space-y-2 text-xs text-blue-950 dark:text-blue-200">
                                        {(selectedCase.repairs?.device_brand || selectedCase.repairs?.device_model) && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-muted-foreground">Equipo</dt>
                                                <dd className="font-semibold text-right">{selectedCase.repairs?.device_brand} {selectedCase.repairs?.device_model}</dd>
                                            </div>
                                        )}
                                        {selectedCase.repairs?.problem_description && (
                                            <div className="rounded-lg bg-background/60 p-2 border border-blue-100 dark:border-blue-900/30">
                                                <dt className="text-[11px] text-muted-foreground mb-0.5">Falla informada originalmente:</dt>
                                                <dd className="font-medium leading-relaxed">{selectedCase.repairs.problem_description}</dd>
                                            </div>
                                        )}
                                        {selectedCase.repairs?.delivered_at && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-muted-foreground">Fecha de entrega</dt>
                                                <dd className="font-medium">{formatDate(selectedCase.repairs.delivered_at)}</dd>
                                            </div>
                                        )}
                                        {selectedCase.repairs?.final_cost != null && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-muted-foreground">Importe cobrado</dt>
                                                <dd className="font-bold">{formatMoney(selectedCase.repairs.final_cost)}</dd>
                                            </div>
                                        )}
                                        {selectedCase.repairs?.warranty_months ? (
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-muted-foreground">Garantía otorgada</dt>
                                                <dd className="font-medium">
                                                    {selectedCase.repairs.warranty_months} meses ({selectedCase.repairs.warranty_type === 'labor' ? 'mano de obra' : selectedCase.repairs.warranty_type === 'parts' ? 'repuestos' : 'completa'})
                                                </dd>
                                            </div>
                                        ) : null}
                                        {selectedCase.repairs?.warranty_expires_at && (
                                            <div className="flex justify-between gap-3 items-center">
                                                <dt className="text-muted-foreground">Vencimiento garantía</dt>
                                                <dd className="font-semibold">
                                                    {formatDate(selectedCase.repairs.warranty_expires_at)}
                                                    {new Date(selectedCase.repairs.warranty_expires_at).getTime() < Date.now() ? (
                                                        <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">Vencida</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="ml-2 border-emerald-500 text-emerald-700 bg-emerald-50 text-[10px] px-1.5 py-0">Vigente</Badge>
                                                    )}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>

                                    {selectedCase.generated_repair?.ticket_number ? (
                                        <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-2.5 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                                            <div className="flex items-center justify-between gap-2 font-semibold">
                                                <span>Retrabajo en taller:</span>
                                                <Badge className="bg-emerald-600 font-mono text-xs text-white">
                                                    {selectedCase.generated_repair.ticket_number}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300">
                                                Estado en taller: <span className="font-semibold uppercase">{selectedCase.generated_repair.status}</span>
                                                {selectedCase.generated_repair.status !== 'entregado' && ' · Aún no entregado al cliente.'}
                                            </p>
                                        </div>
                                    ) : selectedCase.status === 'open' ? (
                                        <p className="border-t border-blue-200/60 pt-2 text-[11px] text-blue-700 dark:border-blue-900/40 dark:text-blue-300">
                                            Al aprobar este reclamo se creará automáticamente la orden de retrabajo sin costo en taller.
                                        </p>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20 space-y-3">
                                    <div className="flex items-center justify-between gap-2 border-b border-violet-200/60 pb-2 dark:border-violet-900/40">
                                        <p className="flex items-center gap-1.5 text-xs font-bold text-violet-900 dark:text-violet-200">
                                            <ShoppingBag className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                            Venta de origen
                                        </p>
                                        {selectedCase.sales?.code && (
                                            <Badge variant="outline" className="border-violet-300 bg-violet-100 font-mono text-xs text-violet-800 dark:border-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
                                                {selectedCase.sales.code}
                                            </Badge>
                                        )}
                                    </div>
                                    <dl className="space-y-2 text-xs text-violet-950 dark:text-violet-200">
                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="text-muted-foreground">Producto</dt>
                                            <dd className="flex min-w-0 items-center gap-2 text-right font-medium">
                                                <span className="min-w-0 truncate font-semibold">
                                                    {selectedCase.products?.name || 'Producto no identificado'}
                                                    {selectedCase.products?.sku ? <span className="opacity-70 text-[11px]"> · {selectedCase.products.sku}</span> : null}
                                                </span>
                                                {selectedCase.products?.name && (
                                                    <ProductThumb
                                                        url={selectedCase.products.image_url}
                                                        name={selectedCase.products.name}
                                                        size={36}
                                                    />
                                                )}
                                            </dd>
                                        </div>

                                        {selectedCase.replacement_product && (
                                            <div className="rounded-lg bg-background/60 p-2.5 border border-violet-100 dark:border-violet-900/30">
                                                <dt className="text-[11px] text-muted-foreground mb-1">Producto de cambio entregado:</dt>
                                                <dd className="flex min-w-0 items-center justify-between gap-2">
                                                    <span className="font-semibold text-xs truncate">
                                                        {selectedCase.replacement_product.name}
                                                        {selectedCase.replacement_quantity ? ` (${selectedCase.replacement_quantity} u.)` : ''}
                                                    </span>
                                                    <ProductThumb
                                                        url={selectedCase.replacement_product.image_url}
                                                        name={selectedCase.replacement_product.name || 'Producto'}
                                                        size={36}
                                                    />
                                                </dd>
                                            </div>
                                        )}

                                        {selectedCase.price_difference != null && selectedCase.price_difference !== 0 && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-muted-foreground">Diferencia de precio</dt>
                                                <dd className="font-bold">
                                                    {selectedCase.price_difference > 0
                                                        ? `Cliente abona ${formatMoney(selectedCase.price_difference)}`
                                                        : `Reintegro cliente: ${formatMoney(Math.abs(selectedCase.price_difference))}`}
                                                </dd>
                                            </div>
                                        )}
                                        <div className="flex justify-between gap-3">
                                            <dt className="text-muted-foreground">Cantidad reclamada</dt>
                                            <dd className="font-medium">{selectedCase.quantity} unidad{selectedCase.quantity > 1 ? 'es' : ''}</dd>
                                        </div>
                                        {selectedCase.sales?.total_amount != null && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-muted-foreground">Total de la venta original</dt>
                                                <dd className="font-semibold">{formatMoney(selectedCase.sales.total_amount)}</dd>
                                            </div>
                                        )}
                                    </dl>
                                </div>
                            )}

                            {/* Motivo y Notas */}
                            <div className="space-y-3">
                                <div className="rounded-xl border bg-card p-3.5 space-y-1.5 shadow-2xs">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <FileText className="h-3.5 w-3.5" />
                                        Motivo expresado por el cliente
                                    </p>
                                    <p className="text-xs leading-relaxed font-medium text-foreground bg-muted/30 p-2.5 rounded-lg border">
                                        {selectedCase.reason}
                                    </p>
                                </div>

                                <div className="rounded-xl border bg-card p-3.5 space-y-1.5 shadow-2xs">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Notas internas y de resolución
                                    </p>
                                    <p className={cn(
                                        'text-xs leading-relaxed bg-muted/30 p-2.5 rounded-lg border',
                                        !selectedCase.notes && 'text-muted-foreground italic'
                                    )}>
                                        {selectedCase.notes || 'Sin notas internas registradas.'}
                                    </p>
                                </div>
                            </div>

                            {/* Resolución (Reintegro y Stock) */}
                            {(selectedCase.refund_amount != null || selectedCase.restock_action) && (
                                <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
                                    {selectedCase.refund_amount != null && (
                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                                <Banknote className="h-3.5 w-3.5" />
                                                Reintegro aplicado
                                            </p>
                                            <p className="mt-1 text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                                                {formatMoney(selectedCase.refund_amount)}
                                            </p>
                                            <p className="text-xs font-medium text-emerald-800/80 dark:text-emerald-400 mt-0.5">
                                                {selectedCase.refund_method === 'cash'
                                                    ? 'Salida efectiva por caja'
                                                    : selectedCase.refund_method === 'store_credit'
                                                        ? 'Acreditado como saldo a favor del cliente'
                                                        : 'Método no especificado'}
                                            </p>
                                        </div>
                                    )}

                                    {selectedCase.restock_action && (
                                        <div className="rounded-xl border bg-muted/40 p-3.5">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                <PackageCheck className="h-3.5 w-3.5" />
                                                Destino de mercadería
                                            </p>
                                            <p className="mt-1 text-sm font-bold">
                                                {selectedCase.restock_action === 'sellable'
                                                    ? 'Reingresó al stock vendible'
                                                    : selectedCase.restock_action === 'quarantine'
                                                        ? 'Ingresó a cuarentena / averiado'
                                                        : 'Sin reingreso de mercadería'}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {selectedCase.restock_action === 'sellable'
                                                    ? `${selectedCase.quantity} u. devueltas disponibles para venta.`
                                                    : selectedCase.restock_action === 'quarantine'
                                                        ? 'Aislado del stock vendible para revisión o descarte.'
                                                        : 'El producto quedó en poder del cliente o fue descartado.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Timeline */}
                            <div className="rounded-xl border bg-muted/20 p-3 lg:col-span-2">
                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span>Fecha de apertura:</span>
                                        <span className="font-semibold text-foreground">{formatDate(selectedCase.created_at)}</span>
                                    </div>
                                    {selectedCase.resolved_at && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                            <span>Fecha de resolución:</span>
                                            <span className="font-semibold text-foreground">{formatDate(selectedCase.resolved_at)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <DialogFooter className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t lg:col-span-2">
                                <p className="mr-auto max-w-md text-left text-[11px] text-muted-foreground">
                                    {selectedCase.status === 'open'
                                        ? selectedCase.request_type === 'repair_warranty'
                                            ? 'Aprobar crea la reparación de retrabajo sin costo en taller. Rechazar finaliza el reclamo.'
                                            : 'Aprobar valida el reclamo y habilita completarlo con reintegro y destino de stock.'
                                        : selectedCase.status === 'approved'
                                            ? 'Al completar se liquidan el reintegro de dinero y el stock devuelto.'
                                            : `Este caso ya está ${STATUS_META[selectedCase.status]?.label.toLowerCase()} y no admite modificaciones.`}
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
                                                'gap-1.5 text-xs font-medium',
                                                action.status === 'approved' && 'bg-blue-600 hover:bg-blue-700 text-white',
                                                action.status === 'completed' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                                                action.destructive && 'text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive'
                                            )}
                                            onClick={() => {
                                                const currentCase = selectedCase
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

            {/* Confirmation & Completion Dialog with Validations */}
            <AlertDialog
                open={Boolean(confirming)}
                onOpenChange={(open) => {
                    if (open) return
                    setConfirming(null)
                    setRefundAmount('')
                    setRefundMethod(null)
                    setRejectionReason('')
                    setResolutionNotes('')
                    setReworkConsent(false)
                }}
            >
                <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirming ? `${confirming.label} caso ${confirming.item.case_number || ''}` : ''}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirming?.status === 'completed'
                                ? 'Finalizar el caso asienta las operaciones comerciales (devolución de mercadería y/o reintegro de dinero).'
                                : isWarrantyApproval
                                    ? 'Se creará automáticamente una nueva orden de servicio de garantía en taller con costo 0 Gs.'
                                    : confirming?.status === 'approved'
                                        ? 'El caso queda aprobado y habilitado para ser completado.'
                                        : 'El reclamo quedará rechazado con motivo asentado y no podrá modificarse.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {confirming?.status === 'completed' && (
                        <div className="space-y-4">
                            {/* Alerta de Retrabajo Pendiente */}
                            {hasPendingRework && (
                                <div role="status" className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
                                    <div className="flex items-start gap-2.5">
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                                        <div className="space-y-1.5 flex-1">
                                            <p className="font-semibold text-amber-900 dark:text-amber-100">
                                                El retrabajo en taller todavía no fue entregado
                                            </p>
                                            <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                                                La reparación <span className="font-mono font-semibold">{confirming.item.generated_repair?.ticket_number ?? 'de garantía'}</span> sigue en estado <span className="font-semibold uppercase">{confirming.item.generated_repair?.status}</span> en el taller técnico.
                                            </p>
                                            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                                                <Checkbox
                                                    id="rework-consent-checkbox"
                                                    checked={reworkConsent}
                                                    onCheckedChange={(checked) => setReworkConsent(Boolean(checked))}
                                                />
                                                <span className="font-medium text-amber-950 dark:text-amber-100">
                                                    Entiendo y confirmo completar el caso posventa
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Destino de la mercadería */}
                            {confirming.item.source_type === 'sale' && (
                                <div className="space-y-1.5">
                                    <span className="text-sm font-medium">Destino de la mercadería devuelta</span>
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
                                        <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                            Este caso no tiene producto asociado en inventario. No se puede reingresar como vendible.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Monto a reintegrar */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="refund-amount" className="text-sm font-medium">
                                        Monto a reintegrar
                                    </label>
                                    {originalTotal !== null && originalTotal > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            Total origen: <span className="font-semibold text-foreground">{formatMoney(originalTotal)}</span>
                                        </span>
                                    )}
                                </div>
                                <Input
                                    id="refund-amount"
                                    inputMode="numeric"
                                    value={refundAmount}
                                    onChange={(event) => setRefundAmount(event.target.value)}
                                    placeholder="0"
                                    className={cn(refundExceedsOriginal && 'border-destructive focus-visible:ring-destructive')}
                                />
                                {refundExceedsOriginal ? (
                                    <p className="text-xs font-medium text-destructive flex items-center gap-1">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                        El monto a reintegrar ({formatMoney(parsedRefund)}) supera el total original de la operación ({formatMoney(originalTotal!)}).
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground">
                                        Dejalo vacío o en 0 si no corresponde devolver dinero al cliente.
                                    </p>
                                )}
                            </div>

                            {/* Método de reintegro */}
                            {parsedRefund > 0 && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">
                                            Método de reintegro <span className="text-destructive">*</span>
                                        </span>
                                        {!refundMethod && (
                                            <span className="text-xs font-semibold text-destructive">Selección requerida</span>
                                        )}
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setRefundMethod('cash')}
                                            className={cn(
                                                'rounded-lg border p-3 text-left text-sm transition-all',
                                                refundMethod === 'cash'
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                                                    : 'hover:bg-muted/60'
                                            )}
                                        >
                                            <div className="flex items-center gap-1.5 font-semibold">
                                                <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                Por caja
                                            </div>
                                            <span className="mt-1 block text-[11px] opacity-80">
                                                Registra una salida de efectivo en la caja registradora abierta.
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRefundMethod('store_credit')}
                                            className={cn(
                                                'rounded-lg border p-3 text-left text-sm transition-all',
                                                refundMethod === 'store_credit'
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200'
                                                    : 'hover:bg-muted/60'
                                            )}
                                        >
                                            <div className="flex items-center gap-1.5 font-semibold">
                                                <CreditCard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                                Saldo a favor
                                            </div>
                                            <span className="mt-1 block text-[11px] opacity-80">
                                                Queda disponible como crédito del cliente para futuras compras.
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Notas de resolución con sugerencias interactivas */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="resolution-notes" className="text-sm font-medium">
                                        Notas de resolución / Comprobante
                                    </label>
                                    <span className="text-[11px] text-muted-foreground">Opcional</span>
                                </div>
                                <Textarea
                                    id="resolution-notes"
                                    value={resolutionNotes}
                                    onChange={(event) => setResolutionNotes(event.target.value)}
                                    placeholder="Detalles sobre el acuerdo, entrega de equipo o solución técnica..."
                                    rows={2}
                                    maxLength={500}
                                />
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {[
                                        'Reintegro en efectivo entregado en caja',
                                        'Saldo a favor acreditado para compras',
                                        'Cambio de producto realizado y entregado conforme',
                                        'Garantía técnica completada y equipo entregado',
                                        'Devolución aprobada y mercadería recibida',
                                    ].map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            type="button"
                                            onClick={() => setResolutionNotes(suggestion)}
                                            className="rounded-md border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
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
                                placeholder="Explicá por qué no corresponde aprobar este reclamo (mínimo 5 caracteres)..."
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
                                El motivo quedará guardado en el historial y notas del caso.
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
                                            ...(resolutionNotes.trim() ? { notes: resolutionNotes.trim() } : {}),
                                        }
                                        : confirming.status === 'rejected'
                                            ? { notes: rejectionReason.trim() }
                                            : undefined
                                )
                            }}
                            disabled={
                                Boolean(pendingId)
                                || (confirming?.status === 'completed' && needsRefundMethod && !refundMethod)
                                || (confirming?.status === 'completed' && refundExceedsOriginal)
                                || (confirming?.status === 'completed' && hasPendingRework && !reworkConsent)
                                || (confirming?.status === 'completed' && restockAction === 'sellable' && !confirming.item.product_id)
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
