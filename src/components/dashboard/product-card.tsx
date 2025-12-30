'use client'

import { useState } from 'react'
import { Edit, Trash2, Package, AlertTriangle, Star, Eye, ShoppingCart, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Product } from '@/lib/types/product'
import { ProductQuickView } from './product-quick-view'

interface ProductCardProps {
  product: Product
  onEdit?: (product: Product) => void
  onDelete?: (productId: string) => void
  onStockAdjust?: (product: Product) => void
  onView?: (product: Product) => void
  onAddToCart?: (product: Product) => void
  className?: string
}

const getStockStatus = (current: number, min: number) => {
  if (current === 0) return { 
    label: 'Agotado', 
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertTriangle,
    severity: 'critical'
  }
  if (current <= min) return { 
    label: 'Crítico', 
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: AlertTriangle,
    severity: 'warning'
  }
  if (current <= min * 1.5) return { 
    label: 'Bajo', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Package,
    severity: 'low'
  }
  return { 
    label: 'Normal', 
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: Package,
    severity: 'normal'
  }
}

// Colores suaves para categorías conocidas; por defecto azul
const getCategoryColor = (category?: string) => {
  const key = (category ?? '').toLowerCase()
  if (key.includes('electr')) return 'bg-indigo-100 text-indigo-800 border-indigo-200'
  if (key.includes('hogar')) return 'bg-teal-100 text-teal-800 border-teal-200'
  if (key.includes('ropa') || key.includes('vest')) return 'bg-pink-100 text-pink-800 border-pink-200'
  if (key.includes('oficina')) return 'bg-sky-100 text-sky-800 border-sky-200'
  if (key.includes('deporte')) return 'bg-lime-100 text-lime-800 border-lime-200'
  if (key.includes('alimento') || key.includes('bebida')) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-blue-100 text-blue-800 border-blue-200'
}

export function ProductCard({ 
  product, 
  onEdit, 
  onDelete, 
  onStockAdjust, 
  onView, 
  onAddToCart,
  className 
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showQuickView, setShowQuickView] = useState(false)
  
  const stockStatus = getStockStatus(product.stock_quantity, product.min_stock)
  const margin = ((product.sale_price - product.purchase_price) / product.purchase_price * 100)
  const isOutOfStock = product.stock_quantity === 0
  const isLowStock = product.stock_quantity <= product.min_stock
  const StockIcon = stockStatus.icon

  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group border-0 shadow-md",
        "bg-gradient-to-br from-white to-gray-50/50",
        isOutOfStock && "opacity-75 grayscale-[0.3]",
        isLowStock && !isOutOfStock && "ring-2 ring-orange-200 shadow-orange-100",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Stock Status Indicator */}
      <div className={cn(
        "absolute top-0 left-0 w-full h-1.5 shadow-sm",
        isOutOfStock ? "bg-gradient-to-r from-red-500 to-red-600" : 
        isLowStock ? "bg-gradient-to-r from-orange-500 to-yellow-500" : 
        "bg-gradient-to-r from-green-500 to-emerald-500"
      )} />

      {/* Featured Badge */}
      {product.featured && (
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg border-0">
            <Star className="h-3 w-3 mr-1 fill-current" />
            Destacado
          </Badge>
        </div>
      )}

      {/* Quick Actions */}
      <div className={cn(
        "absolute top-3 right-3 z-10 transition-all duration-300",
        isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 w-8 p-0 shadow-lg backdrop-blur-sm bg-white/90 hover:bg-white border-0"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="shadow-xl border-0">
            <DropdownMenuItem onClick={() => setShowQuickView(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Vista Previa
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onView?.(product)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver Detalles
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(product)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStockAdjust?.(product)}>
              <Package className="mr-2 h-4 w-4" />
              Ajustar Stock
            </DropdownMenuItem>
            {!isOutOfStock && (
              <DropdownMenuItem onClick={() => onAddToCart?.(product)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Agregar al Carrito
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete?.(product.id)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="p-6">
        {/* Product Image */}
        <div className="flex items-start gap-4 mb-6">
          <Avatar className="h-18 w-18 rounded-xl shadow-md ring-2 ring-white">
            <AvatarImage src={product.image} alt={product.name} className="object-cover" />
            <AvatarFallback className="rounded-xl bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 text-blue-600 font-bold text-lg">
              {product.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 space-y-2">
            <h3 className="font-bold text-gray-900 truncate text-lg leading-tight">{product.name}</h3>
            <p className="text-sm text-gray-500 font-medium">SKU: {product.sku}</p>
            <Badge className={cn('text-xs font-medium shadow-sm', getCategoryColor(product.category))}>
              {product.category}
            </Badge>
          </div>
        </div>

        {/* Stock Status */}
        <div className="flex items-center gap-3 mb-5 p-3 bg-gray-50/50 rounded-lg">
          <div className="flex items-center gap-2 flex-1">
            <StockIcon className={cn(
              "h-5 w-5",
              isOutOfStock ? "text-red-500" : isLowStock ? "text-orange-500" : "text-green-500"
            )} />
            <span className="font-semibold text-gray-900">{product.stock_quantity}</span>
            <span className="text-sm text-gray-600">unidades</span>
          </div>
          <Badge className={cn(
            "font-medium shadow-sm",
            stockStatus.color
          )}>
            {stockStatus.label}
          </Badge>
        </div>

        {/* Pricing */}
        <div className="space-y-3 mb-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50/30 rounded-xl border border-gray-100">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Precio Venta</span>
            <span className="font-bold text-xl text-green-600 tracking-tight">
              ${product.sale_price.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Costo</span>
            <span className="text-sm font-semibold text-gray-700">
              ${product.purchase_price.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-600">Margen</span>
            <Badge className={cn(
              "font-semibold shadow-sm",
              margin > 50 ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' : 
              margin > 25 ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' : 
              'bg-gradient-to-r from-red-500 to-pink-500 text-white'
            )}>
              {margin.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-xs text-gray-600 space-y-2 mb-5 p-3 bg-gray-50/50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="font-medium">Proveedor:</span>
            <span className="text-gray-700">{product.supplier}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Stock mínimo:</span>
            <span className="text-gray-700">{product.min_stock}</span>
          </div>
          {product.barcode && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Código:</span>
              <span className="text-gray-700 font-mono">{product.barcode}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 font-medium shadow-sm hover:shadow-md transition-all duration-200"
            onClick={() => onEdit?.(product)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button 
            variant={isOutOfStock ? "secondary" : "default"}
            size="sm" 
            className={cn(
              "flex-1 font-medium shadow-sm hover:shadow-md transition-all duration-200",
              !isOutOfStock && "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            )}
            disabled={isOutOfStock}
            onClick={() => isOutOfStock ? onStockAdjust?.(product) : onAddToCart?.(product)}
          >
            {isOutOfStock ? (
              <>
                <Package className="h-4 w-4 mr-2" />
                Reponer
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Agregar
              </>
            )}
          </Button>
        </div>

        {/* Low Stock Warning */}
        {isLowStock && !isOutOfStock && (
          <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium">Stock bajo - Considerar reposición</span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Vista Previa Rápida */}
      <ProductQuickView
        product={product}
        isOpen={showQuickView}
        onClose={() => setShowQuickView(false)}
        onEdit={onEdit}
        onAddToCart={onAddToCart}
      />
    </Card>
  )
}