'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Package, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatMoney, ProductThumb, QuantityStepper } from './order-ui'

interface SupplierProduct {
    id: string
    name: string
    suppliersku: string
    unitprice: number
    currency: string
    /** Stock actual en la organizacion (solo para productos propios). */
    stock?: number | null
    /** Minimo configurado; por debajo conviene reponer. */
    minStock?: number | null
    /** Imagen del producto, si tiene. */
    imageUrl?: string | null
    /**
     * De donde salio: catalogo propio o catalogo sincronizado del proveedor.
     * Opcional porque quien abre el modal con un producto preseleccionado
     * (ej. la vista de comparacion) no necesita conocer el origen.
     */
    source?: 'own' | 'supplier'
}

interface OrderItem {
    productId: string
    name: string
    sku: string
    quantity: number
    unitPrice: number
    total: number
    currency: string
    imageUrl?: string | null
}

interface CreateOrderModalProps {
    isOpen: boolean
    onClose: () => void
    supplierId: string
    supplierName: string
    onOrderCreated: () => void
    initialProduct?: SupplierProduct | null
}

function ProductCard({
    product,
    quantity,
    onAdd,
    onChangeQuantity,
}: {
    product: SupplierProduct
    quantity: number
    onAdd: () => void
    onChangeQuantity: (next: number) => void
}) {
    const isLow = product.minStock != null && product.stock != null && product.stock <= product.minStock
    const inOrder = quantity > 0

    return (
        <li
            className={cn(
                'flex flex-col overflow-hidden rounded-lg border bg-card transition-colors',
                inOrder ? 'border-primary/50 bg-primary/[0.03]' : 'hover:border-border/80'
            )}
        >
            {/* Toda la zona superior es un unico objetivo grande para agregar. */}
            <button
                type="button"
                onClick={onAdd}
                aria-label={inOrder
                    ? `Agregar otra unidad de ${product.name}. Actualmente ${quantity} en el pedido`
                    : `Agregar ${product.name} al pedido`}
                className="group flex flex-1 gap-3 p-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
                <div className="relative shrink-0">
                    <ProductThumb url={product.imageUrl} name={product.name} />
                    {inOrder ? (
                        <span
                            className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold tabular-nums text-primary-foreground"
                            aria-hidden="true"
                        >
                            {quantity}
                        </span>
                    ) : (
                        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
                            <Plus className="h-5 w-5 text-foreground" />
                        </span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{product.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{product.suppliersku || 'Sin SKU'}</span>
                        {product.source === 'supplier' ? (
                            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                                Catálogo proveedor
                            </Badge>
                        ) : null}
                    </div>

                    {/* El stock va en su propia linea: es el dato que decide cuanto pedir. */}
                    {product.stock != null ? (
                        <p
                            className={cn(
                                'mt-1.5 inline-flex items-center gap-1 text-sm font-semibold tabular-nums',
                                isLow ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
                            )}
                        >
                            {isLow ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                            Stock: {product.stock}
                            {product.minStock != null ? (
                                <span className="text-xs font-normal text-muted-foreground">
                                    (mín. {product.minStock})
                                </span>
                            ) : null}
                        </p>
                    ) : null}
                </div>
            </button>

            <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
                <span className="text-sm font-semibold tabular-nums">
                    {formatMoney(product.unitprice, product.currency)}
                </span>

                {inOrder ? (
                    <QuantityStepper
                        value={quantity}
                        onChange={onChangeQuantity}
                        label={product.name}
                        size="sm"
                    />
                ) : (
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={onAdd}>
                        <Plus className="h-3.5 w-3.5" />
                        Agregar
                    </Button>
                )}
            </div>
        </li>
    )
}

export function CreateOrderModal({
    isOpen,
    onClose,
    supplierId,
    supplierName,
    onOrderCreated,
    initialProduct,
}: CreateOrderModalProps) {
    const [products, setProducts] = useState<SupplierProduct[]>([])
    const [items, setItems] = useState<OrderItem[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const supabase = useMemo(() => createClient(), [])

    /**
     * Se combinan dos catalogos:
     *  - `products`: la mercaderia propia de la organizacion asociada a este
     *    proveedor. Es la fuente real para reponer y trae stock, minimo e imagen.
     *  - `supplier_products`: el catalogo que publica el proveedor, y que solo
     *    se llena si hay una integracion externa (API/EDI) configurada. Para la
     *    mayoria de las organizaciones esta vacio, y por eso el modal no
     *    mostraba nada cuando leia unicamente de ahi.
     */
    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true)

            const [ownResult, catalogResult] = await Promise.all([
                supabase
                    .from('products')
                    .select('id, name, sku, purchase_price, stock_quantity, min_stock, image_url, images')
                    .eq('supplier_id', supplierId)
                    .order('name', { ascending: true }),
                supabase
                    .from('supplier_products')
                    .select('id, name, suppliersku, unitprice, currency')
                    .eq('supplier_id', supplierId),
            ])

            if (ownResult.error && catalogResult.error) throw ownResult.error

            const own: SupplierProduct[] = (ownResult.data || []).map((row: Record<string, unknown>) => {
                const images = Array.isArray(row.images) ? (row.images as string[]) : []
                return {
                    id: String(row.id),
                    name: String(row.name ?? 'Producto'),
                    suppliersku: row.sku ? String(row.sku) : '',
                    // Para comprar importa el costo, no el precio de venta.
                    unitprice: Number(row.purchase_price ?? 0),
                    currency: 'PYG',
                    stock: row.stock_quantity == null ? null : Number(row.stock_quantity),
                    minStock: row.min_stock == null ? null : Number(row.min_stock),
                    imageUrl: (row.image_url as string | null) || images[0] || null,
                    source: 'own' as const,
                }
            })

            const ownSkus = new Set(own.map((product) => product.suppliersku).filter(Boolean))
            const catalog: SupplierProduct[] = (catalogResult.data || [])
                .map((row: Record<string, unknown>) => ({
                    id: String(row.id),
                    name: String(row.name ?? 'Producto'),
                    suppliersku: row.suppliersku ? String(row.suppliersku) : '',
                    unitprice: Number(row.unitprice ?? 0),
                    currency: String(row.currency || 'PYG'),
                    source: 'supplier' as const,
                }))
                // Evitar duplicar lo que ya existe en el catalogo propio.
                .filter((product) => !product.suppliersku || !ownSkus.has(product.suppliersku))

            setProducts([...own, ...catalog])
        } catch (error) {
            console.error('Error fetching products:', error)
            toast.error('No se pudieron cargar los productos del proveedor')
        } finally {
            setLoading(false)
        }
    }, [supabase, supplierId])

    useEffect(() => {
        if (!isOpen || !supplierId) return

        void fetchProducts()
        setSearch('')
        setItems(initialProduct
            ? [{
                productId: initialProduct.id,
                name: initialProduct.name,
                sku: initialProduct.suppliersku,
                quantity: 1,
                unitPrice: initialProduct.unitprice,
                total: initialProduct.unitprice,
                currency: initialProduct.currency,
                imageUrl: initialProduct.imageUrl,
            }]
            : [])
    }, [isOpen, supplierId, initialProduct, fetchProducts])

    const filteredProducts = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return products
        return products.filter((product) =>
            product.name.toLowerCase().includes(term)
            || product.suppliersku.toLowerCase().includes(term)
        )
    }, [products, search])

    const quantityByProduct = useMemo(() => {
        const map = new Map<string, number>()
        for (const item of items) map.set(item.productId, item.quantity)
        return map
    }, [items])

    /** Productos propios por debajo (o al filo) del minimo configurado. */
    const lowStockProducts = useMemo(() => products.filter((product) =>
        product.source === 'own'
        && product.minStock != null
        && product.stock != null
        && product.stock <= product.minStock
    ), [products])

    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
    const orderTotal = items.reduce((sum, item) => sum + item.total, 0)
    const currency = items[0]?.currency || 'PYG'

    const addItem = (product: SupplierProduct) => {
        setItems((current) => {
            const existing = current.find((item) => item.productId === product.id)
            if (existing) {
                return current.map((item) => item.productId === product.id
                    ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
                    : item)
            }
            return [...current, {
                productId: product.id,
                name: product.name,
                sku: product.suppliersku,
                quantity: 1,
                unitPrice: product.unitprice,
                total: product.unitprice,
                currency: product.currency,
                imageUrl: product.imageUrl,
            }]
        })
    }

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) {
            removeItem(productId)
            return
        }
        setItems((current) => current.map((item) => item.productId === productId
            ? { ...item, quantity, total: quantity * item.unitPrice }
            : item))
    }

    const removeItem = (productId: string) => {
        setItems((current) => current.filter((item) => item.productId !== productId))
    }

    /** Carga de una el faltante hasta cubrir el doble del minimo. */
    const suggestRestock = () => {
        if (lowStockProducts.length === 0) return

        setItems((current) => {
            const existing = new Set(current.map((item) => item.productId))
            const suggestions = lowStockProducts
                .filter((product) => !existing.has(product.id))
                .map((product) => {
                    const target = Math.max((product.minStock || 0) * 2, (product.minStock || 0) + 1)
                    const quantity = Math.max(1, Math.ceil(target - (product.stock || 0)))
                    return {
                        productId: product.id,
                        name: product.name,
                        sku: product.suppliersku,
                        quantity,
                        unitPrice: product.unitprice,
                        total: quantity * product.unitprice,
                        currency: product.currency,
                        imageUrl: product.imageUrl,
                    }
                })

            if (suggestions.length === 0) {
                toast.info('Los productos bajo mínimo ya están en el pedido.')
                return current
            }

            toast.success(`${suggestions.length} producto(s) bajo mínimo agregados.`)
            return [...current, ...suggestions]
        })
    }

    const handleCreateOrder = async () => {
        if (items.length === 0) return

        try {
            setSubmitting(true)

            // La organizacion se deriva del proveedor: es su dueño y ya esta
            // acotado por inquilino. Sin este dato el RLS rechaza el insert.
            const { data: supplier, error: supplierError } = await supabase
                .from('suppliers')
                .select('organization_id')
                .eq('id', supplierId)
                .maybeSingle()

            if (supplierError) throw supplierError
            if (!supplier?.organization_id) {
                throw new Error('El proveedor no tiene una organización asociada.')
            }

            const organizationId = supplier.organization_id
            // Fecha + aleatorio: `Date.now().slice(-6)` se repetia cada ~16 min y
            // ahora la numeracion es unica por organizacion.
            const orderNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`

            const { data: order, error: orderError } = await supabase
                .from('purchase_orders')
                .insert({
                    organization_id: organizationId,
                    supplierid: supplierId,
                    ordernumber: orderNumber,
                    status: 'draft',
                    subtotal: orderTotal,
                    taxamount: 0,
                    shippingcost: 0,
                    totalamount: orderTotal,
                    currency,
                })
                .select()
                .single()

            if (orderError) throw orderError

            const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(items.map((item) => ({
                    organization_id: organizationId,
                    order_id: order.id,
                    product_id: item.productId,
                    suppliersku: item.sku,
                    name: item.name,
                    quantity: item.quantity,
                    unitprice: item.unitPrice,
                    linetotal: item.total,
                })))

            if (itemsError) {
                // Sin transaccion del lado del cliente: si los items fallan hay
                // que revertir la cabecera para no dejar una orden vacia.
                await supabase.from('purchase_orders').delete().eq('id', order.id)
                throw itemsError
            }

            toast.success('Pedido creado', { description: `${totalUnits} unidad(es) · ${formatMoney(orderTotal, currency)}` })
            onOrderCreated()
            onClose()
        } catch (error) {
            console.error('Error creating order:', error)
            toast.error('No se pudo crear el pedido', {
                description: error instanceof Error ? error.message : 'Intenta nuevamente.',
            })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting) onClose() }}>
            {/* Mismo dimensionado que el modal de pedidos del dashboard: el
                offset en xl compensa el ancho del sidebar para que quede
                centrado respecto al area de contenido, no de la ventana. */}
            <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:h-[90dvh] lg:max-w-[calc(100vw-4rem)] xl:!left-[calc(50%+128px)] xl:h-[88dvh] xl:w-[calc(100vw-288px)] xl:max-w-[1500px] 2xl:h-[min(88dvh,900px)]">
                <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
                    <DialogTitle className="text-base">Nuevo pedido a {supplierName}</DialogTitle>
                    <DialogDescription>
                        Elegí los productos y las cantidades que querés pedirle al proveedor.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
                    {/* ── Catálogo ── */}
                    <section className="flex min-h-0 flex-col" aria-label="Productos del proveedor">
                        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
                            <div className="relative min-w-[200px] flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar por nombre o SKU…"
                                    className="h-9 pl-9"
                                    aria-label="Buscar productos"
                                />
                            </div>
                            {lowStockProducts.length > 0 ? (
                                <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={suggestRestock}>
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                    Reponer bajo mínimo ({lowStockProducts.length})
                                </Button>
                            ) : null}
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
                            {loading ? (
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Cargando productos">
                                    {Array.from({ length: 6 }).map((_, index) => (
                                        <Skeleton key={index} className="h-[92px] rounded-lg" />
                                    ))}
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div role="status" className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                                    <div className="rounded-full bg-muted p-4">
                                        <Package className="h-7 w-7 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-medium">
                                        {search ? 'Ningún producto coincide' : 'Este proveedor no tiene productos'}
                                    </p>
                                    <p className="max-w-xs text-xs text-muted-foreground">
                                        {search
                                            ? 'Probá con otro nombre o SKU.'
                                            : 'Asigná este proveedor a tus productos desde Inventario para poder pedirle mercadería.'}
                                    </p>
                                    {search ? (
                                        <Button variant="outline" size="sm" className="mt-2" onClick={() => setSearch('')}>
                                            Limpiar búsqueda
                                        </Button>
                                    ) : null}
                                </div>
                            ) : (
                                <ul role="list" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {filteredProducts.map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            quantity={quantityByProduct.get(product.id) ?? 0}
                                            onAdd={() => addItem(product)}
                                            onChangeQuantity={(next) => updateQuantity(product.id, next)}
                                        />
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>

                    {/* ── Pedido en curso ── */}
                    <aside
                        className="flex min-h-0 flex-col border-t bg-muted/20 lg:border-l lg:border-t-0"
                        aria-label="Resumen del pedido"
                    >
                        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            <h2 className="text-sm font-semibold">Tu pedido</h2>
                            {items.length > 0 ? (
                                <Badge variant="secondary" className="ml-auto tabular-nums">
                                    {totalUnits} u.
                                </Badge>
                            ) : null}
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto max-lg:max-h-64">
                            {items.length === 0 ? (
                                <div role="status" className="flex flex-col items-center justify-center gap-1.5 px-6 py-12 text-center">
                                    <ShoppingCart className="h-7 w-7 text-muted-foreground/40" />
                                    <p className="text-sm font-medium">Todavía no agregaste nada</p>
                                    <p className="text-xs text-muted-foreground">
                                        Elegí productos de la izquierda para armar el pedido.
                                    </p>
                                </div>
                            ) : (
                                <ul role="list" className="divide-y">
                                    {items.map((item) => (
                                        <li key={item.productId} className="flex gap-3 px-4 py-3">
                                            <ProductThumb url={item.imageUrl} name={item.name} size={40} />
                                            <div className="min-w-0 flex-1 space-y-1.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">
                                                        {item.name}
                                                    </p>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                                        aria-label={`Quitar ${item.name} del pedido`}
                                                        onClick={() => removeItem(item.productId)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <QuantityStepper
                                                        value={item.quantity}
                                                        onChange={(next) => updateQuantity(item.productId, next)}
                                                        label={item.name}
                                                        size="sm"
                                                    />
                                                    <span className="text-sm font-semibold tabular-nums">
                                                        {formatMoney(item.total, item.currency)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {item.quantity} × {formatMoney(item.unitPrice, item.currency)}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="shrink-0 space-y-3 border-t bg-background px-4 py-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    {items.length} producto{items.length === 1 ? '' : 's'} · {totalUnits} unidad{totalUnits === 1 ? '' : 'es'}
                                </span>
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-sm font-medium">Total</span>
                                <span className="text-xl font-bold tabular-nums" aria-live="polite">
                                    {formatMoney(orderTotal, currency)}
                                </span>
                            </div>

                            <Button
                                className="w-full gap-2"
                                onClick={handleCreateOrder}
                                disabled={submitting || items.length === 0}
                            >
                                {submitting ? 'Creando pedido…' : 'Crear pedido'}
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full gap-1.5"
                                onClick={onClose}
                                disabled={submitting}
                            >
                                <X className="h-3.5 w-3.5" />
                                Cancelar
                            </Button>
                        </div>
                    </aside>
                </div>
            </DialogContent>
        </Dialog>
    )
}
