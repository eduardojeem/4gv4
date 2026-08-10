/**
 * ProductTable Component - Premium Edition
 * Redesigned with modern aesthetics, better information density and premium UX
 */

import React from 'react'
import Image from 'next/image'
import {
  ArrowUpDown, ArrowUp, ArrowDown,
  Edit, Trash2, Copy, Eye, Package,
  TrendingUp, AlertTriangle, XCircle,
  Sparkles, Globe, EyeOff, MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Product } from '@/types/products'
import { SortConfig } from '@/types/products-dashboard'
import { getStockStatus } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'

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

                  return (
                    <TableRow
                      key={product.id}
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
                              <Package className={cn('text-muted-foreground/40', isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Name */}
                      <TableCell className={cn(isCompact ? 'py-2' : 'py-3.5')}>
                        <div className="max-w-[220px]">
                          <p className={cn(
                            'font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors',
                            isCompact ? 'text-xs' : 'text-sm',
                          )}>
                            {product.name}
                          </p>
                          {!isCompact && product.brand && (
                            <p className="mt-0.5 text-xs text-muted-foreground/70 truncate">{product.brand}</p>
                          )}
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
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-baseline gap-1">
                            <span className={cn(
                              'font-bold tabular-nums leading-none',
                              isCompact ? 'text-xs' : 'text-sm',
                              cfg.text,
                            )}>
                              {product.stock_quantity}
                            </span>
                            {!isCompact && product.min_stock != null && (
                              <span className="text-[10px] text-muted-foreground/50">/ {product.min_stock}</span>
                            )}
                          </div>
                          {!isCompact && (
                            <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn('h-full rounded-full transition-all duration-500', cfg.bar)}
                                style={{ width: `${stockPct}%` }}
                              />
                            </div>
                          )}
                        </div>
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
                        <span className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border font-medium',
                          isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
                          cfg.badge,
                        )}>
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cfg.dot)} />
                          {cfg.label}
                        </span>
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
                  )
                })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
