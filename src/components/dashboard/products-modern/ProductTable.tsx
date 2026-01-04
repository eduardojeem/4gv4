/**
 * ProductTable Component - Modern Edition
 * Enhanced table view for products with premium aesthetics and improved UX
 */

import React from 'react'
import Image from 'next/image'
import { ArrowUpDown, ArrowUp, ArrowDown, Edit, Trash2, Copy, Eye, Package, TrendingUp, AlertTriangle, XCircle, Sparkles } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Product } from '@/types/products'
import { SortConfig } from '@/types/products-dashboard'
import { getStockStatus } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'

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
  loading?: boolean
  className?: string
  viewMode?: 'table' | 'compact'
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
  loading = false,
  className,
  viewMode = 'table'
}: ProductTableProps) {
  const isCompact = viewMode === 'compact'
  const allSelected = products.length > 0 && products.every(p => selectedProductIds.includes(p.id))
  const someSelected = products.some(p => selectedProductIds.includes(p.id)) && !allSelected

  const getSortIcon = (field: SortConfig['field']) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-blue-600" />
    ) : (
      <ArrowDown className="h-4 w-4 text-blue-600" />
    )
  }

  const stockStatusConfig = {
    in_stock: {
      label: 'En Stock',
      bgClass: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      lightBg: 'bg-emerald-50 dark:bg-emerald-950/30',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      borderClass: 'border-emerald-200 dark:border-emerald-900',
      icon: TrendingUp
    },
    low_stock: {
      label: 'Bajo Stock',
      bgClass: 'bg-gradient-to-r from-amber-500 to-orange-500',
      lightBg: 'bg-amber-50 dark:bg-amber-950/30',
      textClass: 'text-amber-700 dark:text-amber-400',
      borderClass: 'border-amber-200 dark:border-amber-900',
      icon: AlertTriangle
    },
    out_of_stock: {
      label: 'Agotado',
      bgClass: 'bg-gradient-to-r from-red-500 to-rose-500',
      lightBg: 'bg-red-50 dark:bg-red-950/30',
      textClass: 'text-red-700 dark:text-red-400',
      borderClass: 'border-red-200 dark:border-red-900',
      icon: XCircle
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-lg animate-pulse relative overflow-hidden"
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 dark:via-gray-700/60 to-transparent" />
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="relative mb-6">
          <Package className="w-24 h-24 text-gray-300 dark:text-gray-600" />
          <Sparkles className="h-8 w-8 text-purple-400 absolute -top-2 -right-2 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          No se encontraron productos
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
          No hay productos que coincidan con los filtros aplicados. Intenta ajustar tus criterios de búsqueda.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm bg-white dark:bg-gray-800', className)}>
      <div className="overflow-x-auto" role="region" aria-label="Tabla de productos" tabIndex={0}>
        <Table>
          <TableHeader className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 sticky top-0 z-10 border-b-2 border-gray-100 dark:border-gray-700">
            <TableRow className="hover:bg-transparent">
              {/* Select All Checkbox */}
              <TableHead className={cn("w-12", isCompact && "h-8 py-1")}>
                <Checkbox
                  checked={allSelected ? true : (someSelected ? 'indeterminate' : false)}
                  onCheckedChange={onSelectAll}
                  aria-label={allSelected ? 'Deseleccionar todos los productos' : 'Seleccionar todos los productos'}
                  className="border-gray-400 dark:border-gray-500"
                />
              </TableHead>

              {/* Image */}
              <TableHead className={cn("w-20 font-semibold text-gray-700 dark:text-gray-300", isCompact && "h-8 py-1 w-12")}>Imagen</TableHead>

              {/* Name - Sortable */}
              <TableHead className={cn(isCompact && "h-8 py-1")}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("-ml-3 h-9 font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors", isCompact && "h-7 text-xs")}
                  onClick={() => onSort('name')}
                  aria-label={`Ordenar por nombre ${sortConfig.field === 'name' ? (sortConfig.direction === 'asc' ? 'descendente' : 'ascendente') : ''}`}
                >
                  Nombre
                  {getSortIcon('name')}
                </Button>
              </TableHead>

              {/* SKU - Sortable */}
              <TableHead className={cn(isCompact && "h-8 py-1")}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("-ml-3 h-9 font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors", isCompact && "h-7 text-xs")}
                  onClick={() => onSort('sku')}
                  aria-label={`Ordenar por SKU ${sortConfig.field === 'sku' ? (sortConfig.direction === 'asc' ? 'descendente' : 'ascendente') : ''}`}
                >
                  SKU
                  {getSortIcon('sku')}
                </Button>
              </TableHead>

              {/* Category */}
              <TableHead className={cn("font-semibold text-gray-700 dark:text-gray-300", isCompact && "h-8 py-1 text-xs")}>Categoría</TableHead>

              {/* Stock - Sortable */}
              <TableHead className={cn("text-right", isCompact && "h-8 py-1")}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("-ml-3 h-9 font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors", isCompact && "h-7 text-xs")}
                  onClick={() => onSort('stock_quantity')}
                >
                  Inventario
                  {getSortIcon('stock_quantity')}
                </Button>
              </TableHead>

              {/* Price - Sortable */}
              <TableHead className={cn("text-right", isCompact && "h-8 py-1")}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("-ml-3 h-9 font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors", isCompact && "h-7 text-xs")}
                  onClick={() => onSort('sale_price')}
                >
                  Precio
                  {getSortIcon('sale_price')}
                </Button>
              </TableHead>

              {/* Status */}
              <TableHead className={cn("font-semibold text-gray-700 dark:text-gray-300", isCompact && "h-8 py-1 text-xs")}>Estado</TableHead>

              {/* Actions */}
              <TableHead className={cn("text-right w-40 font-semibold text-gray-700 dark:text-gray-300", isCompact && "h-8 py-1 text-xs")}>Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {products.map((product) => {
              const isSelected = selectedProductIds.includes(product.id)
              const stockStatus = getStockStatus(product)
              const statusConfig = stockStatusConfig[stockStatus]
              const StatusIcon = statusConfig.icon
              const stockPercentage = Math.min(100, (product.stock_quantity / (product.min_stock * 3)) * 100)

              return (
                <TableRow
                  key={product.id}
                  className={cn(
                    'transition-all duration-200 border-b border-gray-100 dark:border-gray-700',
                    'hover:bg-gradient-to-r hover:from-blue-50/30 hover:via-transparent hover:to-transparent dark:hover:from-blue-900/10',
                    'hover:shadow-sm',
                    isSelected && 'bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20 dark:ring-blue-400/20 ring-inset'
                  )}
                  onClick={() => onViewDetails(product)}
                  role="button"
                >
                  {/* Checkbox */}
                  <TableCell className={cn(isCompact && "py-1")}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onSelect(product.id)}
                      className="border-gray-400 dark:border-gray-500"
                    />
                  </TableCell>

                  {/* Image */}
                  <TableCell className={cn(isCompact && "py-1")}>
                    <div className={cn(
                      "relative rounded-lg overflow-hidden bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 shadow-sm group-hover:shadow-md transition-shadow",
                      isCompact ? "w-8 h-8" : "w-14 h-14"
                    )}>
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover transition-transform duration-200 hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className={cn("text-gray-300 dark:text-gray-600", isCompact ? "h-4 w-4" : "h-7 w-7")} />
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Name */}
                  <TableCell className={cn(isCompact && "py-1")}>
                    <div className="max-w-xs">
                      <p className={cn(
                        "font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors",
                        isCompact ? "text-sm" : ""
                      )}>
                        {product.name}
                      </p>
                      {!isCompact && product.brand && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{product.brand}</p>
                      )}
                    </div>
                  </TableCell>

                  {/* SKU */}
                  <TableCell className={cn(isCompact && "py-1")}>
                    <Badge variant="outline" className={cn(
                      "font-mono text-xs bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800",
                      isCompact ? "px-1.5 py-0.5" : "px-2.5 py-1"
                    )}>
                      {product.sku}
                    </Badge>
                  </TableCell>

                  {/* Category */}
                  <TableCell className={cn(isCompact && "py-1")}>
                    {product.category?.name ? (
                      <Badge variant="secondary" className={cn(
                        "text-xs font-medium bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-100 dark:from-blue-950/30 dark:to-indigo-950/30 dark:text-blue-300 dark:border-blue-900/50",
                        isCompact ? "px-1.5 py-0.5" : "px-2.5 py-1"
                      )}>
                        {product.category.name}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">Sin categoría</span>
                    )}
                  </TableCell>

                  {/* Stock with Progress Bar */}
                  <TableCell className={cn("text-right", isCompact && "py-1")}>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-baseline gap-1">
                        <span className={cn(
                          "font-bold tabular-nums",
                          isCompact ? "text-xs" : "text-sm",
                          stockStatus === 'in_stock' && "text-emerald-600 dark:text-emerald-400",
                          stockStatus === 'low_stock' && "text-amber-600 dark:text-amber-400",
                          stockStatus === 'out_of_stock' && "text-red-600 dark:text-red-400"
                        )}>
                          {product.stock_quantity}
                        </span>
                        {!isCompact && <span className="text-xs text-gray-400 dark:text-gray-500">/ {product.min_stock}</span>}
                      </div>

                      {/* Mini Progress Bar */}
                      {!isCompact && (
                        <div className="w-16 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              statusConfig.bgClass
                            )}
                            style={{ width: `${stockPercentage}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Price */}
                  <TableCell className={cn("text-right", isCompact && "py-1")}>
                    <span className={cn(
                      "font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent",
                      isCompact ? "text-sm" : "text-base"
                    )}>
                      ${product.sale_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell className={cn(isCompact && "py-1")}>
                    <div className="flex flex-col gap-1.5">
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full font-bold text-white w-fit',
                          statusConfig.bgClass,
                          isCompact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
                        )}
                      >
                        <StatusIcon className={cn(isCompact ? "h-2.5 w-2.5" : "h-3 w-3")} />
                        {statusConfig.label}
                      </div>
                      {!product.is_active && !isCompact && (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 font-medium w-fit">
                          ⏸ Inactivo
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className={cn(isCompact && "py-1")}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors",
                          isCompact ? "h-6 w-6" : "h-8 w-8"
                        )}
                        onClick={(e) => { e.stopPropagation(); onViewDetails(product) }}
                        title="Ver detalles"
                      >
                        <Eye className={cn(isCompact ? "h-3 w-3" : "h-4 w-4")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors",
                          isCompact ? "h-6 w-6" : "h-8 w-8"
                        )}
                        onClick={(e) => { e.stopPropagation(); onEdit(product) }}
                        title="Editar"
                      >
                        <Edit className={cn(isCompact ? "h-3 w-3" : "h-4 w-4")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "hover:bg-purple-100 hover:text-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-400 transition-colors",
                          isCompact ? "h-6 w-6" : "h-8 w-8"
                        )}
                        onClick={(e) => { e.stopPropagation(); onDuplicate(product) }}
                        title="Duplicar"
                      >
                        <Copy className={cn(isCompact ? "h-3 w-3" : "h-4 w-4")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors",
                          isCompact ? "h-6 w-6" : "h-8 w-8"
                        )}
                        onClick={(e) => { e.stopPropagation(); onDelete(product) }}
                        title="Eliminar"
                      >
                        <Trash2 className={cn(isCompact ? "h-3 w-3" : "h-4 w-4")} />
                      </Button>
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
