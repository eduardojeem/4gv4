'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Loader2, Search, ShieldAlert, ShoppingBag, TriangleAlert, Wrench, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { REQUEST_META, formatMoney, type RequestType, type SourceType } from './after-sales-meta'
import { ProductThumb } from '@/components/suppliers/order-ui'

/** Origen encontrado por la busqueda, ya normalizado por la API. */
interface OriginResult {
    id: string
    label: string
    subtitle: string
    amount?: number
    device?: string
    warrantyExpired?: boolean
    warrantyExpiresAt?: string | null
    items?: AfterSalesSaleItem[]
}

/** Item de la venta, para poder decir QUE producto se esta reclamando. */
export interface AfterSalesSaleItem {
    id: string
    product_id: string | null
    name: string
    quantity: number
    imageUrl?: string | null
    unitPrice?: number
}

/** Producto candidato a entregarse en reemplazo dentro de un cambio. */
interface ReplacementProduct {
    id: string
    name: string
    imageUrl: string | null
    price: number
    stock: number
}

interface CreateAfterSalesCaseDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceType: SourceType
    /** Requerido cuando sourceType es 'repair'. */
    repairId?: string | null
    /** Requerido cuando sourceType es 'sale'. */
    saleId?: string | null
    customerId?: string | null
    /** Numero de ticket o de venta, solo para mostrar. */
    reference?: string | null
    /** Que se esta reclamando: equipo reparado o producto vendido. */
    subject?: string | null
    customerName?: string | null
    allowedRequestTypes: RequestType[]
    /** Si la garantia esta vencida se avisa, pero no se bloquea: puede haber
     *  una excepcion comercial y el caso queda registrado igual. */
    warrantyExpired?: boolean
    warrantyExpiresLabel?: string | null
    maxQuantity?: number
    /** Items de la venta de origen. Sin esto el caso no sabe que producto
     *  volvio, y al completarlo no hay nada que reponer al stock. */
    saleItems?: AfterSalesSaleItem[]
    onCreated?: () => void
}

