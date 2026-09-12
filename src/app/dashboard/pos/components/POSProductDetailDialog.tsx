'use client'

import React, { useState, useMemo, useEffect } from 'react'
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
  Layers,
  CheckCircle2,
} from 'lucide-react'
import { formatCurrency as defaultFormatCurrency } from '@/lib/currency'
import { resolveProductImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Product } from '@/types/product-unified'
import type { ProductVariant, ProductWithVariants, VariantAttributeValue } from '@/types/product-variants'
import { getProductCreditPlans, type ProductCreditPlan } from '../lib/product-credit'
import { buildCreditEligibility } from '../lib/credit-eligibility'

const COLOR_HEX_MAP: Record<string, string> = {
  blanco: '#ffffff',
  white: '#ffffff',
  negro: '#18181b',
  black: '#18181b',
  gris: '#9ca3af',
  grey: '#9ca3af',
  gray: '#9ca3af',
  beige: '#d4b996',
  'azul marino': '#0f172a',
  marino: '#0f172a',
  navy: '#0f172a',
  azul: '#2563eb',
  blue: '#2563eb',
  rojo: '#dc2626',
  red: '#dc2626',
  verde: '#16a34a',
  green: '#16a34a',
  rosa: '#f472b6',
  rosado: '#f472b6',
  pink: '#f472b6',
  amarillo: '#eab308',
  yellow: '#eab308',
  naranja: '#f97316',
  orange: '#f97316',
  marron: '#78350f',
  marrón: '#78350f',
  brown: '#78350f',
  bordo: '#831843',
  bordó: '#831843',
  vino: '#581c87',
  celeste: '#38bdf8',
  morado: '#7c3aed',
  purpura: '#7c3aed',
  lila: '#c084fc',
  oliva: '#65a30d',
}

function resolveColorHex(colorName: string, explicitHex?: string): string | null {
  if (explicitHex && explicitHex.trim().length > 0) return explicitHex.trim()
  const lower = colorName.toLowerCase().trim()
  return COLOR_HEX_MAP[lower] || null
}

interface POSProductDetailDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart: (product: Product, quantity: number) => void
  onAddVariantToCart?: (variant: ProductVariant, quantity: number) => void
  onOpenVariantSelector?: (product: ProductWithVariants) => void
  getProductWithVariants?: (productId: string) => ProductWithVariants | undefined
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
  formatCurrency?: (amount: number) => string
}

