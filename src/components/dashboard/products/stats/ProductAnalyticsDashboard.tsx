'use client'

import { useState, useMemo } from 'react'
import { motion  } from '../../../ui/motion'
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  BarChart3,
  PieChart,
  Users,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useProductAnalytics } from '@/hooks/products'

interface ProductAnalyticsDashboardProps {
  className?: string
  timeRange?: '7d' | '30d' | '90d' | '1y'
  onTimeRangeChange?: (range: string) => void
  showTimeControls?: boolean
  showExportOptions?: boolean
  compact?: boolean
}

const MetricCard = ({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  trend,
  loading = false 
}: {
  title: string
  value: string | number
  change?: number
  icon: any
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
}) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-emerald-600'
      case 'down': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-3 w-3" />
      case 'down': return <TrendingDown className="h-3 w-3" />
      default: return null
    }
  }

  const getCardGradient = () => {
    if (title.includes('Total Productos')) return 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200'
    if (title.includes('Valor')) return 'bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200'
    if (title.includes('Stock Bajo')) return 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200'
    if (title.includes('Agotados')) return 'bg-gradient-to-br from-red-50 to-pink-100 border-red-200'
    return 'bg-gradient-to-br from-gray-50 to-slate-100 border-gray-200'
  }

  const getIconColor = () => {
    if (title.includes('Total Productos')) return 'text-blue-600 bg-blue-100'
    if (title.includes('Valor')) return 'text-emerald-600 bg-emerald-100'
    if (title.includes('Stock Bajo')) return 'text-amber-600 bg-amber-100'
    if (title.includes('Agotados')) return 'text-red-600 bg-red-100'
    return 'text-gray-600 bg-gray-100'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2, scale: 1.02 }}
    >
      <Card className={cn(
        "border-0 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden",
        getCardGradient()
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide truncate">
                {title}
              </p>
              {loading ? (
                <div className="h-6 w-16 bg-white/60 animate-pulse rounded" />
              ) : (
                <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
              )}
              {change !== undefined && !loading && (
                <div className={cn("flex items-center space-x-1 text-xs", getTrendColor())}>
                  {getTrendIcon()}
                  <span className="font-medium">
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3",
              getIconColor()
            )}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

const CategoryChart = ({ data, loading }: { data: any[], loading: boolean }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="flex-1 h-2 bg-muted animate-pulse rounded" />
            <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BarChart3 className="h-8 w-8 mx-auto mb-2" />
        <p>No hay datos de categorías disponibles</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.slice(0, 5).map((category, index) => (
        <motion.div
          key={category.name || category.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-center space-x-3"
        >
          <div className="w-20 text-sm font-medium truncate">
            {category.name || 'Sin nombre'}
          </div>
          <div className="flex-1">
            <Progress
              value={data[0]?.productCount ? (category.productCount / data[0].productCount) * 100 : 0}
              className="h-2"
            />
          </div>
          <div className="w-12 text-sm text-muted-foreground text-right">
            {category.productCount || category.count || 0}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

const InventoryAlertsPanel = ({ alerts, loading }: { alerts: any[], loading: boolean }) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3 p-3 border rounded-lg">
            <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-8 w-8 mx-auto mb-2" />
        <p>No hay alertas de inventario</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.slice(0, 5).map((alert, index) => (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <AlertTriangle className={cn(
            "h-4 w-4",
            alert.severity === 'high' && "text-red-500",
            alert.severity === 'medium' && "text-yellow-500",
            alert.severity === 'low' && "text-blue-500"
          )} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{alert.product_name}</p>
            <p className="text-xs text-muted-foreground">{alert.message}</p>
          </div>
          <Badge variant={
            alert.severity === 'high' ? 'destructive' :
            alert.severity === 'medium' ? 'default' : 'secondary'
          }>
            {alert.severity}
          </Badge>
        </motion.div>
      ))}
    </div>
  )
}

export const ProductAnalyticsDashboard = ({
  className,
  timeRange = '30d',
  onTimeRangeChange,
  showTimeControls = true,
  showExportOptions = true,
  compact = false
}: ProductAnalyticsDashboardProps) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [showDetails, setShowDetails] = useState(true)

  const {
    dashboardStats,
    categoryAnalytics,
    supplierAnalytics,
    alerts,
    loading,
    refreshAnalytics
  } = useProductAnalytics([], {
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    includeAlerts: true,
    includeMovements: true
  })

  const handleTimeRangeChange = (range: string) => {
    onTimeRangeChange?.(range)
  }

  const handleExportData = () => {
    // Implementar exportación de datos
    console.log('Exportando datos de analytics...')
  }

  return (
    <div className={cn("space-y-6", className, compact && "space-y-4")}>
      {/* Header con controles */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics de Productos</h2>
          <p className="text-muted-foreground">
            Análisis detallado del rendimiento de productos
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {showTimeControls && (
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 días</SelectItem>
                <SelectItem value="30d">30 días</SelectItem>
                <SelectItem value="90d">90 días</SelectItem>
                <SelectItem value="1y">1 año</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          {showExportOptions && (
            <Button variant="outline" size="sm" onClick={handleExportData}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={refreshAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <MetricCard
          title="Total Productos"
          value={dashboardStats?.totalProducts || 0}
          change={0}
          trend="neutral"
          icon={Package}
          loading={loading}
        />
        <MetricCard
          title="Valor Total Inventario"
          value={`€${(dashboardStats?.totalStockValue || 0).toLocaleString()}`}
          change={0}
          trend="neutral"
          icon={GSIcon}
          loading={loading}
        />
        <MetricCard
          title="Stock Bajo"
          value={dashboardStats?.lowStockCount || 0}
          change={0}
          trend="neutral"
          icon={AlertTriangle}
          loading={loading}
        />
        <MetricCard
          title="Productos Agotados"
          value={dashboardStats?.outOfStockCount || 0}
          change={0}
          trend="neutral"
          icon={Package}
          loading={loading}
        />
      </div>

      {/* Tabs de análisis */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Métricas de Inventario</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Margen Promedio</span>
                    <span className="font-medium">
                      {dashboardStats?.avgMarginPercentage?.toFixed(1) || 'N/A'}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Productos Activos</span>
                    <span className="font-medium">
                      {dashboardStats?.activeProducts || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Categorías</span>
                    <span className="font-medium">
                      {dashboardStats?.categoriesCount || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Alertas Recientes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InventoryAlertsPanel alerts={alerts} loading={loading} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="h-5 w-5" />
                <span>Análisis por Categorías</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryChart data={categoryAnalytics} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Análisis por Proveedores</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryChart data={supplierAnalytics} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Todas las Alertas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryAlertsPanel alerts={alerts} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ProductAnalyticsDashboard
import { GSIcon } from '@/components/ui/standardized-components'
