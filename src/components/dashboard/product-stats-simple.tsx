'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Package, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { formatCurrency } from '@/lib/currency'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  sale_price: number
  cost_price: number
  stock_quantity: number
  min_stock: number
  status: 'active' | 'inactive'
}

interface ProductStatsSimpleProps {
  products: Product[]
  loading?: boolean
}

// Función helper para formatear moneda

// Función helper para formatear números
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('es-PY').format(num)
}

export function ProductStatsSimple({ products, loading = false }: ProductStatsSimpleProps) {
  // Cálculo de métricas principales
  const stats = useMemo(() => {
    if (!products.length) {
      return {
        totalProducts: 0,
        activeProducts: 0,
        totalValue: 0,
        totalCost: 0,
        margin: 0,
        outOfStock: 0,
        lowStock: 0,
        inStock: 0,
        categories: 0,
        stockHealth: 0
      }
    }

    const activeProducts = products.filter(p => p.status === 'active')
    const totalValue = products.reduce((sum, p) => sum + (p.sale_price * p.stock_quantity), 0)
    const totalCost = products.reduce((sum, p) => sum + (p.cost_price * p.stock_quantity), 0)
    const margin = totalValue > 0 ? ((totalValue - totalCost) / totalValue) * 100 : 0

    const outOfStock = products.filter(p => p.stock_quantity === 0).length
    const lowStock = products.filter(p => 
      p.stock_quantity > 0 && p.stock_quantity <= p.min_stock
    ).length
    const inStock = products.filter(p => p.stock_quantity > p.min_stock).length

    const categories = new Set(products.map(p => p.category)).size
    const stockHealth = products.length > 0 ? (inStock / products.length) * 100 : 0

    return {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      totalValue,
      totalCost,
      margin,
      outOfStock,
      lowStock,
      inStock,
      categories,
      stockHealth
    }
  }, [products])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de productos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalProducts)}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {stats.activeProducts} activos
              </Badge>
              <span className="text-xs text-muted-foreground">
                {stats.categories} categorías
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Valor del inventario */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Inventario</CardTitle>
            <GSIcon className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-muted-foreground">
                Margen: {stats.margin.toFixed(1)}%
              </span>
              {stats.margin >= 20 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : stats.margin >= 10 ? (
                <Minus className="h-3 w-3 text-yellow-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estado del stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado Stock</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${
              stats.stockHealth >= 80 ? 'text-green-600' :
              stats.stockHealth >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.stockHealth.toFixed(0)}%
            </div>
            <div className="mt-2">
              <Progress 
                value={stats.stockHealth} 
                className="h-2"
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Saludable</span>
              <span>{stats.inStock} productos</span>
            </div>
          </CardContent>
        </Card>

        {/* Alertas de stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-red-600">Agotados</span>
                <Badge variant="destructive" className="text-xs">
                  {stats.outOfStock}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-yellow-600">Stock bajo</span>
                <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-600">
                  {stats.lowStock}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de estado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen de Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Distribución de stock */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Distribución de Stock</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">En stock</span>
                  <span>{stats.inStock} productos</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-600">Stock bajo</span>
                  <span>{stats.lowStock} productos</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Agotados</span>
                  <span>{stats.outOfStock} productos</span>
                </div>
              </div>
            </div>

            {/* Valor financiero */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Valor Financiero</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Valor venta</span>
                  <span>{formatCurrency(stats.totalValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Costo total</span>
                  <span>{formatCurrency(stats.totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Margen bruto</span>
                  <span className={
                    stats.margin >= 20 ? 'text-green-600' :
                    stats.margin >= 10 ? 'text-yellow-600' : 'text-red-600'
                  }>
                    {stats.margin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Acciones recomendadas */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Acciones Recomendadas</h4>
              <div className="space-y-1">
                {stats.outOfStock > 0 && (
                  <div className="text-sm text-red-600">
                    • Reabastecer {stats.outOfStock} productos agotados
                  </div>
                )}
                {stats.lowStock > 0 && (
                  <div className="text-sm text-yellow-600">
                    • Revisar {stats.lowStock} productos con stock bajo
                  </div>
                )}
                {stats.margin < 10 && (
                  <div className="text-sm text-orange-600">
                    • Revisar precios para mejorar margen
                  </div>
                )}
                {stats.outOfStock === 0 && stats.lowStock === 0 && stats.margin >= 20 && (
                  <div className="text-sm text-green-600">
                    • Inventario en buen estado
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
