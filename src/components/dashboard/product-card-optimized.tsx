'use client'

import { useState } from 'react'
import { Edit, Package, Star, Eye, ShoppingCart, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Product } from '@/lib/types/product'

interface ProductCardOptimizedProps {
  product: Product
  onEdit?: (product: Product) => void
  onView?: (product: Product) => void
  onAddToCart?: (product: Product) => void
  className?: string
}

// Función simplificada para estado de stock
const getStockStatus = (current: number, min: number) => {
  if (current === 0) return { label: 'Agotado', variant: 'destructive' as const }
  if (current <= min) return { label: 'Bajo', variant: 'secondary' as const }
  return { label: 'Disponible', variant: 'default' as const }
}

// Función simplificada para margen
const getMarginStatus = (salePrice: number, purchasePrice: number) => {
  const margin = ((salePrice - purchasePrice) / purchasePrice) * 100
  if (margin > 40) return { color: 'text-green-600', label: 'Excelente' }
  if (margin > 20) return { color: 'text-blue-600', label: 'Bueno' }
  return { color: 'text-orange-600', label: 'Bajo' }
}

export function ProductCardOptimized({ 
  product, 
  onEdit, 
  onView, 
  onAddToCart,
  className 
}: ProductCardOptimizedProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  const stockStatus = getStockStatus(product.stock_quantity, product.min_stock)
  const marginStatus = getMarginStatus(product.sale_price, product.purchase_price)
  const isOutOfStock = product.stock_quantity === 0

  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-200 hover:shadow-lg group",
        isOutOfStock && "opacity-60",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Indicador de estado superior */}
      <div className={cn(
        "absolute top-0 left-0 w-full h-1",
        isOutOfStock ? "bg-red-500" : 
        product.stock_quantity <= product.min_stock ? "bg-orange-500" : 
        "bg-green-500"
      )} />

      {/* Badge destacado */}
      {product.featured && (
        <div className="absolute top-3 left-3 z-10">
          <Badge variant="default" className="bg-yellow-500 text-white">
            <Star className="h-3 w-3 mr-1 fill-current" />
            Destacado
          </Badge>
        </div>
      )}

      {/* Menú de acciones */}
      <div className={cn(
        "absolute top-3 right-3 z-10 transition-opacity duration-200",
        isHovered ? "opacity-100" : "opacity-0"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView?.(product)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver detalles
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(product)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="p-4">
        {/* Información principal del producto */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar className="h-12 w-12 rounded-lg">
            <AvatarImage src={product.image} alt={product.name} />
            <AvatarFallback className="rounded-lg bg-gray-100 text-gray-600">
              {product.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
            <p className="text-sm text-gray-500">{product.category}</p>
            <Badge variant={stockStatus.variant} className="mt-1">
              {stockStatus.label}
            </Badge>
          </div>
        </div>

        {/* Información de precios simplificada */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Precio</span>
            <span className="font-bold text-lg text-green-600">
              ${product.sale_price.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Stock</span>
            <span className="text-sm font-medium">
              {product.stock_quantity} unidades
            </span>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => onEdit?.(product)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Editar
          </Button>
          <Button 
            variant={isOutOfStock ? "secondary" : "default"}
            size="sm" 
            className="flex-1"
            disabled={isOutOfStock}
            onClick={() => isOutOfStock ? undefined : onAddToCart?.(product)}
          >
            {isOutOfStock ? (
              <>
                <Package className="h-4 w-4 mr-1" />
                Agotado
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-1" />
                Agregar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}