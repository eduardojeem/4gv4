/**
 * ProductQuickViewModal
 * Lightweight quick-view dialog for a product. Opens on product click so the
 * user can inspect details without leaving the list. A "Ver detalle completo"
 * action navigates to the full product page when more is needed.
 */

import React from 'react'
import Image from 'next/image'
import {
  Package, Edit, ArrowUpRight, Tag, Barcode, Building2,
  Calendar, TrendingUp, BarChart2, Globe, EyeOff, Star,
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

export function ProductQuickViewModal({
  product,
  isOpen,
  onClose,
  onEdit,
  onViewFullDetails,
}: ProductQuickViewModalProps) {
  if (!product) return null

  const stockStatus = getStockStatus(product)
  const statusConfig = STOCK_LABEL[stockStatus]

  const margin =
    product.purchase_price && product.purchase_price > 0 && product.sale_price > 0
      ? ((product.sale_price - product.purchase_price) / product.sale_price) * 100
      : null

  const imageUrl: string | undefined =
    (product.images as string[] | null | undefined)?.[0] || product.image || undefined
  const isValidImage =
    !!imageUrl && (imageUrl.startsWith('data:image') || imageUrl.startsWith('/') || imageUrl.startsWith('http'))

  const categoryLabel = product.category?.name || null
  const supplierLabel = product.supplier?.name || null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {/* Image */}
            <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-gray-800 dark:to-gray-700 ring-1 ring-gray-200 dark:ring-gray-700">
              {isValidImage ? (
                <Image src={imageUrl!} alt={product.name} fill sizes="80px" className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-gray-300 dark:text-gray-500" />
                </div>
              )}
              {product.featured && (
                <div className="absolute -top-1.5 -right-1.5">
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow px-1.5 py-0.5 text-[10px]">
                    <Star className="h-2.5 w-2.5 mr-0.5" /> Destacado
                  </Badge>
                </div>
              )}
            </div>

            {/* Title + badges */}
            <div className="flex-1 min-w-0 text-left">
              <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 pr-6">
                {product.name}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="font-mono text-xs">SKU: {product.sku}</Badge>
                {categoryLabel && (
                  <Badge variant="secondary" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />{categoryLabel}
                  </Badge>
                )}
                <Badge className={cn('text-white border-0 text-xs', statusConfig.badge)}>
                  {statusConfig.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    product.is_active
                      ? 'text-emerald-600 border-emerald-200 dark:text-emerald-400'
                      : 'text-gray-500 border-gray-200',
                  )}
                >
                  {product.is_active ? <><Globe className="h-3 w-3 mr-1" />Visible</> : <><EyeOff className="h-3 w-3 mr-1" />Oculto</>}
                </Badge>
              </div>
              {product.brand && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">{product.brand}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        {product.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {product.description}
          </p>
        )}

        <Separator />

        {/* Prices */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-emerald-600" /> Precios
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Precio de venta</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-50">{formatCurrency(product.sale_price)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Costo</p>
              <p className="text-base font-semibold text-gray-600 dark:text-gray-300">
                {product.purchase_price ? formatCurrency(product.purchase_price) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Margen</p>
              {margin !== null ? (
                <Badge
                  className={cn(
                    'text-white border-0',
                    margin >= 20 ? 'bg-emerald-500' : margin >= 10 ? 'bg-amber-500' : 'bg-red-500',
                  )}
                >
                  {margin.toFixed(1)}%
                </Badge>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Inventory */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
            <BarChart2 className="h-4 w-4 mr-2 text-blue-600" /> Inventario
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Stock actual</p>
              <p className={cn('text-lg font-bold tabular-nums', statusConfig.text)}>
                {product.stock_quantity} <span className="text-xs font-normal text-gray-400">u</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Stock mínimo</p>
              <p className="text-base font-semibold text-gray-600 dark:text-gray-300">{product.min_stock ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Stock máximo</p>
              <p className="text-base font-semibold text-gray-600 dark:text-gray-300">{product.max_stock ?? '—'}</p>
            </div>
          </div>
          {isLowStock(product) && (
            <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-sm text-amber-800 dark:text-amber-300">
              Stock bajo — se recomienda reabastecer.
            </div>
          )}
        </div>

        <Separator />

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 flex items-center"><Building2 className="h-4 w-4 mr-2" />Proveedor</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{supplierLabel || '—'}</span>
          </div>
          {product.barcode && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400 flex items-center"><Barcode className="h-4 w-4 mr-2" />Código</span>
              <span className="font-mono text-gray-800 dark:text-gray-200">{product.barcode}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 flex items-center"><Calendar className="h-4 w-4 mr-2" />Creado</span>
            <span className="text-gray-800 dark:text-gray-200">{formatDate(product.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 flex items-center"><Calendar className="h-4 w-4 mr-2" />Actualizado</span>
            <span className="text-gray-800 dark:text-gray-200">{formatDate(product.updated_at)}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {onEdit && (
            <Button variant="outline" onClick={() => onEdit(product)}>
              <Edit className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
          {onViewFullDetails && (
            <Button onClick={() => onViewFullDetails(product)}>
              <ArrowUpRight className="h-4 w-4 mr-2" /> Ver detalle completo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ProductQuickViewModal
