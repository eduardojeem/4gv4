'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ProductWithVariants,
  ProductVariant,
  VariantAttributeValue,
} from '@/types/product-variants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency as defaultFormatCurrency } from '@/lib/currency'
import { resolveProductImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import {
  Package,
  Check,
  AlertTriangle,
  ShoppingCart,
  Plus,
  Minus,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  CheckCircle2,
  Sparkles,
  Barcode,
  Layers,
} from 'lucide-react'

interface VariantSelectorProps {
  product: ProductWithVariants
  isOpen: boolean
  onClose: () => void
  onAddToCart: (variant: ProductVariant, quantity: number) => void
  formatCurrency?: (amount: number) => string
}

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

export function VariantSelector({
  product,
  isOpen,
  onClose,
  onAddToCart,
  formatCurrency = defaultFormatCurrency,
}: VariantSelectorProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState<'attributes' | 'catalog'>('attributes')
  const [searchQuery, setSearchQuery] = useState('')

  // Lista de todas las variantes activas o disponibles
  const allVariants = useMemo(() => {
    return (product.variants || []).filter(v => v.active !== false)
  }, [product.variants])

  // Obtener atributos únicos del producto con sus opciones deduplicadas
  const productAttributes = useMemo(() => {
    if (!product.variants || product.variants.length === 0) return []

    const attributeMap = new Map<
      string,
      {
        id: string
        name: string
        isColor: boolean
        optionsMap: Map<string, { id: string; name: string; colorHex?: string }>
      }
    >()

    product.variants.forEach(variant => {
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

    // Ordenar atributos: Color primero, luego Talle/Size, luego otros
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
  }, [product.variants])

  // Auto-selección inicial inteligente: si un atributo tiene solo 1 opción, seleccionarlo
  useEffect(() => {
    if (isOpen && productAttributes.length > 0) {
      setSelectedAttributes(prev => {
        const next = { ...prev }
        let changed = false
        productAttributes.forEach(attr => {
          if (!next[attr.id] && attr.options.length === 1) {
            next[attr.id] = attr.options[0].id
            changed = true
          }
        })
        return changed ? next : prev
      })
    }
  }, [isOpen, productAttributes])

  // Reset al cerrar o cambiar producto
  const handleClose = useCallback(() => {
    setSelectedAttributes({})
    setQuantity(1)
    setSearchQuery('')
    setActiveTab('attributes')
    onClose()
  }, [onClose])

  // Obtener variantes que coinciden con los atributos actualmente seleccionados
  const availableVariants = useMemo(() => {
    if (!product.variants) return []

    return product.variants.filter(variant => {
      return variant.attributes?.every((av: VariantAttributeValue) => {
        const selectedValue = selectedAttributes[av.attribute_id]
        return !selectedValue || selectedValue === (av.option_id || av.value)
      })
    })
  }, [product.variants, selectedAttributes])

  // Obtener la variante exacta seleccionada (cuando todos los atributos tienen valor)
  const selectedVariant = useMemo(() => {
    if (!product.variants) return null

    const attributeKeys = Object.keys(selectedAttributes)
    if (attributeKeys.length === 0 || attributeKeys.length < productAttributes.length) {
      return null
    }

    return product.variants.find(variant => {
      const matchesAll = productAttributes.every(attr => {
        const selectedVal = selectedAttributes[attr.id]
        const attrVal = variant.attributes?.find(
          (av: VariantAttributeValue) => av.attribute_id === attr.id
        )
        return attrVal && selectedVal === (attrVal.option_id || attrVal.value)
      })
      return matchesAll
    }) || null
  }, [product.variants, selectedAttributes, productAttributes])

  // Rango de precios y stock total
  const { minPrice, maxPrice, totalStock } = useMemo(() => {
    const productStock = (product as { stock_quantity?: number }).stock_quantity || 0
    if (!allVariants.length) {
      const base = product.base_price || 0
      return { minPrice: base, maxPrice: base, totalStock: productStock }
    }
    const prices = allVariants.map(v => v.price)
    const stocks = allVariants.map(v => v.stock || 0)
    return {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      totalStock: stocks.reduce((acc, curr) => acc + curr, 0),
    }
  }, [allVariants, product.base_price, product])

  // Imagen activa a mostrar (si la variante seleccionada tiene imagen, priorizarla)
  const activeImageSrc = useMemo(() => {
    if (selectedVariant?.images?.[0]) {
      return resolveProductImageUrl(selectedVariant.images[0])
    }
    const fallback = (product as { image?: string }).image || product.images?.[0]
    return fallback ? resolveProductImageUrl(fallback) : ''
  }, [selectedVariant, product])

  // Manejar selección de opción de atributo
  const handleOptionSelect = (attributeId: string, optionId: string) => {
    setSelectedAttributes(prev => ({
      ...prev,
      [attributeId]: optionId,
    }))
  }

  // Manejar selección directa desde catálogo de variantes
  const handleSelectDirectVariant = (variant: ProductVariant) => {
    const nextAttributes: Record<string, string> = {}
    variant.attributes?.forEach(av => {
      if (av.attribute_id) {
        nextAttributes[av.attribute_id] = av.option_id || av.value
      }
    })
    setSelectedAttributes(nextAttributes)
    setActiveTab('attributes')
  }

  // Comprobar si una opción de atributo tiene stock para los filtros cruzados actuales
  const getOptionAvailability = (attributeId: string, optionId: string) => {
    // Buscar si existe al menos una variante con esta opción y con las otras opciones seleccionadas
    const matchingVariants = allVariants.filter(v => {
      const hasThisOption = v.attributes?.some(
        av => av.attribute_id === attributeId && (av.option_id || av.value) === optionId
      )
      if (!hasThisOption) return false

      // Verificar compatibilidad con los otros atributos ya seleccionados
      for (const [otherAttrId, otherOptId] of Object.entries(selectedAttributes)) {
        if (otherAttrId === attributeId) continue
        const matchesOther = v.attributes?.some(
          av => av.attribute_id === otherAttrId && (av.option_id || av.value) === otherOptId
        )
        if (!matchesOther) return false
      }
      return true
    })

    const totalAvailable = matchingVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
    return {
      exists: matchingVariants.length > 0,
      stock: totalAvailable,
      hasStock: totalAvailable > 0,
    }
  }

  // Filtrado para la pestaña de catálogo completo
  const filteredCatalogVariants = useMemo(() => {
    if (!searchQuery.trim()) return allVariants
    const q = searchQuery.toLowerCase().trim()
    return allVariants.filter(v => {
      const nameMatch = v.name?.toLowerCase().includes(q)
      const skuMatch = v.sku?.toLowerCase().includes(q)
      const attrMatch = v.attributes?.some(
        av =>
          av.value?.toLowerCase().includes(q) ||
          av.display_value?.toLowerCase().includes(q)
      )
      return Boolean(nameMatch || skuMatch || attrMatch)
    })
  }, [allVariants, searchQuery])

  // Confirmar y agregar al carrito
  const canAddToCart = selectedVariant && selectedVariant.stock >= quantity && quantity > 0

  const handleConfirm = () => {
    if (canAddToCart && selectedVariant) {
      onAddToCart(selectedVariant, quantity)
      handleClose()
    }
  }

  // Atajo de teclado: Enter para agregar
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canAddToCart) {
      e.preventDefault()
      handleConfirm()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent
        onKeyDown={handleKeyDown}
        className="max-h-[92dvh] w-[calc(100vw-1.5rem)] sm:max-w-2xl overflow-hidden p-0 gap-0 border-border/80 shadow-2xl bg-card rounded-2xl flex flex-col"
      >
        {/* Header Elegante POS */}
        <DialogHeader className="px-5 py-3.5 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm sm:text-base font-bold tracking-tight">
                  Seleccionar Variante
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 h-4 bg-background">
                  {allVariants.length} variantes
                </Badge>
              </div>
              <DialogDescription className="sr-only">
                Selecciona la variante de {product.name} y la cantidad a vender.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Cuerpo con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Card Resumen de Producto */}
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex gap-3 items-center">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-lg bg-background border border-border/60 flex items-center justify-center shrink-0 overflow-hidden relative">
              {activeImageSrc ? (
                <img
                  src={activeImageSrc}
                  alt={product.name}
                  className="h-full w-full object-contain p-1 transition-all duration-200"
                />
              ) : (
                <Package className="h-7 w-7 text-muted-foreground/40" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm text-foreground line-clamp-2 leading-snug">
                {product.name}
              </h3>
              
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {product.brand && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {product.brand}
                  </span>
                )}
                {product.category_id && (
                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4 font-normal">
                    {product.category_id}
                  </Badge>
                )}
              </div>

              {/* Precio y Stock Global */}
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-primary">
                    {selectedVariant
                      ? formatCurrency(selectedVariant.price)
                      : minPrice === maxPrice
                      ? formatCurrency(minPrice)
                      : `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`}
                  </span>
                  {selectedVariant && selectedVariant.price !== product.base_price && product.base_price && (
                    <span className="text-[10px] text-muted-foreground line-through">
                      {formatCurrency(product.base_price)}
                    </span>
                  )}
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] h-4.5 px-2 font-medium border-0",
                    selectedVariant
                      ? selectedVariant.stock > 5
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : selectedVariant.stock > 0
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                      : totalStock > 0
                      ? "bg-muted text-muted-foreground"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                  )}
                >
                  {selectedVariant
                    ? selectedVariant.stock > 0
                      ? `${selectedVariant.stock} disp.`
                      : 'Agotado'
                    : `Total: ${totalStock} unid.`}
                </Badge>
              </div>
            </div>
          </div>

          {/* Navegación por Pestañas */}
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'attributes' | 'catalog')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8 p-0.5 bg-muted/60 rounded-lg">
              <TabsTrigger value="attributes" className="text-xs h-7 gap-1.5 data-[state=active]:bg-background">
                <SlidersHorizontal className="h-3 w-3" />
                Por Atributos
              </TabsTrigger>
              <TabsTrigger value="catalog" className="text-xs h-7 gap-1.5 data-[state=active]:bg-background">
                <LayoutGrid className="h-3 w-3" />
                Catálogo Rápido ({allVariants.length})
              </TabsTrigger>
            </TabsList>

            {/* Pestaña 1: Selección Interactiva de Atributos */}
            <TabsContent value="attributes" className="mt-3 space-y-4">
              {productAttributes.map(attribute => {
                const selectedValueId = selectedAttributes[attribute.id]
                const selectedOption = attribute.options.find(o => o.id === selectedValueId)

                return (
                  <div key={attribute.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {attribute.name}
                        {selectedOption && (
                          <span className="text-primary font-normal text-xs">
                            — <strong className="font-semibold">{selectedOption.name}</strong>
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {attribute.options.length} opciones
                      </span>
                    </div>

                    {/* Renderizado Especial para Colores */}
                    {attribute.isColor ? (
                      <div className="flex flex-wrap gap-2">
                        {attribute.options.map(option => {
                          const isSelected = selectedValueId === option.id
                          const availability = getOptionAvailability(attribute.id, option.id)
                          const colorHex = option.colorHex

                          return (
                            <button
                              key={`${attribute.id}-${option.id}`}
                              type="button"
                              onClick={() => handleOptionSelect(attribute.id, option.id)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                "border shadow-2xs hover:scale-102 active:scale-98",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30 font-semibold"
                                  : availability.hasStock
                                  ? "bg-background text-foreground border-border hover:border-primary/60 hover:bg-muted/40"
                                  : "bg-muted/40 text-muted-foreground/60 border-border/40 opacity-60"
                              )}
                              title={
                                availability.hasStock
                                  ? `${option.name} (${availability.stock} disp.)`
                                  : `${option.name} (Sin stock)`
                              }
                            >
                              {colorHex && (
                                <span
                                  className={cn(
                                    "h-3.5 w-3.5 rounded-full border shrink-0",
                                    isSelected ? "border-white" : "border-black/20"
                                  )}
                                  style={{ backgroundColor: colorHex }}
                                />
                              )}
                              <span>{option.name}</span>
                              {isSelected && <Check className="h-3 w-3 ml-0.5 shrink-0" />}
                              {!availability.hasStock && (
                                <span className="text-[9px] opacity-75 font-normal ml-0.5">
                                  (0)
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      /* Renderizado de Botones / Pills para Talle u otros */
                      <div className="flex flex-wrap gap-2">
                        {attribute.options.map(option => {
                          const isSelected = selectedValueId === option.id
                          const availability = getOptionAvailability(attribute.id, option.id)

                          return (
                            <button
                              key={`${attribute.id}-${option.id}`}
                              type="button"
                              onClick={() => handleOptionSelect(attribute.id, option.id)}
                              className={cn(
                                "min-w-[44px] h-9 px-3 rounded-lg text-xs font-medium transition-all",
                                "border flex items-center justify-center gap-1 hover:scale-102 active:scale-98 shadow-2xs",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30 font-bold"
                                  : availability.hasStock
                                  ? "bg-background text-foreground border-border hover:border-primary/60 hover:bg-muted/40"
                                  : "bg-muted/30 text-muted-foreground/50 border-dashed border-border/50 line-through"
                              )}
                              title={
                                availability.hasStock
                                  ? `${option.name} (${availability.stock} disp.)`
                                  : `${option.name} (Sin stock)`
                              }
                            >
                              <span>{option.name}</span>
                              {isSelected && <Check className="h-3 w-3 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Mensaje de guía si faltan atributos */}
              {productAttributes.length > 0 &&
                Object.keys(selectedAttributes).length < productAttributes.length && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>Selecciona todas las opciones requeridas para fijar la variante.</span>
                  </div>
                )}
            </TabsContent>

            {/* Pestaña 2: Catálogo Directo con Búsqueda */}
            <TabsContent value="catalog" className="mt-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por color, talle, SKU..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>

              <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                {filteredCatalogVariants.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No se encontraron variantes que coincidan.
                  </div>
                ) : (
                  filteredCatalogVariants.map(variant => {
                    const isSelected = selectedVariant?.id === variant.id
                    const inStock = (variant.stock || 0) > 0

                    return (
                      <div
                        key={variant.id}
                        onClick={() => handleSelectDirectVariant(variant)}
                        className={cn(
                          "p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs",
                          isSelected
                            ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xs"
                            : inStock
                            ? "border-border/70 hover:border-primary/40 hover:bg-muted/30"
                            : "border-border/40 bg-muted/20 opacity-60"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground truncate">
                              {variant.name || `Variante SKU ${variant.sku}`}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className="font-mono">{variant.sku || 'Sin SKU'}</span>
                            {variant.barcode && (
                              <span className="flex items-center gap-0.5 font-mono">
                                <Barcode className="h-3 w-3" /> {variant.barcode}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-bold text-primary">
                            {formatCurrency(variant.price)}
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-medium",
                              variant.stock > 5
                                ? "text-emerald-600 dark:text-emerald-400"
                                : variant.stock > 0
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {inStock ? `${variant.stock} en stock` : 'Sin stock'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Tarjeta de Variante Confirmada y Cantidad */}
          {selectedVariant && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>Variante: {selectedVariant.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground block ml-5.5">
                    SKU: {selectedVariant.sku || 'N/A'}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-primary block">
                    {formatCurrency(selectedVariant.price)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">por unidad</span>
                </div>
              </div>

              {/* Selector de Cantidad */}
              <div className="pt-2 border-t border-primary/20 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Cantidad:</span>
                  <div className="flex items-center rounded-lg border border-border bg-background shadow-2xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="h-7 w-7 rounded-none rounded-l-lg hover:bg-muted"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={selectedVariant.stock}
                      value={quantity}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10) || 1
                        setQuantity(Math.max(1, Math.min(selectedVariant.stock || 1, val)))
                      }}
                      className="h-7 w-12 border-0 text-center font-bold text-xs p-0 focus-visible:ring-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuantity(Math.min(selectedVariant.stock, quantity + 1))}
                      disabled={quantity >= selectedVariant.stock}
                      className="h-7 w-7 rounded-none rounded-r-lg hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Botones Presets Rápidos */}
                  {selectedVariant.stock > 1 && (
                    <div className="flex items-center gap-1">
                      {[2, 5, 10].map(qty => {
                        if (selectedVariant.stock < qty) return null
                        return (
                          <button
                            key={qty}
                            type="button"
                            onClick={() => setQuantity(qty)}
                            className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors",
                              quantity === qty
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                            )}
                          >
                            +{qty}
                          </button>
                        )
                      })}
                      {selectedVariant.stock > 10 && (
                        <button
                          type="button"
                          onClick={() => setQuantity(selectedVariant.stock)}
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors",
                            quantity === selectedVariant.stock
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          )}
                        >
                          Máx ({selectedVariant.stock})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Subtotal Calculado */}
                <div className="text-right ml-auto">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Subtotal
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {formatCurrency(selectedVariant.price * quantity)}
                  </span>
                </div>
              </div>

              {/* Alerta de Stock insuficiente si aplica */}
              {selectedVariant.stock <= 0 && (
                <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-2 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Esta variante se encuentra agotada temporalmente.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div className="p-3.5 sm:p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="text-xs h-9 px-4"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canAddToCart}
            className={cn(
              "flex-1 text-xs h-9 font-semibold gap-2 transition-all shadow-sm",
              canAddToCart
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "opacity-60"
            )}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {selectedVariant
              ? canAddToCart
                ? `Agregar al Carrito • ${formatCurrency(selectedVariant.price * quantity)}`
                : 'Sin stock suficiente'
              : 'Selecciona una variante'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
