'use client'

import { useState } from 'react'
import { X, Edit, ShoppingCart, Package, Star, TrendingUp, Calendar, Barcode, Building2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/currency'
import type { Product } from '@/lib/types/product'

interface ProductQuickViewProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (product: Product) => void
  onAddToCart?: (product: Product) => void
}

export function ProductQuickView({ 
  product, 
  isOpen, 
  onClose, 
  onEdit, 
  onAddToCart 
}: ProductQuickViewProps) {
  if (!product) return null

  const margin = product.purchase_price > 0 
    ? ((product.sale_price - product.purchase_price) / product.purchase_price * 100)
    : 0

  const getStockStatus = () => {
    if (product.stock_quantity === 0) {
      return { status: 'out_of_stock', label: 'Sin Stock', color: 'bg-red-500', textColor: 'text-red-600' }
    } else if (product.stock_quantity <= product.min_stock) {
      return { status: 'low_stock', label: 'Stock Bajo', color: 'bg-yellow-500', textColor: 'text-yellow-600' }
    } else {
      return { status: 'in_stock', label: 'En Stock', color: 'bg-green-500', textColor: 'text-green-600' }
    }
  }

  const stockStatus = getStockStatus()

  

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
        <DialogHeader className="pb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="relative">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-20 h-20 object-cover rounded-xl shadow-lg ring-2 ring-gray-100"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center shadow-lg">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                {product.featured && (
                  <div className="absolute -top-2 -right-2">
                    <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-lg">
                      <Star className="h-3 w-3 mr-1" />
                      Destacado
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold text-gray-900 mb-2">
                  {product.name}
                </DialogTitle>
                <div className="flex items-center space-x-3 mb-3">
                  <Badge variant="outline" className="font-mono text-xs">
                    SKU: {product.sku}
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                    {product.category}
                  </Badge>
                  <Badge 
                    className={`${stockStatus.color} text-white border-0 shadow-sm`}
                  >
                    {stockStatus.label}
                  </Badge>
                </div>
                {product.description && (
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {product.description}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Información principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Precios y margen */}
            <Card className="border-0 shadow-sm bg-gradient-to-r from-gray-50 to-blue-50/30">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                  Información de Precios
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Precio de Venta</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(product.sale_price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Costo</p>
                    <p className="text-lg font-semibold text-gray-700">
                      {formatCurrency(product.purchase_price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Margen</p>
                    <Badge 
                      className={`text-white font-semibold shadow-sm ${
                        margin >= 30 
                          ? 'bg-gradient-to-r from-green-500 to-green-600' 
                          : margin >= 15 
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
                          : 'bg-gradient-to-r from-red-500 to-pink-500'
                      }`}
                    >
                      {margin.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventario */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Package className="h-5 w-5 mr-2 text-blue-600" />
                  Estado del Inventario
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Stock Actual</p>
                    <p className={`text-2xl font-bold ${stockStatus.textColor}`}>
                      {product.stock_quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Stock Mínimo</p>
                    <p className="text-lg font-semibold text-gray-700">
                      {product.min_stock}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Stock Máximo</p>
                    <p className="text-lg font-semibold text-gray-700">
                      {product.max_stock || 'N/A'}
                    </p>
                  </div>
                </div>
                
                {product.stock_quantity <= product.min_stock && product.stock_quantity > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                    <span className="text-sm text-yellow-800">
                      Stock bajo - Se recomienda reabastecer
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Información adicional */}
          <div className="space-y-6">
            {/* Detalles del producto */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Detalles</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex items-center">
                      <Building2 className="h-4 w-4 mr-2" />
                      Proveedor
                    </span>
                    <span className="text-sm font-medium">{product.supplier}</span>
                  </div>
                  
                  {product.barcode && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 flex items-center">
                        <Barcode className="h-4 w-4 mr-2" />
                        Código de Barras
                      </span>
                      <span className="text-sm font-mono">{product.barcode}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      Creado
                    </span>
                    <span className="text-sm">{formatDate(product.created_at)}</span>
                  </div>
                  
                  {product.updated_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        Actualizado
                      </span>
                      <span className="text-sm">{formatDate(product.updated_at)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Acciones */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Acciones</h3>
                <div className="space-y-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          onClick={() => onEdit?.(product)}
                          className="w-full justify-start bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                          variant="outline"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar Producto
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar información del producto</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          onClick={() => onAddToCart?.(product)}
                          className="w-full justify-start bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                          variant="outline"
                          disabled={product.stock_quantity === 0}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {product.stock_quantity === 0 ? 'Sin Stock' : 'Agregar al Carrito'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {product.stock_quantity === 0 
                          ? 'Producto sin stock disponible' 
                          : 'Agregar producto al carrito'
                        }
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default ProductQuickView
