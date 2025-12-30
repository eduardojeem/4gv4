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
  className
}: ProductTableProps) {
  const allSelected = products.length > 0 && selectedProductIds.length === products.length
  const someSelected = selectedProductIds.length > 0 && selectedProductIds.length < products.length

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
      lightBg: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
      icon: TrendingUp
    },
    low_stock: {
      label: 'Bajo Stock',
      bgClass: 'bg-gradient-to-r from-amber-500 to-orange-500',
      lightBg: 'bg-amber-50',
      textClass: 'text-amber-700',
      borderClass: 'border-amber-200',
      icon: AlertTriangle
    },
    out_of_stock: {
      label: 'Agotado',
      bgClass: 'bg-gradient-to-r from-red-500 to-rose-500',
      lightBg: 'bg-red-50',
      textClass: 'text-red-700',
      borderClass: 'border-red-200',
      icon: XCircle
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-lg animate-pulse relative overflow-hidden"
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 to-white">
        <div className="relative mb-6">
          <Package className="w-24 h-24 text-gray-300" />
          <Sparkles className="h-8 w-8 text-purple-400 absolute -top-2 -right-2 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          No se encontraron productos
        </h3>
        <p className="text-gray-600 max-w-md mb-6">
          No hay productos que coincidan con los filtros aplicados. Intenta ajustar tus criterios de búsqueda.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white', className)}>
      <div className="overflow-x-auto" role="region" aria-label="Tabla de productos" tabIndex={0}>
        <Table>
          <TableHeader className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 sticky top-0 z-10 border-b-2 border-gray-100">
            <TableRow className="hover:bg-transparent">
              {/* Select All Checkbox */}
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onCheckedChange={onSelectAll}
                  aria-label={allSelected ? 'Deseleccionar todos los productos' : 'Seleccionar todos los productos'}
                  className="border-gray-400"
                />
              </TableHead>

              {/* Image */}
              <TableHead className="w-20 font-semibold text-gray-700">Imagen</TableHead>

              {/* Name - Sortable */}
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-9 font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  onClick={() => onSort('name')}
                  aria-label={`Ordenar por nombre ${sortConfig.field === 'name' ? (sortConfig.direction === 'asc' ? 'descendente' : 'ascendente') : ''}`}
                >
                  Nombre
                  {getSortIcon('name')}
                </Button>
              </TableHead>

              {/* SKU - Sortable */}
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-9 font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  onClick={() => onSort('sku')}
                  aria-label={`Ordenar por SKU ${sortConfig.field === 'sku' ? (sortConfig.direction === 'asc' ? 'descendente' : 'ascendente') : ''}`}
                >
                  SKU
                  {getSortIcon('sku')}
                </Button>
              </TableHead>

              {/* Category */}
              <TableHead className="font-semibold text-gray-700">Categoría</TableHead>

              {/* Stock - Sortable */}
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-9 font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  onClick={() => onSort('stock_quantity')}
                >
                  Inventario
                  {getSortIcon('stock_quantity')}
                </Button>
              </TableHead>

              {/* Price - Sortable */}
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-9 font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  onClick={() => onSort('sale_price')}
                >
                  Precio
                  {getSortIcon('sale_price')}
                </Button>
              </TableHead>

              {/* Status */}
              <TableHead className="font-semibold text-gray-700">Estado</TableHead>

              {/* Actions */}
              <TableHead className="text-right w-40 font-semibold text-gray-700">Acciones</TableHead>
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
                    'transition-all duration-200 border-b border-gray-100',
                    'hover:bg-gradient-to-r hover:from-blue-50/30 hover:via-transparent hover:to-transparent',
                    'hover:shadow-sm',
                    isSelected && 'bg-blue-50/50 ring-2 ring-blue-500/20 ring-inset'
                  )}
                  onClick={() => onViewDetails(product)}
                  role="button"
                >
                  {/* Checkbox */}
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onSelect(product.id)}
                      className="border-gray-400"
                    />
                  </TableCell>

                  {/* Image */}
                  <TableCell>
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100 shadow-sm group-hover:shadow-md transition-shadow">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          className="object-cover transition-transform duration-200 hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-7 w-7 text-gray-300" />
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Name */}
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </p>
                      {product.brand && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{product.brand}</p>
                      )}
                    </div>
                  </TableCell>

                  {/* SKU */}
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 bg-slate-50 text-slate-700 border-slate-200">
                      {product.sku}
                    </Badge>
                  </TableCell>

                  {/* Category */}
                  <TableCell>
                    {product.category?.name ? (
                      <Badge variant="secondary" className="text-xs font-medium px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-100">
                        {product.category.name}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">Sin categoría</span>
                    )}
                  </TableCell>

                  {/* Stock with Progress Bar */}
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-baseline gap-1">
                        <span className={cn(
                          "font-bold tabular-nums text-sm",
                          stockStatus === 'in_stock' && "text-emerald-600",
                          stockStatus === 'low_stock' && "text-amber-600",
                          stockStatus === 'out_of_stock' && "text-red-600"
                        )}>
                          {product.stock_quantity}
                        </span>
                        <span className="text-xs text-gray-400">/ {product.min_stock}</span>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            statusConfig.bgClass
                          )}
                          style={{ width: `${stockPercentage}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>

                  {/* Price */}
                  <TableCell className="text-right">
                    <span className="font-bold text-base bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                      ${product.sale_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white w-fit',
                          statusConfig.bgClass
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </div>
                      {!product.is_active && (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200 font-medium w-fit">
                          ⏸ Inactivo
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onViewDetails(product) }}
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-green-100 hover:text-green-600 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onEdit(product) }}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-purple-100 hover:text-purple-600 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onDuplicate(product) }}
                        title="Duplicar"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-red-100 hover:text-red-600 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onDelete(product) }}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
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
