'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, AlertTriangle, RefreshCw, Search, ShoppingCart, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatMoney, ProductThumb } from './order-ui'

export interface SupplierProduct {
    id: string
    name: string
    sku: string | null
    category: string | null
    /** Costo de compra: es el dato relevante frente a un proveedor. */
    purchasePrice: number
    salePrice: number
    stock: number | null
    minStock: number | null
    imageUrl: string | null
}

type StockFilter = 'all' | 'low' | 'out'

interface SupplierProductsListProps {
    supplierId: string
    /** Permite armar un pedido con el producto ya cargado. */
    onOrderProduct?: (product: SupplierProduct) => void
}

/**
 * Disponibilidad derivada del stock real contra el minimo configurado. El
 * componente anterior solo distinguia con/sin stock, asi que el estado
 * "stock bajo" no se mostraba nunca.
 */
function getAvailability(product: SupplierProduct) {
    if (product.stock == null) {
        return { key: 'unknown', label: 'Sin control', className: 'bg-muted text-muted-foreground border-border' }
    }
    if (product.stock <= 0) {
        return { key: 'out', label: 'Sin stock', className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300' }
    }
    if (product.minStock != null && product.stock <= product.minStock) {
        return { key: 'low', label: 'Stock bajo', className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300' }
    }
    return { key: 'in', label: 'En stock', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300' }
}

export function SupplierProductsList({ supplierId, onOrderProduct }: SupplierProductsListProps) {
    const [products, setProducts] = useState<SupplierProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [stockFilter, setStockFilter] = useState<StockFilter>('all')

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true)
            const supabase = createClient()
            const { data, error } = await supabase
                .from('products')
                .select('id, name, sku, purchase_price, sale_price, stock_quantity, min_stock, image_url, images, category:categories(name)')
                .eq('supplier_id', supplierId)
                .order('name')

            if (error) throw error

            setProducts((data || []).map((row: Record<string, unknown>) => {
                const images = Array.isArray(row.images) ? (row.images as string[]) : []
                const category = row.category as { name?: string } | null
                return {
                    id: String(row.id),
                    name: String(row.name ?? 'Producto'),
                    sku: row.sku ? String(row.sku) : null,
                    category: category?.name || null,
                    purchasePrice: Number(row.purchase_price ?? 0),
                    salePrice: Number(row.sale_price ?? 0),
                    stock: row.stock_quantity == null ? null : Number(row.stock_quantity),
                    minStock: row.min_stock == null ? null : Number(row.min_stock),
                    imageUrl: (row.image_url as string | null) || images[0] || null,
                }
            }))
        } catch (error) {
            console.error('Error fetching products:', error)
            toast.error('No se pudieron cargar los productos del proveedor')
        } finally {
            setLoading(false)
        }
    }, [supplierId])

    // Se carga una sola vez por proveedor: buscar y filtrar se resuelve en
    // memoria para no disparar una consulta por cada tecla.
    useEffect(() => {
        void fetchProducts()
    }, [fetchProducts])

    const visibleProducts = useMemo(() => {
        const term = search.trim().toLowerCase()
        return products.filter((product) => {
            const availability = getAvailability(product)
            if (stockFilter === 'low' && availability.key !== 'low') return false
            if (stockFilter === 'out' && availability.key !== 'out') return false
            if (!term) return true
            return [product.name, product.sku, product.category]
                .some((field) => (field || '').toLowerCase().includes(term))
        })
    }, [products, search, stockFilter])

    const summary = useMemo(() => {
        let low = 0
        let out = 0
        for (const product of products) {
            const key = getAvailability(product).key
            if (key === 'low') low += 1
            if (key === 'out') out += 1
        }
        return { low, out }
    }, [products])

    const hasFilters = search.trim() !== '' || stockFilter !== 'all'

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, SKU o categoría…"
                        className="h-9 pl-9 pr-8"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        aria-label="Buscar productos del proveedor"
                    />
                    {search ? (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            aria-label="Limpiar búsqueda"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : null}
                </div>

                <Select value={stockFilter} onValueChange={(value) => setStockFilter(value as StockFilter)}>
                    <SelectTrigger className="h-9 w-[170px] text-sm">
                        <SelectValue placeholder="Disponibilidad" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="low">Stock bajo ({summary.low})</SelectItem>
                        <SelectItem value="out">Sin stock ({summary.out})</SelectItem>
                    </SelectContent>
                </Select>

                <span className="text-xs text-muted-foreground">
                    {visibleProducts.length} de {products.length}
                </span>

                <Button
                    variant="outline"
                    size="icon"
                    className="ml-auto h-9 w-9"
                    onClick={() => void fetchProducts()}
                    aria-label="Actualizar productos"
                >
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {summary.low + summary.out > 0 && !hasFilters ? (
                <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {summary.out > 0 ? `${summary.out} sin stock` : ''}
                    {summary.out > 0 && summary.low > 0 ? ' · ' : ''}
                    {summary.low > 0 ? `${summary.low} bajo el mínimo` : ''}
                    {'. Conviene incluirlos en el próximo pedido.'}
                </p>
            ) : null}

            {loading ? (
                <div className="space-y-2" aria-busy="true" aria-label="Cargando productos">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-[72px] w-full rounded-lg" />
                    ))}
                </div>
            ) : visibleProducts.length === 0 ? (
                <div role="status" className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium">
                        {hasFilters ? 'Ningún producto coincide' : 'Este proveedor no tiene productos'}
                    </p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                        {hasFilters
                            ? 'Probá con otro término o cambiá el filtro de disponibilidad.'
                            : 'Asigná este proveedor a tus productos desde Inventario para verlos acá.'}
                    </p>
                    {hasFilters ? (
                        <Button variant="outline" size="sm" className="mt-1" onClick={() => { setSearch(''); setStockFilter('all') }}>
                            Limpiar filtros
                        </Button>
                    ) : null}
                </div>
            ) : (
                <ul role="list" className="divide-y rounded-lg border">
                    {visibleProducts.map((product) => {
                        const availability = getAvailability(product)
                        return (
                            <li key={product.id} className="flex flex-wrap items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/30">
                                <ProductThumb url={product.imageUrl} name={product.name} size={48} />

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium leading-tight">{product.name}</p>
                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                        {product.sku ? <span className="font-mono">{product.sku}</span> : 'Sin SKU'}
                                        {product.category ? ` · ${product.category}` : ''}
                                    </p>
                                </div>

                                <div className="w-24 shrink-0 text-right">
                                    <p className="text-sm font-semibold tabular-nums">
                                        {formatMoney(product.purchasePrice)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">costo</p>
                                </div>

                                <div className="w-24 shrink-0 text-right">
                                    <p className={cn(
                                        'text-sm font-semibold tabular-nums',
                                        availability.key === 'low' && 'text-amber-700 dark:text-amber-400',
                                        availability.key === 'out' && 'text-rose-700 dark:text-rose-400'
                                    )}>
                                        {product.stock ?? '—'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {product.minStock != null ? `mín. ${product.minStock}` : 'stock'}
                                    </p>
                                </div>

                                <Badge variant="outline" className={cn('shrink-0', availability.className)}>
                                    {availability.label}
                                </Badge>

                                {onOrderProduct ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 shrink-0 gap-1.5"
                                        onClick={() => onOrderProduct(product)}
                                    >
                                        <ShoppingCart className="h-3.5 w-3.5" />
                                        Pedir
                                    </Button>
                                ) : null}
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
