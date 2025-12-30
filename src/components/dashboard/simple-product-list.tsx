'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Edit, Trash2, Eye, Copy } from 'lucide-react'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  stock_quantity: number
  min_stock: number
  sale_price: number
  purchase_price: number
  supplier: string
}

interface SimpleProductListProps {
  products: Product[]
  loading?: boolean
  viewMode?: 'table' | 'grid'
  selectedProducts?: string[]
  onProductSelect?: (productId: string) => void
  onProductSelectAll?: (selected: boolean) => void
  onProductEdit?: (product: Product) => void
  onProductDelete?: (product: Product) => void
  onProductView?: (product: Product) => void
  onProductDuplicate?: (product: Product) => void
  className?: string
}

import { formatCurrency } from '@/lib/currency'

const getStockStatus = (product: Product) => {
  if (product.stock_quantity <= 0) {
    return { status: 'out_of_stock', color: 'bg-red-500', text: 'Agotado' }
  } else if (product.stock_quantity <= product.min_stock) {
    return { status: 'low_stock', color: 'bg-yellow-500', text: 'Stock bajo' }
  } else {
    return { status: 'in_stock', color: 'bg-green-500', text: 'En stock' }
  }
}

export default function SimpleProductList({
  products,
  loading = false,
  viewMode = 'table',
  selectedProducts = [],
  onProductSelect,
  onProductSelectAll,
  onProductEdit,
  onProductDelete,
  onProductView,
  onProductDuplicate,
  className
}: SimpleProductListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-muted-foreground">Cargando productos...</div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <div className="text-muted-foreground mb-2">No hay productos disponibles</div>
        <div className="text-sm text-muted-foreground">Agrega tu primer producto para comenzar</div>
      </div>
    )
  }

  if (viewMode === 'grid') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {products.map((product) => {
          const stockInfo = getStockStatus(product)
          const isSelected = selectedProducts.includes(product.id)
          
          return (
            <Card key={product.id} className={`transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onProductSelect?.(product.id)}
                    />
                    <div>
                      <h3 className="font-medium text-sm">{product.name}</h3>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {product.category}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stock:</span>
                    <div className="flex items-center space-x-2">
                      <span>{product.stock_quantity}</span>
                      <div className={`w-2 h-2 rounded-full ${stockInfo.color}`} />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Precio:</span>
                    <span className="font-medium">{formatCurrency(product.sale_price)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Proveedor:</span>
                    <span className="truncate max-w-20">{product.supplier}</span>
                  </div>
                </div>
                
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onProductView?.(product)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onProductEdit?.(product)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onProductDuplicate?.(product)}
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onProductDelete?.(product)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedProducts.length === products.length}
                onCheckedChange={onProductSelectAll}
              />
            </TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead className="w-32">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const stockInfo = getStockStatus(product)
            const isSelected = selectedProducts.includes(product.id)
            
            return (
              <TableRow key={product.id} className={isSelected ? 'bg-muted/50' : ''}>
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onProductSelect?.(product.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                <TableCell>
                  <Badge variant="outline">{product.category}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <span>{product.stock_quantity}</span>
                    <div className={`w-2 h-2 rounded-full ${stockInfo.color}`} />
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(product.sale_price)}</TableCell>
                <TableCell className="truncate max-w-32">{product.supplier}</TableCell>
                <TableCell>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onProductView?.(product)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onProductEdit?.(product)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onProductDuplicate?.(product)}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onProductDelete?.(product)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
