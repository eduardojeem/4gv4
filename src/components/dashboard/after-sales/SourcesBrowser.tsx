'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    ChevronLeft,
    ChevronRight,
    Eye,
    Loader2,
    Printer,
    RotateCcw,
    Search,
    ShieldCheck,
    ShoppingCart,
    Wrench,
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
            : ['repair_warranty'],
        [sourceType],
    )

    const totalLabel = pagination
        ? `${pagination.total} ${sourceType === 'sale' ? 'venta' : 'reparación'}${pagination.total === 1 ? '' : sourceType === 'sale' ? 's' : 'es'}`
        : ''

    return (
        <section className="space-y-3" aria-labelledby="after-sales-sources">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 id="after-sales-sources" className="text-sm font-semibold">Ventas y reparaciones</h2>
                    <p className="text-xs text-muted-foreground">
                        Buscá el comprobante, mirá el detalle, reimprimí o abrí un reclamo.
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
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-3">
                <div className="relative min-w-[220px] flex-1 max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={sourceType === 'sale' ? 'Número de venta, cliente o teléfono…' : 'Número de ticket, cliente o teléfono…'}
                        className="h-9 pl-9"
                        aria-label="Buscar ventas o reparaciones"
                    />
                </div>

                {sourceType === 'repair' && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={warrantyOnly}
                            onChange={(event) => setWarrantyOnly(event.target.checked)}
                            className="h-3.5 w-3.5 accent-primary"
                        />
                        Solo entregadas con garantía
                    </label>
                )}

                {totalLabel && <span className="text-xs text-muted-foreground">{totalLabel}</span>}
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
                <div className="space-y-2" aria-busy="true" aria-label="Cargando listado">
                    {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-16 w-full rounded-xl" />)}
                </div>
            ) : rows.length === 0 && !error ? (
                <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                    {search
                        ? 'Ningún comprobante coincide con la búsqueda.'
                        : sourceType === 'repair' && warrantyOnly
                            ? 'No hay reparaciones entregadas con garantía vigente. Destildá el filtro para ver todas.'
                            : 'Todavía no hay registros.'}
                </p>
            ) : (
                <div className="divide-y rounded-xl border">
                    {rows.map((row) => {
                        const busy = busyRowId === row.id
                        return (
                            <div key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-foreground">{row.label}</span>
                                        {row.warrantyExpired === true && (
                                            <Badge variant="outline" className="gap-1 border-amber-300/70 bg-amber-50 text-[10px] font-normal text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                                <ShieldCheck className="h-3 w-3" /> Garantía vencida
                                            </Badge>
                                        )}
                                        {row.warrantyExpired === false && sourceType === 'repair' && (
                                            <Badge variant="outline" className="gap-1 border-emerald-300/70 bg-emerald-50 text-[10px] font-normal text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                <ShieldCheck className="h-3 w-3" /> En garantía
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {row.subtitle}
                                        {row.device ? ` · ${row.device}` : ''}
                                        {' · '}
                                        {formatDate(row.date)}
                                    </p>
                                </div>

                                {typeof row.amount === 'number' && (
                                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(row.amount)}</span>
                                )}

                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 gap-1 text-xs"
                                        disabled={busy}
                                        onClick={() => void handleViewDetail(row)}
                                    >
                                        {busy && detailLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                        Ver detalle
                                    </Button>

                                    {sourceType === 'sale' && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 gap-1 text-xs"
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
                                        variant="outline"
                                        className="h-8 gap-1 text-xs"
                                        onClick={() => setClaimSource(row)}
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        {sourceType === 'sale' ? 'Devolver' : 'Reclamar'}
                                    </Button>
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

            <SourceDetailDialog detail={detail} onClose={() => setDetail(null)} />

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
                    saleItems={claimSource.items}
                    onCreated={() => { setClaimSource(null); void load() }}
                />
            )}
        </section>
    )
}

function SourceDetailDialog({ detail, onClose }: { detail: SaleDetail | RepairDetail | null; onClose: () => void }) {
    if (!detail) return null

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {detail.type === 'sale' ? `Venta ${detail.sale.code ?? ''}` : `Reparación ${detail.label}`}
                    </DialogTitle>
                    <DialogDescription>
                        {detail.type === 'sale'
                            ? `${detail.sale.customer?.name || 'Sin cliente'} · ${formatDate(detail.sale.createdAt)}`
                            : `${detail.customer?.name || 'Sin cliente'} · ${detail.device}`}
                    </DialogDescription>
                </DialogHeader>

                {detail.type === 'sale' ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border">
                            <div className="grid grid-cols-[1fr_60px_110px] gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                <span>Producto</span>
                                <span className="text-right">Cant.</span>
                                <span className="text-right">Precio</span>
                            </div>
                            {detail.sale.items.map((item) => (
                                <div key={item.id} className="grid grid-cols-[1fr_60px_110px] gap-2 border-b px-3 py-2 text-sm last:border-0">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">{item.name}</p>
                                        {item.sku && <p className="text-xs text-muted-foreground">SKU {item.sku}</p>}
                                    </div>
                                    <span className="text-right tabular-nums">{item.quantity}</span>
                                    <span className="text-right tabular-nums">{formatCurrency(item.unitPrice)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="ml-auto w-full max-w-xs space-y-1 rounded-lg border bg-muted/20 p-3 text-sm">
                            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(detail.sale.subtotal)}</span></div>
                            {detail.sale.discount > 0 && (
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Descuento</span><span className="tabular-nums">-{formatCurrency(detail.sale.discount)}</span></div>
                            )}
                            {detail.sale.tax > 0 && (
                                <div className="flex justify-between text-muted-foreground"><span>Impuesto</span><span className="tabular-nums">{formatCurrency(detail.sale.tax)}</span></div>
                            )}
                            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="tabular-nums">{formatCurrency(detail.sale.total)}</span></div>
                        </div>

                        {(detail.sale.payments?.length ?? 0) > 0 && (
                            <div className="text-xs text-muted-foreground">
                                Pagos: {detail.sale.payments!.map((payment) => `${payment.method ?? 'pago'} ${formatCurrency(payment.amount)}`).join(' · ')}
                            </div>
                        )}
                        {detail.sale.cashierName && (
                            <p className="text-xs text-muted-foreground">Atendió: {detail.sale.cashierName}</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3 text-sm">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Equipo</p>
                                <p className="mt-1 font-medium">{detail.device || '—'}</p>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Entregada</p>
                                <p className="mt-1 font-medium">{formatDate(detail.deliveredAt)}</p>
                            </div>
                        </div>
                        {detail.problem && (
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Falla reportada</p>
                                <p className="mt-1">{detail.problem}</p>
                            </div>
                        )}
                        <div className={cn('rounded-lg border p-3', detail.warrantyExpiresAt ? 'bg-muted/20' : '')}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Garantía</p>
                            <p className="mt-1 font-medium">
                                {detail.warrantyExpiresAt ? `Vence ${formatDate(detail.warrantyExpiresAt)}` : 'Sin garantía registrada'}
                            </p>
                        </div>
                        <div className="flex justify-between border-t pt-2 font-semibold">
                            <span>Total</span>
                            <span className="tabular-nums">{formatCurrency(detail.total)}</span>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
