'use client'

import React, { memo } from 'react'
import { Plus, Star, Package, ShoppingCart, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { formatStockStatus } from '@/lib/inventory-manager'
import { resolveProductImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
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
  const imageSrc = product.image ? resolveProductImageUrl(product.image) : ''

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

  // Stock bar percentage
  const stockPercent = Math.min(100, Math.max(0, (stock / Math.max(minStock * 3, 1)) * 100))
  const stockBarColor = stockStatus?.status === 'out' ? 'bg-red-500' 
    : stockStatus?.status === 'critical' ? 'bg-orange-500' 
    : stockStatus?.status === 'low' ? 'bg-amber-400' 
    : 'bg-emerald-500'

  if (viewMode === 'list') {
    return (
      <Card 
        className={cn(
          "transition-all duration-200 hover:shadow-md border-border/60",
          isOutOfStock && 'opacity-50'
        )}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Agregar ${product.name} al carrito. Precio: ${formatCurrency(appliedPrice)}.`}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-4">
            {/* Imagen / Icono */}
            <div className="flex-shrink-0 w-12 h-12 bg-muted/30 rounded-lg flex items-center justify-center text-2xl border border-border/50 overflow-hidden">
              {imageSrc ? (
                <img src={imageSrc} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground/50" />
              )}
            </div>

            {/* Info Principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-medium text-sm truncate">{product.name}</h3>
                {product.featured && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                {showStock && stockStatus && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "h-5 px-1.5 text-[10px] font-normal border-0",
                      stockStatus.status === 'out' || stockStatus.status === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                      stockStatus.status === 'low' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    )}
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

  // Grid View — Premium Redesign
  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-200 cursor-pointer group",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "bg-card border-border/50 rounded-xl",
        "hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30",
        isOutOfStock && 'opacity-50 grayscale pointer-events-none',
        cartQuantity > 0 && 'ring-2 ring-primary/70 ring-offset-1 shadow-md shadow-primary/10'
      )}
      onClick={() => !isOutOfStock && addToCart(product)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Agregar ${product.name} al carrito. Precio: ${formatCurrency(appliedPrice)}.`}
    >
      {/* Badge: Stock bajo/critico */}
      {showStock && stockStatus && (stockStatus.status === 'low' || stockStatus.status === 'critical' || stockStatus.status === 'out') && (
        <div className="absolute top-2 right-2 z-10">
          <Badge 
            variant="secondary"
            className={cn(
              "shadow-sm border-0 font-semibold px-2 py-0.5 text-[10px] backdrop-blur-sm",
              stockStatus.status === 'out' ? 'bg-red-500/90 text-white' : 
                stockStatus.status === 'critical' ? 'bg-orange-500/90 text-white' : 
                'bg-amber-100/90 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200'
            )}
          >
            <AlertTriangle className="h-2.5 w-2.5 mr-1" />
            {stockStatus.message}
          </Badge>
        </div>
      )}

      {/* Badge: Cantidad en carrito */}
      {cartQuantity > 0 && (
        <div className="absolute top-2 left-2 z-10 animate-in zoom-in-75 duration-200">
          <Badge className="bg-primary text-primary-foreground font-bold shadow-lg h-7 min-w-[1.75rem] flex items-center justify-center text-xs rounded-lg">
            {cartQuantity}
          </Badge>
        </div>
      )}

      {/* Featured star */}
      {product.featured && (
        <div className="absolute top-2 left-2 z-10">
          {cartQuantity === 0 && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 drop-shadow-sm" />}
        </div>
      )}

      <CardContent className="p-0 h-full flex flex-col">
        {/* Imagen — más grande */}
        <div className="h-28 sm:h-32 bg-gradient-to-b from-muted/30 to-muted/10 flex items-center justify-center border-b border-border/30 overflow-hidden relative">
          {imageSrc ? (
            <img 
              src={imageSrc} 
              alt={product.name} 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
            />
          ) : (
            <Package className="h-10 w-10 text-muted-foreground/25 sm:h-12 sm:w-12" />
          )}
        </div>
        
        <div className="p-3 flex flex-col flex-1 gap-1.5">
          {/* Titulo y Categoria */}
          <div className="flex-1">
            <h3 className="font-semibold text-[13px] leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors sm:text-sm">
              {product.name}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1 truncate">
              {product.category?.name || product.category_id}
            </p>
          </div>

          {/* Stock bar */}
          {showStock && stockStatus && !isOutOfStock && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", stockBarColor)} 
                  style={{ width: `${stockPercent}%` }} 
                />
              </div>
              <span className="text-[9px] text-muted-foreground font-medium tabular-nums shrink-0">
                {stock}
              </span>
            </div>
          )}

          {/* Precios + Botón Agregar (SIEMPRE visible) */}
          <div className="pt-2 border-t border-border/30">
            <div className="flex items-end justify-between gap-2">
              <div className="flex flex-col">
                {isWholesale && (
                  <span className="text-[10px] text-muted-foreground line-through leading-none mb-0.5">
                    {formatCurrency(price)}
                  </span>
                )}
                <span className="text-base font-bold text-primary leading-none sm:text-lg">
                  {formatCurrency(appliedPrice)}
                </span>
              </div>

              {/* Botón siempre visible */}
              <Button
                onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                disabled={isOutOfStock}
                size="sm"
                className={cn(
                  "h-8 px-3 text-xs font-semibold rounded-lg shadow-sm transition-all",
                  cartQuantity > 0 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                )}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {isOutOfStock ? 'Agotado' : cartQuantity > 0 ? `+1` : 'Agregar'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

ProductCard.displayName = 'ProductCard'
