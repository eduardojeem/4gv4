/**
 * ProductTable Component - Premium Edition
 * Redesigned with modern aesthetics, better information density, clear stock & visibility separation and premium UX
 */

import React, { useState } from 'react'
import Image from 'next/image'
import {
  ArrowUpDown, ArrowUp, ArrowDown,
  Edit, Trash2, Copy, Eye, Package, AlertTriangle, XCircle,
  Sparkles, Globe, EyeOff, MoreHorizontal,
  Wrench, Layers3, ChevronDown, ChevronUp,
  Barcode, CheckCircle2, Smartphone
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Product } from '@/types/products'
import { SortConfig } from '@/types/products-dashboard'
import { isServiceLikeProduct } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'
import { describeDeviceCompatibility, usesDeviceCompatibility } from '@/lib/products/device-compatibility'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { formatCurrency } from '@/lib/currency'
import { useCanViewCost } from '@/hooks/use-can-view-cost'

export interface ProductTableProps {
  products: Product[]
  selectedProductIds: string[]
  sortConfig: SortConfig
  onSort: (field: SortConfig['field']) => void
  onSelectAll: (selected: boolean) => void
  onSelect: (id: string) => void
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onDuplicate: (product: Product) => void
  onViewDetails: (product: Product) => void
  onToggleActive?: (product: Product, newValue: boolean) => Promise<void> | void
  loading?: boolean
  className?: string
  viewMode?: 'table' | 'compact'
}

