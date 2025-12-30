'use client'

import { useState } from 'react'
import { Edit, Eye, Package, MoreHorizontal, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/products'

interface ProductListOptimizedProps {
  products: Product[]
  loading?: boolean
  selectedProducts?: string[]
  onProductSelect?: (productId: string) => void
  onProductSelectAll?: (selected: boolean) => void
  onProductEdit?: (product: Product) => void
  onProductView?: (product: Product) => void
  onSort?: (field: string) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  className?: string
}

// Función simplificada para estado de stock
const getStockBadge = (current: number, min: number) => {
  if (current === 0) {
    return <Badge variant="destructive">Agotado</Badge>
  }
  if (current <= min) {
    return <Badge variant="secondary">Bajo</Badge>
  }
  return <Badge variant="default">Disponible</Badge>
}

// Componente de acciones simplificado
const ProductActions = ({ 
  product, 
  onEdit, 
  onView 
}: { 
  product: Product
  onEdit?: (product: Product) => void
  onView?: (product: Product) => void
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onView?.(product)}>
        <Eye className="mr-2 h-4 w-4" />
        Ver
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onEdit?.(product)}>
        <Edit className="mr-2 h-4 w-4" />
        Editar
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

// Componente de encabezado ordenable
const SortableHeader = ({ 
  children, 
  field, 
  sortBy, 
  sortOrder, 
  onSort 
}: {
  children: React.ReactNode
  field: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void
}) => (
  <TableHead>
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-semibold hover:bg-transparent"
      onClick={() => onSort?.(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  </TableHead>
)

export default function ProductListOptimized({
  products,
  loading = false,
  selectedProducts = [],
  onProductSelect,
  onProductSelectAll,
  onProductEdit,
  onProductView,
  onSort,
  sortBy,
  sortOrder,
  className
}: ProductListOptimizedProps) {
  if (loading) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  const allSelected = products.length > 0 && selectedProducts.length === products.length
  const someSelected = selectedProducts.length > 0 && selectedProducts.length < products.length

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50">
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as any).indeterminate = someSelected
                }}
                onCheckedChange={(checked) => onProductSelectAll?.(!!checked)}
              />
            </TableHead>
            <TableHead>Producto</TableHead>
            <SortableHeader field="category" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort}>
              Categoría
            </SortableHeader>
            <SortableHeader field="stock_quantity" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort}>
              Stock
            </SortableHeader>
            <SortableHeader field="sale_price" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort}>
              Precio
            </SortableHeader>
            <TableHead>Estado</TableHead>
            <TableHead className="w-16">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const isSelected = selectedProducts.includes(product.id)
            const isOutOfStock = product.stock_quantity === 0

            return (
              <TableRow 
                key={product.id}
                className={cn(
                  "hover:bg-gray-50/50 transition-colors",
                  isSelected && "bg-blue-50/50",
                  isOutOfStock && "opacity-60"
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onProductSelect?.(product.id)}
                  />
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-lg">
                      <AvatarImage src={(product as any).image || (product as any).images?.[0]} alt={product.name} />
                      <AvatarFallback className="rounded-lg bg-gray-100 text-gray-600 text-sm">
                        {product.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-sm text-gray-500 truncate">SKU: {product.sku}</p>
                    </div>
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {typeof product.category === 'string' ? product.category : (product.category as any)?.name || 'Sin categoría'}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <div className="text-sm">
                    <span className="font-medium">{product.stock_quantity}</span>
                    <span className="text-gray-500 ml-1">unidades</span>
                  </div>
                </TableCell>
                
                <TableCell>
                  <span className="font-semibold text-green-600">
                    ${product.sale_price.toFixed(2)}
                  </span>
                </TableCell>
                
                <TableCell>
                  {getStockBadge(product.stock_quantity, product.min_stock)}
                </TableCell>
                
                <TableCell>
                  <ProductActions
                    product={product}
                    onEdit={onProductEdit}
                    onView={onProductView}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      
      {products.length === 0 && (
        <div className="p-8 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay productos</h3>
          <p className="text-gray-500">Comienza agregando tu primer producto.</p>
        </div>
      )}
    </Card>
  )
}