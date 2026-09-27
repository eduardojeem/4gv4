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
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Check, Loader2, Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag, Wrench,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { REQUEST_META, formatMoney, type RequestType, type SourceType } from './after-sales-meta'
import { ProductThumb } from '@/components/suppliers/order-ui'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

/** Origen encontrado por la búsqueda, ya normalizado por la API. */
interface OriginResult {
    id: string
    label: string
    subtitle: string
    amount?: number
    device?: string
    warrantyExpired?: boolean
    warrantyExpiresAt?: string | null
    items?: AfterSalesSaleItem[]
    date?: string | null
}

/** Item de la venta, para identificar qué producto se está reclamando. */
export interface AfterSalesSaleItem {
    id: string
    product_id: string | null
    name: string
    quantity: number
    imageUrl?: string | null
    unitPrice?: number
    warrantyMonths?: number | null
    returnWindowDays?: number | null
    exchangeWindowDays?: number | null
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
    /** Número de ticket o de venta, solo para mostrar. */
    reference?: string | null
    /** Qué se está reclamando: equipo reparado o producto vendido. */
    subject?: string | null
    customerName?: string | null
    allowedRequestTypes: RequestType[]
    /** Si la garantía de reparación o venta está vencida por defecto. */
    warrantyExpired?: boolean
    warrantyExpiresLabel?: string | null
    /** Fecha de la venta para calcular vencimientos exactos. */
    saleDate?: string | null
    maxQuantity?: number
    /** Items de la venta de origen. */
    saleItems?: AfterSalesSaleItem[]
    onCreated?: () => void
}

export interface WarrantyEvaluation {
    isExpired: boolean
    expiresAt: Date | null
    daysRemainingOrElapsed: number
    label: string
    badgeText: string
    badgeVariant: 'valid' | 'expired' | 'neutral'
}

