'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Star,
  Building,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/products'
import { formatCurrency } from '@/lib/currency'

interface ProductStatsProps {
  products: Product[]
  className?: string
  loading?: boolean
}

interface StatCard {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ElementType
  color: string
  description: string
  trend?: 'up' | 'down' | 'neutral'
}

export function ProductStats({ products, className, loading = false }: ProductStatsProps) {
  const stats = useMemo(() => {
    if (!products || !Array.isArray(products) || products.length === 0) {
      return {
        totalProducts: 0,
        totalValue: 0,
        totalSaleValue: 0,
        averagePrice: 0,
        averageMargin: 0,
        lowStockProducts: 0,
        outOfStockProducts: 0,
        featuredProducts: 0,
        categoriesCount: 0,
        suppliersCount: 0,
        totalStock: 0,
        highMarginProducts: 0,
        recentProducts: 0,
        categoryDistribution: [],
        stockDistribution: [],
        priceRanges: [],
        topCategories: [],
        topSuppliers: [],
        marginDistribution: []
      }
    }

    const totalProducts = products.length
    const totalValue = products.reduce((acc, p) => acc + (p.stock_quantity * p.purchase_price), 0)
    const totalSaleValue = products.reduce((acc, p) => acc + (p.stock_quantity * p.sale_price), 0)
    const averagePrice = products.reduce((acc, p) => acc + p.sale_price, 0) / totalProducts
    const totalStock = products.reduce((acc, p) => acc + p.stock_quantity, 0)

    const margins = products.map(p => ((p.sale_price - p.purchase_price) / p.purchase_price) * 100)
    const averageMargin = margins.reduce((acc, m) => acc + m, 0) / margins.length

    const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).length
    const outOfStockProducts = products.filter(p => p.stock_quantity === 0).length
    const featuredProducts = products.filter(p => p.featured === true).length
    const highMarginProducts = products.filter(p => {
      const margin = ((p.sale_price - p.purchase_price) / p.purchase_price) * 100
      return margin > 50
    }).length

    // Recent products (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentProducts = products.filter(p => new Date(p.created_at) >= thirtyDaysAgo).length

    // Categories and suppliers
    const categories = Array.from(new Set(products.map(p => p.category?.name || '')))
    const suppliers = Array.from(new Set(products.map(p => p.supplier?.name || '')))

    // Category distribution
    const categoryDistribution = categories.map(category => ({
      name: category,
      count: products.filter(p => p.category?.name === category).length,
      value: products.filter(p => p.category?.name === category).reduce((acc, p) => acc + (p.stock_quantity * p.sale_price), 0)
    })).sort((a, b) => b.count - a.count)

    // Stock distribution
    const stockDistribution = [
      { name: 'Normal', count: products.filter(p => p.stock_quantity > p.min_stock).length, color: 'bg-green-500' },
      { name: 'Bajo', count: lowStockProducts, color: 'bg-yellow-500' },
      { name: 'Agotado', count: outOfStockProducts, color: 'bg-red-500' }
    ]

    // Price ranges
    const priceRanges = [
      { name: '$0-$50', count: products.filter(p => p.sale_price <= 50).length },
      { name: '$51-$200', count: products.filter(p => p.sale_price > 50 && p.sale_price <= 200).length },
      { name: '$201-$500', count: products.filter(p => p.sale_price > 200 && p.sale_price <= 500).length },
      { name: '$501-$1000', count: products.filter(p => p.sale_price > 500 && p.sale_price <= 1000).length },
      { name: '$1000+', count: products.filter(p => p.sale_price > 1000).length }
    ]

    // Top categories by value
    const topCategories = categoryDistribution.slice(0, 5)

    // Top suppliers by product count
    const topSuppliers = suppliers.map(supplier => ({
      name: supplier,
      count: products.filter(p => p.supplier?.name === supplier).length,
      value: products.filter(p => p.supplier?.name === supplier).reduce((acc, p) => acc + (p.stock_quantity * p.sale_price), 0)
    })).sort((a, b) => b.count - a.count).slice(0, 5)

    // Margin distribution
    const marginDistribution = [
      {
        name: '0-25%', count: products.filter(p => {
          const margin = ((p.sale_price - p.purchase_price) / p.purchase_price) * 100
          return margin <= 25
        }).length
      },
      {
        name: '26-50%', count: products.filter(p => {
          const margin = ((p.sale_price - p.purchase_price) / p.purchase_price) * 100
          return margin > 25 && margin <= 50
        }).length
      },
      {
        name: '51-100%', count: products.filter(p => {
          const margin = ((p.sale_price - p.purchase_price) / p.purchase_price) * 100
          return margin > 50 && margin <= 100
        }).length
      },
      {
        name: '100%+', count: products.filter(p => {
          const margin = ((p.sale_price - p.purchase_price) / p.purchase_price) * 100
          return margin > 100
        }).length
      }
    ]

    return {
      totalProducts,
      totalValue,
      totalSaleValue,
      averagePrice,
      averageMargin,
      lowStockProducts,
      outOfStockProducts,
      featuredProducts,
      categoriesCount: categories.length,
      suppliersCount: suppliers.length,
      totalStock,
      highMarginProducts,
      recentProducts,
      categoryDistribution,
      stockDistribution,
      priceRanges,
      topCategories,
      topSuppliers,
      marginDistribution
    }
  }, [products])



  const statCards: StatCard[] = [
    {
      title: 'Total Productos',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-blue-600',
      description: 'Productos en inventario',
      change: stats.recentProducts,
      changeLabel: 'nuevos este mes'
    },
    {
      title: 'Valor Inventario',
      value: formatCurrency(stats.totalValue ?? 0),
      icon: GSIcon,
      color: 'text-green-600',
      description: 'Valor total de compra',
      trend: 'up'
    },
    {
      title: 'Valor de Venta',
      value: formatCurrency(stats.totalSaleValue ?? 0),
      icon: TrendingUp,
      color: 'text-emerald-600',
      description: 'Valor potencial de venta',
      trend: 'up'
    },
    {
      title: 'Stock Bajo',
      value: stats.lowStockProducts,
      icon: AlertTriangle,
      color: 'text-orange-600',
      description: 'Productos con stock bajo',
      trend: stats.lowStockProducts > 0 ? 'down' : 'neutral'
    },
    {
      title: 'Agotados',
      value: stats.outOfStockProducts,
      icon: TrendingDown,
      color: 'text-red-600',
      description: 'Productos sin stock',
      trend: stats.outOfStockProducts > 0 ? 'down' : 'neutral'
    },
    {
      title: 'Precio Promedio',
      value: formatCurrency(stats.averagePrice ?? 0),
      icon: BarChart3,
      color: 'text-purple-600',
      description: 'Precio promedio de venta'
    },
    {
      title: 'Margen Promedio',
      value: `${Number(stats.averageMargin ?? 0).toFixed(1)}%`,
      icon: PieChart,
      color: 'text-indigo-600',
      description: 'Margen de ganancia promedio'
    },
    {
      title: 'Productos Destacados',
      value: stats.featuredProducts,
      icon: Star,
      color: 'text-yellow-600',
      description: 'Productos marcados como destacados'
    }
  ]

  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-lg bg-gray-50`}>
                    <Icon className={cn("h-4 w-4", stat.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                  {stat.change !== undefined && (
                    <div className="flex items-center mt-2">
                      <Badge variant="secondary" className="text-xs">
                        +{stat.change} {stat.changeLabel}
                      </Badge>
                    </div>
                  )}
                  {stat.trend && (
                    <div className="absolute top-2 right-2">
                      {stat.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                      {stat.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                      {stat.trend === 'neutral' && <Activity className="h-3 w-3 text-gray-500" />}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Distribución de Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.stockDistribution.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-sm text-muted-foreground">{item.count} productos</span>
                </div>
                <Progress
                  value={(item.count / stats.totalProducts) * 100}
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Categorías Principales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.topCategories.map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" style={{
                    backgroundColor: `hsl(${(index * 60) % 360}, 70%, 50%)`
                  }} />
                  <span className="text-sm font-medium">{category.name || 'Sin categoría'}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{category.count} productos</div>
                  <div className="text-xs text-muted-foreground">
                    ${category.value.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Price Ranges */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GSIcon className="h-5 w-5" />
              Rangos de Precio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.priceRanges.map((range, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{range.name}</span>
                  <span className="text-sm text-muted-foreground">{range.count} productos</span>
                </div>
                <Progress
                  value={(range.count / stats.totalProducts) * 100}
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Suppliers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Principales Proveedores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.topSuppliers.map((supplier, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                    {(supplier.name || 'N/A').substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{supplier.name || 'Sin proveedor'}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{supplier.count} productos</div>
                  <div className="text-xs text-muted-foreground">
                    ${supplier.value.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resumen de Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total de unidades:</span>
                <span className="font-medium">{stats.totalStock.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Categorías:</span>
                <span className="font-medium">{stats.categoriesCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Proveedores:</span>
                <span className="font-medium">{stats.suppliersCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Análisis de Márgenes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Margen promedio:</span>
                <span className="font-medium">{stats.averageMargin.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Alto margen (&gt;50%):</span>
                <span className="font-medium">{stats.highMarginProducts}</span>
              </div>
              <div className="flex justify-between">
                <span>Ganancia potencial:</span>
                <span className="font-medium text-green-600">
                  ${(stats.totalSaleValue - stats.totalValue).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alertas de Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Productos críticos:</span>
                <span className="font-medium text-red-600">
                  {stats.outOfStockProducts + stats.lowStockProducts}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Requieren atención:</span>
                <span className="font-medium text-orange-600">{stats.lowStockProducts}</span>
              </div>
              <div className="flex justify-between">
                <span>Stock saludable:</span>
                <span className="font-medium text-green-600">
                  {stats.totalProducts - stats.outOfStockProducts - stats.lowStockProducts}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
export default ProductStats
