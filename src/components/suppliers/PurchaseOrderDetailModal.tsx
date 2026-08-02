'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Ban, Calendar, Hash, Lock, Package, Pencil, RefreshCw, Trash2, Truck, X } from 'lucide-react'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatMoney, ProductThumb, QuantityStepper } from './order-ui'

export interface PurchaseOrderSummary {
    id: string
    ordernumber: string
    status: 'draft' | 'sent' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
    orderdate: string
    totalamount: number
    currency: string
    expecteddeliverydate?: string | null
    subtotal?: number | null
    taxamount?: number | null
    shippingcost?: number | null
}

interface PurchaseOrderItem {
    id: string
    product_id: string | null
    name: string
    suppliersku: string | null
    quantity: number
    unitprice: number
    linetotal: number
    imageUrl?: string | null
}

const STATUS_META: Record<PurchaseOrderSummary['status'], { label: string; className: string }> = {
    draft: { label: 'Borrador', className: 'bg-muted text-muted-foreground border-border' },
    sent: { label: 'Enviado', className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300' },
    confirmed: { label: 'Confirmado', className: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300' },
    shipped: { label: 'En camino', className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300' },
    delivered: { label: 'Recibido', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300' },
    cancelled: { label: 'Cancelado', className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300' },
}

function formatDate(value?: string | null) {
    if (!value) return 'Sin definir'
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return 'Sin definir'
    return format(date, "dd 'de' MMMM yyyy", { locale: es })
}

export function PurchaseOrderDetailModal({
    order,
    supplierName,
    open,
    onOpenChange,
    onOrderUpdated,
}: {
    order: PurchaseOrderSummary | null
    supplierName: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onOrderUpdated?: () => void
}) {
    const [items, setItems] = useState<PurchaseOrderItem[]>([])
    const [draftItems, setDraftItems] = useState<PurchaseOrderItem[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editing, setEditing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)
    const [confirmingDestructive, setConfirmingDestructive] = useState(false)
    const orderId = order?.id

    /**
     * Solo se edita un pedido en borrador: una vez enviado al proveedor, cambiar
     * cantidades del lado nuestro dejaria el sistema desalineado con lo que el
     * proveedor ya recibio.
     */
    const canEdit = order?.status === 'draft'

    /**
     * Un borrador nunca salio de la organizacion, asi que se borra de verdad
     * (los items caen por ON DELETE CASCADE). Uno ya enviado al proveedor no se
     * borra: se marca cancelado para conservar el rastro de que existio.
     */
    const isDraft = order?.status === 'draft'
    const isClosed = order?.status === 'delivered' || order?.status === 'cancelled'
    const canDestroy = Boolean(order) && !isClosed

    const loadItems = useCallback(async () => {
        if (!orderId) return
        setLoading(true)
        setError(null)
        try {
            const supabase = createClient()
            const { data, error: itemsError } = await supabase
                .from('purchase_order_items')
                .select('id, product_id, name, suppliersku, quantity, unitprice, linetotal')
                .eq('order_id', orderId)

            if (itemsError) throw itemsError

            const rows = (data || []) as PurchaseOrderItem[]

            // La imagen no vive en el item: se trae del producto referenciado.
            const productIds = Array.from(new Set(rows.map((row) => row.product_id).filter(Boolean))) as string[]
            const imageByProductId = new Map<string, string | null>()

            if (productIds.length > 0) {
                const { data: products } = await supabase
                    .from('products')
                    .select('id, image_url, images')
                    .in('id', productIds)

                for (const product of products || []) {
                    const images = Array.isArray(product.images) ? (product.images as string[]) : []
                    imageByProductId.set(String(product.id), (product.image_url as string | null) || images[0] || null)
                }
            }

            const withImages = rows.map((row) => ({
                ...row,
                imageUrl: row.product_id ? imageByProductId.get(row.product_id) ?? null : null,
            }))

            setItems(withImages)
            setDraftItems(withImages)
        } catch (err) {
            setItems([])
            setDraftItems([])
            setError(err instanceof Error ? err.message : 'No se pudieron cargar los productos del pedido.')
        } finally {
            setLoading(false)
        }
    }, [orderId])

    useEffect(() => {
        if (!open || !orderId) return
        setEditing(false)
        void loadItems()
    }, [open, orderId, reloadKey, loadItems])

    const visibleItems = editing ? draftItems : items

    const totals = useMemo(() => {
        const units = visibleItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
        const subtotal = visibleItems.reduce((sum, item) => sum + (Number(item.linetotal) || 0), 0)
        return { units, subtotal }
    }, [visibleItems])

    if (!order) return null

    const status = STATUS_META[order.status] ?? STATUS_META.draft
    const currency = order.currency || 'PYG'
    const shipping = Number(order.shippingcost) || 0
    const tax = Number(order.taxamount) || 0
    // El subtotal guardado puede venir vacio en ordenes viejas; se recalcula.
    const storedSubtotal = order.subtotal != null && Number(order.subtotal) > 0
        ? Number(order.subtotal)
        : totals.subtotal
    const subtotal = editing ? totals.subtotal : storedSubtotal
    const total = editing ? totals.subtotal + shipping - 0 + tax : Number(order.totalamount) || 0
    const hasChanges = editing && JSON.stringify(draftItems) !== JSON.stringify(items)

    const changeQuantity = (itemId: string, quantity: number) => {
        setDraftItems((current) => current.map((item) => item.id === itemId
            ? { ...item, quantity, linetotal: quantity * Number(item.unitprice || 0) }
            : item))
    }

    const removeItem = (itemId: string) => {
        setDraftItems((current) => current.filter((item) => item.id !== itemId))
    }

    /**
     * Borra el borrador o cancela el pedido ya enviado, segun corresponda.
     * El cierre del modal lo hace el llamador para no dejar abierto un detalle
     * de algo que ya no existe.
     */
    const destroyOrder = async () => {
        setSaving(true)
        try {
            const supabase = createClient()

            if (isDraft) {
                const { error: deleteError } = await supabase
                    .from('purchase_orders')
                    .delete()
                    .eq('id', order.id)
                if (deleteError) throw deleteError
                toast.success('Pedido eliminado', { description: `${order.ordernumber} se borró junto con sus productos.` })
            } else {
                const { error: cancelError } = await supabase
                    .from('purchase_orders')
                    .update({ status: 'cancelled' })
                    .eq('id', order.id)
                if (cancelError) throw cancelError
                toast.success('Pedido cancelado', { description: `${order.ordernumber} quedó marcado como cancelado.` })
            }

            setConfirmingDestructive(false)
            onOrderUpdated?.()
            onOpenChange(false)
        } catch (err) {
            toast.error(isDraft ? 'No se pudo eliminar el pedido' : 'No se pudo cancelar el pedido', {
                description: err instanceof Error ? err.message : 'Intenta nuevamente.',
            })
        } finally {
            setSaving(false)
        }
    }

    const cancelEditing = () => {
        setDraftItems(items)
        setEditing(false)
    }

    const saveChanges = async () => {
        if (draftItems.length === 0) {
            toast.error('El pedido debe tener al menos un producto', {
                description: 'Si querés dejarlo sin productos, cancelá el pedido.',
            })
            return
        }

        setSaving(true)
        try {
            const supabase = createClient()

            const removedIds = items
                .filter((item) => !draftItems.some((draft) => draft.id === item.id))
                .map((item) => item.id)

            if (removedIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from('purchase_order_items')
                    .delete()
                    .in('id', removedIds)
                if (deleteError) throw deleteError
            }

            // Solo se escriben las lineas cuya cantidad cambio.
            const changed = draftItems.filter((draft) => {
                const original = items.find((item) => item.id === draft.id)
                return original && original.quantity !== draft.quantity
            })

            for (const item of changed) {
                const { error: updateError } = await supabase
                    .from('purchase_order_items')
                    .update({ quantity: item.quantity, linetotal: item.linetotal })
                    .eq('id', item.id)
                if (updateError) throw updateError
            }

            const nextSubtotal = draftItems.reduce((sum, item) => sum + (Number(item.linetotal) || 0), 0)
            const { error: orderError } = await supabase
                .from('purchase_orders')
                .update({
                    subtotal: nextSubtotal,
                    totalamount: nextSubtotal + shipping + tax,
                })
                .eq('id', order.id)
            if (orderError) throw orderError

            toast.success('Pedido actualizado', {
                description: `${draftItems.length} producto(s) · ${formatMoney(nextSubtotal + shipping + tax, currency)}`,
            })
            setEditing(false)
            setReloadKey((key) => key + 1)
            onOrderUpdated?.()
        } catch (err) {
            toast.error('No se pudo guardar el pedido', {
                description: err instanceof Error ? err.message : 'Intenta nuevamente.',
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) { cancelEditing(); onOpenChange(false) } }}>
            <DialogContent className="flex max-h-[88vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="shrink-0 space-y-2 border-b px-6 py-4 text-left">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <DialogTitle className="flex items-center gap-2 text-base">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                {order.ordernumber}
                            </DialogTitle>
                            <DialogDescription>Pedido a {supplierName}</DialogDescription>
                        </div>
                        <Badge variant="outline" className={cn('shrink-0', status.className)}>
                            {status.label}
                        </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            Emitido el {formatDate(order.orderdate)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5" />
                            Entrega estimada: {formatDate(order.expecteddeliverydate)}
                        </span>
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Productos pedidos
                        </h3>
                        <div className="flex items-center gap-3">
                            {!loading && visibleItems.length > 0 ? (
                                <span className="text-xs text-muted-foreground">
                                    {visibleItems.length} producto{visibleItems.length === 1 ? '' : 's'} · {totals.units} unidad{totals.units === 1 ? '' : 'es'}
                                </span>
                            ) : null}
                            {!loading && !error && items.length > 0 && canEdit && !editing ? (
                                <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => setEditing(true)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                    Editar
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    {!canEdit && !loading && items.length > 0 ? (
                        <p className="mb-3 flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            Solo se pueden editar los pedidos en borrador. Este ya fue enviado al proveedor.
                        </p>
                    ) : null}

                    {loading ? (
                        <div className="space-y-2" aria-busy="true" aria-label="Cargando productos del pedido">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <Skeleton key={index} className="h-[68px] rounded-lg" />
                            ))}
                        </div>
                    ) : error ? (
                        <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
                            <AlertCircle className="h-7 w-7 text-muted-foreground" />
                            <p className="text-sm font-medium">No se pudieron cargar los productos</p>
                            <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
                            <Button variant="outline" size="sm" className="mt-1 gap-1.5" onClick={() => setReloadKey((key) => key + 1)}>
                                <RefreshCw className="h-3.5 w-3.5" />
                                Reintentar
                            </Button>
                        </div>
                    ) : visibleItems.length === 0 ? (
                        <div role="status" className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
                            <Package className="h-7 w-7 text-muted-foreground/50" />
                            <p className="text-sm font-medium">
                                {editing ? 'Quitaste todos los productos' : 'Este pedido no tiene productos'}
                            </p>
                            <p className="max-w-sm text-xs text-muted-foreground">
                                {editing
                                    ? 'Un pedido no puede quedar vacío: volvé a agregar alguno o cancelá los cambios.'
                                    : 'Puede que se haya creado sin ítems o que se hayan eliminado.'}
                            </p>
                        </div>
                    ) : (
                        <ul role="list" className="divide-y rounded-lg border">
                            {visibleItems.map((item) => (
                                <li key={item.id} className="flex items-center gap-3 px-3 py-3">
                                    <div className="relative shrink-0">
                                        <ProductThumb url={item.imageUrl} name={item.name} size={48} />
                                        {!editing ? (
                                            <span
                                                className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold tabular-nums text-primary-foreground"
                                                aria-hidden="true"
                                            >
                                                {item.quantity}
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium leading-tight">{item.name}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {item.suppliersku ? <span className="font-mono">{item.suppliersku}</span> : 'Sin SKU'}
                                            {' · '}
                                            {formatMoney(item.unitprice, currency)} c/u
                                        </p>
                                        {editing ? (
                                            <div className="mt-2 flex items-center gap-2">
                                                <QuantityStepper
                                                    value={item.quantity}
                                                    onChange={(next) => next < 1 ? removeItem(item.id) : changeQuantity(item.id, next)}
                                                    label={item.name}
                                                    size="sm"
                                                    disabled={saving}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                    disabled={saving}
                                                    aria-label={`Quitar ${item.name} del pedido`}
                                                    onClick={() => removeItem(item.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <p className="text-sm font-semibold tabular-nums">
                                            {formatMoney(item.linetotal, currency)}
                                        </p>
                                        <p className="text-xs text-muted-foreground tabular-nums">
                                            {item.quantity} u.
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="shrink-0 border-t bg-muted/20 px-6 py-4">
                    <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Subtotal</span>
                            <span className="tabular-nums">{formatMoney(subtotal, currency)}</span>
                        </div>
                        {shipping > 0 ? (
                            <div className="flex justify-between text-muted-foreground">
                                <span>Envío</span>
                                <span className="tabular-nums">{formatMoney(shipping, currency)}</span>
                            </div>
                        ) : null}
                        {tax > 0 ? (
                            <div className="flex justify-between text-muted-foreground">
                                <span>Impuestos</span>
                                <span className="tabular-nums">{formatMoney(tax, currency)}</span>
                            </div>
                        ) : null}
                        <div className="flex items-baseline justify-between border-t pt-2">
                            <span className="font-medium">Total</span>
                            <span className="text-lg font-bold tabular-nums" aria-live="polite">
                                {formatMoney(total, currency)}
                            </span>
                        </div>
                    </div>

                    {editing ? (
                        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button variant="ghost" className="gap-1.5" onClick={cancelEditing} disabled={saving}>
                                <X className="h-3.5 w-3.5" />
                                Cancelar cambios
                            </Button>
                            <Button onClick={saveChanges} disabled={saving || !hasChanges || draftItems.length === 0}>
                                {saving ? 'Guardando…' : 'Guardar cambios'}
                            </Button>
                        </div>
                    ) : canDestroy ? (
                        <div className="mt-4 flex justify-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={saving}
                                onClick={() => setConfirmingDestructive(true)}
                            >
                                {isDraft ? <Trash2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                                {isDraft ? 'Eliminar pedido' : 'Cancelar pedido'}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </DialogContent>

            <AlertDialog open={confirmingDestructive} onOpenChange={setConfirmingDestructive}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isDraft ? `¿Eliminar el pedido ${order.ordernumber}?` : `¿Cancelar el pedido ${order.ordernumber}?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isDraft
                                ? 'Se borra el pedido junto con todos sus productos. Como todavía es un borrador y no salió al proveedor, no queda registro. Esta acción no se puede deshacer.'
                                : 'El pedido queda marcado como cancelado. Se conserva en el historial para dejar rastro de que existió, pero ya no se considera en curso.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>Volver</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => { event.preventDefault(); void destroyOrder() }}
                            disabled={saving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {saving
                                ? (isDraft ? 'Eliminando…' : 'Cancelando…')
                                : (isDraft ? 'Sí, eliminar' : 'Sí, cancelar')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    )
}