const STOCK_CONFIG = {
  in_stock: {
    label: 'En stock',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  low_stock: {
    label: 'Stock bajo',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
  },
  out_of_stock: {
    label: 'Agotado',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    bar: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-300',
    icon: XCircle,
  },
}

type RawVariantItem = Record<string, unknown> & {
  id?: string
  variant_name?: string | null
  name?: string | null
  attributes?: Record<string, unknown> | Array<Record<string, unknown>>
  sale_price?: number | null
  salePrice?: number | null
  purchase_price?: number | null
  purchasePrice?: number | null
  wholesale_price?: number | null
  wholesalePrice?: number | null
  stock_quantity?: number | null
  stockQuantity?: number | null
  min_stock?: number | null
  minStock?: number | null
  is_active?: boolean | null
  isActive?: boolean | null
  sku?: string | null
  barcode?: string | null
}

function getNormalizedVariants(product: Product) {
  const rawVariants = Array.isArray(product.variants) ? (product.variants as RawVariantItem[]) : []
  return rawVariants.map((v: RawVariantItem, index: number) => {
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

function SortButton({
  label,
  field,
  sortConfig,
  onSort,
  className,
}: {
  label: string
  field: SortConfig['field']
  sortConfig: SortConfig
  onSort: (field: SortConfig['field']) => void
  className?: string
}) {
  const active = sortConfig.field === field
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors select-none',
        active
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {label}
      {active ? (
        sortConfig.direction === 'asc'
          ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
          : <ArrowDown className="h-3.5 w-3.5 text-primary" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
      )}
    </button>
  )
}

function SkeletonRow({ compact }: { compact: boolean }) {
  return (
    <TableRow className="border-border/40">
      <TableCell className="py-3 pl-4"><div className="h-4 w-4 rounded bg-muted animate-pulse" /></TableCell>
      <TableCell className="py-3"><div className={cn('rounded-xl bg-muted animate-pulse', compact ? 'h-8 w-8' : 'h-11 w-11')} /></TableCell>
      <TableCell className="py-3">
        <div className="space-y-2">
          <div className="h-3.5 w-36 rounded bg-muted animate-pulse" />
          <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
        </div>
      </TableCell>
      <TableCell className="py-3"><div className="h-5 w-24 rounded-full bg-muted animate-pulse" /></TableCell>
      <TableCell className="py-3 text-right"><div className="h-5 w-20 rounded bg-muted animate-pulse ml-auto" /></TableCell>
      <TableCell className="py-3 text-right"><div className="h-4 w-16 rounded bg-muted animate-pulse ml-auto" /></TableCell>
      <TableCell className="py-3 text-center"><div className="h-6 w-24 rounded-full bg-muted animate-pulse mx-auto" /></TableCell>
      <TableCell className="py-3 text-center"><div className="h-5 w-16 rounded-full bg-muted animate-pulse mx-auto" /></TableCell>
      <TableCell className="py-3 pr-4"><div className="h-8 w-16 rounded-lg bg-muted animate-pulse ml-auto" /></TableCell>
    </TableRow>
  )
}

export function ProductTable({
  products,
  selectedProductIds,
  sortConfig,
  onSort,
  onSelectAll,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onViewDetails,
  onToggleActive,
  loading = false,
  className,
  viewMode = 'table',
}: ProductTableProps) {
  // Marca y modelo del celular: sólo para tecnología y talleres de celulares.
  const { businessVertical, operatingModel } = useSubscriptionStatus()
  const muestraCelular = usesDeviceCompatibility({ businessVertical, operatingModel })

  const isCompact = viewMode === 'compact'
  const canViewCost = useCanViewCost()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (productId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const handleVisibilityClick = async (e: React.MouseEvent, product: Product, nextValue: boolean) => {
    e.stopPropagation()
    if (!onToggleActive || togglingIds.has(product.id)) return

    setTogglingIds(prev => new Set(prev).add(product.id))
    try {
      await onToggleActive(product, nextValue)
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }

  const allSelected = products.length > 0 && products.every(p => selectedProductIds.includes(p.id))
  const someSelected = products.some(p => selectedProductIds.includes(p.id)) && !allSelected

  if (products.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">
        <div className="relative mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/80 shadow-xs">
            <Package className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <Sparkles className="h-5 w-5 text-primary/60 absolute -top-1 -right-1 animate-pulse" />
        </div>
        <h3 className="text-base font-bold text-foreground mb-1">No se encontraron productos</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          No hay productos que coincidan con los filtros aplicados.
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn(
        'overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs transition-all',
        className,
      )}>
        <div className="overflow-x-auto" role="region" aria-label="Tabla de productos" tabIndex={0}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-border/60">
                {/* Select all */}
                <TableHead className="w-10 pl-4 pr-2">
                  <Checkbox
                    checked={allSelected ? true : (someSelected ? 'indeterminate' : false)}
                    onCheckedChange={onSelectAll}
                    aria-label="Seleccionar todos los productos de esta página"
                    className="border-muted-foreground/40"
                  />
                </TableHead>

                {/* Thumbnail */}
                <TableHead className={cn('w-14 text-center', isCompact && 'w-10')} />

                {/* Product info (Name, brand, SKU) */}
                <TableHead className="min-w-[220px]">
                  {/* Ordenar por celular junta los repuestos del mismo teléfono:
                      todas las piezas de iPhone 13 una detrás de otra. */}
                  <div className="flex items-center gap-4">
                    <SortButton label="Producto" field="name" sortConfig={sortConfig} onSort={onSort} />
                    {muestraCelular && (
                      <SortButton label="Celular" field="device_model" sortConfig={sortConfig} onSort={onSort} />
                    )}
                  </div>
                </TableHead>

                {/* Category & variants */}
                <TableHead className="w-36 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Categoría / Tipo
                </TableHead>

                {/* Inventory / Stock */}
                <TableHead className="w-40 text-right">
                  <div className="flex justify-end">
                    <SortButton label="Inventario" field="stock_quantity" sortConfig={sortConfig} onSort={onSort} />
                  </div>
                </TableHead>

                {/* Price */}
                <TableHead className="w-32 text-right">
                  <div className="flex justify-end">
                    <SortButton label="Precio" field="sale_price" sortConfig={sortConfig} onSort={onSort} />
                  </div>
                </TableHead>

                {/* Public / Visibility in storefront */}
                {onToggleActive && (
                  <TableHead className="w-36 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Catálogo Público
                  </TableHead>
                )}

                {/* Operational Status (Active/Inactive) */}
                <TableHead className="w-24 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Estado
                </TableHead>

                {/* Quick actions */}
                <TableHead className="w-24 pr-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} compact={isCompact} />)
                : products.map((product) => {
                    const isService = isServiceLikeProduct(product)
                    const isSelected = selectedProductIds.includes(product.id)

                    const variants = getNormalizedVariants(product)
                    void (variants.length > 0 || Boolean(product.has_variants));
                    const isExpanded = expandedIds.has(product.id)

                    // Stock calculation
                    const totalVariantStock = variants.length > 0
                      ? variants.reduce((acc, v) => acc + v.stockQuantity, 0)
                      : (product.stock_quantity ?? 0)
                    const effectiveStock = variants.length > 0
                      ? totalVariantStock
                      : Number(product.stock_quantity ?? 0)

                    // Stock status based strictly on physical count
                    const stockStatus = isService
                      ? 'in_stock'
                      : effectiveStock <= 0
                        ? 'out_of_stock'
                        : effectiveStock <= Number(product.min_stock ?? 0)
                          ? 'low_stock'
                          : 'in_stock'
                    const cfg = STOCK_CONFIG[stockStatus]

                    const minStock = Number(product.min_stock ?? 0)
                    const stockPct = Math.min(
                      100,
                      Math.max(5, (effectiveStock / Math.max(minStock * 3, 1)) * 100),
                    )

                    // Image
                    const productImages = Array.isArray(product.images)
                      ? product.images.filter((value): value is string => typeof value === 'string')
                      : []
                    const imageUrl = productImages[0] || product.image || product.image_url || undefined
                    const hasImage = imageUrl && (
                      imageUrl.startsWith('data:image') ||
                      imageUrl.startsWith('/') ||
                      imageUrl.startsWith('http')
                    )

                    // Visibility in Storefront: public, wholesale, hidden
                    const isPublicVisibility = product.visibility === 'public' || !product.visibility
                    void (product.visibility === 'hidden');
                    const isWholesaleVisibility = product.visibility === 'wholesale'

                    // Offer price
                    const hasActiveOffer = Boolean(product.has_offer && product.offer_price && product.offer_price > 0 && product.offer_price < product.sale_price)

                    const isToggling = togglingIds.has(product.id)

                    return (
                      <React.Fragment key={product.id}>
                        <TableRow
                          onClick={() => onViewDetails(product)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onViewDetails(product)
                            }
                          }}
                          className={cn(
                            'group cursor-pointer border-border/40 transition-colors',
                            'hover:bg-muted/40',
                            isSelected && 'bg-primary/5 hover:bg-primary/8',
                            isExpanded && 'bg-violet-50/40 dark:bg-violet-950/20 border-b-0',
                            !product.is_active && 'opacity-70 bg-slate-50/50 dark:bg-slate-900/40',
                          )}
                        >
                          {/* Checkbox */}
                          <TableCell className={cn('pl-4 pr-2', isCompact ? 'py-2' : 'py-3')}>
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => onSelect(product.id)}
                                aria-label={`Seleccionar ${product.name}`}
                                className="border-muted-foreground/40"
                              />
                            </div>
                          </TableCell>

                          {/* Image Thumbnail */}
                          <TableCell className={cn('pr-2', isCompact ? 'py-2' : 'py-3')}>
                            <div className={cn(
                              'relative shrink-0 overflow-hidden rounded-xl bg-muted border border-border/50 shadow-2xs',
                              'transition-transform duration-200 group-hover:scale-105',
                              isCompact ? 'h-8 w-8 rounded-lg' : 'h-11 w-11',
                            )}>
                              {hasImage ? (
                                <Image
                                  src={imageUrl!}
                                  alt={product.name}
                                  fill
                                  sizes={isCompact ? '32px' : '44px'}
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  {isService ? (
                                    <Wrench className={cn('text-purple-500/70', isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
                                  ) : (
                                    <Package className={cn('text-muted-foreground/40', isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Product Name, Brand, SKU & Barcode */}
                          <TableCell className={cn('pr-4', isCompact ? 'py-2' : 'py-3')}>
                            <div className="max-w-[280px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={cn(
                                    'font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors',
                                    isCompact ? 'text-xs' : 'text-sm',
                                  )}
                                  title={product.name}
                                >
                                  {product.name}
                                </span>
                              </div>

                              {/* Para qué celular es: lo que se busca en el mostrador. */}
                              {muestraCelular && describeDeviceCompatibility(product.device_brand, product.device_models) && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                  <Smartphone className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                                  <span className="truncate">
                                    {describeDeviceCompatibility(product.device_brand, product.device_models)}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs">
                                {product.brand && (
                                  <span className="text-[11px] font-medium text-muted-foreground/80 truncate" title="Marca del repuesto">
                                    {product.brand}
                                  </span>
                                )}
                                {product.sku && (
                                  <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 font-mono text-[10px] text-muted-foreground px-1.5 py-0.5">
                                    {product.sku}
                                  </span>
                                )}
                                {product.barcode && (
                                  <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground/70" title={`Código de barras: ${product.barcode}`}>
                                    <Barcode className="h-2.5 w-2.5 opacity-60" />
                                    {product.barcode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Category & Variant pill */}
                          <TableCell className={cn(isCompact ? 'py-2' : 'py-3')}>
                            <div className="flex flex-col items-start gap-1">
                              {product.category?.name ? (
                                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 text-primary text-[11px] font-medium px-2.5 py-0.5 max-w-[130px] truncate">
                                  {product.category.name}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">—</span>
                              )}

                              {isService ? (
                                <span className="inline-flex items-center gap-1 rounded-full border font-semibold text-[10px] bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60 px-2 py-0.5">
                                  <Wrench className="h-2.5 w-2.5" />
                                  Servicio
                                </span>
                              ) : variants.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleExpanded(product.id)
                                  }}
                                  className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all shadow-2xs cursor-pointer',
                                    isExpanded
                                      ? 'bg-violet-600 text-white shadow-xs'
                                      : 'bg-violet-50 text-violet-700 border border-violet-200/80 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
                                  )}
                                  title="Ver desglose de variantes y stock"
                                >
                                  <Layers3 className="h-2.5 w-2.5" />
                                  <span>{variants.length} variantes</span>
                                  {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                </button>
                              ) : null}
                            </div>
                          </TableCell>

                          {/* Stock / Inventory */}
                          <TableCell className={cn('text-right', isCompact ? 'py-2' : 'py-3')}>
                            {isService ? (
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                  Sin límite
                                </span>
                                <span className="text-[10px] text-muted-foreground/60">Servicio</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn(
                                    'inline-flex items-center gap-1 rounded-full border font-bold px-2 py-0.5 text-xs',
                                    cfg.badge,
                                  )}>
                                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cfg.dot)} />
                                    <span className="tabular-nums">
                                      {effectiveStock} {product.unit_measure || 'u'}
                                    </span>
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                                  <span>{cfg.label}</span>
                                  {minStock > 0 && (
                                    <span>· mín {minStock}</span>
                                  )}
                                </div>

                                {minStock > 0 && !isCompact && (
                                  <div className="h-1 w-16 overflow-hidden rounded-full bg-muted mt-0.5">
                                    <div
                                      className={cn('h-full rounded-full transition-all duration-500', cfg.bar)}
                                      style={{ width: `${stockPct}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>

                          {/* Price */}
                          <TableCell className={cn('text-right', isCompact ? 'py-2' : 'py-3')}>
                            <div className="flex flex-col items-end">
                              {hasActiveOffer ? (
                                <>
                                  <span className="font-bold tabular-nums text-rose-600 dark:text-rose-400 text-sm">
                                    {formatCurrency(product.offer_price!)}
                                  </span>
                                  <span className="text-[10px] line-through text-muted-foreground tabular-nums">
                                    {formatCurrency(product.sale_price)}
                                  </span>
                                </>
                              ) : (
                                <span className={cn(
                                  'font-bold tabular-nums text-foreground',
                                  isCompact ? 'text-xs' : 'text-sm',
                                )}>
                                  {formatCurrency(product.sale_price)}
                                </span>
                              )}

                              {product.wholesale_price && product.wholesale_price > 0 ? (
                                <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                                  May: {formatCurrency(product.wholesale_price)}
                                </span>
                              ) : null}

                              {/* El precio existe, pero la tienda no lo publica: sin este aviso
                                  nadie entiende por que el catalogo dice «Preguntar». */}
                              {(product as { hide_price?: boolean }).hide_price && (
                                <span
                                  className="mt-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                  title="En la tienda sólo ven el precio tus clientes mayoristas habilitados; el resto ve «Preguntar» y «Ver precio»"
                                >
                                  Precio solo mayoristas
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Public Storefront Visibility */}
                          {onToggleActive && (
                            <TableCell
                              className={cn('text-center', isCompact ? 'py-2' : 'py-3')}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={isToggling}
                                    onClick={(e) => handleVisibilityClick(e, product, !isPublicVisibility)}
                                    className={cn(
                                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all shadow-2xs select-none cursor-pointer',
                                      'hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
                                      isPublicVisibility
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                        : isWholesaleVisibility
                                          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                    )}
                                  >
                                    {isToggling ? (
                                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    ) : isPublicVisibility ? (
                                      <Globe className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    ) : isWholesaleVisibility ? (
                                      <Globe className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                    ) : (
                                      <EyeOff className="h-3 w-3 text-slate-500 dark:text-slate-400 shrink-0" />
                                    )}
                                    <span>
                                      {isPublicVisibility
                                        ? 'Público'
                                        : isWholesaleVisibility
                                          ? 'Mayorista'
                                          : 'Oculto'}
                                    </span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-xs">
                                  {isPublicVisibility
                                    ? 'Visible en la tienda web y catálogo público. Clic para ocultar.'
                                    : isWholesaleVisibility
                                      ? 'Visible únicamente para clientes mayoristas. Clic para hacer público.'
                                      : 'Oculto de la tienda online (sigue disponible para ventas en caja/POS). Clic para publicar.'}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          )}

                          {/* Operational Status (Active / Inactive) */}
                          <TableCell className={cn('text-center', isCompact ? 'py-2' : 'py-3')}>
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border',
                              product.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                            )}>
                              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', product.is_active ? 'bg-emerald-500' : 'bg-slate-400')} />
                              {product.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </TableCell>

                          {/* Quick Actions */}
                          <TableCell className={cn('pr-4 text-right', isCompact ? 'py-2' : 'py-3')}>
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              {/* Quick View Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                                    onClick={() => onViewDetails(product)}
                                    aria-label="Ver detalles rápidos"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Vista rápida</TooltipContent>
                              </Tooltip>

                              {/* Quick Edit Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg"
                                    onClick={() => onEdit(product)}
                                    aria-label="Editar producto"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Editar</TooltipContent>
                              </Tooltip>

                              {/* Dropdown for other actions */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                                    aria-label="Más opciones"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 shadow-lg">
                                  <DropdownMenuItem onClick={() => onViewDetails(product)} className="gap-2 cursor-pointer text-xs">
                                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                    Ver ficha completa
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onEdit(product)} className="gap-2 cursor-pointer text-xs">
                                    <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                    Editar producto
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDuplicate(product)} className="gap-2 cursor-pointer text-xs">
                                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                    Duplicar producto
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => onDelete(product)}
                                    className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* ── EXPANDED VARIANT BREAKDOWN SUB-ROW ── */}
                        {isExpanded && variants.length > 0 && (
                          <TableRow className="bg-gradient-to-r from-violet-50/60 via-slate-50/80 to-purple-50/40 dark:from-violet-950/20 dark:via-slate-900/60 dark:to-purple-950/20 border-b border-border/80 hover:bg-slate-50/80 dark:hover:bg-slate-900/60">
                            <TableCell colSpan={onToggleActive ? 9 : 8} className="p-0 pl-10 pr-6 py-4">
                              <div className="space-y-3 rounded-2xl border border-violet-200/80 dark:border-violet-800/60 bg-white/95 dark:bg-slate-900/95 p-4 shadow-xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white shadow-xs">
                                      <Layers3 className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                        Desglose de Variantes ({product.name})
                                      </h4>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {variants.length} combinaciones registradas · Stock total: <strong className="text-slate-700 dark:text-slate-200">{totalVariantStock} unidades</strong>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs font-semibold gap-1 rounded-lg"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onEdit(product)
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                      Editar variantes
                                    </Button>
                                  </div>
                                </div>

                                {/* Mini Table of Variants */}
                                <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800">
                                      <tr>
                                        <th className="px-3.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Variante & Atributos</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">SKU</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Código de Barras</th>
                                        <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Precio Venta</th>
                                        {canViewCost && (
                                          <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Costo</th>
                                        )}
                                        <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Stock Actual</th>
                                        <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">Estado</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                      {variants.map((v) => {
                                        const isOut = v.stockQuantity <= 0
                                        const isLow = v.stockQuantity > 0 && v.minStock !== undefined && v.stockQuantity <= v.minStock
                                        return (
                                          <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-3.5 py-2.5">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-900 dark:text-slate-100">{v.name}</span>
                                                {Object.entries(v.attributes).map(([key, val]) => (
                                                  <span key={key} className="inline-flex items-center gap-1 rounded bg-violet-50 dark:bg-violet-950/50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60">
                                                    <span className="opacity-70">{key}:</span>
                                                    <strong className="font-bold">{String(val)}</strong>
                                                  </span>
                                                ))}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                                              {v.sku || '—'}
                                            </td>
                                            <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-slate-400">
                                              {v.barcode ? (
                                                <span className="inline-flex items-center gap-1">
                                                  <Barcode className="h-3 w-3 opacity-60" />
                                                  {v.barcode}
                                                </span>
                                              ) : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                                              {formatCurrency(v.salePrice)}
                                              {v.wholesalePrice ? (
                                                <span className="block text-[10px] font-normal text-muted-foreground">
                                                  May: {formatCurrency(v.wholesalePrice)}
                                                </span>
                                              ) : null}
                                            </td>
                                            {canViewCost && (
                                              <td className="px-3 py-2.5 text-right font-medium text-slate-500 dark:text-slate-400">
                                                {v.purchasePrice ? formatCurrency(v.purchasePrice) : '—'}
                                              </td>
                                            )}
                                            <td className="px-3 py-2.5 text-right font-bold">
                                              <span className={cn(
                                                'tabular-nums px-2 py-0.5 rounded-full text-xs font-bold',
                                                isOut
                                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                                                  : isLow
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                                              )}>
                                                {v.stockQuantity} u
                                              </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                              {v.isActive ? (
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" /> Activa
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                  Inactiva
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  )
}
