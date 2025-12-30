'use client'

import { useMemo } from 'react'
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart,
  BarChart3,
  PieChart,
  Activity,
  Target
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { formatCurrency } from '@/lib/currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  purchase_price: number
  sale_price: number
  stock_quantity: number
  min_stock: number
  supplier: string
  created_at: string
  featured: boolean
}

interface InventoryAnalyticsProps {
  products: Product[]
}

export function InventoryAnalytics({ products }: InventoryAnalyticsProps) {
  const analytics = useMemo(() => {
    const totalProducts = products.length
    const totalValue = products.reduce((sum, product) => sum + (product.sale_price * product.stock_quantity), 0)
    const totalCost = products.reduce((sum, product) => sum + (product.purchase_price * product.stock_quantity), 0)
    const totalMargin = totalValue - totalCost
    const marginPercentage = totalCost > 0 ? ((totalMargin / totalCost) * 100) : 0

    // Productos con stock bajo
    const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0)
    const outOfStockProducts = products.filter(p => p.stock_quantity === 0)
    
    // Productos por categoría
    const categoryStats = products.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = { count: 0, value: 0, stock: 0 }
      }
      acc[product.category].count++
      acc[product.category].value += product.sale_price * product.stock_quantity
      acc[product.category].stock += product.stock_quantity
      return acc
    }, {} as Record<string, { count: number; value: number; stock: number }>)

    // Top productos por valor
    const topValueProducts = [...products]
      .sort((a, b) => (b.sale_price * b.stock_quantity) - (a.sale_price * a.stock_quantity))
      .slice(0, 5)

    // Productos más rentables
    const topMarginProducts = [...products]
      .map(p => ({
        ...p,
        margin: p.sale_price - p.purchase_price,
        marginPercent: p.purchase_price > 0 ? ((p.sale_price - p.purchase_price) / p.purchase_price) * 100 : 0
      }))
      .sort((a, b) => b.marginPercent - a.marginPercent)
      .slice(0, 5)

    return {
      totalProducts,
      totalValue,
      totalCost,
      totalMargin,
      marginPercentage,
      lowStockProducts,
      outOfStockProducts,
      categoryStats,
      topValueProducts,
      topMarginProducts
    }
  }, [products])

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.outOfStockProducts.length} agotados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor del Inventario</CardTitle>
            <GSIcon className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Costo: {formatCurrency(analytics.totalCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.totalMargin)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.marginPercentage.toFixed(1)}% de margen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas de Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {analytics.lowStockProducts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Productos con stock bajo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Análisis por categorías */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Distribución por Categorías
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(analytics.categoryStats).map(([category, stats]) => {
              const percentage = (stats.count / analytics.totalProducts) * 100
              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{category}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{stats.count}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(stats.value)}
                      </span>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {percentage.toFixed(1)}% del inventario • {stats.stock} unidades
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Productos de Mayor Valor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topValueProducts.map((product, index) => {
                const totalValue = product.sale_price * product.stock_quantity
                return (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.stock_quantity} unidades × {formatCurrency(product.sale_price)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatCurrency(totalValue)}</p>
                      <Badge variant={product.stock_quantity <= product.min_stock ? "destructive" : "secondary"}>
                        Stock: {product.stock_quantity}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Productos más rentables y alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Productos Más Rentables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topMarginProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Costo: {formatCurrency(product.purchase_price)} → Venta: {formatCurrency(product.sale_price)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-green-600">
                      {product.marginPercent.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      +{formatCurrency(product.margin)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas de Inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.outOfStockProducts.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-red-600 mb-2">
                    Productos Agotados ({analytics.outOfStockProducts.length})
                  </h4>
                  <div className="space-y-2">
                    {analytics.outOfStockProducts.slice(0, 3).map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-2 rounded border border-red-200 bg-red-50">
                        <span className="text-sm">{product.name}</span>
                        <Badge variant="destructive">Agotado</Badge>
                      </div>
                    ))}
                    {analytics.outOfStockProducts.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{analytics.outOfStockProducts.length - 3} productos más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {analytics.lowStockProducts.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-orange-600 mb-2">
                    Stock Bajo ({analytics.lowStockProducts.length})
                  </h4>
                  <div className="space-y-2">
                    {analytics.lowStockProducts.slice(0, 3).map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-2 rounded border border-orange-200 bg-orange-50">
                        <span className="text-sm">{product.name}</span>
                        <Badge variant="outline" className="text-orange-600">
                          {product.stock_quantity}/{product.min_stock}
                        </Badge>
                      </div>
                    ))}
                    {analytics.lowStockProducts.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{analytics.lowStockProducts.length - 3} productos más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {analytics.outOfStockProducts.length === 0 && analytics.lowStockProducts.length === 0 && (
                <div className="text-center py-4">
                  <Activity className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-green-600 font-medium">
                    ¡Todo el inventario está en buen estado!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No hay alertas de stock en este momento
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
