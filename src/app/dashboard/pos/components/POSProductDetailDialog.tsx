'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Package,
  ShoppingCart,
  Plus,
  Minus,
  Star,
  Barcode,
  Tag,
  AlertTriangle,
  EyeOff,
  Check,
  Copy,
  Info,
  Layers,
  Sparkles
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { resolveProductImageUrl } from '@/lib/images'
import { formatStockStatus } from '@/lib/inventory-manager'
import { toast } from 'sonner'
import type { Product } from '@/types/product-unified'

interface POSProductDetailDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart: (product: Product, quantity: number) => void
  isWholesale?: boolean
  wholesaleDiscountRate?: number
}

export function POSProductDetailDialog({
  product,
  open,
  onOpenChange,
  onAddToCart,
  isWholesale = false,
  wholesaleDiscountRate = 10
}: POSProductDetailDialogProps) {
  const [quantity, setQuantity] = useState(1)
  const [copiedBarcode, setCopiedBarcode] = useState(false)

  useEffect(() => {
    if (open) {
      setQuantity(1)
      setCopiedBarcode(false)
    }
  }, [open, product])

  if (!product) return null

  const stock = product.stock_quantity ?? 0
  const minStock = product.min_stock ?? 5
  const isOutOfStock = stock <= 0
  const stockStatus = formatStockStatus(stock, minStock)

  const price = product.sale_price || 0
  const hasExplicitWholesale = typeof product.wholesale_price === 'number' && product.wholesale_price > 0
  const computedWholesale = Math.round(price * (1 - (wholesaleDiscountRate / 100)))
  const wholesalePrice = hasExplicitWholesale ? product.wholesale_price! : computedWholesale
  const activePrice = isWholesale ? wholesalePrice : price
  const imageSrc = product.image ? resolveProductImageUrl(product.image) : ''

  const handleCopyBarcode = () => {
    if (product.barcode) {
      navigator.clipboard.writeText(product.barcode)
      setCopiedBarcode(true)
      toast.success('Código de barras copiado')
      setTimeout(() => setCopiedBarcode(false), 2000)
    }
  }

  const handleAddToCart = () => {
    if (isOutOfStock) {
      toast.error('Producto sin stock disponible')
      return
    }
    if (quantity <= 0) return
    onAddToCart(product, quantity)
    toast.success(`Agregado al carrito (${quantity} u.)`, {
      description: `${product.name} — ${formatCurrency(activePrice * quantity)}`
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl bg-card border-border/80 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] max-h-[85vh] overflow-y-auto">
          {/* Columna Izquierda: Imagen & Badges */}
          <div className="bg-muted/30 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border/60 relative">
            {product.featured && (
              <Badge className="absolute top-3 left-3 bg-amber-500 hover:bg-amber-600 text-white font-bold gap-1 text-[10px] shadow-sm">
                <Star className="h-3 w-3 fill-white" /> Destacado
              </Badge>
            )}

            <div className="w-44 h-44 rounded-xl bg-background border border-border/60 flex items-center justify-center overflow-hidden shadow-xs relative">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={product.name}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <Package className="h-16 w-16 text-muted-foreground/30" />
              )}
            </div>

            {/* Estado de Stock en Badge */}
            <div className="mt-4 w-full text-center">
              <Badge
                variant="secondary"
                className={`w-full justify-center py-1 text-xs font-semibold ${
                  isOutOfStock
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    : stock <= minStock
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}
              >
                {isOutOfStock
                  ? 'Sin Stock'
                  : stock <= minStock
                  ? `Stock Bajo (${stock} u.)`
                  : `Disponible: ${stock} u.`}
              </Badge>
            </div>
          </div>

          {/* Columna Derecha: Detalles & Acción de Compra */}
          <div className="p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              {/* Categoría & SKU */}
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                {product.category?.name && (
                  <Badge variant="outline" className="text-xs bg-muted/40 font-normal">
                    <Tag className="h-3 w-3 mr-1 text-primary" />
                    {product.category.name}
                  </Badge>
                )}
                {product.sku && (
                  <Badge variant="outline" className="text-xs font-mono bg-muted/40 font-normal">
                    SKU: {product.sku}
                  </Badge>
                )}
                {product.is_active === false && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <EyeOff className="h-3 w-3" /> Oculto en catálogo
                  </Badge>
                )}
              </div>

              {/* Nombre del Producto */}
              <DialogTitle className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                {product.name}
              </DialogTitle>

              {/* Código de barras si existe */}
              {product.barcode && (
                <div className="flex items-center gap-2 text-xs bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 w-fit">
                  <Barcode className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground">{product.barcode}</span>
                  <button
                    type="button"
                    onClick={handleCopyBarcode}
                    className="ml-1 text-muted-foreground hover:text-foreground p-0.5 rounded"
                    title="Copiar código de barras"
                  >
                    {copiedBarcode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              {/* Tarjeta de Precios */}
              <div className="bg-muted/30 p-3.5 rounded-xl border border-border/60 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground block">Precio Minorista</span>
                  <span className={`text-lg font-bold ${!isWholesale ? 'text-primary' : 'text-muted-foreground line-through text-sm'}`}>
                    {formatCurrency(price)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground block flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" /> Precio Mayorista
                  </span>
                  <span className={`text-lg font-bold ${isWholesale ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                    {formatCurrency(wholesalePrice)}
                  </span>
                </div>
              </div>

              {/* Descripción corta si existe */}
              {product.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {product.description}
                </p>
              )}
            </div>

            {/* Selector de Cantidad & Botón Agregar */}
            <div className="pt-4 border-t border-border/50 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-foreground">Cantidad a cobrar:</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || isOutOfStock}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={stock > 0 ? stock : 1}
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1
                      setQuantity(Math.max(1, Math.min(stock > 0 ? stock : 999, val)))
                    }}
                    disabled={isOutOfStock}
                    className="h-8 w-16 text-center font-bold text-sm px-1 rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setQuantity(q => Math.min(stock > 0 ? stock : 999, q + 1))}
                    disabled={isOutOfStock || (stock > 0 && quantity >= stock)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Botón Principal de Agregar */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-10 text-xs"
                >
                  Cerrar
                </Button>
                <Button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  size="sm"
                  className="flex-1 h-10 gap-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md rounded-xl"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Agregar al Carrito • {formatCurrency(activePrice * quantity)}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
