/**
 * ProductCard Component - Premium Edition
 * Enhanced card display for products in grid view with premium aesthetics
 */

import React, { useState } from 'react'
import Image from 'next/image'
import {
  Edit, Trash2, Copy, Eye, Package,
  TrendingUp, TrendingDown, Tag, BarChart2,
  AlertTriangle, CheckCircle2, XCircle,
  Globe, EyeOff
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Product } from '@/types/products'
import { getStockStatus } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'

export interface ProductCardProps {
  product: Product
  isSelected: boolean
  onSelect: (id: string) => void
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onDuplicate: (product: Product) => void
  onViewDetails: (product: Product) => void
  onToggleActive?: (product: Product, newValue: boolean) => void
  className?: string
}

const formatGs = (value: number) =>
  `Gs. ${value.toLocaleString('es-PY', { maximumFractionDigits: 0 })}`

export const ProductCard = React.memo(function ProductCard({
  product,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onViewDetails,
  onToggleActive,
  className
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [localActive, setLocalActive] = useState(product.is_active)
  const [togglingActive, setTogglingActive] = useState(false)

  const stockStatus = getStockStatus(product)

  const stockStatusConfig = {
    in_stock: {
      label: 'En Stock',
      bgClass: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      pillBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      barClass: 'from-emerald-400 to-teal-400',
      icon: CheckCircle2
    },
    low_stock: {
      label: 'Stock Bajo',
      bgClass: 'bg-gradient-to-r from-amber-500 to-orange-500',
      pillBg: 'bg-amber-50 dark:bg-amber-950/40',
      textClass: 'text-amber-700 dark:text-amber-400',
      barClass: 'from-amber-400 to-orange-400',
      icon: AlertTriangle
    },
    out_of_stock: {
      label: 'Agotado',
      bgClass: 'bg-gradient-to-r from-red-500 to-rose-500',
      pillBg: 'bg-red-50 dark:bg-red-950/40',
      textClass: 'text-red-700 dark:text-red-400',
      barClass: 'from-red-400 to-rose-400',
      icon: XCircle
    }
  }

  const statusConfig = stockStatusConfig[stockStatus]
  const StatusIcon = statusConfig.icon

  // Margin calculation
  const margin = product.purchase_price && product.purchase_price > 0 && product.sale_price > 0
    ? Math.round(((product.sale_price - product.purchase_price) / product.sale_price) * 100)
    : null

  // Stock fill percentage relative to min_stock threshold
  const minStock = product.min_stock ?? 1
  const stockFillPct = Math.min(100, Math.round((product.stock_quantity / Math.max(minStock * 4, 1)) * 100))

  // First letter placeholder
  const firstLetter = product.name.charAt(0).toUpperCase()

  // Resolve usable image URL: prefer images[0] (DB field), fallback to image (legacy)
  const imageUrl: string | undefined =
    ((product as any).images as string[] | null | undefined)?.[0] ||
    product.image ||
    undefined

  // Images count for the indicator
  const imagesCount: number = ((product as any).images as string[] | null | undefined)?.length ?? (imageUrl ? 1 : 0)

  // Validate image URL
  const isValidImage = imageUrl && (
    imageUrl.startsWith('data:image') ||
    imageUrl.startsWith('/') ||
    imageUrl.startsWith('http')
  )

  // Category label
  const categoryLabel = (product as any).category?.name || (product as any).category || null

  return (
    <Card
      role="article"
      aria-label={`Producto: ${product.name}, Precio: Gs. ${product.sale_price}, Stock: ${product.stock_quantity}`}
      className={cn(
        'group relative border border-gray-100 dark:border-gray-700/60',
        'bg-white dark:bg-gray-800/90 overflow-hidden',
        'transition-all duration-300 ease-out rounded-2xl',
        'hover:shadow-2xl hover:shadow-gray-200/60 dark:hover:shadow-gray-900/60',
        'hover:border-gray-200 dark:hover:border-gray-600',
        isSelected && 'ring-2 ring-blue-500 border-blue-200 dark:border-blue-700 shadow-lg shadow-blue-100/50 dark:shadow-blue-900/30',
        isHovered ? 'scale-[1.025] -translate-y-1' : 'shadow-md',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-0">

        {/* ── Image Section ── */}
        <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100 dark:from-gray-800 dark:via-gray-750 dark:to-gray-800 overflow-hidden">
          {isValidImage && !imageError ? (
            <>
              <Image
                src={imageUrl!}
                alt={product.name}
                fill
                className={cn(
                  'object-cover transition-all duration-500',
                  isHovered ? 'scale-110 brightness-105' : 'scale-100 brightness-100'
                )}
                onError={() => setImageError(true)}
              />
              {/* Gradient overlay on hover */}
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent',
                  'transition-opacity duration-300',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 dark:from-indigo-950/30 dark:via-gray-900 dark:to-purple-950/30">
              <div className="text-center space-y-2">
                <div className="relative inline-block">
                  <div className="h-16 w-16 rounded-2xl bg-white dark:bg-gray-700 shadow-inner flex items-center justify-center mx-auto border border-gray-100 dark:border-gray-600">
                    <Package className="h-8 w-8 text-gray-300 dark:text-gray-500" />
                  </div>
                </div>
                <span className="text-4xl font-black bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-500 dark:to-gray-400 bg-clip-text text-transparent block">
                  {firstLetter}
                </span>
              </div>
            </div>
          )}

          {/* Status pill — top left */}
          <div className="absolute top-2.5 left-2.5">
            <div className={cn(
              'px-2.5 py-1 rounded-full backdrop-blur-md',
              'flex items-center gap-1.5 shadow-lg',
              'border border-white/25 dark:border-white/10',
              statusConfig.bgClass
            )}>
              <StatusIcon className="h-3 w-3 text-white" strokeWidth={2.5} />
              <span className="text-[10px] font-bold text-white tracking-wide uppercase">
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Margin badge — top right */}
          {margin !== null && (
            <div className="absolute top-2.5 right-2.5">
              <div className={cn(
                'px-2.5 py-1 rounded-full backdrop-blur-md border border-white/20 shadow-lg',
                margin >= 20
                  ? 'bg-emerald-500/90'
                  : margin >= 10
                    ? 'bg-amber-500/90'
                    : 'bg-red-500/90'
              )}>
                <span className="text-[10px] font-bold text-white tracking-wide">
                  {margin}% margen
                </span>
              </div>
            </div>
          )}

          {/* Multiple images indicator */}
          {imagesCount > 1 && (
            <div className="absolute bottom-2.5 left-2.5">
              <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium shadow">
                +{imagesCount - 1} fotos
              </div>
            </div>
          )}

          {/* Selection checkbox */}
          <div className={cn(
            'absolute bottom-2.5 left-2.5 transition-all duration-200',
            product.images && product.images.length > 1 ? 'hidden' : '',
            isHovered || isSelected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}>
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-lg p-1.5 shadow-xl border border-white/30">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(product.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Seleccionar ${product.name}`}
                className="border-gray-400 dark:border-gray-500"
              />
            </div>
          </div>

          {/* Quick action buttons */}
          <div className={cn(
            'absolute bottom-2.5 right-2.5 flex gap-1.5 transition-all duration-300',
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}>
            {[
              { action: onViewDetails, icon: Eye, color: 'hover:bg-blue-500', label: 'Ver detalles' },
              { action: onEdit, icon: Edit, color: 'hover:bg-green-500', label: 'Editar' },
              { action: onDuplicate, icon: Copy, color: 'hover:bg-purple-500', label: 'Duplicar' },
              { action: onDelete, icon: Trash2, color: 'hover:bg-red-500', label: 'Eliminar' },
            ].map(({ action, icon: Icon, color, label }) => (
              <Button
                key={label}
                size="icon"
                variant="secondary"
                className={cn(
                  'h-8 w-8 bg-white/95 dark:bg-gray-800/95 dark:text-gray-200',
                  'hover:text-white backdrop-blur-md shadow-lg',
                  'border border-white/20 dark:border-white/10 transition-all duration-150',
                  color
                )}
                onClick={(e) => { e.stopPropagation(); action(product) }}
                aria-label={`${label}: ${product.name}`}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </Button>
            ))}
          </div>
        </div>

        {/* ── Info Section ── */}
        <div className="p-4 space-y-3">

          {/* Category + brand row */}
          <div className="flex items-center gap-1.5 flex-wrap min-h-[1.25rem]">
            {categoryLabel && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <Tag className="h-2.5 w-2.5" />
                {categoryLabel}
              </span>
            )}
            {categoryLabel && product.brand && (
              <span className="text-gray-300 dark:text-gray-600 text-[10px]">·</span>
            )}
            {product.brand && (
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                {product.brand}
              </span>
            )}
          </div>

          {/* Product name */}
          <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug min-h-[2.75rem] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
            {product.name}
          </h3>

          {/* SKU */}
          <div>
            <code className="text-[10px] font-mono font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-700">
              {product.sku}
            </code>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700/60" />

          {/* Price */}
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">Precio venta</p>
              <span className="text-xl font-black text-gray-900 dark:text-gray-50 tracking-tight">
                {formatGs(product.sale_price)}
              </span>
            </div>
            {product.purchase_price && product.purchase_price > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">Costo</p>
                <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">
                  {formatGs(product.purchase_price)}
                </span>
              </div>
            )}
          </div>

          {/* Stock bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-medium text-gray-500 dark:text-gray-400">
                <BarChart2 className="h-3 w-3" />
                Stock
              </span>
              <span className={cn(
                'font-bold tabular-nums text-xs',
                stockStatus === 'in_stock' && 'text-emerald-600 dark:text-emerald-400',
                stockStatus === 'low_stock' && 'text-amber-600 dark:text-amber-400',
                stockStatus === 'out_of_stock' && 'text-red-600 dark:text-red-400',
              )}>
                {product.stock_quantity}
                <span className="font-normal text-gray-400 dark:text-gray-500"> u</span>
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', statusConfig.barClass)}
                style={{ width: `${stockFillPct}%` }}
              />
            </div>
            {minStock > 0 && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Mínimo: {minStock} u
              </p>
            )}
          </div>

          {/* Inactive badge */}
          {!product.is_active && (
            <div className="pt-1">
              <Badge
                variant="outline"
                className="text-[10px] bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 font-medium w-full justify-center py-1"
              >
                ⏸ Producto Inactivo
              </Badge>
            </div>
          )}

          {/* Visibility toggle — always visible */}
          {onToggleActive && (
            <div
              className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                {localActive
                  ? <Globe className="h-3.5 w-3.5 text-emerald-500" />
                  : <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                }
                {localActive ? 'Visible al público' : 'Oculto al público'}
              </span>
              <Switch
                checked={localActive}
                disabled={togglingActive}
                onCheckedChange={async (checked) => {
                  setLocalActive(checked)
                  setTogglingActive(true)
                  try {
                    await onToggleActive(product, checked)
                  } catch {
                    setLocalActive(!checked) // revert on error
                  } finally {
                    setTogglingActive(false)
                  }
                }}
                aria-label={localActive ? 'Ocultar del catálogo público' : 'Publicar en catálogo'}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          )}

          {/* Primary CTA */}
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'w-full mt-1 text-xs font-semibold gap-1.5 justify-center',
              'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30',
              'border border-transparent hover:border-blue-200 dark:hover:border-blue-800',
              'transition-all duration-200 rounded-lg h-8',
              'opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0'
            )}
            onClick={(e) => { e.stopPropagation(); onViewDetails(product) }}
          >
            <Eye className="h-3.5 w-3.5" />
            Ver detalle
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.product.sale_price === nextProps.product.sale_price &&
    prevProps.product.stock_quantity === nextProps.product.stock_quantity &&
    prevProps.product.image === nextProps.product.image &&
    prevProps.product.is_active === nextProps.product.is_active &&
    prevProps.product.purchase_price === nextProps.product.purchase_price &&
    JSON.stringify((prevProps.product as any).images) === JSON.stringify((nextProps.product as any).images)
  )
})
