'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    Eye,
    FileText,
    Loader2,
    Mail,
    Package,
    Phone,
    Printer,
    RotateCcw,
    Search,
    ShieldAlert,
    ShieldCheck,
    ShoppingCart,
    Smartphone,
    User,
    Wrench,
    X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/currency'
import { printReceipt } from '@/lib/receipt-utils'
import { buildReprintReceiptData, type StoredSale } from '@/lib/after-sales/sale-receipt'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { cn } from '@/lib/utils'
import { CreateAfterSalesCaseDialog, type AfterSalesSaleItem } from './CreateAfterSalesCaseDialog'
import type { RequestType, SourceType } from './after-sales-meta'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

type SourceRow = {
    id: string
    label: string
    subtitle: string
    amount?: number
    device?: string
    status?: string | null
    warrantyMonths?: number | null
    warrantyExpiresAt?: string | null
    warrantyExpired?: boolean
    date: string | null
    items?: AfterSalesSaleItem[]
}

type Pagination = { page: number; limit: number; total: number; totalPages: number }

type SaleDetail = { type: 'sale'; paymentStatus: string | null; sale: StoredSale }
type RepairDetail = {
    type: 'repair'
    id: string
    label: string
    status: string | null
    device: string
    problem: string | null
    total: number
    paidAmount: number
    warrantyMonths?: number | null
    warrantyType?: string | null
    warrantyExpiresAt: string | null
    deliveredAt: string | null
    createdAt: string | null
    customer: { name: string | null; phone: string | null; email: string | null } | null
}

const PAGE_SIZE = 15

function formatDate(value: string | null | undefined) {
    if (!value) return '—'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '—'
    return format(parsed, "d MMM yyyy, HH:mm", { locale: es })
}