export function evaluateDeadline(
    dateStr: string | null | undefined,
    requestType: RequestType,
    item?: AfterSalesSaleItem | null,
    repairWarrantyExpired?: boolean,
    repairWarrantyExpiresLabel?: string | null
): WarrantyEvaluation {
    if (requestType === 'repair_warranty') {
        const isExpired = Boolean(repairWarrantyExpired)
        return {
            isExpired,
            expiresAt: null,
            daysRemainingOrElapsed: 0,
            label: isExpired
                ? `Garantía de reparación vencida${repairWarrantyExpiresLabel ? ` (${repairWarrantyExpiresLabel})` : ''}`
                : `Garantía de reparación vigente${repairWarrantyExpiresLabel ? ` (${repairWarrantyExpiresLabel})` : ''}`,
            badgeText: isExpired ? 'Garantía vencida' : 'Garantía vigente',
            badgeVariant: isExpired ? 'expired' : 'valid',
        }
    }

    if (!dateStr) {
        return {
            isExpired: false,
            expiresAt: null,
            daysRemainingOrElapsed: 0,
            label: 'Fecha del comprobante no registrada',
            badgeText: 'Sin fecha registrada',
            badgeVariant: 'neutral',
        }
    }

    const baseDate = new Date(dateStr)
    if (Number.isNaN(baseDate.getTime())) {
        return {
            isExpired: false,
            expiresAt: null,
            daysRemainingOrElapsed: 0,
            label: 'Fecha no disponible',
            badgeText: 'Sin fecha',
            badgeVariant: 'neutral',
        }
    }

    const now = new Date()

    if (requestType === 'product_warranty') {
        const months = item?.warrantyMonths ?? 3
        const expiresAt = new Date(baseDate)
        expiresAt.setMonth(expiresAt.getMonth() + months)
        const isExpired = now.getTime() > expiresAt.getTime()
        const diffDays = Math.max(0, Math.floor(Math.abs(now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24)))
        const dateFormatted = format(expiresAt, "d 'de' MMMM yyyy", { locale: es })
        return {
            isExpired,
            expiresAt,
            daysRemainingOrElapsed: diffDays,
            label: isExpired
                ? `Garantía de producto (${months} meses) vencida hace ${diffDays} día${diffDays === 1 ? '' : 's'} (venció el ${dateFormatted})`
                : `Garantía de producto (${months} meses) vigente hasta el ${dateFormatted}`,
            badgeText: isExpired ? `Garantía vencida (-${diffDays}d)` : `Garantía vigente (${months}m)`,
            badgeVariant: isExpired ? 'expired' : 'valid',
        }
    }

    if (requestType === 'return') {
        const days = item?.returnWindowDays ?? 7
        const expiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)
        const isExpired = now.getTime() > expiresAt.getTime()
        const diffDays = Math.max(0, Math.floor(Math.abs(now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24)))
        const dateFormatted = format(expiresAt, "d 'de' MMMM yyyy", { locale: es })
        return {
            isExpired,
            expiresAt,
            daysRemainingOrElapsed: diffDays,
            label: isExpired
                ? `Plazo de devolución (${days} días) vencido hace ${diffDays} día${diffDays === 1 ? '' : 's'} (venció el ${dateFormatted})`
                : `Plazo de devolución (${days} días) vigente hasta el ${dateFormatted}`,
            badgeText: isExpired ? `Plazo vencido (-${diffDays}d)` : `Plazo vigente (${days}d)`,
            badgeVariant: isExpired ? 'expired' : 'valid',
        }
    }

    if (requestType === 'exchange') {
        const days = item?.exchangeWindowDays ?? 7
        const expiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)
        const isExpired = now.getTime() > expiresAt.getTime()
        const diffDays = Math.max(0, Math.floor(Math.abs(now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24)))
        const dateFormatted = format(expiresAt, "d 'de' MMMM yyyy", { locale: es })
        return {
            isExpired,
            expiresAt,
            daysRemainingOrElapsed: diffDays,
            label: isExpired
                ? `Plazo de cambio (${days} días) vencido hace ${diffDays} día${diffDays === 1 ? '' : 's'} (venció el ${dateFormatted})`
                : `Plazo de cambio (${days} días) vigente hasta el ${dateFormatted}`,
            badgeText: isExpired ? `Plazo vencido (-${diffDays}d)` : `Plazo vigente (${days}d)`,
            badgeVariant: isExpired ? 'expired' : 'valid',
        }
    }

    return {
        isExpired: false,
        expiresAt: null,
        daysRemainingOrElapsed: 0,
        label: '',
        badgeText: '',
        badgeVariant: 'neutral',
    }
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
    saleDate,
    maxQuantity,
    saleItems,
    onCreated,
}: CreateAfterSalesCaseDialogProps) {
    // Si la organización no tiene taller activado, ocultar todas las opciones y tipos de reparación.
    const subscription = useSubscriptionStatus() as { effectiveModules?: string[]; tieneTaller?: boolean }
    const tieneTaller = Array.isArray(subscription?.effectiveModules)
        ? subscription.effectiveModules.includes('repairs')
        : Boolean(subscription?.tieneTaller ?? false)

    // Origen: solo se selecciona si se abrió sin venta ni reparación previa.
    const needsOrigin = !repairId && !saleId
    const [originType, setOriginType] = useState<SourceType>('sale')
    const [originQuery, setOriginQuery] = useState('')
    const [originResults, setOriginResults] = useState<OriginResult[]>([])
    const [originLoading, setOriginLoading] = useState(false)
    const [pickedOrigin, setPickedOrigin] = useState<OriginResult | null>(null)

    const originOptions = useMemo(() => [
        { value: 'sale' as SourceType, label: 'Ventas', icon: ShoppingBag },
        { value: 'repair' as SourceType, label: 'Reparaciones', icon: Wrench },
    ].filter((option) => option.value !== 'repair' || tieneTaller), [tieneTaller])

    // Si no tiene taller, bloquear originType a venta.
    useEffect(() => {
        if (!tieneTaller && originType === 'repair') {
            setOriginType('sale')
        }
    }, [tieneTaller, originType])

    // Tipos de reclamo admitidos según contexto y módulos.
    const effectiveTypes: RequestType[] = useMemo(() => {
        const base: RequestType[] = needsOrigin
            ? (originType === 'repair' && tieneTaller ? ['repair_warranty'] : ['product_warranty', 'exchange', 'return'])
            : allowedRequestTypes

        return base.filter((type) => tieneTaller || type !== 'repair_warranty')
    }, [needsOrigin, originType, tieneTaller, allowedRequestTypes])

    const [requestType, setRequestType] = useState<RequestType>(effectiveTypes[0] || 'product_warranty')
    const [reason, setReason] = useState('')
    const [notes, setNotes] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [refundAmount, setRefundAmount] = useState('')
    const [selectedItemId, setSelectedItemId] = useState<string>('')
    const [warrantyConsent, setWarrantyConsent] = useState(false)

    // Reemplazo en caso de Cambio
    const [replacementQuery, setReplacementQuery] = useState('')
    const [replacementResults, setReplacementResults] = useState<ReplacementProduct[]>([])
    const [replacement, setReplacement] = useState<ReplacementProduct | null>(null)
    const [replacementQty, setReplacementQty] = useState(1)
    const [submitting, setSubmitting] = useState(false)

    // Reinicio limpio en cada apertura
    useEffect(() => {
        if (!open) return
        const initialType = effectiveTypes[0] || 'product_warranty'
        setRequestType(initialType)
        setReason('')
        setNotes('')
        setQuantity(1)
        setRefundAmount('')
        setSelectedItemId(saleItems?.length === 1 ? saleItems[0].id : '')
        setWarrantyConsent(false)
        setSubmitting(false)
        setPickedOrigin(null)
        setOriginQuery('')
        setOriginResults([])
        setReplacement(null)
        setReplacementQuery('')
        setReplacementResults([])
        setReplacementQty(1)
    }, [open, effectiveTypes, saleItems])

    // Si cambia el tipo de origen
    useEffect(() => {
        if (!needsOrigin) return
        setPickedOrigin(null)
        setSelectedItemId('')
        setWarrantyConsent(false)
        setRequestType(originType === 'repair' && tieneTaller ? 'repair_warranty' : 'product_warranty')
    }, [originType, needsOrigin, tieneTaller])

    // Ajustar si requestType deja de estar permitido
    useEffect(() => {
        if (!effectiveTypes.includes(requestType) && effectiveTypes.length > 0) {
            setRequestType(effectiveTypes[0])
        }
    }, [effectiveTypes, requestType])

    // Datos efectivos
    const effectiveSourceType: SourceType = needsOrigin ? originType : sourceType
    const effectiveRepairId = needsOrigin ? (originType === 'repair' ? pickedOrigin?.id ?? null : null) : repairId
    const effectiveSaleId = needsOrigin ? (originType === 'sale' ? pickedOrigin?.id ?? null : null) : saleId
    const effectiveItems = needsOrigin ? pickedOrigin?.items : saleItems
    const effectiveReference = needsOrigin ? pickedOrigin?.label ?? null : reference
    const effectiveSubject = needsOrigin ? pickedOrigin?.device ?? null : subject
    const effectiveCustomerName = needsOrigin ? pickedOrigin?.subtitle ?? null : customerName
    const effectiveDate = needsOrigin ? pickedOrigin?.date ?? null : saleDate ?? null
    const effectiveWarrantyExpired = needsOrigin ? Boolean(pickedOrigin?.warrantyExpired) : warrantyExpired

    const originChosen = !needsOrigin || Boolean(pickedOrigin)
    const showQuantity = effectiveSourceType === 'sale'
    const hasItems = effectiveSourceType === 'sale' && Array.isArray(effectiveItems) && effectiveItems.length > 0
    const selectedItem = hasItems ? effectiveItems.find((item) => item.id === selectedItemId) ?? null : null
    const showRefund = requestType === 'return'
    const showReplacement = requestType === 'exchange'

    // Evaluación del plazo de garantía / devolución
    const warrantyEvaluation = useMemo(() => {
        return evaluateDeadline(
            effectiveDate,
            requestType,
            selectedItem,
            effectiveWarrantyExpired,
            warrantyExpiresLabel
        )
    }, [effectiveDate, requestType, selectedItem, effectiveWarrantyExpired, warrantyExpiresLabel])

    // Al cambiar de item o de tipo de reclamo, resetear el consentimiento de excepción si vuelve a estar vencido
    useEffect(() => {
        setWarrantyConsent(false)
    }, [selectedItemId, requestType])

    // Búsqueda de orígenes con respiro
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

    // Búsqueda de productos de reemplazo en el catálogo
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

    // Diferencia del cambio
    const priceDifference =
        showReplacement && replacement
            ? replacement.price * replacementQty - (selectedItem?.unitPrice ?? 0) * quantity
            : null

    const parsedRefund = useMemo(() => {
        if (!showRefund) return null
        const value = Number(refundAmount.replace(/[^\d]/g, ''))
        return Number.isFinite(value) && value > 0 ? value : null
    }, [refundAmount, showRefund])

    const trimmedReason = reason.trim()

    // Validaciones de envío:
    // Requiere: origen elegido, motivo >= 3 chars, item elegido si hay items, reemplazo si es cambio,
    // y consentimiento explícito si el plazo está vencido.
    const isWarrantyBlocked = warrantyEvaluation.isExpired && !warrantyConsent

    const canSubmit =
        originChosen &&
        trimmedReason.length >= 3 &&
        !submitting &&
        (!hasItems || Boolean(selectedItem)) &&
        (!showReplacement || Boolean(replacement)) &&
        !isWarrantyBlocked

    const handleSubmit = async () => {
        if (!canSubmit) return
        setSubmitting(true)

        try {
            // Documentar en notas internas si se autorizó una excepción fuera de plazo
            const auditNotes = [
                warrantyEvaluation.isExpired ? `[Excepción comercial autorizada: ${warrantyEvaluation.label}]` : null,
                notes.trim() || null,
            ].filter(Boolean).join('\n')

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
                    notes: auditNotes || null,
                    refund_amount: parsedRefund,
                    replacement_product_id: showReplacement ? replacement?.id ?? null : null,
                    replacement_quantity: showReplacement ? replacementQty : null,
                    price_difference: showReplacement ? priceDifference : null,
                }),
            })

            const result = await response.json().catch(() => null)

            if (!response.ok || !result?.success) {
                throw new Error(result?.error || 'No se pudo registrar el reclamo.')
            }

            toast.success('Reclamo registrado con éxito', {
                description: result.data?.case_number
                    ? `Expediente ${result.data.case_number} abierto para auditoría.`
                    : 'Expediente registrado en el sistema.',
            })
            onOpenChange(false)
            onCreated?.()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo registrar el reclamo.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden border border-slate-200 dark:border-white/10 dark:bg-[#0d1117] shadow-2xl">
                {/* Modern Header */}
                <div className="bg-gradient-to-r from-blue-600/10 via-slate-50 to-white dark:from-blue-950/40 dark:via-[#161b22] dark:to-[#0d1117] border-b border-slate-200/80 dark:border-white/10 px-6 py-4">
                    <DialogHeader className="space-y-1">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30">
                                <ShieldAlert className="h-5 w-5" />
                            </span>
                            <div>
                                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                                    Registrar Nuevo Reclamo
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                                    Apertura de caso de posventa auditado con validación de garantías y plazos.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                {/* Form Body with Scroll */}
                <div className="space-y-5 px-6 py-4 max-h-[72vh] overflow-y-auto">
                    {/* PASO 1: SELECCIÓN DE ORIGEN (SI APLICA) */}
                    {needsOrigin && (
                        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    1. Comprobante de origen <span className="text-rose-500">*</span>
                                </Label>
                                {originOptions.length > 1 && !pickedOrigin && (
                                    <div className="flex rounded-lg border border-slate-200 dark:border-white/10 p-0.5 bg-white dark:bg-[#161b22]">
                                        {originOptions.map((opt) => {
                                            const Icon = opt.icon
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setOriginType(opt.value)}
                                                    className={cn(
                                                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                                                        originType === opt.value
                                                            ? 'bg-blue-600 text-white shadow-xs'
                                                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                                    )}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                    {opt.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {pickedOrigin ? (
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-500/60 bg-blue-50/70 p-3 dark:border-blue-500/40 dark:bg-blue-950/30">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 font-mono font-bold text-xs">
                                            {originType === 'repair' ? <Wrench className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                                {pickedOrigin.label}
                                            </p>
                                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                                {pickedOrigin.subtitle}
                                                {pickedOrigin.device ? ` · ${pickedOrigin.device}` : ''}
                                                {typeof pickedOrigin.amount === 'number' ? ` · ${formatMoney(pickedOrigin.amount)}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs shrink-0"
                                        onClick={() => {
                                            setPickedOrigin(null)
                                            setSelectedItemId('')
                                        }}
                                    >
                                        <X className="mr-1 h-3 w-3" />
                                        Cambiar
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            value={originQuery}
                                            onChange={(event) => setOriginQuery(event.target.value)}
                                            placeholder={originType === 'sale' ? 'Buscar venta por código, cliente o teléfono...' : 'Buscar ticket de reparación o cliente...'}
                                            className="h-9 pl-9 text-xs rounded-xl"
                                        />
                                    </div>

                                    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
                                        {originLoading && (
                                            <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                <span>Buscando comprobantes...</span>
                                            </div>
                                        )}
                                        {!originLoading && originResults.length === 0 && (
                                            <p className="py-4 text-center text-xs text-slate-400">
                                                {originType === 'sale'
                                                    ? 'No se encontraron ventas con ese criterio.'
                                                    : 'No se encontraron reparaciones entregadas con garantía.'}
                                            </p>
                                        )}
                                        {!originLoading && originResults.map((result) => (
                                            <button
                                                key={result.id}
                                                type="button"
                                                onClick={() => {
                                                    setPickedOrigin(result)
                                                    if (result.items?.length === 1) {
                                                        setSelectedItemId(result.items[0].id)
                                                    }
                                                }}
                                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-2.5 text-left transition-all hover:border-blue-400 hover:bg-blue-50/40 dark:border-white/10 dark:bg-[#161b22] dark:hover:bg-white/5"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                                                        {result.label}
                                                    </p>
                                                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                                        {result.subtitle}
                                                        {result.device ? ` · ${result.device}` : ''}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    {typeof result.amount === 'number' && (
                                                        <p className="text-xs font-semibold text-slate-900 dark:text-white font-mono">
                                                            {formatMoney(result.amount)}
                                                        </p>
                                                    )}
                                                    {result.warrantyExpired != null && (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                'text-[10px] h-4.5',
                                                                result.warrantyExpired
                                                                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
                                                                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            )}
                                                        >
                                                            {result.warrantyExpired ? 'Garantía vencida' : 'Garantía vigente'}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Resumen del comprobante cuando ya se conoce */}
                    {!needsOrigin && (effectiveReference || effectiveCustomerName || effectiveSubject) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs dark:border-white/10 dark:bg-[#161b22]">
                            <div className="flex items-center gap-2 min-w-0">
                                <Badge variant="outline" className="text-[11px] font-semibold">
                                    {effectiveSourceType === 'repair' ? 'Reparación' : 'Venta'}
                                </Badge>
                                {effectiveReference && (
                                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                                        {effectiveReference}
                                    </span>
                                )}
                                {effectiveCustomerName && (
                                    <span className="text-slate-500 dark:text-slate-400 truncate">
                                        · {effectiveCustomerName}
                                    </span>
                                )}
                            </div>
                            {effectiveSubject && (
                                <span className="text-[11px] text-muted-foreground truncate max-w-xs">
                                    {effectiveSubject}
                                </span>
                            )}
                        </div>
                    )}

                    {originChosen && (
                        <>
                            {/* PASO 2: SELECCIÓN DEL PRODUCTO (SI ES VENTA CON ITEMS) */}
                            {hasItems && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span>2. Producto reclamado <span className="text-rose-500">*</span></span>
                                        <span className="text-[11px] font-normal text-slate-400 lowercase">
                                            {effectiveItems!.length} item{effectiveItems!.length === 1 ? '' : 's'} en el comprobante
                                        </span>
                                    </Label>

                                    <div className="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto pr-0.5">
                                        {effectiveItems!.map((item) => {
                                            const isSelected = selectedItemId === item.id
                                            const itemWarranty = evaluateDeadline(
                                                effectiveDate,
                                                requestType,
                                                item,
                                                effectiveWarrantyExpired,
                                                warrantyExpiresLabel
                                            )
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedItemId(item.id)
                                                        setQuantity((current) => Math.min(Math.max(1, current), item.quantity))
                                                    }}
                                                    className={cn(
                                                        'flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all relative overflow-hidden',
                                                        isSelected
                                                            ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40'
                                                            : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#161b22] dark:hover:bg-white/5'
                                                    )}
                                                >
                                                    <ProductThumb url={item.imageUrl} name={item.name} size={42} />
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                                                {item.name}
                                                            </p>
                                                            {isSelected && (
                                                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                                                    <Check className="h-2.5 w-2.5" />
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                                            <span>Cant: {item.quantity} u.</span>
                                                            {item.unitPrice ? (
                                                                <span className="font-mono font-medium">{formatMoney(item.unitPrice)}</span>
                                                            ) : null}
                                                        </div>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                'text-[10px] px-1.5 py-0 h-4 mt-0.5',
                                                                itemWarranty.badgeVariant === 'expired'
                                                                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
                                                                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            )}
                                                        >
                                                            {itemWarranty.badgeText}
                                                        </Badge>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* PASO 3: TIPO DE RECLAMO */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    3. Tipo de reclamo <span className="text-rose-500">*</span>
                                </Label>
                                <div className="grid gap-2 sm:grid-cols-3">
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
                                                    'flex flex-col gap-1 rounded-xl border p-3 text-left transition-all',
                                                    active
                                                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                                                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#161b22] dark:hover:bg-white/5'
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs',
                                                        active
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                    )}>
                                                        <Icon className="h-3.5 w-3.5" />
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                        {meta.label}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mt-0.5">
                                                    {meta.hint}
                                                </p>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* PASO 4: VALIDACIÓN DE GARANTÍA Y PLAZOS */}
                            {warrantyEvaluation.isExpired ? (
                                <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 space-y-2.5 text-xs dark:border-amber-900/60 dark:bg-amber-950/30">
                                    <div className="flex items-start gap-2.5">
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="font-bold text-amber-900 dark:text-amber-200">
                                                Plazo de garantía / devolución vencido
                                            </p>
                                            <p className="text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                                                {warrantyEvaluation.label}. Para continuar y registrar este expediente, debes autorizar expresamente la excepción comercial.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-amber-200 dark:border-amber-900/50">
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <Checkbox
                                                checked={warrantyConsent}
                                                onCheckedChange={(checked) => setWarrantyConsent(Boolean(checked))}
                                                className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                            />
                                            <span className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                                                Autorizar excepción comercial fuera de plazo (Requerido)
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            ) : warrantyEvaluation.label ? (
                                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-[11px] font-medium">{warrantyEvaluation.label}</span>
                                </div>
                            ) : null}

                            {/* CANTIDAD (SI APLICA) */}
                            {showQuantity && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="after-sales-qty" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Cantidad de unidades
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="after-sales-qty"
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
                                            className="w-28 rounded-xl text-xs h-9 font-mono"
                                        />
                                        <span className="text-[11px] text-slate-400">
                                            (Máximo permitido: {selectedItem?.quantity ?? maxQuantity ?? 1} u.)
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* REEMPLAZO (SI ES CAMBIO) */}
                            {showReplacement && (
                                <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3.5 dark:border-violet-900/40 dark:bg-violet-950/20">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-violet-900 dark:text-violet-300 flex items-center justify-between">
                                        <span>Producto de reemplazo <span className="text-rose-500">*</span></span>
                                        {replacement && (
                                            <span className="text-[11px] font-normal text-violet-700 dark:text-violet-400">
                                                Stock actual: {replacement.stock} u.
                                            </span>
                                        )}
                                    </Label>

                                    {replacement ? (
                                        <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-400 bg-white p-2.5 dark:border-violet-600 dark:bg-[#161b22]">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <ProductThumb url={replacement.imageUrl} name={replacement.name} size={40} />
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                                        {replacement.name}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                                        {formatMoney(replacement.price)} c/u
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="flex items-center gap-1">
                                                    <Label className="text-[11px] text-slate-500">Cant:</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={replacement.stock || 1}
                                                        value={replacementQty}
                                                        onChange={(event) => setReplacementQty(Math.max(1, Number(event.target.value) || 1))}
                                                        className="h-7 w-14 rounded-lg text-xs font-mono text-center"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => setReplacement(null)}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                                <Input
                                                    value={replacementQuery}
                                                    onChange={(event) => setReplacementQuery(event.target.value)}
                                                    placeholder="Buscar producto de reemplazo en el catálogo..."
                                                    className="h-9 pl-9 text-xs rounded-xl bg-white dark:bg-[#161b22]"
                                                />
                                            </div>
                                            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
                                                {replacementResults.length === 0 && (
                                                    <p className="py-3 text-center text-xs text-slate-400">
                                                        Escribí para buscar productos con stock en el catálogo.
                                                    </p>
                                                )}
                                                {replacementResults.map((product) => (
                                                    <button
                                                        key={product.id}
                                                        type="button"
                                                        onClick={() => setReplacement(product)}
                                                        disabled={product.stock <= 0}
                                                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-2 text-left transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#161b22]"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <ProductThumb url={product.imageUrl} name={product.name} size={32} />
                                                            <span className="truncate text-xs font-medium text-slate-900 dark:text-white">
                                                                {product.name}
                                                            </span>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white">
                                                                {formatMoney(product.price)}
                                                            </span>
                                                            <span className={cn(
                                                                'block text-[10px]',
                                                                product.stock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                                                            )}>
                                                                {product.stock > 0 ? `Stock: ${product.stock}` : 'Sin stock'}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cálculo de diferencia */}
                                    {replacement && priceDifference != null && (
                                        <div className="rounded-xl border border-violet-300/80 bg-white/80 p-2.5 text-xs text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200 flex items-center justify-between">
                                            <span>Balance del cambio:</span>
                                            <span className="font-mono font-bold text-xs">
                                                {priceDifference > 0
                                                    ? `Abona el cliente: +${formatMoney(priceDifference)}`
                                                    : priceDifference < 0
                                                        ? `A favor del cliente: ${formatMoney(Math.abs(priceDifference))}`
                                                        : 'Sin diferencia de precio ($0)'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* REINTEGRO PROYECTADO (SI ES DEVOLUCIÓN) */}
                            {showRefund && (
                                <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 dark:border-rose-900/40 dark:bg-rose-950/20">
                                    <Label htmlFor="after-sales-refund" className="text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-300">
                                        Monto proyectado a reintegrar
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="after-sales-refund"
                                            inputMode="numeric"
                                            value={refundAmount}
                                            onChange={(event) => setRefundAmount(event.target.value)}
                                            placeholder="0"
                                            className="h-9 w-40 rounded-xl text-xs font-mono bg-white dark:bg-[#161b22]"
                                        />
                                        {selectedItem?.unitPrice ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-9 text-xs"
                                                onClick={() => setRefundAmount(String((selectedItem.unitPrice ?? 0) * quantity))}
                                            >
                                                Reintegro total ({formatMoney((selectedItem.unitPrice ?? 0) * quantity)})
                                            </Button>
                                        ) : null}
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Opcional. El monto final y el método de pago se confirman al resolver y cerrar el caso.
                                    </p>
                                </div>
                            )}

                            {/* MOTIVO DEL RECLAMO */}
                            <div className="space-y-1.5">
                                <Label htmlFor="after-sales-reason" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Motivo manifestado por el cliente <span className="text-rose-500">*</span>
                                </Label>
                                <Textarea
                                    id="after-sales-reason"
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value.slice(0, 1000))}
                                    placeholder="Detallá la falla manifestada, motivo de cambio o defecto encontrado (mínimo 3 caracteres)..."
                                    rows={3}
                                    className="rounded-xl text-xs leading-relaxed resize-none"
                                />
                                <div className="flex justify-between text-[11px] text-slate-400">
                                    <span>{trimmedReason.length < 3 ? 'Mínimo 3 caracteres requeridos' : 'Motivo válido'}</span>
                                    <span>{reason.length}/1000</span>
                                </div>
                            </div>

                            {/* NOTAS INTERNAS */}
                            <div className="space-y-1.5">
                                <Label htmlFor="after-sales-notes" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Notas internas de recepción
                                </Label>
                                <Textarea
                                    id="after-sales-notes"
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value.slice(0, 2000))}
                                    placeholder="Opcional. Estado estético de entrega, accesorios recibidos, etc."
                                    rows={2}
                                    className="rounded-xl text-xs leading-relaxed resize-none"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Modern Footer */}
                <DialogFooter className="bg-slate-50 dark:bg-[#161b22] px-6 py-3.5 border-t border-slate-200/80 dark:border-white/10 flex flex-row items-center justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                        className="rounded-xl h-9 text-xs"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={cn(
                            'rounded-xl h-9 text-xs font-semibold text-white transition-all shadow-sm',
                            canSubmit
                                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                                : 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed'
                        )}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                Guardando expediente...
                            </>
                        ) : (
                            'Registrar Reclamo'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
