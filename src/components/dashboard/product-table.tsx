'use client'

import { useState } from 'react'
import { 
  Edit, 
  Trash2, 
  Package, 
  AlertTriangle, 
  Star, 
  Eye, 
  ShoppingCart, 
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatCurrency } from '@/lib/currency'
import { resolveProductImageUrl } from '@/lib/images'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Product } from '@/lib/types/product'

interface ProductTableProps {
  products: Product[]
  loading?: boolean
  onEdit?: (product: Product) => void
  onDelete?: (productId: string) => void
  onStockAdjust?: (product: Product) => void
  onView?: (product: Product) => void
  onAddToCart?: (product: Product) => void
  onInlineUpdate?: (id: string, field: 'stock' | 'min_stock', value: number) => void
  // Props opcionales aceptados por compatibilidad con page.tsx
  selectedProducts?: string[]
  onSelectionChange?: (ids: string[]) => void
  onEditProduct?: (product: Product) => void
  onDeleteProduct?: (productId: string) => void
  onDuplicateProduct?: (product: Product) => void
  onToggleFeatured?: (productId: string) => void
  // Término de búsqueda para resaltar coincidencias
  highlightTerm?: string
  // Acciones para estado vacío
  onClearFilters?: () => void
  onCreateProduct?: () => void
  className?: string
}

type SortField = 'name' | 'category' | 'stock_quantity' | 'sale_price' | 'purchase_price' | 'margin' | 'supplier'
type SortDirection = 'asc' | 'desc'

const getStockStatus = (current: number, min: number) => {
  if (current === 0) return { 
    label: 'Agotado', 
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertTriangle,
    severity: 'critical'
  }
  if (current <= min) return { 
    label: 'Crítico', 
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: AlertTriangle,
    severity: 'warning'
  }
  if (current <= min * 1.5) return { 
    label: 'Bajo', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Package,
    severity: 'low'
  }
  return { 
    label: 'Normal', 
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: Package,
    severity: 'normal'
  }
}

