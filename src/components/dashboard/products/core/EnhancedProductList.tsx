'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence  } from '../../../ui/motion'
import { 
  Package, 
  Edit, 
  Trash2, 
  Eye, 
  Copy, 
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Tag,
  Grid3X3,
  List,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
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
import { ProductCardSkeletonGrid } from '../shared'
import { useProductManagement, useProductFiltering } from '@/hooks/products'
import type { Product } from '@/hooks/products/types'

interface EnhancedProductListProps {
  className?: string
  viewMode?: 'table' | 'grid' | 'compact'
  enableSelection?: boolean
  enableBulkActions?: boolean
  onProductAction?: (action: string, product: Product) => void
  onBulkAction?: (action: string, productIds: string[]) => void
}

const getStockStatus = (product: Product) => {
  if (product.stock_quantity === 0) {
    return { status: 'out_of_stock', label: 'Agotado', color: 'text-red-600', bgColor: 'bg-red-50' }
  }
  if (product.stock_quantity <= product.min_stock) {
    return { status: 'low_stock', label: 'Stock Bajo', color: 'text-yellow-600', bgColor: 'bg-yellow-50' }
  }
  // Note: max_stock property doesn't exist in database schema, removing overstock check
  return { status: 'in_stock', label: 'En Stock', color: 'text-green-600', bgColor: 'bg-green-50' }
}

const getMarginInfo = (product: Product) => {
  if (product.purchase_price <= 0 || product.sale_price <= 0) {
    return { margin: 0, marginPercent: 0, status: 'unknown' }
  }
  
  const margin = product.sale_price - product.purchase_price
  const marginPercent = (margin / product.purchase_price) * 100
  
  let status = 'good'
  if (marginPercent < 10) status = 'low'
  else if (marginPercent < 20) status = 'medium'
  else if (marginPercent > 50) status = 'high'
  
  return { margin, marginPercent, status }
}

import { formatCurrency } from '@/lib/currency'

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(dateString))
}

// Componente de acciones del producto
const ProductActions = ({ 
  product, 
  onAction
}: { 
  product: Product
  onAction?: (action: string, product: Product) => void
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAction?.('view', product)}>
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction?.('edit', product)}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction?.('duplicate', product)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => onAction?.('delete', product)}
          className="text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Componente de fila de tabla moderna
const ProductTableRow = ({ 
  product, 
  isSelected, 
  onSelect, 
  onAction,
  enableSelection 
}: {
  product: Product
  isSelected: boolean
  onSelect: (selected: boolean) => void
  onAction?: (action: string, product: Product) => void
  enableSelection: boolean
}) => {
  const stockStatus = getStockStatus(product)
  const marginInfo = getMarginInfo(product)
  
  // Calcular porcentaje de stock para la barra de progreso
  const stockPercentage = product.min_stock > 0 
    ? Math.min((product.stock_quantity / product.min_stock) * 100, 100)
    : 100

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "group hover:bg-gray-50/50 transition-colors duration-200",
        isSelected && "bg-blue-50/50 border-l-4 border-l-blue-500"
      )}
    >
      {enableSelection && (
        <TableCell className="w-12">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            aria-label={`Seleccionar ${product.name}`}
          />
        </TableCell>
      )}
      
      {/* Información del producto */}
      <TableCell className="min-w-[250px]">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                <Package className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            {/* Indicador de estado en el avatar */}
            <div className={cn(
              "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
              stockStatus.status === 'out_of_stock' && 'bg-red-500',
              stockStatus.status === 'low_stock' && 'bg-amber-500',
              stockStatus.status === 'in_stock' && 'bg-emerald-500'
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 truncate">{product.name}</div>
            <div className="text-sm text-gray-600 font-mono">{product.sku}</div>
            {product.category?.name && (
              <div className="flex items-center space-x-1 mt-1">
                <Tag className="h-3 w-3 text-gray-500" />
                <span className="text-xs text-gray-500 truncate">{product.category?.name}</span>
              </div>
            )}
          </div>
        </div>
      </TableCell>
      
      {/* Estado del stock con barra de progreso */}
      <TableCell className="min-w-[140px]">
        <div className="space-y-2">
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs font-medium border-0",
              stockStatus.status === 'out_of_stock' && 'bg-red-100 text-red-800',
              stockStatus.status === 'low_stock' && 'bg-amber-100 text-amber-800',
              stockStatus.status === 'in_stock' && 'bg-emerald-100 text-emerald-800'
            )}
          >
            {stockStatus.label}
          </Badge>
          {product.min_stock > 0 && (
            <div className="w-full">
              <Progress value={stockPercentage} className="h-1.5" />
            </div>
          )}
        </div>
      </TableCell>
      
      {/* Cantidad de stock */}
      <TableCell className="text-right min-w-[100px]">
        <div className="space-y-1">
          <div className="font-semibold text-gray-900">{product.stock_quantity}</div>
          <div className="text-xs text-gray-500">
            {product.min_stock > 0 && `Min: ${product.min_stock}`}
          </div>
        </div>
      </TableCell>
      
      {/* Precio de venta */}
      <TableCell className="text-right min-w-[120px]">
        <div className="space-y-1">
          <div className="font-bold text-lg text-gray-900">
            {formatCurrency(product.sale_price)}
          </div>
          <div className="text-xs text-gray-500">
            Costo: {formatCurrency(product.purchase_price)}
          </div>
        </div>
      </TableCell>
      
      {/* Margen con indicadores visuales */}
      <TableCell className="text-right min-w-[100px]">
        <div className="space-y-1">
          <div className="flex items-center justify-end space-x-1">
            <span className={cn(
              "font-bold text-lg",
              marginInfo.status === 'low' && 'text-red-600',
              marginInfo.status === 'medium' && 'text-amber-600',
              marginInfo.status === 'good' && 'text-emerald-600',
              marginInfo.status === 'high' && 'text-blue-600'
            )}>
              {marginInfo.marginPercent.toFixed(1)}%
            </span>
            {marginInfo.status === 'low' && <TrendingDown className="h-4 w-4 text-red-600" />}
            {marginInfo.status === 'high' && <TrendingUp className="h-4 w-4 text-blue-600" />}
          </div>
          <div className="text-xs text-emerald-600 font-medium">
            +{formatCurrency(marginInfo.margin)}
          </div>
        </div>
      </TableCell>
      
      {/* Información adicional */}
      <TableCell className="min-w-[150px]">
        <div className="space-y-1">
          {product.supplier?.name && (
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <User className="h-3 w-3" />
              <span className="truncate">{product.supplier?.name}</span>
            </div>
          )}
          {product.updated_at && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(product.updated_at)}</span>
            </div>
          )}
        </div>
      </TableCell>
      
      {/* Acciones */}
      <TableCell className="text-right w-12">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <ProductActions product={product} onAction={onAction} />
        </div>
      </TableCell>
    </motion.tr>
  )
}

