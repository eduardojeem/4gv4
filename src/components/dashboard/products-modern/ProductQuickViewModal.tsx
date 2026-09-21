/**
 * ProductQuickViewModal
 * Rediseño moderno, limpio y organizado del modal de vista rápida de producto.
 * Permite inspeccionar detalles, galería de fotos, métricas de inventario/costos
 * y un explorador avanzado de variantes con matriz agrupada y tabla interactiva.
 */

'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import {
  Package,
  Edit,
  ArrowUpRight,
  Tag,
  Barcode,
  Building2,
  Calendar,
  BarChart2,
  Globe,
  EyeOff,
  Star,
  Layers3,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Search,
  LayoutGrid,
  TableProperties,
  RotateCcw,
  Info,
  Boxes,
  ShieldAlert,
  Loader2,
  ZoomIn,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Product } from '@/types/products'
import { getStockStatus, isLowStock } from '@/lib/products-dashboard-utils'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useCanViewCost } from '@/hooks/use-can-view-cost'
import { resolveProductImageUrl } from '@/lib/images'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

export interface ProductQuickViewModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (product: Product) => void
  onViewFullDetails?: (product: Product) => void
  /** Imprime la etiqueta con el codigo de barras de este producto. */
  onPrintLabel?: (product: Product) => void
  /** Permite activar o desactivar el producto directamente desde el modal de detalle */
  onToggleActive?: (product: Product, newActiveState: boolean) => Promise<void> | void
}