// Colores suaves para categorías conocidas; por defecto azul
const getCategoryColor = (category?: string) => {
  const key = (category ?? '').toLowerCase()
  if (key.includes('electr')) return 'bg-indigo-100 text-indigo-800 border-indigo-200'
  if (key.includes('hogar')) return 'bg-teal-100 text-teal-800 border-teal-200'
  if (key.includes('ropa') || key.includes('vest')) return 'bg-pink-100 text-pink-800 border-pink-200'
  if (key.includes('oficina')) return 'bg-sky-100 text-sky-800 border-sky-200'
  if (key.includes('deporte')) return 'bg-lime-100 text-lime-800 border-lime-200'
  if (key.includes('alimento') || key.includes('bebida')) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-blue-100 text-blue-800 border-blue-200'
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text?: string, term?: string) {
  if (!text) return text
  if (!term) return text
  const safeTerm = escapeRegExp(term.trim())
  if (!safeTerm) return text
  const regex = new RegExp(`(${safeTerm})`, 'ig')
  const parts = String(text).split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="px-0.5 rounded bg-yellow-200 text-inherit">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export function ProductTable({ 
  products,
  loading = false,
  onEdit, 
  onDelete, 
  onStockAdjust, 
  onView, 
  onAddToCart,
  onInlineUpdate,
  highlightTerm,
  onClearFilters,
  onCreateProduct,
  className 
}: ProductTableProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedProducts = [...products].sort((a, b) => {
    const getValue = (p: Product): string | number => {
      switch (sortField) {
        case 'name':
          return (p.name || '').toLowerCase()
        case 'category':
          return (p.category || '').toLowerCase()
        case 'supplier':
          return (p.supplier || '').toLowerCase()
        case 'stock_quantity':
          return p.stock_quantity || 0
        case 'purchase_price':
          return p.purchase_price || 0
        case 'sale_price':
          return p.sale_price || 0
        case 'margin':
          return p.purchase_price > 0 ? ((p.sale_price - p.purchase_price) / p.purchase_price) * 100 : 0
        default:
          return 0
      }
    }

    const aValue = getValue(a)
    const bValue = getValue(b)

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      if (sortDirection === 'asc') return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }

    const aNum = typeof aValue === 'number' ? aValue : 0
    const bNum = typeof bValue === 'number' ? bValue : 0
    if (sortDirection === 'asc') return aNum - bNum
    return bNum - aNum
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  return (
    <div className={cn("rounded-md border overflow-auto max-h-[calc(100vh-320px)]", className)}>
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="w-[50px] sticky top-0 bg-background z-10">Imagen</TableHead>
            <TableHead aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className="sticky top-0 bg-background z-10">
              <Button 
                variant="ghost" 
                onClick={() => handleSort('name')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Producto
                <SortIcon field="name" />
              </Button>
            </TableHead>
            <TableHead aria-sort={sortField === 'category' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className="sticky top-0 bg-background z-10">
              <Button 
                variant="ghost" 
                onClick={() => handleSort('category')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Categoría
                <SortIcon field="category" />
              </Button>
            </TableHead>
            <TableHead aria-sort={sortField === 'stock_quantity' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className="sticky top-0 bg-background z-10">
              <Button 
                variant="ghost" 
                onClick={() => handleSort('stock_quantity')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Stock
                <SortIcon field="stock_quantity" />
              </Button>
            </TableHead>
            <TableHead aria-sort={sortField === 'purchase_price' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className="sticky top-0 bg-background z-10">
              <Button 
                variant="ghost" 
                onClick={() => handleSort('purchase_price')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Precio Compra
                <SortIcon field="purchase_price" />
              </Button>
            </TableHead>
            <TableHead aria-sort={sortField === 'sale_price' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className="sticky top-0 bg-background z-10">
              <Button 
                variant="ghost" 
                onClick={() => handleSort('sale_price')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Precio Venta
                <SortIcon field="sale_price" />
              </Button>
            </TableHead>
            <TableHead aria-sort={sortField === 'margin' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className="sticky top-0 bg-background z-10">
              <Button 
                variant="ghost" 
                onClick={() => handleSort('margin')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Margen
                <SortIcon field="margin" />
              </Button>
            </TableHead>
            <TableHead aria-sort={sortField === 'supplier' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className="sticky top-0 bg-background z-10">
              <Button 
                variant="ghost" 
                onClick={() => handleSort('supplier')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Proveedor
                <SortIcon field="supplier" />
              </Button>
            </TableHead>
            <TableHead className="text-right sticky top-0 bg-background z-10">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                <TableCell>
                  <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <div className="h-4 w-40 bg-muted animate-pulse" />
                    <div className="h-3 w-24 bg-muted animate-pulse" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-6 w-32 bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-24 bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-24 bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-16 bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-24 bg-muted animate-pulse" />
                </TableCell>
                <TableCell className="text-right">
                  <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))
          )}
          {!loading && sortedProducts.map((product) => {
            const stockStatus = getStockStatus(product.stock_quantity, product.min_stock)
            const margin = product.purchase_price > 0 
              ? ((product.sale_price - product.purchase_price) / product.purchase_price) * 100 
              : 0
            const isOutOfStock = product.stock_quantity === 0
            const StockIcon = stockStatus.icon
            
            return (
              <TableRow 
                key={product.id} 
                className={cn(
                  "group hover:bg-muted/50 transition-colors border-l-4",
                  isOutOfStock && "opacity-60",
                  stockStatus.severity === 'critical' && 'bg-red-50 border-red-300',
                  stockStatus.severity === 'warning' && 'bg-orange-50 border-orange-300',
                  stockStatus.severity === 'low' && 'bg-yellow-50 border-yellow-300',
                  stockStatus.severity === 'normal' && 'border-green-300'
                )}
                onClick={() => onView?.(product)}
                role="button"
              >
                <TableCell>
                  <Avatar className="h-10 w-10 rounded-lg">
                    <AvatarImage src={resolveProductImageUrl(product.image)} alt={product.name} />
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600 text-xs">
                      {product.image ? (
                        <ImageIcon className="h-4 w-4" />
                      ) : (
                        product.name.substring(0, 2).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{highlightText(product.name, highlightTerm)}</div>
                      {product.featured && (
                        <Badge className="bg-yellow-500 text-white text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Destacado
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {highlightText(product.sku, highlightTerm)}
                    </div>
                    {product.barcode && (
                      <div className="text-xs text-muted-foreground">
                        Código: {highlightText(product.barcode, highlightTerm)}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn('border', getCategoryColor(product.category))}>{highlightText(product.category, highlightTerm)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StockIcon className="h-4 w-4" />
                      <input
                        type="number"
                        className="w-16 text-sm bg-transparent outline-none border-b border-transparent focus:border-muted-foreground"
                        defaultValue={product.stock_quantity}
                        min={0}
                        step={1}
                        onBlur={(e) => {
                          let val = Number(e.target.value)
                          if (Number.isNaN(val)) return
                          val = Math.max(0, Math.round(val))
                          if (val !== product.stock_quantity && onInlineUpdate) onInlineUpdate(product.id, 'stock', val)
                        }}
                        aria-label="Stock"
                      />
                      <Badge className={stockStatus.color}>
                        {stockStatus.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>Mín:</span>
                      <input
                        type="number"
                        className="w-12 text-xs bg-transparent outline-none border-b border-transparent focus:border-muted-foreground"
                        defaultValue={product.min_stock}
                        min={0}
                        step={1}
                        onBlur={(e) => {
                          let val = Number(e.target.value)
                          if (Number.isNaN(val)) return
                          val = Math.max(0, Math.round(val))
                          if (val !== product.min_stock && onInlineUpdate) onInlineUpdate(product.id, 'min_stock', val)
                        }}
                        aria-label="Stock mínimo"
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatCurrency(product.purchase_price)}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-green-600">{formatCurrency(product.sale_price)}</div>
                </TableCell>
                <TableCell>
                  <Badge className={cn(
                    margin > 50 ? 'bg-green-100 text-green-800 border-green-200' : 
                    margin > 25 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-red-100 text-red-800 border-red-200'
                  )}>
                    {(Number.isFinite(margin) ? margin : 0).toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200">{highlightText(product.supplier, highlightTerm)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Quick Actions - Visible on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); onView?.(product) }}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); onEdit?.(product) }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!isOutOfStock && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); onAddToCart?.(product) }}
                          className="h-8 w-8 p-0"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* More Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView?.(product) }}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(product) }}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStockAdjust?.(product) }}>
                          <Package className="mr-2 h-4 w-4" />
                          Ajustar Stock
                        </DropdownMenuItem>
                        {!isOutOfStock && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAddToCart?.(product) }}>
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Agregar al Carrito
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); onDelete?.(product.id) }}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {!loading && sortedProducts.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-10 w-10 opacity-50" />
                    <div className="text-sm">No hay productos que coincidan con los filtros</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onClearFilters} aria-label="Limpiar filtros">
                      Limpiar filtros
                    </Button>
                    <Button size="sm" onClick={onCreateProduct} aria-label="Crear producto">
                      Crear producto
                    </Button>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
export default ProductTable
