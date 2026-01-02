'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react'
import { Product } from '@/types/products'
import { motion  } from '../../ui/motion'

interface ProductStatsCardProps {
  product: Product
}

export function ProductStatsCard({ product }: ProductStatsCardProps) {
  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0 }).format(amount)
    return `Gs. ${formatted}`
  }

  const calculateMargin = () => {
    if (!product.purchase_price || product.purchase_price === 0) return 0
    return ((product.sale_price - product.purchase_price) / product.purchase_price) * 100
  }

  const getMarginColor = (margin: number) => {
    if (margin < 10) return 'text-red-600'
    if (margin < 20) return 'text-amber-600'
    if (margin < 30) return 'text-blue-600'
    return 'text-green-600'
  }

  const getStockPercentage = () => {
    if (!product.max_stock) return 50
    return (product.stock_quantity / product.max_stock) * 100
  }

  const getStockStatus = () => {
    if (product.stock_quantity === 0) return 'critical'
    if (product.stock_quantity <= product.min_stock) return 'warning'
    return 'healthy'
  }

  const margin = calculateMargin()
  const stockPercentage = getStockPercentage()
  const stockStatus = getStockStatus()

  const stats = [
    {
      label: 'Precio de Venta',
      value: formatCurrency(product.sale_price),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      trend: null
    },
    {
      label: 'Precio de Costo',
      value: product.purchase_price ? formatCurrency(product.purchase_price) : 'N/A',
      icon: BarChart3,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      trend: null
    },
    {
      label: 'Margen',
      value: `${margin.toFixed(1)}%`,
      icon: margin >= 20 ? TrendingUp : TrendingDown,
      color: getMarginColor(margin),
      bgColor: margin >= 20 ? 'bg-green-100' : 'bg-amber-100',
      trend: margin >= 20 ? 'positive' : 'negative'
    },
    {
      label: 'Stock Actual',
      value: product.stock_quantity.toString(),
      icon: Package,
      color: stockStatus === 'critical' ? 'text-red-600' : stockStatus === 'warning' ? 'text-amber-600' : 'text-green-600',
      bgColor: stockStatus === 'critical' ? 'bg-red-100' : stockStatus === 'warning' ? 'bg-amber-100' : 'bg-green-100',
      trend: null
    }
  ]

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Estadísticas del Producto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="relative overflow-hidden rounded-xl border p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-600">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
              {stat.trend && (
                <div className="mt-2">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      stat.trend === 'positive' 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {stat.trend === 'positive' ? 'Buen margen' : 'Margen bajo'}
                  </Badge>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Stock Progress */}
        <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Nivel de Stock</span>
            <span className="text-sm font-bold text-gray-900">
              {product.stock_quantity} / {product.max_stock || product.min_stock * 2}
            </span>
          </div>
          <Progress 
            value={stockPercentage} 
            className={`h-3 ${
              stockStatus === 'critical' ? '[&>div]:bg-red-500' :
              stockStatus === 'warning' ? '[&>div]:bg-amber-500' :
              '[&>div]:bg-green-500'
            }`}
          />
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Mínimo: {product.min_stock}</span>
            {product.max_stock && <span>Máximo: {product.max_stock}</span>}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            product.is_active ? 'bg-green-50' : 'bg-gray-50'
          }`}>
            {product.is_active ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Clock className="h-4 w-4 text-gray-600" />
            )}
            <span className={`text-sm font-medium ${
              product.is_active ? 'text-green-700' : 'text-gray-700'
            }`}>
              {product.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            stockStatus === 'healthy' ? 'bg-green-50' : 
            stockStatus === 'warning' ? 'bg-amber-50' : 'bg-red-50'
          }`}>
            {stockStatus === 'critical' ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : stockStatus === 'warning' ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <span className={`text-sm font-medium ${
              stockStatus === 'critical' ? 'text-red-700' :
              stockStatus === 'warning' ? 'text-amber-700' : 'text-green-700'
            }`}>
              {stockStatus === 'critical' ? 'Sin Stock' :
               stockStatus === 'warning' ? 'Stock Bajo' : 'Stock OK'}
            </span>
          </div>
        </div>

        {/* Value Calculation */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-700">Valor Total en Stock</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {formatCurrency(product.stock_quantity * product.sale_price)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