const STOCK_LABEL: Record<'in_stock' | 'low_stock' | 'out_of_stock', { label: string; badge: string; text: string; bg: string }> = {
  in_stock: {
    label: 'En Stock',
    badge: 'bg-emerald-500 text-white',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  low_stock: {
    label: 'Stock Bajo',
    badge: 'bg-amber-500 text-white',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  out_of_stock: {
    label: 'Agotado',
    badge: 'bg-rose-500 text-white',
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
}

const COLOR_HEX_MAP: Record<string, string> = {
  blanco: '#ffffff',
  white: '#ffffff',
  negro: '#18181b',
  black: '#18181b',
  gris: '#9ca3af',
  grey: '#9ca3af',
  gray: '#9ca3af',
  'gris melange': '#d1d5db',
  beige: '#d4b996',
  'azul marino': '#0f172a',
  marino: '#0f172a',
  navy: '#0f172a',
  azul: '#2563eb',
  blue: '#2563eb',
  'azul francia': '#1d4ed8',
  'azul noche': '#1e3a8a',
  'negro grafito': '#27272a',
  rojo: '#dc2626',
  red: '#dc2626',
  verde: '#16a34a',
  green: '#16a34a',
  'verde militar': '#4d7c0f',
  'verde oliva': '#556b2f',
  rosa: '#f472b6',
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
  morado: '#7e22ce',
  purpura: '#9333ea',
  púrpura: '#9333ea',
  celeste: '#38bdf8',
  cyan: '#06b6d4',
  'color surtido': '#94a3b8',
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
}

export interface NormalizedVariant {
  id: string
  name: string
  sku?: string
  barcode?: string
  salePrice: number
  purchasePrice?: number
  wholesalePrice?: number
  stockQuantity: number
  minStock?: number
  isActive: boolean
  attributes: Record<string, string>
}

function getNormalizedVariants(product: Product): NormalizedVariant[] {
  const rawVariants = Array.isArray((product as any).variants)
    ? (product as any).variants
    : Array.isArray((product as any).product_variants)
      ? (product as any).product_variants
      : []

  return rawVariants.map((v: any, index: number) => {
    const attributes: Record<string, string> = {}
    if (v.attributes && typeof v.attributes === 'object' && !Array.isArray(v.attributes)) {
      for (const [k, val] of Object.entries(v.attributes)) {
        if (val !== undefined && val !== null) attributes[k] = String(val)
      }
    } else if (Array.isArray(v.attributes)) {
      for (const item of v.attributes) {
        if (item && typeof item === 'object') {
          const k = item.key || item.attribute_name || item.name || `attr_${index}`
          const val = item.value || item.display_value || ''
          if (k && val) attributes[String(k)] = String(val)
        }
      }
    }

    const name = v.variant_name || v.name || Object.values(attributes).join(' / ') || `Variante ${index + 1}`
    const salePrice = Number(v.sale_price ?? v.salePrice ?? product.sale_price ?? 0)
    const purchasePrice = v.purchase_price !== undefined
      ? Number(v.purchase_price)
      : v.purchasePrice !== undefined
        ? Number(v.purchasePrice)
        : undefined
    const wholesalePrice = v.wholesale_price !== undefined
      ? Number(v.wholesale_price)
      : v.wholesalePrice !== undefined
        ? Number(v.wholesalePrice)
        : undefined
    const stockQuantity = Number(v.stock_quantity ?? v.stockQuantity ?? 0)
    const minStock = v.min_stock !== undefined
      ? Number(v.min_stock)
      : v.minStock !== undefined
        ? Number(v.minStock)
        : undefined
    const isActive = v.is_active !== undefined ? Boolean(v.is_active) : v.isActive !== undefined ? Boolean(v.isActive) : true

    return {
      id: v.id || `var-${index}`,
      name,
      sku: v.sku || undefined,
      barcode: v.barcode || undefined,
      salePrice,
      purchasePrice,
      wholesalePrice,
      stockQuantity,
      minStock,
      isActive,
      attributes,
    }
  })
}

export function ProductQuickViewModal({
  product: initialProduct,
  isOpen,
  onClose,
  onEdit,
  onViewFullDetails,
  onPrintLabel,
  onToggleActive,
}: ProductQuickViewModalProps) {
  const canViewCost = useCanViewCost()

  // Dynamic product state & hydration
  const [hydratedProduct, setHydratedProduct] = useState<Product | null>(null)
  const [isLoadingHydration, setIsLoadingHydration] = useState(false)
  const [isTogglingActive, setIsTogglingActive] = useState(false)

  const handleToggleActiveClick = async () => {
    if (!product || !onToggleActive || isTogglingActive) return
    const nextState = !product.is_active
    setIsTogglingActive(true)
    try {
      await onToggleActive(product, nextState)
      setHydratedProduct((prev) => (prev ? { ...prev, is_active: nextState } : { ...product, is_active: nextState }))
    } catch (err) {
      console.error('Error al alternar estado activo:', err)
    } finally {
      setIsTogglingActive(false)
    }
  }

  // Interactive controls
  const [activeTab, setActiveTab] = useState<string>('variants')
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all')
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'matrix' | 'table'>('matrix')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isImageZoomed, setIsImageZoomed] = useState<boolean>(false)
  const [zoomPosition, setZoomPosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 })

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setZoomPosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    })
  }

  // Determine if initialProduct specifies variants
  const initialHasVariants = Boolean(
    (initialProduct as any)?.has_variants ||
    (Array.isArray((initialProduct as any)?.variants) && (initialProduct as any).variants.length > 0) ||
    (Array.isArray((initialProduct as any)?.product_variants) && (initialProduct as any).product_variants.length > 0)
  )

  // Reset state on open/product change
  useEffect(() => {
    if (isOpen && initialProduct) {
      setHydratedProduct(null)
      setSelectedImageIndex(0)
      setSearchQuery('')
      setStatusFilter('all')
      setSelectedColor(null)
      setCopiedKey(null)

      // Ensure activeTab defaults to variants if product has variants
      const hasVars = Boolean(
        (initialProduct as any).has_variants ||
        (Array.isArray((initialProduct as any).variants) && (initialProduct as any).variants.length > 0) ||
        (Array.isArray((initialProduct as any).product_variants) && (initialProduct as any).product_variants.length > 0)
      )
      setActiveTab(hasVars ? 'variants' : 'info')

      const needsHydration =
        Boolean((initialProduct as any).has_variants) &&
        (!Array.isArray((initialProduct as any).variants) || (initialProduct as any).variants.length === 0) &&
        (!Array.isArray((initialProduct as any).product_variants) || (initialProduct as any).product_variants.length === 0)

      if (needsHydration) {
        setIsLoadingHydration(true)
        fetch(`/api/products/${initialProduct.id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.success && data?.data) {
              setHydratedProduct(data.data)
            }
          })
          .catch((err) => {
            console.error('Error hydrating product variants in quick view:', err)
          })
          .finally(() => {
            setIsLoadingHydration(false)
          })
      }
    }
  }, [isOpen, initialProduct?.id])

  const product = hydratedProduct || initialProduct

  const variants = useMemo(() => (product ? getNormalizedVariants(product) : []), [product])

  const hasVariants = Boolean(
    (product as any)?.has_variants ||
    variants.length > 0 ||
    initialHasVariants
  )

  // Automatically adjust default active tab when variants finish loading
  useEffect(() => {
    if (hasVariants) {
      setActiveTab('variants')
    }
  }, [hasVariants])

  // Images list
  const imagesList = useMemo(() => {
    if (!product) return ['/placeholder-product.svg']
    const list: string[] = []
    if (Array.isArray(product.images)) {
      list.push(...product.images.filter(Boolean))
    }
    if (product.image && !list.includes(product.image)) {
      list.unshift(product.image)
    }
    if ((product as any).image_url && !list.includes((product as any).image_url)) {
      list.unshift((product as any).image_url)
    }
    return list.length > 0 ? list : ['/placeholder-product.svg']
  }, [product])

  const activeImageUrl = resolveProductImageUrl(imagesList[selectedImageIndex] || imagesList[0])

  // Stock calculations
  const totalVariantStock = variants.length > 0
    ? variants.reduce((acc, v) => acc + v.stockQuantity, 0)
    : (product?.stock_quantity ?? 0)

  const stockStatus = product
    ? getStockStatus({
        ...product,
        stock_quantity: totalVariantStock,
      })
    : 'in_stock'
  const statusConfig = STOCK_LABEL[stockStatus]

  // Cost & Margin calculations
  const margin =
    canViewCost && product && product.purchase_price && product.purchase_price > 0 && product.sale_price > 0
      ? ((product.sale_price - product.purchase_price) / product.sale_price) * 100
      : null

  const compareAtPrice: number | null =
    product
      ? ((product as any).compare_at_price ??
        (product.has_offer && product.offer_price && product.offer_price < product.sale_price
          ? product.sale_price
          : (product as any).original_price ?? null))
      : null

  const effectiveSalePrice: number =
    product
      ? (product.has_offer && product.offer_price && product.offer_price > 0
        ? product.offer_price
        : product.sale_price)
      : 0

  const discountPercent =
    compareAtPrice && compareAtPrice > effectiveSalePrice
      ? Math.round(((compareAtPrice - effectiveSalePrice) / compareAtPrice) * 100)
      : null

  // Extract color attribute values for filter chips
  const colorOptions = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of variants) {
      for (const [key, val] of Object.entries(v.attributes)) {
        if (key.toLowerCase().includes('color') || key.toLowerCase() === 'colour') {
          map.set(val, (map.get(val) || 0) + 1)
        }
      }
    }
    return Array.from(map.entries()).map(([color, count]) => ({ color, count }))
  }, [variants])

  // Filtered variants
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      // Stock status filter
      if (statusFilter === 'in_stock' && v.stockQuantity <= 0) return false
      if (statusFilter === 'out_of_stock' && v.stockQuantity > 0) return false

      // Color filter
      if (selectedColor) {
        const hasColor = Object.entries(v.attributes).some(
          ([k, val]) => (k.toLowerCase().includes('color') || k.toLowerCase() === 'colour') && val === selectedColor
        )
        if (!hasColor) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesName = v.name.toLowerCase().includes(q)
        const matchesSku = v.sku?.toLowerCase().includes(q)
        const matchesBarcode = v.barcode?.toLowerCase().includes(q)
        const matchesAttrs = Object.values(v.attributes).some((val) => val.toLowerCase().includes(q))
        if (!matchesName && !matchesSku && !matchesBarcode && !matchesAttrs) return false
      }

      return true
    })
  }, [variants, statusFilter, selectedColor, searchQuery])

  // Grouped variants for matrix view (by Color if present, otherwise by first attribute or flat)
  const groupedVariants = useMemo(() => {
    const groups: { key: string; colorHex?: string; items: NormalizedVariant[]; totalStock: number }[] = []
    const groupMap = new Map<string, NormalizedVariant[]>()

    // Determine primary grouping attribute
    let primaryAttrKey: string | null = null
    if (colorOptions.length > 0) {
      primaryAttrKey = 'color'
    } else if (variants.length > 0 && Object.keys(variants[0].attributes).length > 0) {
      primaryAttrKey = Object.keys(variants[0].attributes)[0]
    }

    if (!primaryAttrKey) {
      return [{ key: 'Todas las variantes', items: filteredVariants, totalStock: filteredVariants.reduce((s, i) => s + i.stockQuantity, 0) }]
    }

    for (const v of filteredVariants) {
      let groupName = 'General'
      for (const [k, val] of Object.entries(v.attributes)) {
        if (primaryAttrKey === 'color' ? (k.toLowerCase().includes('color') || k.toLowerCase() === 'colour') : k === primaryAttrKey) {
          groupName = val
          break
        }
      }
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, [])
      }
      groupMap.get(groupName)!.push(v)
    }

    for (const [key, items] of groupMap.entries()) {
      const colorHex = COLOR_HEX_MAP[key.toLowerCase()] || undefined
      const totalStock = items.reduce((s, i) => s + i.stockQuantity, 0)
      groups.push({ key, colorHex, items, totalStock })
    }

    return groups
  }, [filteredVariants, colorOptions.length, variants])

  // Copy helper with feedback
  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyName)
    toast.success(`Copiado: ${text}`)
    setTimeout(() => {
      setCopiedKey((prev) => (prev === keyName ? null : prev))
    }, 2000)
  }

  // Variant stats counters
  const inStockVariantsCount = variants.filter((v) => v.stockQuantity > 0).length
  const outOfStockVariantsCount = variants.filter((v) => v.stockQuantity <= 0).length

  if (!isOpen || !product) {
    return null
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          <TooltipProvider delayDuration={150}>
            {/* ── HEADER / HERO (FIXED) ── */}
        <div className="shrink-0 p-5 sm:p-6 pb-4 bg-gradient-to-b from-slate-50/90 via-slate-50/40 to-transparent dark:from-slate-850 dark:via-slate-900/50 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">

            {/* Gallery / Main Photo with Interactive Hover Zoom */}
            <div className="flex flex-col gap-2 shrink-0">
              <div
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 ring-1 ring-slate-200/80 dark:ring-slate-700 shadow-inner flex items-center justify-center group cursor-crosshair select-none"
                onMouseEnter={() => setIsImageZoomed(true)}
                onMouseMove={handleImageMouseMove}
                onMouseLeave={() => {
                  setIsImageZoomed(false)
                  setZoomPosition({ x: 50, y: 50 })
                }}
              >
                <div
                  className="relative w-full h-full transition-transform duration-150 ease-out will-change-transform"
                  style={{
                    transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
                    transform: isImageZoomed ? 'scale(2.5)' : 'scale(1)',
                  }}
                >
                  <Image
                    src={activeImageUrl}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 96px, 112px"
                    className="object-contain p-2 pointer-events-none"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = '/placeholder-product.svg'
                    }}
                  />
                </div>
                {product.featured && (
                  <div className="absolute top-1.5 right-1.5 shadow-sm z-10 pointer-events-none">
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-1.5 py-0.2 text-[9px] font-bold">
                      <Star className="h-2.5 w-2.5 mr-0.5 fill-white" /> Destacado
                    </Badge>
                  </div>
                )}
                {/* Floating zoom indicator on hover */}
                {isImageZoomed && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 bg-black/75 backdrop-blur-xs text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md pointer-events-none flex items-center gap-1 shadow-sm">
                    <ZoomIn className="h-2.5 w-2.5" />
                    <span>2.5x</span>
                  </div>
                )}
              </div>

              {/* Multi-image thumbnail strip */}
              {imagesList.length > 1 && (
                <div className="flex items-center gap-1.5 max-w-[112px] overflow-x-auto pb-1 scrollbar-none">
                  {imagesList.slice(0, 4).map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={cn(
                        'relative w-6 h-6 rounded-md overflow-hidden border transition-all shrink-0',
                        selectedImageIndex === idx
                          ? 'border-blue-600 ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 opacity-70 hover:opacity-100'
                      )}
                    >
                      <Image
                        src={resolveProductImageUrl(img)}
                        alt={`Vista ${idx + 1}`}
                        fill
                        sizes="24px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                  {imagesList.length > 4 && (
                    <span className="text-[10px] font-semibold text-slate-400 pl-0.5">
                      +{imagesList.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Product Meta & Titles */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                    {product.name}
                  </DialogTitle>
                  {product.brand && (
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      Marca: <span className="text-slate-700 dark:text-slate-200">{product.brand}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Badges strip */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {/* SKU with 1-click copy */}
                <button
                  type="button"
                  onClick={() => handleCopy(product.sku, 'sku')}
                  title="Click para copiar SKU"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-colors group"
                >
                  <span>SKU: {product.sku}</span>
                  {copiedKey === 'sku' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                  )}
                </button>

                {/* Category */}
                {product.category?.name && (
                  <Badge variant="secondary" className="text-xs font-semibold gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <Tag className="h-3 w-3 text-blue-500" />
                    {product.category.name}
                  </Badge>
                )}

                {/* Variants Count badge */}
                {hasVariants && (
                  <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 text-xs font-bold gap-1 px-2.5 py-1 shadow-xs">
                    <Layers3 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    {variants.length > 0 ? `${variants.length} Variantes` : 'Con Variantes'}
                  </Badge>
                )}

                {/* Stock Status Badge */}
                <Badge className={cn('text-xs font-semibold px-2.5 py-1 shadow-xs', statusConfig.badge)}>
                  {statusConfig.label}
                </Badge>

                {/* Operational Status (Active / Inactive) with interactive 1-click toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={isTogglingActive || !onToggleActive}
                      onClick={handleToggleActiveClick}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all shadow-2xs select-none',
                        onToggleActive ? 'cursor-pointer hover:opacity-90 active:scale-95' : 'cursor-default',
                        'disabled:opacity-60 disabled:cursor-not-allowed',
                        product.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20'
                      )}
                    >
                      {isTogglingActive ? (
                        <Loader2 className="h-3 w-3 animate-spin text-current" />
                      ) : product.is_active ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>Activo</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          <span>Inactivo{onToggleActive ? ' · Clic para activar' : ''}</span>
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-xs">
                    {product.is_active
                      ? (onToggleActive ? 'Producto activo para ventas en caja/POS y catálogo. Clic para desactivar.' : 'Producto activo.')
                      : (onToggleActive ? 'Producto inactivo (no disponible para ventas). Hacé clic para activarlo inmediatamente.' : 'Producto inactivo.')}
                  </TooltipContent>
                </Tooltip>

                {/* Storefront Visibility Badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-semibold px-2.5 py-1',
                    (product as any).visibility === 'hidden'
                      ? 'text-slate-500 border-slate-200 dark:border-slate-800'
                      : (product as any).visibility === 'wholesale'
                        ? 'text-indigo-600 border-indigo-200 bg-indigo-50/50 dark:text-indigo-400 dark:border-indigo-900/50 dark:bg-indigo-950/30'
                        : 'text-emerald-600 border-emerald-200 bg-emerald-50/50 dark:text-emerald-400 dark:border-emerald-900/50 dark:bg-emerald-950/30',
                  )}
                >
                  {(product as any).visibility === 'hidden' ? (
                    <><EyeOff className="h-3 w-3 mr-1" /> Catálogo Oculto</>
                  ) : (product as any).visibility === 'wholesale' ? (
                    <><Globe className="h-3 w-3 mr-1 text-indigo-500" /> Mayorista</>
                  ) : (
                    <><Globe className="h-3 w-3 mr-1 text-emerald-500" /> Tienda Online</>
                  )}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE BODY (CONTAINS KPIS, TABS & CONTENT) ── */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-5 scrollbar-thin">

          {/* Banner Prominente si el Producto está Inactivo con Botón para Activar */}
          {!product.is_active && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-gradient-to-r from-amber-50 via-amber-50/60 to-orange-50/40 dark:from-amber-950/40 dark:via-amber-950/30 dark:to-orange-950/20 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                  <EyeOff className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <span>Producto actualmente Inactivo</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                      Fuera de venta
                    </span>
                  </p>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                    Este producto no aparece en las búsquedas de caja/POS ni en el catálogo público hasta que sea activado.
                  </p>
                </div>
              </div>

              {onToggleActive && (
                <Button
                  type="button"
                  size="sm"
                  disabled={isTogglingActive}
                  onClick={handleToggleActiveClick}
                  className="shrink-0 h-9 px-4 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md transition-all gap-1.5 self-start sm:self-center"
                >
                  {isTogglingActive ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>Activar Producto</span>
                </Button>
              )}
            </div>
          )}

          {/* KPI METRICS CARDS */}
          <div className={cn(
            'grid gap-3',
            canViewCost ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'
          )}>
            {/* Sale Price */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/10 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                  Precio de Venta
                </p>
                {discountPercent !== null && (
                  <Badge className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0">
                    -{discountPercent}%
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-100 tracking-tight">
                  {formatCurrency(effectiveSalePrice)}
                </p>
                {compareAtPrice && compareAtPrice > effectiveSalePrice && (
                  <span className="text-xs line-through text-slate-400 dark:text-slate-500 font-semibold">
                    {formatCurrency(compareAtPrice)}
                  </span>
                )}
              </div>
            </div>

            {/* Total Stock */}
            <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Stock Total {hasVariants ? '(Variantes)' : ''}
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <p className={cn('text-xl sm:text-2xl font-black tabular-nums', statusConfig.text)}>
                  {totalVariantStock}
                </p>
                <span className="text-xs font-semibold text-slate-400">unidades</span>
                {product.min_stock !== undefined && product.min_stock > 0 && (
                  <span className="text-[10px] ml-auto text-slate-400 font-medium">
                    Mín: {product.min_stock}
                  </span>
                )}
              </div>
            </div>

            {/* Cost Base (if permitted) */}
            {canViewCost && (
              <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Costo Base
                </p>
                <p className="mt-1 text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">
                  {product.purchase_price ? formatCurrency(product.purchase_price) : '—'}
                </p>
              </div>
            )}

            {/* Margin (if permitted) or Barcode/Supplier */}
            {canViewCost ? (
              <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Margen Bruto
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {margin !== null ? (
                    <Badge
                      className={cn(
                        'text-white border-0 text-xs font-black px-2 py-0.5',
                        margin >= 30
                          ? 'bg-emerald-600'
                          : margin >= 15
                            ? 'bg-amber-500'
                            : 'bg-rose-500',
                      )}
                    >
                      {margin.toFixed(1)}%
                    </Badge>
                  ) : (
                    <span className="text-sm font-semibold text-slate-400">—</span>
                  )}
                  {product.purchase_price && product.sale_price > product.purchase_price && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      +{formatCurrency(product.sale_price - product.purchase_price)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Código / EAN
                </p>
                <p className="mt-1 text-base font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                  {product.barcode || product.sku}
                </p>
              </div>
            )}
          </div>

          {/* Low stock warning banner */}
          {isLowStock(product) && (
            <div className="px-3.5 py-2.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-900 rounded-xl text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Atención:</strong> Stock bajo ({totalVariantStock} disponibles). Se aconseja realizar una orden de reposición con el proveedor.
              </span>
            </div>
          )}

          {/* TABS COMPONENT */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <TabsList className="bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl h-auto">
                {hasVariants && (
                  <TabsTrigger
                    value="variants"
                    className="rounded-lg text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-xs flex items-center gap-1.5"
                  >
                    <Layers3 className="h-3.5 w-3.5" />
                    <span>Variantes</span>
                    {variants.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/80 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-extrabold">
                        {variants.length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="info"
                  className="rounded-lg text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-xs flex items-center gap-1.5"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span>Información & Logística</span>
                </TabsTrigger>
              </TabsList>

              {/* View Switcher in variants tab */}
              {activeTab === 'variants' && variants.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode('matrix')}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all',
                      viewMode === 'matrix'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>Matriz</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all',
                      viewMode === 'table'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    )}
                  >
                    <TableProperties className="h-3.5 w-3.5" />
                    <span>Tabla</span>
                  </button>
                </div>
              )}
            </div>

            {/* TAB CONTENT: VARIANTES */}
            {hasVariants && (
              <TabsContent value="variants" className="pt-1 m-0 space-y-4">

                {/* Search and Filters Bar */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">

                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Buscar por nombre, SKU, color o talle..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8.5 pr-8 h-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Stock Status Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0',
                        statusFilter === 'all'
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                      )}
                    >
                      Todas ({variants.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('in_stock')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1',
                        statusFilter === 'in_stock'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                      )}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      En Stock ({inStockVariantsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('out_of_stock')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1',
                        statusFilter === 'out_of_stock'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
                      )}
                    >
                      <XCircle className="h-3 w-3" />
                      Agotadas ({outOfStockVariantsCount})
                    </button>
                  </div>
                </div>

                {/* Color Swatches Quick Filter */}
                {colorOptions.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0">Color:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedColor(null)}
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all shrink-0',
                        selectedColor === null
                          ? 'bg-slate-900 text-white border-transparent dark:bg-slate-100 dark:text-slate-900'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      )}
                    >
                      Todos
                    </button>
                    {colorOptions.map(({ color, count }) => {
                      const hex = COLOR_HEX_MAP[color.toLowerCase()] || '#cbd5e1'
                      const isWhiteOrLight = ['#ffffff', '#fff'].includes(hex.toLowerCase()) || color.toLowerCase() === 'blanco'
                      const isSelected = selectedColor === color

                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(isSelected ? null : color)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all shrink-0',
                            isSelected
                              ? 'ring-2 ring-blue-500 bg-blue-50 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-700'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          )}
                        >
                          <span
                            className={cn(
                              'w-2.5 h-2.5 rounded-full shrink-0',
                              isWhiteOrLight ? 'ring-1 ring-slate-300' : ''
                            )}
                            style={{ backgroundColor: hex }}
                          />
                          <span>{color}</span>
                          <span className="text-[9px] text-slate-400 font-mono">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Variants Hydration Loading */}
                {isLoadingHydration && (
                  <div className="flex items-center justify-center py-10 gap-2 text-slate-500 text-xs font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span>Cargando variantes en tiempo real...</span>
                  </div>
                )}

                {/* Empty filter state */}
                {!isLoadingHydration && filteredVariants.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <Search className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {variants.length === 0 ? 'Sin combinaciones creadas' : 'No se encontraron variantes con estos filtros'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                      {variants.length === 0
                        ? 'El producto está marcado con variantes pero aún no tiene combinaciones guardadas.'
                        : 'Prueba modificando el término de búsqueda o desactivando los filtros de color y stock.'}
                    </p>
                    {variants.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchQuery('')
                          setStatusFilter('all')
                          setSelectedColor(null)
                        }}
                        className="mt-3 text-xs font-bold rounded-xl"
                      >
                        <RotateCcw className="h-3 w-3 mr-1.5" /> Restablecer filtros
                      </Button>
                    )}
                  </div>
                )}

                {/* VIEW 1: MATRIZ AGRUPADA */}
                {!isLoadingHydration && filteredVariants.length > 0 && viewMode === 'matrix' && (
                  <div className="space-y-3">
                    {groupedVariants.map((group) => {
                      const isWhiteOrLight = group.colorHex && (['#ffffff', '#fff'].includes(group.colorHex.toLowerCase()) || group.key.toLowerCase() === 'blanco')

                      return (
                        <div
                          key={group.key}
                          className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60"
                        >
                          {/* Group Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {group.colorHex && (
                                <span
                                  className={cn(
                                    'w-4 h-4 rounded-full shadow-xs shrink-0',
                                    isWhiteOrLight ? 'ring-1 ring-slate-300 dark:ring-slate-600' : ''
                                  )}
                                  style={{ backgroundColor: group.colorHex }}
                                />
                              )}
                              <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                                {group.key}
                              </h4>
                              <span className="text-[11px] font-semibold text-slate-400">
                                ({group.items.length} {group.items.length === 1 ? 'opción' : 'opciones'})
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                Total grupo:
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs font-extrabold px-2 py-0.5',
                                  group.totalStock > 0
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                                )}
                              >
                                {group.totalStock} u
                              </Badge>
                            </div>
                          </div>

                          {/* Matrix Cards for sizes/options */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                            {group.items.map((v) => {
                              const isOut = v.stockQuantity <= 0
                              const isLow = v.stockQuantity > 0 && v.minStock !== undefined && v.stockQuantity <= v.minStock

                              // Get primary label for size or non-color attribute
                              const sizeOrLabel =
                                v.attributes.talle ||
                                v.attributes.size ||
                                v.attributes.talla ||
                                Object.entries(v.attributes).find(
                                  ([k]) => !k.toLowerCase().includes('color') && !k.toLowerCase().includes('colour')
                                )?.[1] ||
                                v.name

                              return (
                                <div
                                  key={v.id}
                                  className={cn(
                                    'p-2.5 rounded-xl border transition-all flex flex-col justify-between group',
                                    isOut
                                      ? 'bg-rose-50/40 dark:bg-rose-950/15 border-rose-200/60 dark:border-rose-900/40 opacity-75 hover:opacity-100'
                                      : isLow
                                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/60 shadow-xs'
                                        : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 shadow-xs'
                                  )}
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-1">
                                      <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                                        {sizeOrLabel}
                                      </span>
                                      {v.sku && (
                                        <button
                                          type="button"
                                          onClick={() => handleCopy(v.sku!, `sku-${v.id}`)}
                                          title={`Copiar SKU: ${v.sku}`}
                                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
                                        >
                                          {copiedKey === `sku-${v.id}` ? (
                                            <Check className="h-3 w-3 text-emerald-600" />
                                          ) : (
                                            <Copy className="h-2.5 w-2.5" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                                      {v.sku || 'Sin SKU'}
                                    </p>
                                  </div>

                                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                      {formatCurrency(v.salePrice)}
                                    </span>
                                    <span
                                      className={cn(
                                        'px-1.5 py-0.2 rounded-md text-[10px] font-black tabular-nums',
                                        isOut
                                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                          : isLow
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      )}
                                    >
                                      {isOut ? 'Agotado' : `${v.stockQuantity} u`}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* VIEW 2: TABLA DETALLADA */}
                {!isLoadingHydration && filteredVariants.length > 0 && viewMode === 'table' && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-3 py-2.5 text-left font-bold text-slate-700 dark:text-slate-300">Variante</th>
                          <th className="px-3 py-2.5 text-left font-bold text-slate-700 dark:text-slate-300">SKU</th>
                          <th className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">Precio</th>
                          {canViewCost && (
                            <th className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">Costo</th>
                          )}
                          <th className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">Stock</th>
                          <th className="px-3 py-2.5 text-center font-bold text-slate-700 dark:text-slate-300">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredVariants.map((v) => {
                          const isOut = v.stockQuantity <= 0
                          const isLow = v.stockQuantity > 0 && v.minStock !== undefined && v.stockQuantity <= v.minStock

                          return (
                            <tr
                              key={v.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="px-3 py-2.5">
                                <p className="font-extrabold text-slate-900 dark:text-slate-100">{v.name}</p>
                                {Object.entries(v.attributes).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.entries(v.attributes).map(([key, val]) => {
                                      const hex = key.toLowerCase().includes('color') ? COLOR_HEX_MAP[val.toLowerCase()] : null
                                      return (
                                        <span
                                          key={key}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700"
                                        >
                                          {hex && (
                                            <span
                                              className="w-2 h-2 rounded-full inline-block"
                                              style={{ backgroundColor: hex }}
                                            />
                                          )}
                                          <span className="capitalize">{key}:</span>
                                          <strong className="font-bold text-slate-800 dark:text-slate-200">{String(val)}</strong>
                                        </span>
                                      )
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                                {v.sku ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(v.sku!, `table-sku-${v.id}`)}
                                    className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 group"
                                  >
                                    <span>{v.sku}</span>
                                    {copiedKey === `table-sku-${v.id}` ? (
                                      <Check className="h-3 w-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                  </button>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-black text-slate-900 dark:text-slate-100">
                                {formatCurrency(v.salePrice)}
                              </td>
                              {canViewCost && (
                                <td className="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400 font-medium">
                                  {v.purchasePrice ? formatCurrency(v.purchasePrice) : '—'}
                                </td>
                              )}
                              <td className="px-3 py-2.5 text-right">
                                <span
                                  className={cn(
                                    'px-2 py-0.5 rounded-full text-[11px] font-black tabular-nums',
                                    isOut
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                      : isLow
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  )}
                                >
                                  {v.stockQuantity} u
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {v.isActive ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="h-3 w-3" /> Activa
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-semibold">Inactiva</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            )}

            {/* TAB CONTENT: DETALLES & LOGÍSTICA */}
            <TabsContent value="info" className="pt-1 m-0 space-y-4">

              {/* Product Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-blue-600" /> Descripción del Producto
                </h4>
                {product.description ? (
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 whitespace-pre-line">
                    {product.description}
                  </p>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                    Sin descripción registrada para este producto.
                  </div>
                )}
              </div>

              {/* Technical Specifications & Logistics Grid */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <Boxes className="h-3.5 w-3.5 text-indigo-600" /> Ficha Técnica & Logística
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">

                  {/* Supplier */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" /> Proveedor
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {product.supplier?.name || (product as any).supplier_name || 'No asignado'}
                    </span>
                  </div>

                  {/* Barcode / EAN */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Barcode className="h-3.5 w-3.5 text-slate-400" /> Código EAN-13
                    </span>
                    {product.barcode ? (
                      <button
                        type="button"
                        onClick={() => handleCopy(product.barcode!, 'barcode')}
                        className="font-mono font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1 hover:text-blue-600"
                      >
                        <span>{product.barcode}</span>
                        {copiedKey === 'barcode' ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-2.5 w-2.5 text-slate-400" />
                        )}
                      </button>
                    ) : (
                      <span className="text-slate-400 font-mono">—</span>
                    )}
                  </div>

                  {/* Unit Measure */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Package className="h-3.5 w-3.5 text-slate-400" /> Unidad de Medida
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                      {product.unit_measure || 'Unidad'}
                    </span>
                  </div>

                  {/* Operational Status Switch */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <div className="space-y-0.5 pr-3">
                      <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs font-bold">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", product.is_active ? "text-emerald-500" : "text-amber-500")} />
                        Estado Operativo ({product.is_active ? 'Activo' : 'Inactivo'})
                      </span>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {product.is_active
                          ? 'Habilitado para cobros en caja/POS y movimientos de inventario.'
                          : 'Deshabilitado. No aparecerá en ventas de caja ni catálogo.'}
                      </p>
                    </div>
                    {onToggleActive && (
                      <Switch
                        checked={product.is_active}
                        onCheckedChange={handleToggleActiveClick}
                        disabled={isTogglingActive}
                        aria-label="Alternar estado activo del producto"
                      />
                    )}
                  </div>

                  {/* Visibility */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Globe className="h-3.5 w-3.5 text-slate-400" /> Canal de Visibilidad
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                      {(product as any).visibility || 'Público'}
                    </span>
                  </div>

                  {/* Min Stock */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <BarChart2 className="h-3.5 w-3.5 text-slate-400" /> Stock Mínimo Sugerido
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {product.min_stock ?? 0} u
                    </span>
                  </div>

                  {/* Max Stock */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <BarChart2 className="h-3.5 w-3.5 text-slate-400" /> Capacidad Máxima
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {product.max_stock ? `${product.max_stock} u` : 'Sin límite'}
                    </span>
                  </div>

                  {/* Created date */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" /> Fecha de Alta
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(product.created_at)}
                    </span>
                  </div>

                  {/* Updated date */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" /> Última Modificación
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(product.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── FOOTER (FIXED) ── */}
        <DialogFooter className="shrink-0 p-4 sm:px-6 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex flex-row items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-xl h-9 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
          >
            Cerrar
          </Button>

          <div className="flex items-center gap-2">
            {onToggleActive && (
              <Button
                type="button"
                variant={product.is_active ? "outline" : "default"}
                size="sm"
                disabled={isTogglingActive}
                onClick={handleToggleActiveClick}
                className={cn(
                  "rounded-xl h-9 text-xs font-bold gap-1.5 shadow-xs transition-all",
                  product.is_active
                    ? "text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 hover:border-amber-300"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                )}
              >
                {isTogglingActive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : product.is_active ? (
                  <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>{product.is_active ? 'Desactivar' : 'Activar Producto'}</span>
              </Button>
            )}

            {onPrintLabel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPrintLabel(product)}
                className="rounded-xl h-9 text-xs font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Tag className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Etiqueta
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(product)}
                className="rounded-xl h-9 text-xs font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Edit className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Editar Producto
              </Button>
            )}
            {onViewFullDetails && (
              <Button
                size="sm"
                onClick={() => onViewFullDetails(product)}
                className="rounded-xl h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              >
                <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" /> Ficha Completa
              </Button>
            )}
          </div>
        </DialogFooter>
          </TooltipProvider>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  )
}

export default ProductQuickViewModal
