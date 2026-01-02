'use client'

import React, { memo } from 'react'
import { Plus, Minus, Star, Package, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { formatStockStatus } from '@/lib/inventory-manager'
import type { Product } from '@/types/product-unified'

interface ProductCardProps {
  product: Product
  addToCart: (product: Product) => void
  formatCurrency: (amount: number) => string
  viewMode?: 'grid' | 'list'
  inventoryManager?: any
  isWholesale?: boolean
  wholesaleDiscountRate?: number
  onQuickAdd?: (product: Product, quantity: number) => void
  cartQuantity?: number
  showStock?: boolean
  showBarcode?: boolean
}

export const ProductCard = memo(({
  product,
  addToCart,
  formatCurrency,
  viewMode = 'grid',
  inventoryManager,
  isWholesale = false,
  wholesaleDiscountRate = 10,
  onQuickAdd,
  cartQuantity = 0,
  showStock = true,
  showBarcode = false
}: ProductCardProps) => {
  const stock = product.stock_quantity || 0
  const minStock = product.min_stock || 5
  const price = product.sale_price || 0
  
  const stockStatus = inventoryManager ? formatStockStatus(stock) : formatStockStatus(stock, minStock)
  const isOutOfStock = stock === 0
  
  const hasExplicitWholesale = typeof product.wholesale_price === 'number' && product.wholesale_price > 0
  const computedWholesale = Math.round(price * (1 - (wholesaleDiscountRate / 100)))
  const appliedPrice = isWholesale ? (hasExplicitWholesale ? product.wholesale_price! : computedWholesale) : price

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!isOutOfStock) {
        addToCart(product)
      }
    }
  }

  const handleQuickAdd = (quantity: number) => {
    if (onQuickAdd && quantity > 0 && quantity <= stock) {
      onQuickAdd(product, quantity)
    }
  }

  if (viewMode === 'list') {
    return (
      <Card 
        className={`transition-all duration-200 hover:shadow-md ${isOutOfStock ? 'opacity-50' : ''}`}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Agregar ${product.name} al carrito. Precio: ${formatCurrency(appliedPrice)}.`}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-4">
            {/* Imagen / Icono */}
            <div className="flex-shrink-0 w-12 h-12 bg-muted/30 rounded-lg flex items-center justify-center text-2xl border border-border/50">
              {product.image || '📦'}
            </div>

            {/* Info Principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-medium text-sm truncate">{product.name}</h3>
                {product.featured && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                {showStock && stockStatus && (
                  <Badge 
                    variant="outline" 
                    className={`h-5 px-1.5 text-[10px] font-normal border-0 ${
                      stockStatus.status === 'out' || stockStatus.status === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                      stockStatus.status === 'low' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}
                  >
                    {stock} un.
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">{product.category?.name || product.category_id}</span>
                {product.sku && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="font-mono">{product.sku}</span>
                  </>
                )}
              </div>
            </div>

            {/* Precios y Acciones */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-bold text-base text-primary">
                  {formatCurrency(appliedPrice)}
                </div>
                {isWholesale && (
                  <div className="text-[10px] text-muted-foreground line-through">
                    {formatCurrency(price)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {onQuickAdd && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); handleQuickAdd(1); }}
                    disabled={isOutOfStock}
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title="+1 Unidad"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                  disabled={isOutOfStock}
                  size="sm"
                  className={cartQuantity > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}
                >
                  {cartQuantity > 0 ? (
                    <span className="font-bold">{cartQuantity}</span>
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Grid View - Optimized Layout
  return (
    <Card 
      className={`
        relative overflow-hidden transition-all duration-200 
        hover:shadow-lg hover:-translate-y-0.5 cursor-pointer group 
        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        bg-card border-border/60
        ${isOutOfStock ? 'opacity-60 grayscale' : ''}
        ${cartQuantity > 0 ? 'ring-2 ring-primary ring-offset-1' : ''}
      `}
      onClick={() => !isOutOfStock && addToCart(product)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
    >
      {/* Badge Flotante de Stock (Solo visible si es bajo o crítico) */}
      {showStock && stockStatus && (stockStatus.status === 'low' || stockStatus.status === 'critical' || stockStatus.status === 'out') && (
        <div className="absolute top-2 right-2 z-10">
          <Badge 
            variant="secondary"
            className={`
              shadow-sm border-0 font-medium px-2 py-0.5 text-[10px]
              ${stockStatus.status === 'out' ? 'bg-destructive text-destructive-foreground' : 
                stockStatus.status === 'critical' ? 'bg-orange-500 text-white' : 
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}
            `}
          >
            {stockStatus.message}
          </Badge>
        </div>
      )}

      {/* Badge de Cantidad en Carrito */}
      {cartQuantity > 0 && (
        <div className="absolute top-2 left-2 z-10 animate-in zoom-in duration-200">
          <Badge className="bg-primary text-primary-foreground font-bold shadow-md h-6 min-w-[1.5rem] flex items-center justify-center p-1">
            {cartQuantity}
          </Badge>
        </div>
      )}

      <CardContent className="p-0 h-full flex flex-col">
        {/* Imagen / Icono Grande */}
        <div className="h-24 bg-muted/20 flex items-center justify-center text-5xl border-b border-border/40 group-hover:bg-muted/40 transition-colors overflow-hidden">
          {product.image && (product.image.startsWith('http') || product.image.startsWith('/') || product.image.startsWith('data:')) ? (
             <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          ) : (
             product.image || '📦'
          )}
        </div>
        
        <div className="p-3 flex flex-col flex-1 gap-2">
          {/* Título y Categoría */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-foreground/90 group-hover:text-primary transition-colors">
                {product.name}
              </h3>
              {product.featured && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0 mt-0.5" />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {product.category?.name || product.category_id}
            </p>
          </div>

          <div className="mt-auto pt-2 border-t border-border/40 flex flex-col gap-2">
            {/* Precios */}
            <div className="flex items-end justify-between">
              <div className="flex flex-col">
                {isWholesale && (
                  <span className="text-[10px] text-muted-foreground line-through leading-none mb-0.5">
                    {formatCurrency(price)}
                  </span>
                )}
                <span className="text-lg font-bold text-primary leading-none">
                  {formatCurrency(appliedPrice)}
                </span>
              </div>
              
              {/* Indicador de stock sutil si es normal */}
              {showStock && stockStatus && stockStatus.status === 'ok' && (
                <span className="text-[10px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded-sm">
                  {stock} un.
                </span>
              )}
            </div>

            {/* Botones de Acción Rápida (Visibles al hover en desktop, siempre en mobile) */}
            <div className="grid grid-cols-2 gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0">
              {onQuickAdd && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); handleQuickAdd(1); }}
                  disabled={isOutOfStock}
                  className="h-7 text-xs border-primary/20 hover:bg-primary/5 hover:text-primary"
                >
                  +1
                </Button>
              )}
              <Button
                onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                disabled={isOutOfStock}
                size="sm"
                className="h-7 text-xs bg-primary hover:bg-primary/90"
              >
                Agregar
              </Button>
            </div>
            
            {/* Fallback para mobile/touch donde no hay hover */}
            <div className="lg:hidden w-full">
               <Button
                onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                disabled={isOutOfStock}
                size="sm"
                variant="secondary"
                className="w-full h-8 text-xs font-medium"
              >
                {isOutOfStock ? 'Agotado' : 'Agregar'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

ProductCard.displayName = 'ProductCard'
