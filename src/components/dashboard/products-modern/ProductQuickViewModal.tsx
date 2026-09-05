/**
 * ProductQuickViewModal
 * Lightweight quick-view dialog for a product. Opens on product click so the
 * user can inspect details, prices, variants, and stock without leaving the list.
 */

import React from 'react'
import Image from 'next/image'
import {
  Package, Edit, ArrowUpRight, Tag, Barcode, Building2,
  Calendar, TrendingUp, BarChart2, Globe, EyeOff, Star,
  Layers3, CheckCircle2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Product } from '@/types/products'
import { getStockStatus, isLowStock } from '@/lib/products-dashboard-utils'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useCanViewCost } from '@/hooks/use-can-view-cost'

export interface ProductQuickViewModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (product: Product) => void
  onViewFullDetails?: (product: Product) => void
}

const STOCK_LABEL: Record<'in_stock' | 'low_stock' | 'out_of_stock', { label: string; badge: string; text: string }> = {
  in_stock: { label: 'En Stock', badge: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  low_stock: { label: 'Stock Bajo', badge: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  out_of_stock: { label: 'Agotado', badge: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
}

function getNormalizedVariants(product: Product) {
  const rawVariants = Array.isArray((product as any).variants) ? (product as any).variants : []
  return rawVariants.map((v: any, index: number) => {
    let attributes: Record<string, string> = {}
    if (v.attributes && typeof v.attributes === 'object' && !Array.isArray(v.attributes)) {
      for (const [k, val] of Object.entries(v.attributes)) {
        if (val !== undefined && val !== null) attributes[k] = String(val)
      }
    } else if (Array.isArray(v.attributes)) {
      for (const item of v.attributes) {
        if (item && typeof item === 'object') {
          const k = item.key || item.attribute_name || item.name || `attr_${index}`
          const val = item.value || item.display_value || ''
          if (k && val) attributes[String(k)] = String(val)
        }
      }
    }

    const name = v.variant_name || v.name || Object.values(attributes).join(' / ') || `Variante ${index + 1}`
    const salePrice = Number(v.sale_price ?? v.salePrice ?? product.sale_price ?? 0)
    const purchasePrice = v.purchase_price !== undefined
      ? Number(v.purchase_price)
      : v.purchasePrice !== undefined
        ? Number(v.purchasePrice)
        : undefined
    const wholesalePrice = v.wholesale_price !== undefined
      ? Number(v.wholesale_price)
      : v.wholesalePrice !== undefined
        ? Number(v.wholesalePrice)
        : undefined
    const stockQuantity = Number(v.stock_quantity ?? v.stockQuantity ?? 0)
    const minStock = v.min_stock !== undefined
      ? Number(v.min_stock)
      : v.minStock !== undefined
        ? Number(v.minStock)
        : undefined
    const isActive = v.is_active !== undefined ? Boolean(v.is_active) : v.isActive !== undefined ? Boolean(v.isActive) : true

    return {
      id: v.id || `var-${index}`,
      name,
      sku: v.sku || undefined,
      barcode: v.barcode || undefined,
      salePrice,
      purchasePrice,
      wholesalePrice,
      stockQuantity,
      minStock,
      isActive,
      attributes,
    }
  })
}

export function ProductQuickViewModal({
  product,
  isOpen,
  onClose,
  onEdit,
  onViewFullDetails,
}: ProductQuickViewModalProps) {
  const canViewCost = useCanViewCost()
  if (!product) return null

  const variants = getNormalizedVariants(product)
  const totalVariantStock = variants.length > 0
    ? variants.reduce((acc, v) => acc + v.stockQuantity, 0)
    : product.stock_quantity

  const stockStatus = getStockStatus(product)
  const statusConfig = STOCK_LABEL[stockStatus]

  const margin =
    canViewCost && product.purchase_price && product.purchase_price > 0 && product.sale_price > 0
      ? ((product.sale_price - product.purchase_price) / product.sale_price) * 100
      : null

  const imageUrl: string | undefined =
    (product.images as string[] | null | undefined)?.[0] ||
    product.image ||
    (product as any).image_url ||
    undefined
  const isValidImage =
    !!imageUrl && (imageUrl.startsWith('data:image') || imageUrl.startsWith('/') || imageUrl.startsWith('http'))

  const categoryLabel = product.category?.name || null
  const supplierLabel = product.supplier?.name || null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {/* Image */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 ring-1 ring-slate-200 dark:ring-slate-700 shadow-inner">
              {isValidImage ? (
                <Image src={imageUrl!} alt={product.name} fill sizes="96px" className="object-contain p-1" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-slate-300 dark:text-slate-500" />
                </div>
              )}
              {product.featured && (
                <div className="absolute top-1 right-1">
                  <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-xs px-1.5 py-0.5 text-[9px] font-bold">
                    <Star className="h-2.5 w-2.5 mr-0.5 fill-white" /> Destacado
                  </Badge>
                </div>
              )}
            </div>

            {/* Title + badges */}
            <div className="flex-1 min-w-0 text-left">
              <DialogTitle className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 pr-6">
                {product.name}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge variant="outline" className="font-mono text-xs bg-slate-50 dark:bg-slate-800 font-semibold">SKU: {product.sku}</Badge>
                {categoryLabel && (
                  <Badge variant="secondary" className="text-xs font-semibold gap-1">
                    <Tag className="h-3 w-3 text-blue-500" />{categoryLabel}
                  </Badge>
                )}
                {variants.length > 0 && (
                  <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 dark:border-violet-800 text-xs font-bold gap-1">
                    <Layers3 className="h-3 w-3 text-violet-600" />
                    {variants.length} Variantes
                  </Badge>
                )}
                <Badge className={cn('text-white border-0 text-xs font-semibold', statusConfig.badge)}>
                  {statusConfig.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-semibold',
                    (!product.is_active || (product as any).visibility === 'hidden')
                      ? 'text-slate-500 border-slate-200 dark:border-slate-800'
                      : (product as any).visibility === 'wholesale'
                        ? 'text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-900/50'
                        : 'text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-900/50',
                  )}
                >
                  {!product.is_active ? (
                    <><EyeOff className="h-3 w-3 mr-1" />Inactivo</>
                  ) : (product as any).visibility === 'hidden' ? (
                    <><EyeOff className="h-3 w-3 mr-1" />Oculto</>
                  ) : (product as any).visibility === 'wholesale' ? (
                    <><Globe className="h-3 w-3 mr-1 text-blue-500" />Mayorista</>
                  ) : (
                    <><Globe className="h-3 w-3 mr-1 text-emerald-500" />Visible</>
                  )}
                </Badge>
              </div>
              {product.brand && (
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5">{product.brand}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        {product.description && (
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            {product.description}
          </p>
        )}

        <Separator className="bg-slate-100 dark:bg-slate-800" />

        {/* Prices */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Estructura de Precios
          </h3>
          <div className={cn('grid gap-3', canViewCost ? 'grid-cols-3' : 'grid-cols-1')}>
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60">
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">Precio de venta</p>
              <p className="text-lg font-black text-emerald-950 dark:text-emerald-100">{formatCurrency(product.sale_price)}</p>
            </div>
            {canViewCost && (
              <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <p className="text-[11px] font-bold text-muted-foreground mb-0.5">Costo Base</p>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {product.purchase_price ? formatCurrency(product.purchase_price) : '—'}
                </p>
              </div>
            )}
            {canViewCost && (
              <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-0.5">Margen %</p>
                {margin !== null ? (
                  <Badge
                    className={cn(
                      'text-white border-0 text-xs font-bold mt-0.5',
                      margin >= 20 ? 'bg-emerald-500' : margin >= 10 ? 'bg-amber-500' : 'bg-red-500',
                    )}
                  >
                    {margin.toFixed(1)}%
                  </Badge>
                ) : (
                  <span className="text-sm text-slate-400">—</span>
                )}
              </div>
            )}
          </div>
        </div>

        <Separator className="bg-slate-100 dark:bg-slate-800" />

        {/* Inventory */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
            <BarChart2 className="h-3.5 w-3.5 text-blue-600" /> Estado de Inventario
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/60 text-center">
              <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-0.5">Stock total</p>
              <p className={cn('text-lg font-black tabular-nums', statusConfig.text)}>
                {variants.length > 0 ? totalVariantStock : product.stock_quantity} <span className="text-xs font-normal text-muted-foreground">u</span>
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-center">
              <p className="text-[11px] font-bold text-muted-foreground mb-0.5">Stock mínimo</p>
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">{product.min_stock ?? '—'}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-center">
              <p className="text-[11px] font-bold text-muted-foreground mb-0.5">Stock máximo</p>
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">{product.max_stock ?? '—'}</p>
            </div>
          </div>
          {isLowStock(product) && (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Package className="h-4 w-4 shrink-0" />
              Stock bajo — se recomienda reabastecer este producto.
            </div>
          )}
        </div>

        {/* ── VARIANTS DETAILED SECTION ── */}
        {variants.length > 0 && (
          <>
            <Separator className="bg-slate-100 dark:bg-slate-800" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers3 className="h-3.5 w-3.5 text-violet-600" /> Variantes y Stock por Combinación
                </h3>
                <Badge variant="outline" className="text-[11px] font-bold bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800">
                  {variants.length} combinaciones
                </Badge>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Variante</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">SKU</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Precio</th>
                      {canViewCost && (
                        <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Costo</th>
                      )}
                      <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Stock</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {variants.map((v) => {
                      const isOut = v.stockQuantity <= 0
                      const isLow = v.stockQuantity > 0 && v.minStock !== undefined && v.stockQuantity <= v.minStock
                      return (
                        <tr key={v.id} className="hover:bg-white/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-3 py-2.5">
                            <p className="font-bold text-slate-900 dark:text-slate-100">{v.name}</p>
                            {Object.entries(v.attributes).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {Object.entries(v.attributes).map(([key, val]) => (
                                  <span key={key} className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    {key}: <strong className="ml-0.5 font-bold">{String(val)}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                            {v.sku || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(v.salePrice)}
                          </td>
                          {canViewCost && (
                            <td className="px-3 py-2.5 text-right text-muted-foreground">
                              {v.purchasePrice ? formatCurrency(v.purchasePrice) : '—'}
                            </td>
                          )}
                          <td className="px-3 py-2.5 text-right">
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums',
                              isOut
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                                : isLow
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            )}>
                              {v.stockQuantity} u
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {v.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" /> Activa
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Inactiva</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <Separator className="bg-slate-100 dark:bg-slate-800" />

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/30">
            <span className="text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-slate-400" />Proveedor</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{supplierLabel || '—'}</span>
          </div>
          {product.barcode && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/30">
              <span className="text-muted-foreground flex items-center gap-1.5"><Barcode className="h-3.5 w-3.5 text-slate-400" />Código EAN</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{product.barcode}</span>
            </div>
          )}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/30">
            <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" />Creado</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(product.created_at)}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/30">
            <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" />Actualizado</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(product.updated_at)}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(product)} className="rounded-xl h-9 text-xs font-semibold">
              <Edit className="h-3.5 w-3.5 mr-1.5" /> Editar
            </Button>
          )}
          {onViewFullDetails && (
            <Button size="sm" onClick={() => onViewFullDetails(product)} className="rounded-xl h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs">
              <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" /> Ver detalle completo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ProductQuickViewModal
