'use client'

import { useState } from 'react'
import { 
  Package, 
  Edit, 
  Trash2, 
  Eye, 
  Copy, 
  MoreHorizontal,
  Star,
  StarOff,
  Tag,
  BarChart3,
  SortAsc,
  SortDesc,
  Download
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { formatCurrency } from '@/lib/currency'
import { resolveProductImageUrl } from '@/lib/images'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  stock_quantity: number
  min_stock: number
  max_stock?: number
  sale_price: number
  purchase_price: number
  supplier: string
  last_updated?: string
  status?: string
  image_url?: string
  image?: string
  images?: string[]
  description?: string
  barcode?: string
  weight?: number
  dimensions?: string
  location?: string
  tags?: string[]
  created_at?: string
  updated_at?: string
}

interface EnhancedProductListProps {
  products: Product[]
  loading?: boolean
  viewMode?: 'table' | 'grid' | 'compact'
  selectedProducts?: string[]
  onProductSelect?: (productId: string) => void
  onProductSelectAll?: (selected: boolean) => void
  onProductEdit?: (product: Product) => void
  onProductDelete?: (product: Product) => void
  onProductView?: (product: Product) => void
  onProductDuplicate?: (product: Product) => void
  onBulkAction?: (action: string, productIds: string[]) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void
  className?: string
}

const getStockStatus = (product: Product) => {
  if (product.stock_quantity <= 0) {
    return { status: 'out_of_stock', color: 'text-red-600', bgColor: 'bg-red-100', label: 'Sin stock' }
  } else if (product.stock_quantity <= product.min_stock) {
    return { status: 'low_stock', color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Stock bajo' }
  } else {
    return { status: 'in_stock', color: 'text-green-600', bgColor: 'bg-green-100', label: 'En stock' }
  }
}

 

// Componente simplificado sin Progress
const SimpleStockIndicator = ({ product }: { product: Product }) => {
  const stockInfo = getStockStatus(product)

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Badge variant="outline" className={cn("text-xs", stockInfo.color, stockInfo.bgColor)}>
          {stockInfo.label}
        </Badge>
        <span className="text-sm font-medium">{product.stock_quantity}</span>
      </div>
    </div>
  )
}

const ProductActions = ({ 
  product, 
  onProductView, 
  onProductEdit, 
  onProductDuplicate, 
  onProductDelete 
}: { 
  product: Product
  onProductView?: (product: Product) => void
  onProductEdit?: (product: Product) => void
  onProductDuplicate?: (product: Product) => void
  onProductDelete?: (product: Product) => void
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onProductView?.(product)}>
          <Eye className="h-4 w-4 mr-2" />
          Ver detalles
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onProductEdit?.(product)}>
          <Edit className="h-4 w-4 mr-2" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onProductDuplicate?.(product)}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => navigator.clipboard.writeText(product.sku)}
          className="text-muted-foreground"
        >
          <Tag className="h-4 w-4 mr-2" />
          Copiar SKU
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => navigator.clipboard.writeText(product.barcode || '')}
          className="text-muted-foreground"
          disabled={!product.barcode}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Copiar código de barras
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => onProductDelete?.(product)}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function EnhancedProductList({
  products,
  loading = false,
  selectedProducts = [],
  onProductSelect,
  onProductSelectAll,
  onProductEdit,
  onProductDelete,
  onProductView,
  onProductDuplicate,
  onBulkAction,
  sortBy,
  sortOrder,
  onSort,
  className
}: EnhancedProductListProps) {
  const [favorites, setFavorites] = useState<string[]>([])
  
  const someSelected = selectedProducts.length > 0
  const allSelected = selectedProducts.length === products.length && products.length > 0

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
  }

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Acciones en lote */}
      {someSelected && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">
                {selectedProducts.length} producto(s) seleccionado(s)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction?.('export', selectedProducts)}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction?.('update_stock', selectedProducts)}
              >
                <Package className="h-4 w-4 mr-2" />
                Actualizar Stock
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction?.('delete', selectedProducts)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tabla */}
      <Card className="overflow-hidden">
        <div className="rounded-md border overflow-auto max-h-[calc(100vh-320px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 sticky top-0 bg-background z-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onProductSelectAll}
                />
              </TableHead>
              <TableHead className="w-12 sticky top-0 bg-background z-10"></TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 sticky top-0 bg-background z-10"
                onClick={() => onSort?.('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Producto</span>
                  {getSortIcon('name')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 sticky top-0 bg-background z-10"
                onClick={() => onSort?.('sku')}
              >
                <div className="flex items-center space-x-1">
                  <span>SKU</span>
                  {getSortIcon('sku')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 sticky top-0 bg-background z-10"
                onClick={() => onSort?.('category')}
              >
                <div className="flex items-center space-x-1">
                  <span>Categoría</span>
                  {getSortIcon('category')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 sticky top-0 bg-background z-10"
                onClick={() => onSort?.('stock_quantity')}
              >
                <div className="flex items-center space-x-1">
                  <span>Stock</span>
                  {getSortIcon('stock_quantity')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 sticky top-0 bg-background z-10"
                onClick={() => onSort?.('sale_price')}
              >
                <div className="flex items-center space-x-1">
                  <span>Precio</span>
                  {getSortIcon('sale_price')}
                </div>
              </TableHead>
              <TableHead className="sticky top-0 bg-background z-10">Proveedor</TableHead>
              <TableHead className="w-12 sticky top-0 bg-background z-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const isSelected = selectedProducts.includes(product.id)
              const isFavorite = favorites.includes(product.id)
              
              return (
                <TableRow 
                  key={product.id} 
                  className={cn(isSelected ? "bg-muted/50" : "", "hover:bg-muted/50 odd:bg-muted/30")}
                  onClick={() => onProductView?.(product)}
                  role="button"
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onProductSelect?.(product.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
                      className="h-8 w-8 p-0"
                    >
                      {isFavorite ? (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      ) : (
                        <StarOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={resolveProductImageUrl(product.images?.[0] || product.image || product.image_url || '')} alt={product.name} />
                        <AvatarFallback className="bg-muted">
                          <Package className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {product.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {product.sku}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <SimpleStockIndicator product={product} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {formatCurrency(product.sale_price)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Compra: {formatCurrency(product.purchase_price)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{product.supplier}</div>
                  </TableCell>
                  <TableCell>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ProductActions 
                        product={product}
                        onProductView={onProductView}
                        onProductEdit={onProductEdit}
                        onProductDuplicate={onProductDuplicate}
                        onProductDelete={onProductDelete}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  )
}