export function CreateAfterSalesCaseDialog({
    open,
    onOpenChange,
    sourceType,
    repairId,
    saleId,
    customerId,
    reference,
    subject,
    customerName,
    allowedRequestTypes,
    warrantyExpired = false,
    warrantyExpiresLabel,
    maxQuantity,
    saleItems,
    onCreated,
}: CreateAfterSalesCaseDialogProps) {
    const [requestType, setRequestType] = useState<RequestType>(allowedRequestTypes[0])
    const [reason, setReason] = useState('')
    const [notes, setNotes] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [refundAmount, setRefundAmount] = useState('')
    const [selectedItemId, setSelectedItemId] = useState<string>('')
    // Selector de origen: solo se usa cuando el dialogo se abre sin una venta ni
    // una reparacion, es decir desde el boton "Nuevo reclamo" de Posventa.
    const [originType, setOriginType] = useState<SourceType>('sale')
    const [originQuery, setOriginQuery] = useState('')
    const [originResults, setOriginResults] = useState<OriginResult[]>([])
    const [originLoading, setOriginLoading] = useState(false)
    const [pickedOrigin, setPickedOrigin] = useState<OriginResult | null>(null)
    // Reemplazo: solo aplica a los cambios, donde el cliente se lleva otro producto.
    const [replacementQuery, setReplacementQuery] = useState('')
    const [replacementResults, setReplacementResults] = useState<ReplacementProduct[]>([])
    const [replacement, setReplacement] = useState<ReplacementProduct | null>(null)
    const [replacementQty, setReplacementQty] = useState(1)
    const [submitting, setSubmitting] = useState(false)

    // Cada apertura arranca limpia: reutilizar el borrador anterior lleva a
    // registrar un caso con el motivo de otro cliente.
    useEffect(() => {
        if (!open) return
        setRequestType(allowedRequestTypes[0])
        setReason('')
        setNotes('')
        setQuantity(1)
        setRefundAmount('')
        // Con un solo item no tiene sentido preguntar cual es.
        setSelectedItemId(saleItems?.length === 1 ? saleItems[0].id : '')
        setSubmitting(false)
        setPickedOrigin(null)
        setOriginQuery('')
        setOriginResults([])
        setReplacement(null)
        setReplacementQuery('')
        setReplacementResults([])
        setReplacementQty(1)
    }, [open, allowedRequestTypes, saleItems])

    // Si el dialogo se abrio sin origen hay que elegirlo primero.
    const needsOrigin = !repairId && !saleId
    const effectiveSourceType: SourceType = needsOrigin ? originType : sourceType
    const effectiveRepairId = needsOrigin ? (originType === 'repair' ? pickedOrigin?.id ?? null : null) : repairId
    const effectiveSaleId = needsOrigin ? (originType === 'sale' ? pickedOrigin?.id ?? null : null) : saleId
    const effectiveItems = needsOrigin ? pickedOrigin?.items : saleItems
    const effectiveReference = needsOrigin ? pickedOrigin?.label ?? null : reference
    const effectiveSubject = needsOrigin ? pickedOrigin?.device ?? null : subject
    const effectiveCustomerName = needsOrigin ? pickedOrigin?.subtitle ?? null : customerName
    const effectiveWarrantyExpired = needsOrigin ? Boolean(pickedOrigin?.warrantyExpired) : warrantyExpired

    // Una reparacion solo admite garantia de reparacion; una venta, el resto.
    const effectiveTypes: RequestType[] = needsOrigin
        ? (originType === 'repair' ? ['repair_warranty'] : ['product_warranty', 'exchange', 'return'])
        : allowedRequestTypes

    const originChosen = !needsOrigin || Boolean(pickedOrigin)

    const showQuantity = effectiveSourceType === 'sale'
    const hasItems = effectiveSourceType === 'sale' && Array.isArray(effectiveItems) && effectiveItems.length > 0
    const selectedItem = hasItems ? effectiveItems.find((item) => item.id === selectedItemId) ?? null : null
    const showRefund = requestType === 'return'
    const showReplacement = requestType === 'exchange'

    // Diferencia del cambio: lo que se lleva menos lo que devuelve.
    // Positiva la abona el cliente; negativa se le devuelve a el.
    const priceDifference =
        showReplacement && replacement
            ? replacement.price * replacementQty - (selectedItem?.unitPrice ?? 0) * quantity
            : null
    const trimmedReason = reason.trim()
    const canSubmit =
        originChosen &&
        trimmedReason.length > 0 &&
        !submitting &&
        (!hasItems || Boolean(selectedItem)) &&
        (!showReplacement || Boolean(replacement))

    // Al cambiar de tipo de origen el reclamo anterior deja de tener sentido.
    useEffect(() => {
        if (!needsOrigin) return
        setPickedOrigin(null)
        setSelectedItemId('')
        setRequestType(originType === 'repair' ? 'repair_warranty' : 'product_warranty')
    }, [originType, needsOrigin])

    // Catalogo para el reemplazo, con el mismo respiro que la busqueda de origen.
    useEffect(() => {
        if (!open || !showReplacement || replacement) return
        let cancelled = false

        const timer = setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/products?query=${encodeURIComponent(replacementQuery)}&limit=8`
                )
                const payload = await response.json().catch(() => null)
                if (cancelled) return
                const rows = (payload?.data ?? payload?.products ?? []) as Array<Record<string, unknown>>
                setReplacementResults(
                    rows.slice(0, 8).map((row) => ({
                        id: String(row.id),
                        name: String(row.name ?? 'Producto'),
                        imageUrl: (row.image_url as string | null) ?? null,
                        price: Number(row.sale_price ?? 0),
                        stock: Number(row.stock_quantity ?? 0),
                    }))
                )
            } catch {
                if (!cancelled) setReplacementResults([])
            }
        }, 300)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [open, showReplacement, replacement, replacementQuery])

    // Busqueda con respiro, para no disparar una consulta por tecla.
    useEffect(() => {
        if (!open || !needsOrigin) return
        let cancelled = false
        setOriginLoading(true)

        const timer = setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/after-sales/sources?type=${originType}&q=${encodeURIComponent(originQuery)}`
                )
                const payload = await response.json().catch(() => null)
                if (cancelled) return
                setOriginResults(response.ok && payload?.success ? payload.data ?? [] : [])
            } catch {
                if (!cancelled) setOriginResults([])
            } finally {
                if (!cancelled) setOriginLoading(false)
            }
        }, 300)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [open, needsOrigin, originType, originQuery])

    const parsedRefund = useMemo(() => {
        if (!showRefund) return null
        const value = Number(refundAmount.replace(/[^\d]/g, ''))
        return Number.isFinite(value) && value > 0 ? value : null
    }, [refundAmount, showRefund])

    const handleSubmit = async () => {
        if (!canSubmit) return
        setSubmitting(true)

        try {
            const response = await fetch('/api/after-sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_type: effectiveSourceType,
                    request_type: requestType,
                    repair_id: effectiveSourceType === 'repair' ? effectiveRepairId : null,
                    sale_id: effectiveSourceType === 'sale' ? effectiveSaleId : null,
                    customer_id: customerId || null,
                    product_id: selectedItem?.product_id ?? null,
                    sale_item_id: selectedItem?.id ?? null,
                    quantity: showQuantity ? quantity : 1,
                    reason: trimmedReason,
                    notes: notes.trim() || null,
                    refund_amount: parsedRefund,
                    replacement_product_id: showReplacement ? replacement?.id ?? null : null,
                    replacement_quantity: showReplacement ? replacementQty : null,
                    price_difference: showReplacement ? priceDifference : null,
                }),
            })

            const result = await response.json().catch(() => null)

            if (!response.ok || !result?.success) {
                throw new Error(result?.error || 'No se pudo registrar el caso.')
            }

            toast.success('Caso de posventa registrado', {
                description: result.data?.case_number
                    ? `Caso ${result.data.case_number}. Seguilo desde Posventa.`
                    : 'Seguilo desde la sección Posventa.',
            })
            onOpenChange(false)
            onCreated?.()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo registrar el caso.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl rounded-2xl p-6 dark:bg-[#0d1117] dark:border-white/10">
                <DialogHeader className="space-y-1.5 pb-2">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                            🛡️
                        </span>
                        <span>Registrar Nuevo Reclamo</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                        Completa la información para abrir un caso de posventa auditado en el sistema.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
                    {needsOrigin && (
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                Contra que se reclama <span className="text-rose-500">*</span>
                            </Label>

                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { value: 'sale' as SourceType, label: 'Una venta', icon: ShoppingBag },
                                    { value: 'repair' as SourceType, label: 'Una reparacion', icon: Wrench },
                                ]).map((option) => {
                                    const OptionIcon = option.icon
                                    const active = originType === option.value
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setOriginType(option.value)}
                                            className={cn(
                                                'flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all',
                                                active
                                                    ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#161b22] dark:hover:bg-white/5'
                                            )}
                                        >
                                            <OptionIcon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                            {option.label}
                                        </button>
                                    )
                                })}
                            </div>

                            {pickedOrigin ? (
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-500 bg-blue-50/80 p-3 dark:border-blue-500 dark:bg-blue-950/40">
                                    <div className="min-w-0">
                                        <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">{pickedOrigin.label}</p>
                                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                            {pickedOrigin.subtitle}
                                            {pickedOrigin.device ? ` - ${pickedOrigin.device}` : ''}
                                            {typeof pickedOrigin.amount === 'number' ? ` - ${formatMoney(pickedOrigin.amount)}` : ''}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 shrink-0 text-[11px]"
                                        onClick={() => setPickedOrigin(null)}
                                    >
                                        <X className="mr-1 h-3 w-3" />
                                        Cambiar
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            value={originQuery}
                                            onChange={(event) => setOriginQuery(event.target.value)}
                                            placeholder={originType === 'sale' ? 'Buscar por codigo de venta...' : 'Buscar por numero de ticket...'}
                                            className="h-9 rounded-xl pl-8 text-xs"
                                        />
                                    </div>

                                    <div className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
                                        {originLoading && (
                                            <p className="py-3 text-center text-[11px] text-slate-400">Buscando...</p>
                                        )}
                                        {!originLoading && originResults.length === 0 && (
                                            <p className="py-3 text-center text-[11px] text-slate-400">
                                                {originType === 'sale'
                                                    ? 'No se encontraron ventas.'
                                                    : 'No se encontraron reparaciones entregadas con garantia.'}
                                            </p>
                                        )}
                                        {!originLoading && originResults.map((result) => (
                                            <button
                                                key={result.id}
                                                type="button"
                                                onClick={() => setPickedOrigin(result)}
                                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-all hover:bg-slate-50 dark:border-white/10 dark:bg-[#161b22] dark:hover:bg-white/5"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">{result.label}</p>
                                                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                                        {result.subtitle}
                                                        {result.device ? ` - ${result.device}` : ''}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    {typeof result.amount === 'number' && (
                                                        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                                            {formatMoney(result.amount)}
                                                        </p>
                                                    )}
                                                    {result.warrantyExpired != null && (
                                                        <p className={cn(
                                                            'text-[10px] font-medium',
                                                            result.warrantyExpired ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                                                        )}>
                                                            {result.warrantyExpired ? 'Garantia vencida' : 'Garantia vigente'}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {originChosen && (<>
                    {/* Contexto: información del origen */}
                    {(effectiveReference || effectiveSubject || effectiveCustomerName) && (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs dark:border-blue-900/30 dark:bg-blue-950/20 space-y-1.5">
                            <p className="font-bold text-blue-900 dark:text-blue-300 text-[11px] uppercase tracking-wider">Información del Reclamo</p>
                            {effectiveReference && (
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500 dark:text-slate-400">
                                        {effectiveSourceType === 'repair' ? 'Reparación de Taller' : 'Venta de Mostrador'}
                                    </span>
                                    <span className="font-semibold text-slate-900 dark:text-white font-mono">{effectiveReference}</span>
                                </div>
                            )}
                            {effectiveSubject && (
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500 dark:text-slate-400">Equipo / Producto</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{effectiveSubject}</span>
                                </div>
                            )}
                            {effectiveCustomerName && (
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500 dark:text-slate-400">Cliente</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{effectiveCustomerName}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {effectiveWarrantyExpired && (
                        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                            <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                            <p className="leading-relaxed">
                                La garantía comercial se encuentra vencida{warrantyExpiresLabel ? ` (venció el ${warrantyExpiresLabel})` : ''}.
                                Puedes continuar y registrar el caso si decides realizar una excepción autorizada.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Tipo de Reclamo</Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {effectiveTypes.map((type) => {
                                const meta = REQUEST_META[type]
                                const Icon = meta.icon
                                const active = requestType === type
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setRequestType(type)}
                                        className={cn(
                                            'flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all',
                                            active
                                                ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 dark:border-blue-500 ring-2 ring-blue-500/20'
                                                : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#161b22] dark:hover:bg-white/5'
                                        )}
                                    >
                                        <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                                            <Icon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                            {meta.label}
                                        </span>
                                        <span className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                                            {meta.hint}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {hasItems && (
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                Producto reclamado <span className="text-rose-500">*</span>
                            </Label>
                            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                                {effectiveItems!.map((item) => {
                                    const active = selectedItemId === item.id
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedItemId(item.id)
                                                setQuantity((current) => Math.min(Math.max(1, current), item.quantity))
                                            }}
                                            className={cn(
                                                'flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-all',
                                                active
                                                    ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#161b22] dark:hover:bg-white/5'
                                            )}
                                        >
                                            <span className="flex min-w-0 items-center gap-2.5">
                                                <ProductThumb url={item.imageUrl} name={item.name} size={40} />
                                                <span className="min-w-0 truncate text-xs font-semibold text-slate-900 dark:text-white">
                                                    {item.name}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                                                {item.quantity} u.
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {showQuantity && (
                        <div className="space-y-1.5">
                            <Label htmlFor="after-sales-quantity" className="text-xs font-semibold">Cantidad de unidades</Label>
                            <Input
                                id="after-sales-quantity"
                                type="number"
                                min={1}
                                max={selectedItem?.quantity ?? maxQuantity}
                                value={quantity}
                                onChange={(event) => {
                                    const value = Number(event.target.value)
                                    if (!Number.isFinite(value)) return
                                    const limit = selectedItem?.quantity ?? maxQuantity
                                    const capped = limit ? Math.min(value, limit) : value
                                    setQuantity(Math.max(1, capped))
                                }}
                                className="w-32 rounded-xl text-xs h-9"
                            />
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="after-sales-reason" className="text-xs font-semibold">
                            Motivo del reclamo <span className="text-rose-500">*</span>
                        </Label>
                        <Textarea
                            id="after-sales-reason"
                            value={reason}
                            onChange={(event) => setReason(event.target.value.slice(0, 1000))}
                            placeholder="Describe detalladamente lo manifestado por el cliente..."
                            rows={3}
                            className="rounded-xl text-xs leading-relaxed resize-none"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="after-sales-notes" className="text-xs font-semibold">Notas internas</Label>
                        <Textarea
                            id="after-sales-notes"
                            value={notes}
                            onChange={(event) => setNotes(event.target.value.slice(0, 2000))}
                            placeholder="Opcional. Observaciones de recepción, estado estético del equipo, etc."
                            rows={2}
                            className="rounded-xl text-xs leading-relaxed resize-none"
                        />
                    </div>

                    {showReplacement && (
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                Producto que se lleva <span className="text-rose-500">*</span>
                            </Label>

                            {replacement ? (
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-500 bg-violet-50/80 p-2.5 dark:border-violet-500 dark:bg-violet-950/30">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <ProductThumb url={replacement.imageUrl} name={replacement.name} size={40} />
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{replacement.name}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {formatMoney(replacement.price)} · stock {replacement.stock}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Input
                                            type="number"
                                            min={1}
                                            value={replacementQty}
                                            onChange={(event) => setReplacementQty(Math.max(1, Number(event.target.value) || 1))}
                                            className="h-8 w-16 rounded-lg text-xs"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-[11px]"
                                            onClick={() => setReplacement(null)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            value={replacementQuery}
                                            onChange={(event) => setReplacementQuery(event.target.value)}
                                            placeholder="Buscar el producto de reemplazo..."
                                            className="h-9 rounded-xl pl-8 text-xs"
                                        />
                                    </div>
                                    <div className="max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
                                        {replacementResults.length === 0 && (
                                            <p className="py-3 text-center text-[11px] text-slate-400">
                                                Escribí para buscar en el catálogo.
                                            </p>
                                        )}
                                        {replacementResults.map((product) => (
                                            <button
                                                key={product.id}
                                                type="button"
                                                onClick={() => setReplacement(product)}
                                                disabled={product.stock <= 0}
                                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2 text-left transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#161b22] dark:hover:bg-white/5"
                                            >
                                                <span className="flex min-w-0 items-center gap-2.5">
                                                    <ProductThumb url={product.imageUrl} name={product.name} size={36} />
                                                    <span className="min-w-0 truncate text-xs font-semibold text-slate-900 dark:text-white">
                                                        {product.name}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 text-right">
                                                    <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                                        {formatMoney(product.price)}
                                                    </span>
                                                    <span className={cn(
                                                        'block text-[10px]',
                                                        product.stock > 0 ? 'text-slate-400' : 'text-rose-500'
                                                    )}>
                                                        {product.stock > 0 ? `stock ${product.stock}` : 'sin stock'}
                                                    </span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {replacement && (
                                <p className="rounded-lg border border-violet-200 bg-violet-50/60 p-2.5 text-[11px] leading-relaxed text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300">
                                    Al completar el caso, {replacementQty} u. de este producto salen del stock y la unidad
                                    devuelta vuelve según el destino que elijas.
                                    {priceDifference != null && priceDifference !== 0 && (
                                        <span className="mt-1 block font-semibold">
                                            {priceDifference > 0
                                                ? `El cliente abona ${formatMoney(priceDifference)} de diferencia.`
                                                : `Se le devuelven ${formatMoney(Math.abs(priceDifference))} al cliente.`}
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>
                    )}

                    {showRefund && (
                        <div className="space-y-1.5">
                            <Label htmlFor="after-sales-refund" className="text-xs font-semibold">Monto proyectado a reintegrar</Label>
                            <Input
                                id="after-sales-refund"
                                inputMode="numeric"
                                value={refundAmount}
                                onChange={(event) => setRefundAmount(event.target.value)}
                                placeholder="0"
                                className="rounded-xl text-xs h-9"
                            />
                            <p className="text-[11px] text-slate-400">
                                {parsedRefund
                                    ? `Monto proyectado: ${formatMoney(parsedRefund)}.`
                                    : 'Opcional. Puede especificarse al momento de procesar la resolución.'}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-[#161b22] dark:text-slate-400">
                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                        <p className="leading-relaxed">
                            Al registrar el caso, el reclamo queda abierto para auditoría. Los movimientos finales de dinero o inventario se confirman al aprobar o completar el expediente.
                        </p>
                    </div>
                    </>)}
                </div>

                <DialogFooter className="pt-3 gap-2 border-t dark:border-white/10">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="rounded-xl h-9 text-xs">
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={!canSubmit} className="rounded-xl h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrar reclamo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
