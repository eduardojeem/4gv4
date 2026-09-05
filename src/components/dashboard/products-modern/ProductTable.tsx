/**
 * ProductTable Component - Premium Edition
 * Redesigned with modern aesthetics, better information density, variant breakdown and premium UX
 */

import React, { useState } from 'react'
import Image from 'next/image'
import {
  ArrowUpDown, ArrowUp, ArrowDown,
  Edit, Trash2, Copy, Eye, Package,
  TrendingUp, AlertTriangle, XCircle,
  Sparkles, Globe, EyeOff, MoreHorizontal,
  Wrench, Layers3, ChevronDown, ChevronUp,
  Barcode, Tag, CheckCircle2,
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
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Product } from '@/types/products'
import { SortConfig } from '@/types/products-dashboard'
import { getStockStatus, isServiceLikeProduct } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'
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
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
    bar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: TrendingUp,
  },
  low_stock: {
    label: 'Bajo stock',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
    bar: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
  },
  out_of_stock: {
    label: 'Agotado',
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60',
    bar: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    icon: XCircle,
  },
}

function getNormalizedVariants(product: Product) {
  const rawVariants = Array.isArray((product as any).variants) ? (product as any).variants : []
  return rawVariants.map((v: any, index: number) => {
    let attributes: Record<string, string> = {}
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
        'flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors select-none',
        active
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {label}
      {active ? (
        sortConfig.direction === 'asc'
          ? <ArrowUp className="h-3 w-3" />
          : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  )
}

function SkeletonRow({ compact }: { compact: boolean }) {
  return (
    <TableRow className="border-border/40">
      <TableCell className="py-3 pl-4"><div className="h-4 w-4 rounded bg-muted animate-pulse" /></TableCell>
      <TableCell className="py-3"><div className={cn('rounded-xl bg-muted animate-pulse', compact ? 'h-8 w-8' : 'h-12 w-12')} /></TableCell>
      <TableCell className="py-3">
        <div className="space-y-2">
          <div className="h-3.5 w-36 rounded bg-muted animate-pulse" />
          <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
        </div>
      </TableCell>
      <TableCell className="py-3"><div className="h-5 w-16 rounded-md bg-muted animate-pulse" /></TableCell>
      <TableCell className="py-3"><div className="h-5 w-20 rounded-full bg-muted animate-pulse" /></TableCell>
      <TableCell className="py-3"><div className="h-5 w-20 rounded-full bg-muted animate-pulse" /></TableCell>
      <TableCell className="py-3 text-right"><div className="h-3.5 w-10 rounded bg-muted animate-pulse ml-auto" /></TableCell>
      <TableCell className="py-3 text-right"><div className="h-3.5 w-16 rounded bg-muted animate-pulse ml-auto" /></TableCell>
      <TableCell className="py-3"><div className="h-5 w-20 rounded-full bg-muted animate-pulse" /></TableCell>
      <TableCell className="py-3"><div className="h-5 w-9 rounded-full bg-muted animate-pulse mx-auto" /></TableCell>
      <TableCell className="py-3 pr-4"><div className="h-7 w-7 rounded-lg bg-muted animate-pulse ml-auto" /></TableCell>
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
  const isCompact = viewMode === 'compact'
  const canViewCost = useCanViewCost()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (productId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const allSelected = products.length > 0 && products.every(p => selectedProductIds.includes(p.id))
  const someSelected = products.some(p => selectedProductIds.includes(p.id)) && !allSelected

  if (products.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border/50 rounded-2xl bg-muted/20">
        <div className="relative mb-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
            <Package className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <Sparkles className="h-6 w-6 text-primary/60 absolute -top-1.5 -right-1.5 animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">No se encontraron productos</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          No hay productos que coincidan con los filtros aplicados.
        </p>
      </div>
    )
  }

  return (
    <div className={cn(
      'overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm',
      className,
    )}>
      <div className="overflow-x-auto" role="region" aria-label="Tabla de productos" tabIndex={0}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-border/60">
              <TableHead className="w-10 pl-4 pr-2">
                <Checkbox
                  checked={allSelected ? true : (someSelected ? 'indeterminate' : false)}
                  onCheckedChange={onSelectAll}
                  aria-label="Seleccionar todos"
                  className="border-muted-foreground/40"
                />
              </TableHead>

              <TableHead className={cn('w-16', isCompact && 'w-10')} />

              <TableHead className="min-w-[180px]">
                <SortButton label="Producto" field="name" sortConfig={sortConfig} onSort={onSort} />
              </TableHead>

              <TableHead className="w-32">
                <SortButton label="SKU" field="sku" sortConfig={sortConfig} onSort={onSort} />
              </TableHead>

              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo / Variantes
              </TableHead>

              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Categoría
              </TableHead>

              <TableHead className="text-right">
                <div className="flex justify-end">
                  <SortButton label="Stock" field="stock_quantity" sortConfig={sortConfig} onSort={onSort} />
                </div>
              </TableHead>

              <TableHead className="text-right">
                <div className="flex justify-end">
                  <SortButton label="Precio" field="sale_price" sortConfig={sortConfig} onSort={onSort} />
                </div>
              </TableHead>

              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Estado
              </TableHead>

              {onToggleActive && (
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Público
                </TableHead>
              )}

              <TableHead className="w-12 pr-4" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} compact={isCompact} />)
              : products.map((product) => {
                  const isService = isServiceLikeProduct(product)
                  const isSelected = selectedProductIds.includes(product.id)
                  const stockStatus = getStockStatus(product)
                  const cfg = STOCK_CONFIG[stockStatus]
                  const stockPct = Math.min(
                    100,
                    (product.stock_quantity / Math.max((product.min_stock || 0) * 3, 1)) * 100,
                  )

                  const productImages = Array.isArray(product.images)
                    ? product.images.filter((value): value is string => typeof value === 'string')
                    : []
                  const imageUrl = productImages[0] || product.image || product.image_url || undefined
                  const hasImage = imageUrl && (
                    imageUrl.startsWith('data:image') ||
                    imageUrl.startsWith('/') ||
                    imageUrl.startsWith('http')
                  )

                  const isVisible = product.is_active && product.visibility !== 'hidden'
                  const isWholesale = product.visibility === 'wholesale'

                  const variants = getNormalizedVariants(product)
                  const hasVariants = variants.length > 0 || Boolean((product as any).has_variants)
                  const isExpanded = expandedIds.has(product.id)
                  const totalVariantStock = variants.length > 0
                    ? variants.reduce((acc, v) => acc + v.stockQuantity, 0)
                    : product.stock_quantity

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
                          'hover:bg-muted/30',
                          isSelected && 'bg-primary/5 hover:bg-primary/8',
                          isExpanded && 'bg-violet-50/40 dark:bg-violet-950/20 border-b-0',
                        )}
                      >
                        {/* Checkbox */}
                        <TableCell className={cn('pl-4 pr-2', isCompact ? 'py-2' : 'py-3.5')}>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => onSelect(product.id)}
                              aria-label={`Seleccionar ${product.name}`}
                              className="border-muted-foreground/40"
                            />
                          </div>
                        </TableCell>

                        {/* Image */}
                        <TableCell className={cn(isCompact ? 'py-2' : 'py-3.5')}>
                          <div className={cn(
                            'relative shrink-0 overflow-hidden rounded-xl bg-muted border border-border/40',
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
                                  <Wrench className={cn('text-purple-500/60', isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
                                ) : (
                                  <Package className={cn('text-muted-foreground/40', isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Name + Variant toggle button */}
                        <TableCell className={cn(isCompact ? 'py-2' : 'py-3.5')}>
                          <div className="max-w-[240px]">
                            <p className={cn(
                              'font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors',
                              isCompact ? 'text-xs' : 'text-sm',
                            )}>
                              {product.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {!isCompact && product.brand && (
                                <span className="text-xs text-muted-foreground/70 truncate">{product.brand}</span>
                              )}
                              {variants.length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleExpanded(product.id)
                                  }}
                                  className={cn(
                                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all shadow-2xs',
                                    isExpanded
                                      ? 'bg-violet-600 text-white'
                                      : 'bg-violet-50 text-violet-700 border border-violet-200/80 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
                                  )}
                                  title="Ver desglose de variantes y stock"
                                >
                                  <Layers3 className="h-2.5 w-2.5" />
                                  <span>{variants.length} variantes</span>
                                  {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* SKU */}
                        <TableCell className={cn(isCompact ? 'py-2' : 'py-3.5')}>
                          <span className={cn(
                            'inline-flex items-center rounded-md border bg-muted/60 font-mono text-muted-foreground',
                            isCompact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
                          )}>
                            {product.sku}
                          </span>
                        </TableCell>

                        {/* Tipo / Variantes */}
                        <TableCell className={cn(isCompact ? 'py-2' : 'py-3.5')}>
                          {isService ? (
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full border font-bold',
                              'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
                              isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
                            )}>
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
                                'inline-flex items-center gap-1.5 rounded-full border font-bold transition-all',
                                'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/60',
                                isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
                              )}
                            >
                              <Layers3 className="h-2.5 w-2.5 text-violet-600 dark:text-violet-400" />
                              {variants.length} vars
                              {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                            </button>
                          ) : (
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full border font-medium',
                              'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60',
                              isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
                            )}>
                              <Package className="h-2.5 w-2.5" />
                              Simple
                            </span>
                          )}
                        </TableCell>

                        {/* Category */}
                        <TableCell className={cn(isCompact ? 'py-2' : 'py-3.5')}>
                          {product.category?.name ? (
                            <span className={cn(
                              'inline-flex items-center rounded-full border bg-primary/5 text-primary border-primary/20 font-medium',
                              isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
                            )}>
                              {product.category.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </TableCell>

                        {/* Stock */}
                        <TableCell className={cn('text-right', isCompact ? 'py-2' : 'py-3.5')}>
                          {isService ? (
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                Sin límite
                              </span>
                              <span className="text-[10px] text-muted-foreground/60">Servicio</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-baseline gap-1">
                                <span className={cn(
                                  'font-bold tabular-nums leading-none',
                                  isCompact ? 'text-xs' : 'text-sm',
                                  cfg.text,
                                )}>
                                  {variants.length > 0 ? totalVariantStock : product.stock_quantity}
                                </span>
                                {!isCompact && product.min_stock != null && (
                                  <span className="text-[10px] text-muted-foreground/50">/ {product.min_stock}</span>
                                )}
                              </div>
                              {variants.length > 0 ? (
                                <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                                  en {variants.length} vars
                                </span>
                              ) : !isCompact ? (
                                <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={cn('h-full rounded-full transition-all duration-500', cfg.bar)}
                                    style={{ width: `${stockPct}%` }}
                                  />
                                </div>
                              ) : null}
                            </div>
                          )}
                        </TableCell>

                        {/* Price */}
                        <TableCell className={cn('text-right', isCompact ? 'py-2' : 'py-3.5')}>
                          <span className={cn(
                            'font-bold tabular-nums text-foreground',
                            isCompact ? 'text-xs' : 'text-sm',
                          )}>
                            {formatCurrency(product.sale_price)}
                          </span>
                        </TableCell>

                        {/* Status badge */}
                        <TableCell className={cn(isCompact ? 'py-2' : 'py-3.5')}>
                          {isService ? (
                            <span className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border font-medium',
                              isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
                              product.is_active
                                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60'
                                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                            )}>
                              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', product.is_active ? 'bg-purple-500' : 'bg-slate-400')} />
                              {product.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          ) : (
                            <span className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border font-medium',
                              isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
                              cfg.badge,
                            )}>
                              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cfg.dot)} />
                              {cfg.label}
                            </span>
                          )}
                        </TableCell>

                        {/* Visibility toggle */}
                        {onToggleActive && (
                          <TableCell
                            className={cn('text-center', isCompact ? 'py-2' : 'py-3.5')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <Switch
                                checked={isVisible}
                                onCheckedChange={(checked) => onToggleActive(product, checked)}
                                aria-label={isVisible ? 'Ocultar del catálogo' : 'Publicar en catálogo'}
                                className="data-[state=checked]:bg-emerald-500 scale-90"
                              />
                              <span className={cn(
                                'flex items-center gap-0.5 font-semibold leading-none',
                                isCompact ? 'text-[9px]' : 'text-[10px]',
                                isVisible ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60',
                              )}>
                                {!product.is_active ? (
                                  <><EyeOff className="h-2.5 w-2.5" />Inactivo</>
                                ) : product.visibility === 'hidden' ? (
                                  <><EyeOff className="h-2.5 w-2.5" />Oculto</>
                                ) : isWholesale ? (
                                  <><Globe className="h-2.5 w-2.5 text-blue-500" />Mayorista</>
                                ) : (
                                  <><Globe className="h-2.5 w-2.5" />Visible</>
                                )}
                              </span>
                            </div>
                          </TableCell>
                        )}

                        {/* Actions dropdown */}
                        <TableCell className={cn('pr-4 text-right', isCompact ? 'py-2' : 'py-3.5')}>
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    'opacity-0 group-hover:opacity-100 transition-opacity data-[state=open]:opacity-100',
                                    'hover:bg-muted rounded-lg',
                                    isCompact ? 'h-6 w-6' : 'h-8 w-8',
                                  )}
                                  aria-label="Acciones del producto"
                                >
                                  <MoreHorizontal className={cn(isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => onViewDetails(product)} className="gap-2 cursor-pointer">
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                  Ver detalles
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEdit(product)} className="gap-2 cursor-pointer">
                                  <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(product)} className="gap-2 cursor-pointer">
                                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(product)}
                                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
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
                          <TableCell colSpan={onToggleActive ? 11 : 10} className="p-0 pl-10 pr-6 py-4">
                            <div className="space-y-3 rounded-2xl border border-violet-200/80 dark:border-violet-800/60 bg-white/90 dark:bg-slate-900/90 p-4 shadow-sm">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white shadow-xs">
                                    <Layers3 className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                      Desglose de Stock por Variante ({product.name})
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {variants.length} combinaciones disponibles · Stock total: <strong className="text-slate-700 dark:text-slate-200">{totalVariantStock} unidades</strong>
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
                                              'tabular-nums px-2 py-0.5 rounded-full text-xs',
                                              isOut
                                                ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
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
  )
}