// Componente de tarjeta de producto moderna
const ProductCard = ({ 
  product, 
  isSelected, 
  onSelect, 
  onAction,
  enableSelection 
}: {
  product: Product
  isSelected: boolean
  onSelect: (selected: boolean) => void
  onAction?: (action: string, product: Product) => void
  enableSelection: boolean
}) => {
  const stockStatus = getStockStatus(product)
  const marginInfo = getMarginInfo(product)
  
  // Calcular porcentaje de stock basado en min_stock
  const stockPercentage = product.min_stock > 0 
    ? Math.min((product.stock_quantity / product.min_stock) * 100, 100)
    : 100

  // Determinar el color del gradiente basado en el estado del stock
  const getGradientClass = () => {
    if (stockStatus.status === 'out_of_stock') return 'from-red-50 to-red-100 border-red-200'
    if (stockStatus.status === 'low_stock') return 'from-amber-50 to-orange-100 border-amber-200'
    return 'from-emerald-50 to-green-100 border-emerald-200'
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2, scale: 1.02 }}
      className="group"
    >
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-xl bg-gradient-to-br",
        getGradientClass(),
        isSelected && "ring-2 ring-blue-500 shadow-lg"
      )}>
        {/* Header con selección y acciones */}
        <div className="flex items-center justify-between p-3 pb-0">
          {enableSelection && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              aria-label={`Seleccionar ${product.name}`}
              className="z-10"
            />
          )}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ProductActions product={product} onAction={onAction} />
          </div>
        </div>

        <CardContent className="p-4 pt-2">
          <div className="space-y-4">
            {/* Información principal del producto */}
            <div className="flex items-start space-x-3">
              <div className="relative">
                <Avatar className="h-14 w-14 border-2 border-white shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    <Package className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                {/* Indicador de estado en el avatar */}
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
                  stockStatus.status === 'out_of_stock' && 'bg-red-500',
                  stockStatus.status === 'low_stock' && 'bg-amber-500',
                  stockStatus.status === 'in_stock' && 'bg-emerald-500'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate text-base leading-tight">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-600 font-mono">{product.sku}</p>
                {product.category?.name && (
                  <div className="flex items-center space-x-1 mt-1">
                    <Tag className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-500 truncate">{product.category?.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de progreso de stock */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Stock</span>
                <span className="font-semibold">{product.stock_quantity} unidades</span>
              </div>
              <div className="relative">
                <Progress 
                  value={stockPercentage} 
                  className="h-2"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-700">
                    {product.min_stock > 0 && `Min: ${product.min_stock}`}
                  </span>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs font-medium border-0",
                  stockStatus.status === 'out_of_stock' && 'bg-red-100 text-red-800',
                  stockStatus.status === 'low_stock' && 'bg-amber-100 text-amber-800',
                  stockStatus.status === 'in_stock' && 'bg-emerald-100 text-emerald-800'
                )}
              >
                {stockStatus.label}
              </Badge>
            </div>

            {/* Información de precios y margen */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Precio de Venta</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(product.sale_price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600">Margen</p>
                  <div className="flex items-center space-x-1">
                    <span className={cn(
                      "text-lg font-bold",
                      marginInfo.status === 'low' && 'text-red-600',
                      marginInfo.status === 'medium' && 'text-amber-600',
                      marginInfo.status === 'good' && 'text-emerald-600',
                      marginInfo.status === 'high' && 'text-blue-600'
                    )}>
                      {marginInfo.marginPercent.toFixed(1)}%
                    </span>
                    {marginInfo.status === 'low' && <TrendingDown className="h-4 w-4 text-red-600" />}
                    {marginInfo.status === 'high' && <TrendingUp className="h-4 w-4 text-blue-600" />}
                  </div>
                </div>
              </div>

              {/* Información adicional */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-xs text-gray-600">Costo</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {formatCurrency(product.purchase_price)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">Ganancia</p>
                  <p className="text-sm font-semibold text-emerald-600">
                    {formatCurrency(marginInfo.margin)}
                  </p>
                </div>
              </div>
            </div>

            {/* Información del proveedor y fecha */}
            {(product.supplier?.name || product.updated_at) && (
              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
                {product.supplier?.name && (
                  <div className="flex items-center space-x-1">
                    <User className="h-3 w-3" />
                    <span className="truncate">{product.supplier?.name}</span>
                  </div>
                )}
                {product.updated_at && (
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(product.updated_at)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export const EnhancedProductList = ({
  className,
  viewMode = 'table',
  enableSelection = true,
  enableBulkActions = true,
  onProductAction,
  onBulkAction
}: EnhancedProductListProps) => {
  const [localViewMode, setLocalViewMode] = useState(viewMode)
  
  // Usar los nuevos hooks compuestos
  const {
    products,
    loadingState,
    selectedProducts,
    selectProduct,
    selectAllProducts,
    clearSelection,
    sort,
    setSort
  } = useProductManagement()

  const { filteredProducts } = useProductFiltering(products)

  // Productos a mostrar (filtrados)
  const displayProducts = useMemo(() => {
    return filteredProducts
  }, [filteredProducts])

  const handleProductAction = (action: string, product: Product) => {
    onProductAction?.(action, product)
  }

  const handleBulkAction = (action: string) => {
    if (selectedProducts.length > 0) {
      onBulkAction?.(action, selectedProducts)
      clearSelection()
    }
  }

  const getSortIcon = (field: string) => {
    if (sort.field !== field) return <ArrowUpDown className="h-4 w-4" />
    return sort.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const handleSort = (field: string) => {
    const newDirection = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc'
    setSort({ field: field as import('@/hooks/products/types').ProductSort['field'], direction: newDirection })
  }

  if (loadingState.loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <ProductCardSkeletonGrid count={6} />
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controles superiores */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant={localViewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLocalViewMode('table')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={localViewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLocalViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </div>
        
        {enableBulkActions && selectedProducts.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {selectedProducts.length} seleccionados
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('delete')}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('export')}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        )}
      </div>

      {/* Vista de tabla */}
      {localViewMode === 'table' && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {enableSelection && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedProducts.length === displayProducts.length && displayProducts.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllProducts()
                        } else {
                          clearSelection()
                        }
                      }}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                )}
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('name')}
                    className="h-auto p-0 font-semibold"
                  >
                    Producto
                    {getSortIcon('name')}
                  </Button>
                </TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('stock_quantity')}
                    className="h-auto p-0 font-semibold"
                  >
                    Stock
                    {getSortIcon('stock_quantity')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('sale_price')}
                    className="h-auto p-0 font-semibold"
                  >
                    Precio
                    {getSortIcon('sale_price')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead>Información</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {displayProducts.map((product) => (
                  <ProductTableRow
                    key={product.id}
                    product={product}
                    isSelected={selectedProducts.includes(product.id)}
                    onSelect={() => selectProduct(product.id)}
                    onAction={handleProductAction}
                    enableSelection={enableSelection}
                  />
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Vista de cuadrícula */}
      {localViewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {displayProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isSelected={selectedProducts.includes(product.id)}
                onSelect={() => selectProduct(product.id)}
                onAction={handleProductAction}
                enableSelection={enableSelection}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Estado vacío */}
      {displayProducts.length === 0 && !loadingState.loading && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay productos</h3>
          <p className="text-muted-foreground">
            No se encontraron productos que coincidan con los criterios de búsqueda.
          </p>
        </div>
      )}
    </div>
  )
}

export default EnhancedProductList
