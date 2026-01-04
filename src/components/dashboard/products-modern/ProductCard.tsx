/**
 * ProductCard Component - Modern Edition
 * Enhanced card display for products in grid view with premium aesthetics
 */

import React, { useState } from 'react'
import Image from 'next/image'
import { Edit, Trash2, Copy, Eye, Package, TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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
  className?: string
}

export const ProductCard = React.memo(function ProductCard({
  product,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onViewDetails,
  className
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)

  const stockStatus = getStockStatus(product)

  const stockStatusConfig = {
    in_stock: {
      label: 'En Stock',
      bgClass: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      lightBg: 'bg-emerald-50 dark:bg-emerald-950/30',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      borderClass: 'border-emerald-200 dark:border-emerald-900',
      icon: TrendingUp
    },
    low_stock: {
      label: 'Bajo Stock',
      bgClass: 'bg-gradient-to-r from-amber-500 to-orange-500',
      lightBg: 'bg-amber-50 dark:bg-amber-950/30',
      textClass: 'text-amber-700 dark:text-amber-400',
      borderClass: 'border-amber-200 dark:border-amber-900',
      icon: TrendingDown
    },
    out_of_stock: {
      label: 'Agotado',
      bgClass: 'bg-gradient-to-r from-red-500 to-rose-500',
      lightBg: 'bg-red-50 dark:bg-red-950/30',
      textClass: 'text-red-700 dark:text-red-400',
      borderClass: 'border-red-200 dark:border-red-900',
      icon: TrendingDown
    }
  }

  const statusConfig = stockStatusConfig[stockStatus]
  const StatusIcon = statusConfig.icon

  // Get first letter for placeholder
  const firstLetter = product.name.charAt(0).toUpperCase()

  // Calculate price discount percentage if applicable
  const discountPercentage = product.wholesale_price && product.wholesale_price > product.sale_price
    ? Math.round(((product.wholesale_price - product.sale_price) / product.wholesale_price) * 100)
    : null

  return (
    <Card
      role="article"
      aria-label={`Producto: ${product.name}, Precio: $${product.sale_price}, Stock: ${product.stock_quantity}`}
      className={cn(
        'group relative border-0 bg-white dark:bg-gray-800 overflow-hidden',
        'transition-all duration-300 ease-out',
        'hover:shadow-2xl hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50',
        isSelected && 'ring-2 ring-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/20',
        isHovered ? 'scale-[1.03] -translate-y-1' : 'shadow-lg',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-0">
        {/* Image Section with Gradient Overlay */}
        <div className="relative aspect-square bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 overflow-hidden">
          {product.image && !imageError ? (
            <>
              <Image
                src={product.image}
                alt={product.name}
                fill
                className={cn(
                  'object-cover transition-all duration-500',
                  isHovered ? 'scale-110 brightness-105' : 'scale-100 brightness-100'
                )}
                onError={() => setImageError(true)}
              />
              {/* Gradient Overlay on Hover */}
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent',
                  'transition-opacity duration-300',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-pink-950/40">
              <div className="text-center">
                <div className="relative">
                  <Package className="h-20 w-20 text-gray-300 dark:text-gray-600 mx-auto mb-3 drop-shadow-sm" />
                  <Sparkles className="h-6 w-6 text-purple-400 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <span className="text-5xl font-bold bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-500 dark:to-gray-400 bg-clip-text text-transparent">
                  {firstLetter}
                </span>
              </div>
            </div>
          )}

          {/* Stock Status Badge - Top Left */}
          <div className="absolute top-3 left-3">
            <div
              className={cn(
                'px-3 py-1.5 rounded-full backdrop-blur-md',
                'flex items-center gap-1.5',
                'shadow-lg border border-white/20 dark:border-white/10',
                statusConfig.bgClass
              )}
            >
              <StatusIcon className="h-3.5 w-3.5 text-white" />
              <span className="text-xs font-bold text-white tracking-wide">
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Discount Badge - Top Right */}
          {discountPercentage && discountPercentage > 0 && (
            <div className="absolute top-3 right-3">
              <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg border border-white/20 dark:border-white/10 backdrop-blur-md">
                <span className="text-xs font-bold text-white">
                  -{discountPercentage}%
                </span>
              </div>
            </div>
          )}

          {/* Multiple Images Indicator */}
          {product.images && product.images.length > 1 && (
            <div className="absolute bottom-3 left-3">
              <div className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm text-white text-xs font-medium shadow-lg">
                +{product.images.length - 1} fotos
              </div>
            </div>
          )}

          {/* Selection Checkbox - Bottom Left with Glassmorphism */}
          <div
            className={cn(
              'absolute bottom-3 left-3 transition-all duration-200',
              isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            )}
          >
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg p-1.5 shadow-xl border border-white/20 dark:border-white/10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(product.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Seleccionar producto ${product.name}`}
                className="border-gray-400 dark:border-gray-500"
              />
            </div>
          </div>

          {/* Quick Actions - Bottom Right with Glassmorphism */}
          <div
            className={cn(
              'absolute bottom-3 right-3 flex gap-1.5 transition-all duration-300',
              isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            )}
          >
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 bg-white/95 dark:bg-gray-800/95 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 dark:text-gray-200 backdrop-blur-md shadow-lg border border-white/20 dark:border-white/10 transition-all duration-200"
              onClick={(e) => {
                e.stopPropagation()
                onViewDetails(product)
              }}
              aria-label={`Ver detalles de ${product.name}`}
              title="Ver detalles"
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 bg-white/95 dark:bg-gray-800/95 hover:bg-green-500 hover:text-white dark:hover:bg-green-600 dark:text-gray-200 backdrop-blur-md shadow-lg border border-white/20 dark:border-white/10 transition-all duration-200"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(product)
              }}
              aria-label={`Editar ${product.name}`}
              title="Editar"
            >
              <Edit className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 bg-white/95 dark:bg-gray-800/95 hover:bg-purple-500 hover:text-white dark:hover:bg-purple-600 dark:text-gray-200 backdrop-blur-md shadow-lg border border-white/20 dark:border-white/10 transition-all duration-200"
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate(product)
              }}
              aria-label={`Duplicar ${product.name}`}
              title="Duplicar"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 bg-white/95 dark:bg-gray-800/95 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 dark:text-gray-200 backdrop-blur-md shadow-lg border border-white/20 dark:border-white/10 transition-all duration-200"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(product)
              }}
              aria-label={`Eliminar ${product.name}`}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Info Section with Enhanced Design */}
        <div className="p-5 space-y-4 bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50">
          {/* Product Name */}
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug min-h-[3.5rem] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
              {product.name}
            </h3>
          </div>

          {/* SKU and Brand with Modern Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-xs font-medium px-2.5 py-1 bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              <code className="font-mono">{product.sku}</code>
            </Badge>
            {product.brand && (
              <Badge
                variant="secondary"
                className="text-xs font-medium px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-100 dark:from-blue-950/30 dark:to-indigo-950/30 dark:text-blue-300 dark:border-blue-900/50"
              >
                {product.brand}
              </Badge>
            )}
          </div>

          {/* Price with Modern Typography */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent">
                ${product.sale_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {product.wholesale_price && product.wholesale_price > product.sale_price && (
              <span className="text-sm text-gray-400 dark:text-gray-500 line-through font-medium">
                ${product.wholesale_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {/* Stock Quantity with Progress-like Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-600 dark:text-gray-400">Inventario</span>
              <span className={cn(
                "font-bold tabular-nums",
                stockStatus === 'in_stock' && "text-emerald-600 dark:text-emerald-400",
                stockStatus === 'low_stock' && "text-amber-600 dark:text-amber-400",
                stockStatus === 'out_of_stock' && "text-red-600 dark:text-red-400"
              )}>
                {product.stock_quantity} unidades
              </span>
            </div>

            {/* Visual Stock Indicator Bar */}
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  statusConfig.bgClass
                )}
                style={{
                  width: `${Math.min(100, (product.stock_quantity / (product.min_stock * 3)) * 100)}%`
                }}
              />
            </div>
          </div>

          {/* Active Status */}
          {!product.is_active && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <Badge
                variant="outline"
                className="text-xs bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 font-medium"
              >
                ⏸ Producto Inactivo
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.product.sale_price === nextProps.product.sale_price &&
    prevProps.product.stock_quantity === nextProps.product.stock_quantity &&
    prevProps.product.image === nextProps.product.image &&
    prevProps.product.is_active === nextProps.product.is_active
  )
})
