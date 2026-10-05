'use client'

import { Edit, Layers, Loader2, Package, PackagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { resolveStockLevel, type StockLevel } from '@/lib/inventory/stock-status'
import type { Product } from '@/hooks/use-inventory'

export const STOCK_LEVEL_STYLE: Record<StockLevel, { label: string; badge: string; bar: string }> = {
  out: { label: 'Agotado', badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', bar: 'bg-rose-500' },
  low: { label: 'Bajo', badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
  normal: { label: 'Normal', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
  high: { label: 'Alto', badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300', bar: 'bg-sky-500' },
}

/**
 * Qué tan lleno está el stock, para la barra: contra el máximo si hay uno, si
 * no contra tres veces el mínimo (un nivel cómodo), y si no hay ninguno, lleno.
 */
export function stockFill(product: Pick<Product, 'stock_quantity' | 'min_stock' | 'max_stock'>): number {
  const stock = Math.max(0, Number(product.stock_quantity) || 0)
  const max = Number(product.max_stock) || 0
  const min = Number(product.min_stock) || 0
  const reference = max > 0 ? max : min > 0 ? min * 3 : 0
  if (stock === 0) return 0
  if (reference === 0) return 100
  return Math.min(100, Math.round((stock / reference) * 100))
}

/** Margen sobre el precio de venta; null si falta el costo o el precio. */
export function productMargin(product: Pick<Product, 'sale_price' | 'purchase_price'>): number | null {
  const sale = Number(product.sale_price) || 0
  const cost = Number(product.purchase_price) || 0
  if (sale <= 0 || cost <= 0) return null
  return Math.round(((sale - cost) / sale) * 100)
}

export function CatalogProductGrid({
  products,
  loading,
  onEdit,
  onStock,
  onVariants,
  onDelete,
}: {
  products: Product[]
  loading: boolean
  onEdit: (product: Product) => void
  onStock: (product: Product) => void
  onVariants: (product: Product) => void
  onDelete: (product: Product) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando catálogo...
      </div>
    )
  }

  return (
    <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Productos del catálogo">
      {products.map((product) => {
        const level = resolveStockLevel(product)
        const style = STOCK_LEVEL_STYLE[level]
        const margin = productMargin(product)
        const reserved = Number(product.reserved_quantity || 0)
        const fill = stockFill(product)
        const inactive = product.status !== 'active'

        return (
          <li key={product.id} className={cn('flex flex-col overflow-hidden rounded-xl border bg-background transition-shadow hover:shadow-sm', inactive && 'opacity-70')}>
            <button
              type="button"
              onClick={() => onEdit(product)}
              className="flex items-start gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              aria-label={`Editar ${product.name}`}
            >
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg border bg-muted object-cover" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Package className="h-6 w-6" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm text-foreground">{product.name}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {[product.sku, product.category?.name].filter(Boolean).join(' · ') || 'Sin código ni categoría'}
                </span>
                {inactive && <span className="mt-1 inline-block rounded bg-muted px-1.5 text-[10px] text-muted-foreground">Inactivo</span>}
              </span>
            </button>

            <div className="space-y-2.5 px-3 pb-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(product.sale_price)}</span>
                <span className={cn('text-[11px] tabular-nums', margin === null ? 'text-muted-foreground' : margin < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
                  {margin === null ? 'Sin costo cargado' : `Margen ${margin}%`}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="tabular-nums text-foreground">
                    {product.stock_quantity} u.
                    {reserved > 0 && <span className="text-amber-700 dark:text-amber-300"> · {reserved} reservadas</span>}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px]', style.badge)}>{style.label}</span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                  role="meter"
                  aria-valuenow={fill}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Nivel de stock de ${product.name}`}
                >
                  <div className={cn('h-full rounded-full', style.bar)} style={{ width: `${fill}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {Number(product.min_stock) > 0 ? `Mínimo ${product.min_stock}` : 'Sin mínimo: no avisa al quedar poco'}
                </p>
              </div>
            </div>

            <div className="mt-auto flex border-t">
              <Button variant="ghost" size="sm" className="h-9 flex-1 gap-1.5 rounded-none text-xs" onClick={() => onStock(product)}>
                <PackagePlus className="h-3.5 w-3.5 text-emerald-600" /> Stock
              </Button>
              <Button variant="ghost" size="sm" className="h-9 flex-1 gap-1.5 rounded-none border-l text-xs" onClick={() => onEdit(product)}>
                <Edit className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-10 rounded-none border-l" onClick={() => onVariants(product)} aria-label={`Gestionar variantes de ${product.name}`} title="Variantes">
                <Layers className="h-3.5 w-3.5 text-violet-500" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-10 rounded-none border-l" onClick={() => onDelete(product)} aria-label={`Eliminar ${product.name}`} title="Eliminar">
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default CatalogProductGrid