export function SourcesBrowser() {
    // Sin taller no hay reparaciones contra las que reclamar.
    const subscription = useSubscriptionStatus() as { effectiveModules?: string[]; tieneTaller?: boolean }
    const tieneTaller = Array.isArray(subscription?.effectiveModules)
        ? subscription.effectiveModules.includes('repairs')
        : Boolean(subscription?.tieneTaller ?? false)

    // El ticket sale con los datos y el logo de la organizacion; sin esto caia
    // al monograma de dos letras del config global.
    const { settings: websiteSettings } = useAdminWebsiteSettings()
    const companyInfo = useMemo(() => {
        const info = websiteSettings?.company_info
        if (!info) return undefined
        return {
            name: info.name || '',
            address: info.address || '',
            phone: info.phone || '',
            email: info.email || '',
            ruc: info.ruc,
            logoUrl: info.logoUrl,
            // El termico rinde mejor el logo en blanco y negro.
            monochromeLogo: true,
        }
    }, [websiteSettings])

    const [sourceType, setSourceType] = useState<SourceType>('sale')
    const [search, setSearch] = useState('')
    const [warrantyOnly, setWarrantyOnly] = useState(true)
    const [page, setPage] = useState(1)
    const [rows, setRows] = useState<SourceRow[]>([])
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [detail, setDetail] = useState<SaleDetail | RepairDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [busyRowId, setBusyRowId] = useState<string | null>(null)
    const [claimSource, setClaimSource] = useState<SourceRow | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                type: sourceType,
                q: search,
                page: String(page),
                limit: String(PAGE_SIZE),
            })
            if (sourceType === 'repair' && !warrantyOnly) params.set('warrantyOnly', 'false')

            const response = await fetch(`/api/after-sales/sources?${params}`, { cache: 'no-store' })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error ?? 'No se pudo cargar el listado.')
            }
            setRows((payload.data ?? []) as SourceRow[])
            setPagination((payload.pagination ?? null) as Pagination | null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo cargar el listado.')
        } finally {
            setLoading(false)
        }
    }, [page, search, sourceType, warrantyOnly])

    useEffect(() => {
        const timer = window.setTimeout(() => void load(), 250)
        return () => window.clearTimeout(timer)
    }, [load])

    // Cambiar de tipo o de búsqueda invalida la página actual: quedarse en la 4
    // mostraría una página vacía de un listado más corto.
    useEffect(() => { setPage(1) }, [sourceType, search, warrantyOnly])

    // Si la organizacion no tiene taller, forzar siempre a ventas.
    useEffect(() => {
        if (!tieneTaller && sourceType === 'repair') {
            setSourceType('sale')
            setPage(1)
        }
    }, [tieneTaller, sourceType])

    async function fetchDetail(row: SourceRow) {
        const response = await fetch(`/api/after-sales/sources/${row.id}?type=${sourceType}`, { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || payload?.success === false) {
            throw new Error(payload?.error ?? 'No se pudo cargar el detalle.')
        }
        return payload.data as SaleDetail | RepairDetail
    }

    async function handleViewDetail(row: SourceRow) {
        setBusyRowId(row.id)
        setDetailLoading(true)
        try {
            setDetail(await fetchDetail(row))
        } catch (err) {
            toast.error('No se pudo abrir el detalle', {
                description: err instanceof Error ? err.message : 'Intentá nuevamente.',
            })
        } finally {
            setDetailLoading(false)
            setBusyRowId(null)
        }
    }

    async function handleReprint(row: SourceRow) {
        setBusyRowId(row.id)
        try {
            const data = await fetchDetail(row)
            if (data.type !== 'sale') return
            printReceipt(buildReprintReceiptData(data.sale), companyInfo)
            toast.success('Reimpresión enviada', {
                description: `${data.sale.code ?? row.label} · marcado como REIMPRESIÓN`,
            })
        } catch (err) {
            toast.error('No se pudo reimprimir', {
                description: err instanceof Error ? err.message : 'Intentá nuevamente.',
            })
        } finally {
            setBusyRowId(null)
        }
    }

    // Una devolución sigue abriendo un caso: es lo que deja registrado quién la
    // autorizó, adónde fue la plata y adónde el stock. El atajo prellena, no
    // saltea.
    const claimTypes: RequestType[] = useMemo(
        () => sourceType === 'sale'
            ? ['return', 'exchange', 'product_warranty']
            : (tieneTaller ? ['repair_warranty'] : []),
        [sourceType, tieneTaller],
    )

    const totalLabel = pagination
        ? `${pagination.total} ${sourceType === 'sale' ? 'venta' : 'reparación'}${pagination.total === 1 ? '' : sourceType === 'sale' ? 's' : 'es'}`
        : ''

    return (
        <section className="space-y-3" aria-labelledby="after-sales-sources">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 id="after-sales-sources" className="text-sm font-semibold">
                        {tieneTaller ? 'Ventas y reparaciones' : 'Comprobantes de venta'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {tieneTaller
                            ? 'Buscá el comprobante, mirá el detalle, reimprimí o abrí un reclamo.'
                            : 'Buscá la venta, mirá el detalle, reimprimí o iniciá un reclamo.'}
                    </p>
                </div>
                <div className="flex rounded-lg border p-0.5">
                    <Button
                        type="button"
                        size="sm"
                        variant={sourceType === 'sale' ? 'default' : 'ghost'}
                        aria-pressed={sourceType === 'sale'}
                        className="h-8 gap-1.5"
                        onClick={() => setSourceType('sale')}
                    >
                        <ShoppingCart className="h-3.5 w-3.5" /> Ventas
                    </Button>
                    {tieneTaller && (
                    <Button
                        type="button"
                        size="sm"
                        variant={sourceType === 'repair' ? 'default' : 'ghost'}
                        aria-pressed={sourceType === 'repair'}
                        className="h-8 gap-1.5"
                        onClick={() => setSourceType('repair')}
                    >
                        <Wrench className="h-3.5 w-3.5" /> Reparaciones
                    </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/60 p-3 shadow-2xs">
                <div className="relative min-w-[240px] flex-1 max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={sourceType === 'sale' ? 'Número de venta, cliente o teléfono…' : 'Número de ticket, cliente o teléfono…'}
                        className="h-9 pl-9 pr-8 text-sm"
                        aria-label="Buscar ventas o reparaciones"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-sm transition-colors"
                            aria-label="Limpiar búsqueda"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {sourceType === 'repair' && (
                        <label className="flex items-center gap-2 cursor-pointer select-none rounded-lg border bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                            <input
                                type="checkbox"
                                checked={warrantyOnly}
                                onChange={(event) => setWarrantyOnly(event.target.checked)}
                                className="h-3.5 w-3.5 rounded accent-primary"
                            />
                            <span>Solo con garantía vigente</span>
                        </label>
                    )}

                    {totalLabel && (
                        <Badge variant="secondary" className="font-normal text-xs py-1 px-2.5 bg-muted/60 text-muted-foreground">
                            {totalLabel}
                        </Badge>
                    )}
                </div>
            </div>

            {error ? (
                <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
                    <p className="text-muted-foreground">{error}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void load()}>
                        Reintentar
                    </Button>
                </div>
            ) : null}

            {loading && rows.length === 0 ? (
                <div className="space-y-2.5" aria-busy="true" aria-label="Cargando listado">
                    {[0, 1, 2, 3].map((key) => (
                        <Skeleton key={key} className="h-24 w-full rounded-xl" />
                    ))}
                </div>
            ) : rows.length === 0 && !error ? (
                <div className="rounded-xl border border-dashed p-8 text-center bg-muted/10">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {sourceType === 'sale' ? (
                            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                        ) : (
                            <Wrench className="h-5 w-5 text-muted-foreground" />
                        )}
                    </div>
                    <h3 className="mt-3 text-sm font-medium text-foreground">
                        {search ? 'Sin coincidencias' : 'No hay comprobantes'}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                        {search
                            ? 'No se encontraron resultados para los términos ingresados. Probá con otro código, nombre o teléfono.'
                            : sourceType === 'repair' && warrantyOnly
                                ? 'No hay reparaciones entregadas con garantía vigente. Destildá el filtro para ver todas.'
                                : 'Todavía no hay registros disponibles en esta sección.'}
                    </p>
                    {search && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3 h-8 text-xs"
                            onClick={() => setSearch('')}
                        >
                            Limpiar búsqueda
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-2.5">
                    {rows.map((row) => {
                        const busy = busyRowId === row.id
                        return (
                            <div
                                key={row.id}
                                className={cn(
                                    "group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border bg-card/70 p-4 transition-all duration-150",
                                    "hover:bg-card hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-xs",
                                    busy && "opacity-60 pointer-events-none"
                                )}
                            >
                                {/* Left section: Icon + Identity & Badges + Subtitle / details */}
                                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                    <div
                                        className={cn(
                                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                                            sourceType === 'sale'
                                                ? "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/60"
                                                : "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/60"
                                        )}
                                    >
                                        {sourceType === 'sale' ? (
                                            <ShoppingCart className="h-5 w-5" />
                                        ) : (
                                            <Wrench className="h-5 w-5" />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-sm font-bold tracking-tight text-foreground">
                                                {row.label}
                                            </span>

                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[10px] font-medium h-5 px-1.5",
                                                    sourceType === 'sale'
                                                        ? "border-violet-200 bg-violet-50/50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300"
                                                        : "border-blue-200 bg-blue-50/50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                                                )}
                                            >
                                                {sourceType === 'sale' ? 'Venta POS' : 'Reparación'}
                                            </Badge>

                                            {row.warrantyExpired === true && (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1 border-amber-300/70 bg-amber-50 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 h-5 px-1.5"
                                                >
                                                    <AlertTriangle className="h-3 w-3" /> Garantía vencida
                                                </Badge>
                                            )}
                                            {row.warrantyExpired === false && sourceType === 'repair' && (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1 border-emerald-300/70 bg-emerald-50 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 h-5 px-1.5"
                                                >
                                                    <ShieldCheck className="h-3 w-3" /> En garantía
                                                </Badge>
                                            )}
                                            {sourceType === 'repair' && row.status && (
                                                <Badge variant="secondary" className="text-[10px] font-normal capitalize h-5 px-1.5">
                                                    {row.status}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                {row.subtitle || 'Sin cliente registrado'}
                                            </span>

                                            {row.device && (
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    <Smartphone className="h-3.5 w-3.5" />
                                                    {row.device}
                                                </span>
                                            )}

                                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {formatDate(row.date)}
                                            </span>
                                        </div>

                                        {sourceType === 'sale' && Array.isArray(row.items) && row.items.length > 0 && (
                                            <div className="pt-0.5 flex flex-wrap items-center gap-1.5">
                                                <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                                                {row.items.slice(0, 3).map((it, idx) => (
                                                    <span
                                                        key={it.id || idx}
                                                        className="inline-flex items-center text-[11px] rounded-md bg-muted/60 px-1.5 py-0.5 text-muted-foreground border border-border/40 font-normal"
                                                    >
                                                        {it.quantity > 1 ? `${it.quantity}x ` : ''}
                                                        <span className="max-w-[140px] truncate">{it.name}</span>
                                                    </span>
                                                ))}
                                                {row.items.length > 3 && (
                                                    <span className="text-[10px] text-muted-foreground/80 font-medium">
                                                        +{row.items.length - 3} más
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right section: Amount + Action buttons */}
                                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                                    {typeof row.amount === 'number' && (
                                        <div className="text-left sm:text-right">
                                            <span className="block text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Monto</span>
                                            <span className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(row.amount)}</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 gap-1 text-xs hover:bg-muted"
                                            disabled={busy}
                                            onClick={() => void handleViewDetail(row)}
                                        >
                                            {busy && detailLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                            <span className="hidden md:inline">Ver</span> detalle
                                        </Button>

                                        {sourceType === 'sale' && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 gap-1 text-xs hover:bg-muted"
                                                disabled={busy}
                                                onClick={() => void handleReprint(row)}
                                            >
                                                <Printer className="h-3.5 w-3.5" />
                                                Reimprimir
                                            </Button>
                                        )}

                                        <Button
                                            type="button"
                                            size="sm"
                                            className={cn(
                                                "h-8 gap-1.5 text-xs font-semibold text-white shadow-2xs",
                                                sourceType === 'sale'
                                                    ? "bg-violet-600 hover:bg-violet-700"
                                                    : "bg-blue-600 hover:bg-blue-700"
                                            )}
                                            onClick={() => setClaimSource(row)}
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                            {sourceType === 'sale' ? 'Devolver / Cambiar' : 'Iniciar Reclamo'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                        Página {pagination.page} de {pagination.totalPages}
                    </span>
                    <div className="flex gap-1">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            disabled={pagination.page <= 1 || loading}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            disabled={pagination.page >= pagination.totalPages || loading}
                            onClick={() => setPage((current) => current + 1)}
                        >
                            Siguiente <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            <SourceDetailDialog
                detail={detail}
                onClose={() => setDetail(null)}
                onReprint={() => {
                    if (detail?.type === 'sale') {
                        printReceipt(buildReprintReceiptData(detail.sale), companyInfo)
                        toast.success('Reimpresión enviada', {
                            description: `${detail.sale.code ?? 'Venta'} · marcado como REIMPRESIÓN`,
                        })
                    }
                }}
                onClaim={() => {
                    if (!detail) return
                    const row: SourceRow = rows.find(r => r.id === (detail.type === 'sale' ? detail.sale.id : detail.id)) || (
                        detail.type === 'sale' ? {
                            id: detail.sale.id,
                            label: detail.sale.code || 'Venta',
                            subtitle: detail.sale.customer?.name || 'Cliente sin nombre',
                            amount: detail.sale.total,
                            date: detail.sale.createdAt,
                            items: detail.sale.items.map(item => ({
                                id: item.id,
                                product_id: item.product_id,
                                name: item.name,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                imageUrl: item.imageUrl,
                                warrantyMonths: item.warrantyMonths,
                                returnWindowDays: item.returnWindowDays,
                                exchangeWindowDays: item.exchangeWindowDays,
                            })),
                        } : {
                            id: detail.id,
                            label: detail.label,
                            subtitle: detail.customer?.name || 'Cliente sin nombre',
                            device: detail.device,
                            amount: detail.total,
                            date: detail.deliveredAt || detail.createdAt,
                            warrantyMonths: detail.warrantyMonths,
                            warrantyExpiresAt: detail.warrantyExpiresAt,
                            warrantyExpired: detail.warrantyExpiresAt ? new Date(detail.warrantyExpiresAt).getTime() < Date.now() : false,
                        }
                    )
                    setDetail(null)
                    setClaimSource(row)
                }}
            />

            {claimSource && (
                <CreateAfterSalesCaseDialog
                    open
                    onOpenChange={(open) => { if (!open) setClaimSource(null) }}
                    sourceType={sourceType}
                    saleId={sourceType === 'sale' ? claimSource.id : null}
                    repairId={sourceType === 'repair' ? claimSource.id : null}
                    reference={claimSource.label}
                    subject={claimSource.device || undefined}
                    customerName={claimSource.subtitle}
                    allowedRequestTypes={claimTypes}
                    warrantyExpired={claimSource.warrantyExpired ?? false}
                    warrantyExpiresLabel={claimSource.warrantyExpiresAt ? formatDate(claimSource.warrantyExpiresAt) : null}
                    saleDate={claimSource.date}
                    saleItems={claimSource.items}
                    onCreated={() => { setClaimSource(null); void load() }}
                />
            )}
        </section>
    )
}

export function SourceDetailDialog({
    detail,
    onClose,
    onReprint,
    onClaim,
}: {
    detail: SaleDetail | RepairDetail | null
    onClose: () => void
    onReprint?: () => void
    onClaim?: () => void
}) {
    const [openedAt] = useState(Date.now)
    if (!detail) return null

    const isSale = detail.type === 'sale'
    const isRepair = detail.type === 'repair'

    const repairWarrantyExpired = isRepair && detail.warrantyExpiresAt
        ? new Date(detail.warrantyExpiresAt).getTime() < openedAt
        : false

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0 sm:rounded-xl">
                {/* Header */}
                <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {isSale ? (
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300">
                                    <ShoppingCart className="h-5 w-5" />
                                </div>
                            ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                                    <Wrench className="h-5 w-5" />
                                </div>
                            )}
                            <div>
                                <DialogTitle className="font-mono text-lg font-bold">
                                    {isSale ? `Venta ${detail.sale.code ?? ''}` : `Reparación ${detail.label}`}
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    {isSale
                                        ? `${detail.sale.customer?.name || 'Cliente de Mostrador'} · ${formatDate(detail.sale.createdAt)}`
                                        : `${detail.customer?.name || 'Cliente sin nombre'} · ${detail.device}`}
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                            {isSale ? (
                                <>
                                    <Badge variant="outline" className="border-violet-300 bg-violet-50 font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                                        Venta POS
                                    </Badge>
                                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        {detail.paymentStatus === 'paid' ? 'Pagado' : 'Completada'}
                                    </Badge>
                                </>
                            ) : (
                                <>
                                    <Badge variant="outline" className="border-blue-300 bg-blue-50 font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                                        Taller
                                    </Badge>
                                    <Badge variant="outline" className="capitalize">
                                        {detail.status === 'entregado' ? 'Entregado' : detail.status || 'Listo'}
                                    </Badge>
                                    {detail.warrantyExpiresAt ? (
                                        repairWarrantyExpired ? (
                                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                                <ShieldAlert className="mr-1 h-3 w-3" /> Garantía vencida
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                <ShieldCheck className="mr-1 h-3 w-3" /> En garantía
                                            </Badge>
                                        )
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                            Sin garantía
                                        </Badge>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-5 px-6 py-4">
                    {/* Customer & Overview Cards */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <User className="h-3.5 w-3.5 text-primary" /> Datos del Cliente
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                                {isSale ? (detail.sale.customer?.name || 'Cliente sin registrar / Mostrador') : (detail.customer?.name || 'Cliente sin registrar')}
                            </p>
                            {((isSale && detail.sale.customer?.phone) || (isRepair && detail.customer?.phone)) && (
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                                    <span>{isSale ? detail.sale.customer?.phone : detail.customer?.phone}</span>
                                </p>
                            )}
                            {((isSale && detail.sale.customer?.email) || (isRepair && detail.customer?.email)) && (
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground/70" />
                                    <span>{isSale ? detail.sale.customer?.email : detail.customer?.email}</span>
                                </p>
                            )}
                        </div>

                        <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <Calendar className="h-3.5 w-3.5 text-primary" /> {isSale ? 'Datos del Comprobante' : 'Datos del Servicio'}
                            </div>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">Fecha:</span>
                                    <span className="font-medium text-foreground">{formatDate(isSale ? detail.sale.createdAt : detail.createdAt)}</span>
                                </div>
                                {isSale && detail.sale.cashierName && (
                                    <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Atendido por:</span>
                                        <span className="font-medium text-foreground">{detail.sale.cashierName}</span>
                                    </div>
                                )}
                                {isRepair && (
                                    <>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-muted-foreground">Equipo:</span>
                                            <span className="font-medium text-foreground">{detail.device || '—'}</span>
                                        </div>
                                        {detail.deliveredAt && (
                                            <div className="flex justify-between gap-2">
                                                <span className="text-muted-foreground">Entregado el:</span>
                                                <span className="font-medium text-foreground">{formatDate(detail.deliveredAt)}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {isSale ? (
                        <div className="space-y-4">
                            {/* Products Table */}
                            <div className="overflow-hidden rounded-xl border">
                                <div className="border-b bg-muted/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Productos Vendidos ({detail.sale.items.length})
                                </div>
                                <div className="divide-y text-sm">
                                    {detail.sale.items.map((item) => (
                                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/10">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-foreground">{item.name}</p>
                                                {item.sku && (
                                                    <span className="inline-block font-mono text-xs text-muted-foreground">
                                                        SKU: {item.sku}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-right">
                                                <div className="text-xs">
                                                    <span className="font-semibold tabular-nums text-foreground">{item.quantity}</span>
                                                    <span className="text-muted-foreground"> x {formatCurrency(item.unitPrice)}</span>
                                                </div>
                                                <div className="min-w-[90px] text-right font-semibold tabular-nums text-foreground">
                                                    {formatCurrency(item.quantity * item.unitPrice - (item.discount || 0))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Financial Summary and Payments */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                {/* Payments Block */}
                                <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <CreditCard className="h-3.5 w-3.5 text-primary" /> Medios de Pago
                                    </div>
                                    {(detail.sale.payments?.length ?? 0) > 0 ? (
                                        <div className="space-y-1.5">
                                            {detail.sale.payments!.map((payment, idx) => (
                                                <div key={payment.id || idx} className="flex items-center justify-between rounded-lg border bg-background/60 px-3 py-1.5 text-xs">
                                                    <span className="font-medium capitalize text-foreground">
                                                        {payment.method === 'cash' ? 'Efectivo' : payment.method === 'card' ? 'Tarjeta' : payment.method === 'transfer' ? 'Transferencia' : payment.method || 'Pago'}
                                                        {payment.reference ? <span className="ml-1 opacity-70">({payment.reference})</span> : ''}
                                                    </span>
                                                    <span className="font-semibold tabular-nums text-foreground">{formatCurrency(payment.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            {detail.sale.paymentMethod ? `Método registrado: ${detail.sale.paymentMethod}` : 'Sin desglose de pagos'}
                                        </p>
                                    )}
                                </div>

                                {/* Totals Block */}
                                <div className="rounded-xl border bg-card p-4 space-y-2 shadow-xs">
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Subtotal</span>
                                            <span className="tabular-nums font-medium text-foreground">{formatCurrency(detail.sale.subtotal)}</span>
                                        </div>
                                        {detail.sale.discount > 0 && (
                                            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                                <span>Descuento</span>
                                                <span className="tabular-nums">-{formatCurrency(detail.sale.discount)}</span>
                                            </div>
                                        )}
                                        {detail.sale.tax > 0 && (
                                            <div className="flex justify-between text-muted-foreground">
                                                <span>Impuestos / IVA</span>
                                                <span className="tabular-nums font-medium text-foreground">{formatCurrency(detail.sale.tax)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between border-t pt-2.5">
                                        <span className="text-sm font-bold text-foreground">Total Pagado</span>
                                        <span className="text-lg font-extrabold tabular-nums text-primary">{formatCurrency(detail.sale.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Problem and Warranty Info */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                                        <AlertTriangle className="h-3.5 w-3.5 text-blue-600" /> Falla Reportada Original
                                    </div>
                                    <p className="text-sm text-foreground font-medium">
                                        {detail.problem || 'Sin descripción de falla'}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Cobertura de Garantía
                                    </div>
                                    <div className="space-y-1 text-xs text-foreground">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tipo de cobertura:</span>
                                            <span className="font-semibold">
                                                {detail.warrantyType === 'labor' ? 'Mano de obra' : detail.warrantyType === 'parts' ? 'Repuestos' : 'Garantía completa'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Duración:</span>
                                            <span className="font-semibold">{detail.warrantyMonths ? `${detail.warrantyMonths} meses` : '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Vencimiento:</span>
                                            <span className={cn('font-semibold', repairWarrantyExpired && 'text-amber-600 dark:text-amber-400')}>
                                                {detail.warrantyExpiresAt ? formatDate(detail.warrantyExpiresAt) : 'Sin fecha registrada'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Financial totals for repair */}
                            <div className="rounded-xl border bg-card p-4 shadow-xs">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="border-r pr-2">
                                        <span className="text-xs text-muted-foreground">Costo Total</span>
                                        <p className="text-base font-bold tabular-nums text-foreground">{formatCurrency(detail.total)}</p>
                                    </div>
                                    <div className="border-r pr-2">
                                        <span className="text-xs text-muted-foreground">Monto Pagado</span>
                                        <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(detail.paidAmount)}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Saldo Pendiente</span>
                                        <p className={cn('text-base font-bold tabular-nums', detail.total - detail.paidAmount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                                            {formatCurrency(Math.max(0, detail.total - detail.paidAmount))}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer with Actions */}
                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 px-6 py-3.5 backdrop-blur-sm">
                    {isSale && onReprint ? (
                        <Button type="button" variant="outline" size="sm" onClick={onReprint} className="gap-1.5 text-xs">
                            <Printer className="h-3.5 w-3.5" /> Reimprimir Comprobante
                        </Button>
                    ) : (
                        <div />
                    )}

                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
                            Cerrar
                        </Button>
                        {onClaim && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={onClaim}
                                className={cn(
                                    'gap-1.5 text-xs text-white font-semibold',
                                    isSale ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'
                                )}
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {isSale ? 'Iniciar Devolución / Cambio' : 'Iniciar Reclamo de Garantía'}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
