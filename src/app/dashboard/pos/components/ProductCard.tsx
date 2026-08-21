'use client'

import React, { memo } from 'react'
import { Plus, Star, Package, ShoppingCart, AlertTriangle, EyeOff, Eye, Info, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { formatStockStatus } from '@/lib/inventory-manager'
import { resolveProductImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/product-unified'
import { getFeaturedProductCreditPlan } from '../lib/product-credit'

interface ProductCardProps {
  product: Product
  addToCart: (product: Product) => void
  formatCurrency: (amount: number) => string
  viewMode?: 'grid' | 'list'
  inventoryManager?: any
  isWholesale?: boolean
  wholesaleDiscountRate?: number
  onQuickAdd?: (product: Product, quantity: number) => void
  onViewDetail?: (product: Product) => void
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
  onViewDetail,
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
  const featuredCreditPlan = getFeaturedProductCreditPlan(product, appliedPrice)
  const financingAriaLabel = featuredCreditPlan
    ? ` Hasta ${featuredCreditPlan.count} cuotas desde ${formatCurrency(featuredCreditPlan.installmentAmount)} por mes.`
    : ''
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
          "transition-all duration-200 hover:shadow-xs border-border/60 mb-1.5",
          isOutOfStock && 'opacity-50'
        )}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Agregar ${product.name} al carrito. Precio: ${formatCurrency(appliedPrice)}.${financingAriaLabel}`}
      >
        <CardContent className="p-2">
          <div className="flex items-center gap-3">
            {/* Imagen / Icono */}
            <div className="flex-shrink-0 w-10 h-10 bg-muted/30 rounded-md flex items-center justify-center border border-border/50 overflow-hidden">
              {imageSrc ? (
                <img src={imageSrc} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-5 w-5 text-muted-foreground/50" />
              )}
            </div>

            {/* Info Principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3 className="font-medium text-xs truncate">{product.name}</h3>
                {Boolean(product.featured || (product as any).is_featured || (product as any).isFeatured) && (
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                )}
                {product.is_active === false && (
                  <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Oculto del catálogo público">
                    <title>Oculto del catálogo público</title>
                  </EyeOff>
                )}
                {showStock && stockStatus && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "h-4 px-1 text-[9px] font-normal border-0",
                      stockStatus.status === 'out' || stockStatus.status === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                      stockStatus.status === 'low' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    )}
                  >
                    {stock} un.
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="truncate">{product.category?.name || product.category_id}</span>
                {product.sku && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="font-mono">{product.sku}</span>
                  </>
                )}
              </div>
              {featuredCreditPlan && (
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-sky-700 dark:text-sky-300">
                  <CreditCard className="h-3 w-3" aria-hidden="true" />
                  <span className="font-semibold">Hasta {featuredCreditPlan.count} cuotas</span>
                  <span>Desde {formatCurrency(featuredCreditPlan.installmentAmount)}/mes</span>
                  <span>{featuredCreditPlan.rate === 0 ? 'Sin interés' : `Tasa ${featuredCreditPlan.rate}%`}</span>
                </div>
              )}
            </div>

            {/* Precios y Acciones */}
            <div className="flex items-center gap-2.5">
              <div className="text-right">
                <div className="font-bold text-xs sm:text-sm text-primary">
                  {formatCurrency(appliedPrice)}
                </div>
                {isWholesale && (
                  <div className="text-[9px] text-muted-foreground line-through">
                    {formatCurrency(price)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {onViewDetail && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onViewDetail(product); }}
                    className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    title="Ver detalle del producto"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onQuickAdd && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); handleQuickAdd(1); }}
                    disabled={isOutOfStock}
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    title="+1 Unidad"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                  disabled={isOutOfStock}
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs",
                    cartQuantity > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {cartQuantity > 0 ? (
                    <span className="font-bold">{cartQuantity}</span>
                  ) : (
                    <ShoppingCart className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Grid View — Premium Redesign (Compact)
  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-200 cursor-pointer group select-none",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "bg-card/95 border-border/60 rounded-xl",
        "hover:shadow-sm hover:shadow-primary/5 hover:border-primary/40 hover:-translate-y-0.5",
        isOutOfStock && 'opacity-50 grayscale pointer-events-none',
        cartQuantity > 0 && 'ring-2 ring-primary/80 ring-offset-1 shadow-xs border-primary/40'
      )}
      onClick={() => !isOutOfStock && addToCart(product)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Agregar ${product.name} al carrito. Precio: ${formatCurrency(appliedPrice)}.${financingAriaLabel}`}
    >
      {/* Botón Ver Detalle (Flotante en esquina superior derecha) */}
      {onViewDetail && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onViewDetail(product)
          }}
          className="absolute top-1.5 right-1.5 z-20 h-5.5 w-5.5 rounded-full bg-background/90 hover:bg-background backdrop-blur-md border border-border/70 shadow-xs flex items-center justify-center text-muted-foreground hover:text-primary transition-all hover:scale-110"
          title="Ver detalle completo del producto"
        >
          <Eye className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Badge: Stock bajo/critico */}
      {showStock && stockStatus && (stockStatus.status === 'low' || stockStatus.status === 'critical' || stockStatus.status === 'out') && (
        <div className={`absolute ${onViewDetail ? 'top-1.5 right-8' : 'top-1.5 right-1.5'} z-10`}>
          <Badge 
            variant="secondary"
            className={cn(
              "shadow-xs border-0 font-semibold px-1 py-0.2 text-[8px] backdrop-blur-md",
              stockStatus.status === 'out' ? 'bg-rose-500 text-white' : 
                stockStatus.status === 'critical' ? 'bg-orange-500 text-white' : 
                'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300'
            )}
          >
            <AlertTriangle className="h-2 w-2 mr-0.5" />
            {stockStatus.message}
          </Badge>
        </div>
      )}

      {/* Badge: Cantidad en carrito */}
      {cartQuantity > 0 && (
        <div className="absolute top-1.5 left-1.5 z-10 animate-in zoom-in-75 duration-150">
          <Badge className="bg-primary text-primary-foreground font-bold shadow-xs h-5 min-w-[1.25rem] flex items-center justify-center text-[10px] rounded-md px-1">
            {cartQuantity}
          </Badge>
        </div>
      )}

      {/* Featured star */}
      {Boolean(product.featured || (product as any).is_featured || (product as any).isFeatured) && (
        <div className="absolute top-1.5 left-1.5 z-10">
          {cartQuantity === 0 && <Star className="h-3 w-3 text-amber-500 fill-amber-500 drop-shadow-xs" />}
        </div>
      )}

      <CardContent className="p-0 h-full flex flex-col justify-between">
        {/* Imagen compacta y nítida */}
        <div className="h-20 sm:h-24 bg-gradient-to-b from-muted/40 to-muted/10 flex items-center justify-center border-b border-border/40 overflow-hidden relative group-hover:bg-muted/30 transition-colors">
          {imageSrc ? (
            <img 
              src={imageSrc} 
              alt={product.name} 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
            />
          ) : (
            <Package className="h-7 w-7 text-muted-foreground/30 sm:h-8 sm:w-8" />
          )}
        </div>
        
        <div className="p-2 sm:p-2.5 flex flex-col flex-1 justify-between gap-1">
          {/* Titulo y Categoria */}
          <div>
            <h3 className="font-semibold text-xs leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            {product.is_active === false && (
              <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-slate-900/80 px-1 py-0.2 text-[8px] font-semibold text-white">
                <EyeOff className="h-2 w-2" />
                Oculto
              </span>
            )}
            <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
              {product.category?.name || product.category_id}
            </p>
          </div>

          {/* Stock indicator */}
          {showStock && stockStatus && !isOutOfStock && (
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", stockBarColor)} />
              <span className="truncate tabular-nums font-medium">
                {stock} disp.
              </span>
            </div>
          )}

          {featuredCreditPlan && (
            <div className="rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-1 text-[9px] leading-tight text-sky-800 dark:text-sky-200">
              <div className="flex items-center gap-1 font-semibold">
                <CreditCard className="h-2.5 w-2.5" aria-hidden="true" />
                Hasta {featuredCreditPlan.count} cuotas
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-1">
                <span>Desde {formatCurrency(featuredCreditPlan.installmentAmount)}/mes</span>
                <span>·</span>
                <span>{featuredCreditPlan.rate === 0 ? 'Sin interés' : `Tasa ${featuredCreditPlan.rate}%`}</span>
              </div>
            </div>
          )}

          {/* Precios + Botón Agregar */}
          <div className="pt-1.5 border-t border-border/40 flex items-end justify-between gap-1.5">
            <div className="flex flex-col min-w-0">
              {isWholesale && (
                <span className="text-[9px] text-muted-foreground line-through leading-none mb-0.5">
                  {formatCurrency(price)}
                </span>
              )}
              <span className="text-xs sm:text-sm font-bold text-primary leading-tight tracking-tight">
                {formatCurrency(appliedPrice)}
              </span>
            </div>

            {/* Botón siempre visible */}
            <Button
              onClick={(e) => { e.stopPropagation(); addToCart(product); }}
              disabled={isOutOfStock}
              size="sm"
              className={cn(
                "h-6.5 px-2 text-[10.5px] font-semibold rounded-md shadow-xs transition-all",
                cartQuantity > 0 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
              )}
            >
              <Plus className="h-2.5 w-2.5 mr-0.5" />
              {isOutOfStock ? 'Agotado' : cartQuantity > 0 ? `+1` : 'Agregar'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

ProductCard.displayName = 'ProductCard'
