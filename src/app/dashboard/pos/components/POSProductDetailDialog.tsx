'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
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
  EyeOff,
  Check,
  Copy,
  Sparkles,
  CreditCard,
  CircleCheck,
  CircleAlert,
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { resolveProductImageUrl } from '@/lib/images'
import { toast } from 'sonner'
import type { Product } from '@/types/product-unified'
import { getProductCreditPlans, type ProductCreditPlan } from '../lib/product-credit'
import { buildCreditEligibility } from '../lib/credit-eligibility'

interface POSProductDetailDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart: (product: Product, quantity: number) => void
  isWholesale?: boolean
  wholesaleDiscountRate?: number
  creditContext: {
    hasCustomer: boolean
    hasCreditLine: boolean
    availableCredit: number
    isRegisterOpen: boolean
  }
  onUseCreditPlan: (product: Product, quantity: number, plan: ProductCreditPlan) => void
  autoScrollToCredit?: boolean
}

export function POSProductDetailDialog({
  product,
  open,
  onOpenChange,
  onAddToCart,
  creditContext,
  onUseCreditPlan,
  isWholesale = false,
  wholesaleDiscountRate = 10,
  autoScrollToCredit = false
}: POSProductDetailDialogProps) {
  const [quantity, setQuantity] = useState(1)
  const [copiedBarcode, setCopiedBarcode] = useState(false)

  // Auto-scroll a la seccion de creditos si se requiere
  React.useEffect(() => {
    if (open && autoScrollToCredit) {
      setTimeout(() => {
        const el = document.getElementById('product-credit-plans-title')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 150) // pequeño delay para que el dialog termine de animarse
    }
  }, [open, autoScrollToCredit])

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuantity(1)
      setCopiedBarcode(false)
    }
    onOpenChange(nextOpen)
  }

  if (!product) return null

  const stock = product.stock_quantity ?? 0
  const minStock = product.min_stock ?? 5
  const isOutOfStock = stock <= 0
  const price = product.sale_price || 0
  const hasExplicitWholesale = typeof product.wholesale_price === 'number' && product.wholesale_price > 0
  const computedWholesale = Math.round(price * (1 - (wholesaleDiscountRate / 100)))
  const wholesalePrice = hasExplicitWholesale ? product.wholesale_price! : computedWholesale
  const activePrice = isWholesale ? wholesalePrice : price
  const imageSrc = product.image ? resolveProductImageUrl(product.image) : ''
  const creditPlans = getProductCreditPlans(product, activePrice * quantity)

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
    handleDialogOpenChange(false)
  }

  const handleUseCreditPlan = (plan: ProductCreditPlan) => {
    if (isOutOfStock || quantity > stock) {
      toast.error('No hay stock suficiente para aplicar este plan')
      return
    }
    onUseCreditPlan(product, quantity, plan)
    handleDialogOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[88dvh] w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-w-2xl bg-card border-border/80 shadow-xl">
        <div className="max-h-[88dvh] overflow-y-auto">
          {/* Columna Izquierda: Imagen & Badges */}
          <div className="bg-muted/30 px-4 py-3 pr-12 flex items-center gap-3 border-b border-border/60 relative">
            {product.featured && (
              <Badge className="order-last bg-amber-500 hover:bg-amber-600 text-white font-bold gap-1 text-[10px]">
                <Star className="h-3 w-3 fill-white" /> Destacado
              </Badge>
            )}

            <div className="w-14 h-14 shrink-0 rounded-md bg-background border border-border/60 flex items-center justify-center overflow-hidden">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={product.name}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <Package className="h-7 w-7 text-muted-foreground/50" />
              )}
            </div>

            {/* Estado de Stock en Badge */}
            <div className="min-w-0 space-y-1">
              <DialogTitle className="break-words text-base font-semibold leading-snug">{product.name}</DialogTitle>
              <Badge
                variant="secondary"
                className={`py-0.5 text-xs font-medium ${
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
          <div className="px-3 pt-3 sm:px-4 flex flex-col space-y-3">
            <div className="space-y-2">
              <DialogDescription className="sr-only">Revisá el producto, compará sus planes de cuotas y agregalo a la venta.</DialogDescription>
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
              <div className="bg-muted/30 p-2 rounded-md border border-border/60 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground block">Precio Minorista</span>
                  <span className={`text-base font-semibold ${!isWholesale ? 'text-primary' : 'text-muted-foreground line-through text-sm'}`}>
                    {formatCurrency(price)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground block flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" /> Precio Mayorista
                  </span>
                  <span className={`text-base font-semibold ${isWholesale ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                    {formatCurrency(wholesalePrice)}
                  </span>
                </div>
              </div>

              {/* Descripción corta si existe */}
              {product.description && (
                <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1">Descripción del producto</summary><p className="mt-1 leading-relaxed">{product.description}</p></details>
              )}

              {creditPlans.length > 0 && (
                <section className="space-y-2" aria-labelledby="product-credit-plans-title">
                  <div>
                    <h3 id="product-credit-plans-title" className="flex items-center gap-1.5 text-sm font-semibold">
                      <CreditCard className="h-4 w-4 text-sky-600" aria-hidden="true" />
                      Opciones de crédito
                    </h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      El plan seleccionado se aplicará al total financiado del ticket.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {creditPlans.map((plan) => {
                      const requirements = buildCreditEligibility({
                        ...creditContext,
                        financedTotal: plan.financedTotal,
                        stock,
                        quantity,
                      })
                      const ready = requirements.every(requirement => requirement.met)

                      return (
                        <article key={`${plan.count}-${plan.rate}`} className="rounded-md border border-sky-500/20 bg-sky-500/5 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-semibold text-sky-900 dark:text-sky-100">{plan.count} cuotas</h4>
                              <p className="text-base font-bold text-primary">{formatCurrency(plan.installmentAmount)}<span className="text-xs font-normal text-muted-foreground">/mes</span></p>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {plan.rate === 0 ? 'Sin interés' : `Tasa ${plan.rate}%`}
                            </Badge>
                          </div>
                          <dl className="mt-1.5 grid grid-cols-2 gap-1 text-xs">
                            <div><dt className="text-muted-foreground">Interés</dt><dd className="font-medium">{formatCurrency(plan.interestAmount)}</dd></div>
                            <div><dt className="text-muted-foreground">Total financiado</dt><dd className="font-medium">{formatCurrency(plan.financedTotal)}</dd></div>
                          </dl>
                          <details className="mt-2 text-xs">
                            <summary className={`cursor-pointer rounded py-1 font-medium ${ready ? 'text-muted-foreground' : 'text-amber-800 dark:text-amber-300'}`}>{ready ? 'Requisitos completos' : `${requirements.filter(requirement => !requirement.met).length} requisitos pendientes`}</summary>
                          <ul className="mt-1 space-y-1" aria-label={`Requisitos para ${plan.count} cuotas`}>
                            {requirements.map(requirement => (
                              <li key={requirement.id} className="flex items-start gap-1 text-xs">
                                {requirement.met
                                  ? <CircleCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
                                  : <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />}
                                <span className={requirement.met ? 'text-muted-foreground' : 'font-medium text-amber-800 dark:text-amber-300'}>{requirement.detail}</span>
                              </li>
                            ))}
                          </ul>
                          </details>
                          <Button
                            type="button"
                            variant={ready ? 'default' : 'outline'}
                            className="mt-2 h-10 sm:h-8 w-full text-xs"
                            disabled={isOutOfStock || quantity > stock}
                            onClick={() => handleUseCreditPlan(plan)}
                            aria-label={`Usar plan de ${plan.count} cuotas`}
                          >
                            Usar este plan
                          </Button>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* Selector de Cantidad & Botón Agregar */}
            <div className="sticky bottom-0 bg-card pt-2 pb-3 border-t border-border/50 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-foreground">Cantidad a cobrar:</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    aria-label="Reducir cantidad"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || isOutOfStock}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    aria-label="Cantidad a cobrar"
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
                    aria-label="Aumentar cantidad"
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
                  onClick={() => handleDialogOpenChange(false)}
                  className="h-10 text-xs"
                >
                  Cerrar
                </Button>
                <Button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  size="sm"
                  className="flex-1 h-10 gap-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
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