export function POSProductDetailDialog({
  product,
  open,
  onOpenChange,
  onAddToCart,
  onAddVariantToCart,
  onOpenVariantSelector,
  getProductWithVariants,
  creditContext,
  onUseCreditPlan,
  isWholesale = false,
  wholesaleDiscountRate = 10,
  autoScrollToCredit = false,
  formatCurrency = defaultFormatCurrency,
}: POSProductDetailDialogProps) {
  const [quantity, setQuantity] = useState(1)
  const [copiedBarcode, setCopiedBarcode] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})

  // Obtener producto enriquecido con variantes
  const productWithVariants = useMemo<ProductWithVariants | null>(() => {
    if (!product) return null
    if (getProductWithVariants) {
      const p = getProductWithVariants(product.id)
      if (p && p.variants && p.variants.length > 0) return p
    }
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      const mappedVariants: ProductVariant[] = (product.variants as any[]).map(v => ({
        id: v.id,
        product_id: product.id,
        sku: v.sku || '',
        barcode: v.barcode ?? undefined,
        name: v.variant_name || v.name || `${product.name} - ${v.sku}`,
        attributes: Array.isArray(v.attributes)
          ? v.attributes
          : typeof v.attributes === 'object' && v.attributes
          ? Object.entries(v.attributes).map(([k, val]) => ({
              attribute_id: k,
              attribute_name: k,
              option_id: String(val),
              value: String(val),
            }))
          : [],
        price: Number(v.sale_price ?? product.sale_price ?? 0),
        wholesale_price: v.wholesale_price != null ? Number(v.wholesale_price) : undefined,
        cost_price: v.purchase_price != null ? Number(v.purchase_price) : undefined,
        stock: Number(v.stock_quantity ?? v.stock ?? 0),
        min_stock: Number(v.min_stock ?? 0),
        active: v.is_active !== false,
        images: v.images,
        created_at: v.created_at || new Date().toISOString(),
        updated_at: v.updated_at || new Date().toISOString(),
      }))

      return {
        id: product.id,
        name: product.name,
        base_price: product.sale_price,
        has_variants: true,
        variant_attributes: [],
        variants: mappedVariants,
      } as ProductWithVariants
    }
    return null
  }, [product, getProductWithVariants])

  const hasVariants = Boolean(productWithVariants && productWithVariants.variants && productWithVariants.variants.length > 0)
  const activeVariants = useMemo(() => {
    return (productWithVariants?.variants || []).filter(v => v.active !== false)
  }, [productWithVariants])

  // Atributos agrupados únicos con opciones deduplicadas
  const groupedAttributes = useMemo(() => {
    if (!hasVariants || !productWithVariants?.variants) return []

    const attributeMap = new Map<
      string,
      {
        id: string
        name: string
        isColor: boolean
        optionsMap: Map<string, { id: string; name: string; colorHex?: string }>
      }
    >()

    productWithVariants.variants.forEach(variant => {
      variant.attributes?.forEach((av: VariantAttributeValue) => {
        if (!av?.attribute_id) return
        const attrId = av.attribute_id
        const attrName = av.attribute_name || attrId
        const isColor =
          attrName.toLowerCase().includes('color') ||
          attrId.toLowerCase().includes('color')

        if (!attributeMap.has(attrId)) {
          attributeMap.set(attrId, {
            id: attrId,
            name: attrName,
            isColor,
            optionsMap: new Map(),
          })
        }

        const attr = attributeMap.get(attrId)!
        const optionId = av.option_id || av.value
        if (optionId && !attr.optionsMap.has(optionId)) {
          const optionName = av.display_value || av.value || optionId
          const hex = resolveColorHex(optionName, av.color_hex)
          attr.optionsMap.set(optionId, {
            id: optionId,
            name: optionName,
            colorHex: hex || undefined,
          })
        }
      })
    })

    const rank = (name: string) => {
      const lower = name.toLowerCase()
      if (lower.includes('color')) return 0
      if (lower.includes('talle') || lower.includes('size') || lower.includes('talla')) return 1
      return 2
    }

    return Array.from(attributeMap.values())
      .sort((a, b) => rank(a.name) - rank(b.name))
      .map(attr => ({
        id: attr.id,
        name: attr.name,
        isColor: attr.isColor,
        options: Array.from(attr.optionsMap.values()),
      }))
  }, [hasVariants, productWithVariants])

  // Auto-scroll a la seccion de creditos si se requiere
  useEffect(() => {
    if (open && autoScrollToCredit) {
      setTimeout(() => {
        const el = document.getElementById('product-credit-plans-title')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 150)
    }
  }, [open, autoScrollToCredit])

  // Reset al abrir o cerrar
  useEffect(() => {
    if (open) {
      setSelectedVariant(null)
      setSelectedAttributes({})
      setQuantity(1)
      setCopiedBarcode(false)
    }
  }, [open, product?.id])

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuantity(1)
      setCopiedBarcode(false)
      setSelectedVariant(null)
      setSelectedAttributes({})
    }
    onOpenChange(nextOpen)
  }

  // Sincronizar selección de atributo con variante correspondiente
  const handleAttributeSelect = (attributeId: string, optionId: string) => {
    const updated = {
      ...selectedAttributes,
      [attributeId]: optionId,
    }
    setSelectedAttributes(updated)

    // Buscar si hay una variante exacta que coincida con todos los atributos seleccionados
    if (productWithVariants?.variants) {
      const matching = productWithVariants.variants.find(variant => {
        return groupedAttributes.every(attr => {
          const expectedVal = updated[attr.id]
          if (!expectedVal) return false
          const attrVal = variant.attributes?.find(
            (av: VariantAttributeValue) => av.attribute_id === attr.id
          )
          return attrVal && expectedVal === (attrVal.option_id || attrVal.value)
        })
      })
      if (matching) {
        setSelectedVariant(matching)
      } else {
        setSelectedVariant(null)
      }
    }
  }

  // Selección directa de variante
  const handleDirectSelect = (v: ProductVariant) => {
    setSelectedVariant(v)
    const newAttrs: Record<string, string> = {}
    v.attributes?.forEach(av => {
      if (av.attribute_id) {
        newAttrs[av.attribute_id] = av.option_id || av.value
      }
    })
    setSelectedAttributes(newAttrs)
  }

  // Imagen activa (variante > producto)
  const imageSrc = useMemo(() => {
    if (selectedVariant?.images?.[0]) {
      return resolveProductImageUrl(selectedVariant.images[0])
    }
    return product?.image ? resolveProductImageUrl(product.image) : ''
  }, [selectedVariant, product?.image])

  // Planes de crédito
  const creditProductProxy = useMemo(() => {
    if (!product) return null
    if (hasVariants && selectedVariant) {
      return { ...product, sale_price: selectedVariant.price }
    }
    return product
  }, [hasVariants, selectedVariant, product])

  // Stock consolidado o de la variante
  const totalVariantsStock = activeVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
  const stock = hasVariants
    ? selectedVariant
      ? selectedVariant.stock
      : totalVariantsStock
    : product?.stock_quantity ?? 0

  const minStock = product?.min_stock ?? 5
  const isOutOfStock = stock <= 0
  const basePrice = product?.sale_price || 0
  const activeUnitSalePrice = hasVariants && selectedVariant ? selectedVariant.price : basePrice

  const hasExplicitWholesale =
    typeof product?.wholesale_price === 'number' && product.wholesale_price > 0
  const computedWholesale = Math.round(activeUnitSalePrice * (1 - wholesaleDiscountRate / 100))
  const wholesalePrice = hasVariants && selectedVariant && typeof selectedVariant.wholesale_price === 'number'
    ? selectedVariant.wholesale_price
    : hasExplicitWholesale
    ? product?.wholesale_price!
    : computedWholesale

  const activePrice = isWholesale ? wholesalePrice : activeUnitSalePrice

  // SKU y código de barras activos
  const activeSku = selectedVariant?.sku || product?.sku
  const activeBarcode = selectedVariant?.barcode || product?.barcode

  const creditPlans = creditProductProxy
    ? getProductCreditPlans(creditProductProxy, activePrice * quantity)
    : []

  const handleCopyBarcode = () => {
    if (activeBarcode) {
      navigator.clipboard.writeText(activeBarcode)
      setCopiedBarcode(true)
      toast.success('Código de barras copiado')
      setTimeout(() => setCopiedBarcode(false), 2000)
    }
  }

  const handleAddToCart = () => {
    if (hasVariants) {
      if (!selectedVariant) {
        toast.info('Selecciona una variante para agregar al ticket', {
          description: 'Puedes pulsar sobre cualquiera de las variantes disponibles abajo.',
        })
        const el = document.getElementById('pos-product-variants-section')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      if (selectedVariant.stock <= 0) {
        toast.error('La variante seleccionada no tiene stock disponible')
        return
      }

      if (quantity <= 0) return

      if (onAddVariantToCart) {
        onAddVariantToCart(selectedVariant, quantity)
      } else {
        onAddToCart(
          {
            ...product,
            sku: selectedVariant.sku || product.sku,
            sale_price: selectedVariant.price,
          },
          quantity
        )
      }

      toast.success(`Agregado al carrito (${quantity} u.)`, {
        description: `${selectedVariant.name} — ${formatCurrency(activePrice * quantity)}`,
      })
      handleDialogOpenChange(false)
      return
    }

    if (isOutOfStock) {
      toast.error('Producto sin stock disponible')
      return
    }
    if (quantity <= 0) return
    onAddToCart(product, quantity)
    toast.success(`Agregado al carrito (${quantity} u.)`, {
      description: `${product.name} — ${formatCurrency(activePrice * quantity)}`,
    })
    handleDialogOpenChange(false)
  }

  const handleUseCreditPlan = (plan: ProductCreditPlan) => {
    if (hasVariants && !selectedVariant) {
      toast.info('Selecciona una variante para financiar con este plan')
      const el = document.getElementById('pos-product-variants-section')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (isOutOfStock || quantity > stock) {
      toast.error('No hay stock suficiente para aplicar este plan')
      return
    }

    if (hasVariants && selectedVariant && onAddVariantToCart) {
      onAddVariantToCart(selectedVariant, quantity)
      onUseCreditPlan(
        {
          ...product,
          sku: selectedVariant.sku || product.sku,
          sale_price: selectedVariant.price,
        },
        quantity,
        plan
      )
    } else {
      onUseCreditPlan(product, quantity, plan)
    }

    handleDialogOpenChange(false)
  }

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[88dvh] w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-w-2xl bg-card border-border/80 shadow-xl">
        <div className="max-h-[88dvh] overflow-y-auto">
          {/* Encabezado: Imagen & Badges */}
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
                  className="w-full h-full object-contain p-1.5 transition-all duration-200"
                />
              ) : (
                <Package className="h-7 w-7 text-muted-foreground/50" />
              )}
            </div>

            {/* Estado de Stock en Badge */}
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="break-words text-base font-semibold leading-snug">
                  {product.name}
                </DialogTitle>
                {hasVariants && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold gap-1 shrink-0">
                    <Layers className="h-2.5 w-2.5" /> {activeVariants.length} var.
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={cn(
                    "py-0.5 text-xs font-medium",
                    isOutOfStock
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                      : stock <= minStock
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  )}
                >
                  {selectedVariant
                    ? selectedVariant.stock > 0
                      ? `Variante: ${selectedVariant.stock} u. en stock`
                      : 'Variante agotada'
                    : hasVariants
                    ? `Total: ${totalVariantsStock} u. disp.`
                    : isOutOfStock
                    ? 'Sin Stock'
                    : stock <= minStock
                    ? `Stock Bajo (${stock} u.)`
                    : `Disponible: ${stock} u.`}
                </Badge>
              </div>
            </div>
          </div>

          {/* Detalles & Acciones de Compra */}
          <div className="px-3 pt-3 sm:px-4 flex flex-col space-y-3">
            <div className="space-y-2">
              <DialogDescription className="sr-only">
                Revisá el producto, seleccioná variantes si corresponde y agregalo a la venta.
              </DialogDescription>

              {/* Categoría & SKU */}
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                {product.category?.name && (
                  <Badge variant="outline" className="text-xs bg-muted/40 font-normal">
                    <Tag className="h-3 w-3 mr-1 text-primary" />
                    {product.category.name}
                  </Badge>
                )}
                {activeSku && (
                  <Badge variant="outline" className="text-xs font-mono bg-muted/40 font-normal">
                    SKU: {activeSku}
                  </Badge>
                )}
                {product.is_active === false && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <EyeOff className="h-3 w-3" /> Oculto en catálogo
                  </Badge>
                )}
              </div>

              {/* Código de barras si existe */}
              {activeBarcode && (
                <div className="flex items-center gap-2 text-xs bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 w-fit">
                  <Barcode className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground">{activeBarcode}</span>
                  <button
                    type="button"
                    onClick={handleCopyBarcode}
                    className="ml-1 text-muted-foreground hover:text-foreground p-0.5 rounded"
                    title="Copiar código de barras"
                  >
                    {copiedBarcode ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}

              {/* Tarjeta de Precios */}
              <div className="bg-muted/30 p-2 rounded-md border border-border/60 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    {selectedVariant ? 'Precio Variante' : 'Precio Minorista'}
                  </span>
                  <span
                    className={`text-base font-semibold ${
                      !isWholesale ? 'text-primary' : 'text-muted-foreground line-through text-sm'
                    }`}
                  >
                    {formatCurrency(activeUnitSalePrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground block flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" /> Precio Mayorista
                  </span>
                  <span
                    className={`text-base font-semibold ${
                      isWholesale ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                    }`}
                  >
                    {formatCurrency(wholesalePrice)}
                  </span>
                </div>
              </div>

              {/* SECCIÓN ESPECIAL: VARIANTES DEL PRODUCTO */}
              {hasVariants && productWithVariants && (
                <div
                  id="pos-product-variants-section"
                  className="rounded-xl border border-primary/25 bg-primary/5 p-3 sm:p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <Layers className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="text-xs font-bold text-foreground">
                        Variantes Disponibles ({activeVariants.length})
                      </h3>
                    </div>

                    {onOpenVariantSelector && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenVariantSelector(productWithVariants)}
                        className="h-6.5 text-[10px] px-2 gap-1 bg-background hover:bg-muted"
                      >
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        Selector Táctil
                      </Button>
                    )}
                  </div>

                  {/* Variante seleccionada actualmente */}
                  {selectedVariant ? (
                    <div className="rounded-lg border border-primary/40 bg-background p-2.5 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-foreground truncate">
                            {selectedVariant.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span className="font-mono">SKU: {selectedVariant.sku || 'N/A'}</span>
                          <span>•</span>
                          <span
                            className={
                              selectedVariant.stock > 0
                                ? 'text-emerald-600 font-semibold'
                                : 'text-rose-600 font-semibold'
                            }
                          >
                            {selectedVariant.stock > 0
                              ? `${selectedVariant.stock} u. disp.`
                              : 'Sin stock'}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-primary">
                            {formatCurrency(selectedVariant.price)}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedVariant(null)
                          setSelectedAttributes({})
                        }}
                        className="h-6 text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                      >
                        Cambiar
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Selecciona las características o haz clic en cualquiera de las variantes:
                    </p>
                  )}

                  {/* Chips interactivos por atributo */}
                  {groupedAttributes.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-primary/10">
                      {groupedAttributes.map(attr => {
                        const selectedVal = selectedAttributes[attr.id]
                        return (
                          <div key={attr.id} className="space-y-1">
                            <span className="text-[11px] font-semibold text-foreground block">
                              {attr.name}:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {attr.options.map(opt => {
                                const isSelected = selectedVal === opt.id
                                const hex = opt.colorHex

                                return (
                                  <button
                                    key={`${attr.id}-${opt.id}`}
                                    type="button"
                                    onClick={() => handleAttributeSelect(attr.id, opt.id)}
                                    className={cn(
                                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 border shadow-2xs",
                                      isSelected
                                        ? "bg-primary text-primary-foreground border-primary font-bold ring-2 ring-primary/20"
                                        : "bg-background text-foreground border-border/80 hover:border-primary/50 hover:bg-muted/40"
                                    )}
                                  >
                                    {hex && (
                                      <span
                                        className={cn(
                                          "h-3 w-3 rounded-full border shrink-0",
                                          isSelected ? "border-white" : "border-black/20"
                                        )}
                                        style={{ backgroundColor: hex }}
                                      />
                                    )}
                                    <span>{opt.name}</span>
                                    {isSelected && <Check className="h-3 w-3 shrink-0" />}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Lista desplegable / rápida de variantes */}
                  <div className="space-y-1 pt-1 max-h-36 overflow-y-auto pr-1">
                    {activeVariants.map(v => {
                      const isSelected = selectedVariant?.id === v.id
                      const inStock = v.stock > 0

                      return (
                        <div
                          key={v.id}
                          onClick={() => handleDirectSelect(v)}
                          className={cn(
                            "p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs",
                            isSelected
                              ? "border-primary bg-primary/15 ring-1 ring-primary/40 font-semibold"
                              : inStock
                              ? "border-border/70 bg-background hover:border-primary/40 hover:bg-muted/30"
                              : "border-border/40 bg-muted/20 opacity-50"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="truncate text-foreground font-medium">
                                {v.name || `Variante ${v.sku}`}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground block">
                              {v.sku || 'Sin SKU'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] h-4 px-1.5 border-0 font-medium",
                                v.stock > 5
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : v.stock > 0
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                              )}
                            >
                              {inStock ? `${v.stock} u.` : '0 u.'}
                            </Badge>

                            <span className="font-bold text-primary text-xs">
                              {formatCurrency(v.price)}
                            </span>

                            <Button
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              className="h-6 text-[10px] px-2"
                            >
                              {isSelected ? 'Elegida' : 'Elegir'}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Descripción corta si existe */}
              {product.description && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer py-1">Descripción del producto</summary>
                  <p className="mt-1 leading-relaxed">{product.description}</p>
                </details>
              )}

              {/* Opciones de crédito */}
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
                    {creditPlans.map(plan => {
                      const requirements = buildCreditEligibility({
                        ...creditContext,
                        financedTotal: plan.financedTotal,
                        stock,
                        quantity,
                      })
                      const ready = requirements.every(requirement => requirement.met)

                      return (
                        <article
                          key={`${plan.count}-${plan.rate}`}
                          className="rounded-md border border-sky-500/20 bg-sky-500/5 p-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-semibold text-sky-900 dark:text-sky-100">
                                {plan.count} cuotas
                              </h4>
                              <p className="text-base font-bold text-primary">
                                {formatCurrency(plan.installmentAmount)}
                                <span className="text-xs font-normal text-muted-foreground">/mes</span>
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {plan.rate === 0 ? 'Sin interés' : `Tasa ${plan.rate}%`}
                            </Badge>
                          </div>
                          <dl className="mt-1.5 grid grid-cols-2 gap-1 text-xs">
                            <div>
                              <dt className="text-muted-foreground">Interés</dt>
                              <dd className="font-medium">{formatCurrency(plan.interestAmount)}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Total financiado</dt>
                              <dd className="font-medium">{formatCurrency(plan.financedTotal)}</dd>
                            </div>
                          </dl>
                          <details className="mt-2 text-xs">
                            <summary
                              className={`cursor-pointer rounded py-1 font-medium ${
                                ready ? 'text-muted-foreground' : 'text-amber-800 dark:text-amber-300'
                              }`}
                            >
                              {ready
                                ? 'Requisitos completos'
                                : `${requirements.filter(r => !r.met).length} requisitos pendientes`}
                            </summary>
                            <ul className="mt-1 space-y-1" aria-label={`Requisitos para ${plan.count} cuotas`}>
                              {requirements.map(requirement => (
                                <li key={requirement.id} className="flex items-start gap-1 text-xs">
                                  {requirement.met ? (
                                    <CircleCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
                                  ) : (
                                    <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
                                  )}
                                  <span
                                    className={
                                      requirement.met
                                        ? 'text-muted-foreground'
                                        : 'font-medium text-amber-800 dark:text-amber-300'
                                    }
                                  >
                                    {requirement.detail}
                                  </span>
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
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 1
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
                  disabled={hasVariants ? (selectedVariant ? selectedVariant.stock <= 0 : false) : isOutOfStock}
                  size="sm"
                  className={cn(
                    "flex-1 h-10 gap-2 text-xs font-semibold rounded-md transition-all",
                    hasVariants && !selectedVariant
                      ? "bg-primary/90 hover:bg-primary text-primary-foreground"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground"
                  )}
                >
                  {hasVariants && !selectedVariant ? (
                    <>
                      <Layers className="h-4 w-4" />
                      Seleccionar Variante para Agregar
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      Agregar al Carrito • {formatCurrency(activePrice * quantity)}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
