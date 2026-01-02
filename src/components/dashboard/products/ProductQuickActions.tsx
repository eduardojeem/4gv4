'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Package, 
  Edit, 
  Trash2, 
  Copy, 
  Share2, 
  Download,
  Upload,
  BarChart3,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react'
import { Product } from '@/types/products'
import { toast } from 'sonner'
import { motion  } from '../../ui/motion'

interface ProductQuickActionsProps {
  product: Product
  onEdit?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  onStockUpdate?: (newStock: number) => void
  onExport?: () => void
}

export function ProductQuickActions({
  product,
  onEdit,
  onDelete,
  onDuplicate,
  onStockUpdate,
  onExport
}: ProductQuickActionsProps) {
  const [stockAdjustment, setStockAdjustment] = useState(0)
  const [isAdjusting, setIsAdjusting] = useState(false)

  const handleStockAdjustment = () => {
    if (stockAdjustment === 0) {
      toast.error('Ingresa una cantidad válida')
      return
    }

    const newStock = product.stock_quantity + stockAdjustment
    if (newStock < 0) {
      toast.error('El stock no puede ser negativo')
      return
    }

    onStockUpdate?.(newStock)
    setStockAdjustment(0)
    setIsAdjusting(false)
    toast.success(`Stock actualizado: ${product.stock_quantity} → ${newStock}`)
  }

  const handleCopySKU = () => {
    navigator.clipboard.writeText(product.sku)
    toast.success('SKU copiado al portapapeles')
  }

  const handleShare = () => {
    const url = `${window.location.origin}/dashboard/products/${product.id}`
    navigator.clipboard.writeText(url)
    toast.success('Enlace copiado al portapapeles')
  }

  const quickActions = [
    {
      icon: Edit,
      label: 'Editar',
      onClick: onEdit,
      variant: 'default' as const,
      color: 'blue'
    },
    {
      icon: Copy,
      label: 'Duplicar',
      onClick: onDuplicate,
      variant: 'outline' as const,
      color: 'gray'
    },
    {
      icon: Share2,
      label: 'Compartir',
      onClick: handleShare,
      variant: 'outline' as const,
      color: 'gray'
    },
    {
      icon: Download,
      label: 'Exportar',
      onClick: onExport,
      variant: 'outline' as const,
      color: 'gray'
    },
    {
      icon: BarChart3,
      label: 'Reportes',
      onClick: () => toast.info('Función en desarrollo'),
      variant: 'outline' as const,
      color: 'gray'
    },
    {
      icon: Trash2,
      label: 'Eliminar',
      onClick: onDelete,
      variant: 'outline' as const,
      color: 'red'
    }
  ]

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          Acciones Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stock Adjustment */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Ajuste Rápido de Stock</span>
            </div>
            <Badge variant="outline" className="bg-white">
              Actual: {product.stock_quantity}
            </Badge>
          </div>

          {!isAdjusting ? (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setIsAdjusting(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajustar Stock
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setStockAdjustment(prev => prev - 1)}
                  className="shrink-0"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={stockAdjustment}
                  onChange={(e) => setStockAdjustment(Number(e.target.value))}
                  className="text-center font-semibold"
                  placeholder="0"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setStockAdjustment(prev => prev + 1)}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {stockAdjustment !== 0 && (
                <div className="flex items-center justify-between text-sm p-2 bg-white rounded-lg">
                  <span className="text-gray-600">Nuevo stock:</span>
                  <span className="font-bold text-blue-600">
                    {product.stock_quantity + stockAdjustment}
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStockAdjustment(0)
                    setIsAdjusting(false)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleStockAdjustment}
                  disabled={stockAdjustment === 0}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aplicar
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopySKU}
            className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <Copy className="h-4 w-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-600">SKU</span>
            </div>
            <code className="text-sm font-mono text-gray-900 block truncate">
              {product.sku}
            </code>
          </button>

          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-600">Stock</span>
            </div>
            <p className="text-sm font-bold text-gray-900">
              {product.stock_quantity} {product.unit_measure}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              className={`w-full justify-start ${
                action.color === 'red' 
                  ? 'text-red-600 hover:text-red-700 hover:bg-red-50' 
                  : action.color === 'blue'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : ''
              }`}
              onClick={action.onClick}
            >
              <action.icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          ))}
        </div>

        {/* Status Indicators */}
        <div className="pt-4 border-t space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Estado</span>
            <Badge variant={product.is_active ? "default" : "secondary"}>
              {product.is_active ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Activo
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Inactivo
                </>
              )}
            </Badge>
          </div>

          {product.featured && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Destacado</span>
              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                <Zap className="h-3 w-3 mr-1" />
                Sí
              </Badge>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Stock Status</span>
            <Badge 
              variant="outline"
              className={
                product.stock_quantity === 0
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : product.stock_quantity <= product.min_stock
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-green-50 border-green-200 text-green-700'
              }
            >
              {product.stock_quantity === 0
                ? 'Agotado'
                : product.stock_quantity <= product.min_stock
                ? 'Bajo'
                : 'OK'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
