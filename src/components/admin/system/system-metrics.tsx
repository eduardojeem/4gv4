'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  ShoppingCart, 
  Package, 
  Activity, 
  Database, 
  Clock, 
  Shield, 
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { SystemMetrics } from '@/hooks/use-admin-dashboard'
import { formatCurrency } from '@/lib/currency'

interface SystemMetricsProps {
  metrics: SystemMetrics
}

export function SystemMetricsComponent({ metrics }: SystemMetricsProps) {
  

  const getHealthColor = (health: number) => {
    if (health >= 95) return 'text-green-600'
    if (health >= 85) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getHealthBadgeVariant = (health: number) => {
    if (health >= 95) return 'default'
    if (health >= 85) return 'secondary'
    return 'destructive'
  }

  const getTrendIcon = (value: number, threshold: number) => {
    if (value > threshold) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (value < threshold) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-gray-600" />
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Usuarios */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalUsers}</div>
          <div className="flex items-center text-xs text-muted-foreground">
            <span className="text-green-600 font-medium">{metrics.activeUsers} activos</span>
          </div>
        </CardContent>
      </Card>

      {/* Ventas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
          <GSIcon className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.totalSales)}</div>
          <div className="flex items-center text-xs text-muted-foreground">
            {getTrendIcon(metrics.totalSales, 1000000)}
            <span className="ml-1">vs mes anterior</span>
          </div>
        </CardContent>
      </Card>

      {/* Productos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Productos</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalProducts}</div>
          <div className="flex items-center text-xs text-muted-foreground">
            <span>En inventario</span>
          </div>
        </CardContent>
      </Card>

      {/* Salud del Sistema */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Salud del Sistema</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <div className={`text-2xl font-bold ${getHealthColor(metrics.systemHealth)}`}>
              {metrics.systemHealth.toFixed(1)}%
            </div>
            <Badge variant={getHealthBadgeVariant(metrics.systemHealth)}>
              {metrics.systemHealth >= 95 ? 'Excelente' : 
               metrics.systemHealth >= 85 ? 'Bueno' : 'Crítico'}
            </Badge>
          </div>
          <Progress value={metrics.systemHealth} className="mt-2" />
        </CardContent>
      </Card>

      {/* Métricas principales */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Usuarios</p>
                <p className="text-3xl font-bold text-blue-800">{metrics.totalUsers}</p>
                <p className="text-xs text-blue-500 mt-1">+12% este mes</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full shadow-lg">
                <Users className="h-8 w-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6 bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Ventas</p>
                <p className="text-3xl font-bold text-green-800">{metrics.totalSales}</p>
                <p className="text-xs text-green-500 mt-1">+8% este mes</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-lg">
                <GSIcon className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6 bg-gradient-to-br from-purple-50 to-pink-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Productos</p>
                <p className="text-3xl font-bold text-purple-800">{metrics.totalProducts}</p>
                <p className="text-xs text-purple-500 mt-1">+5% este mes</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6 bg-gradient-to-br from-orange-50 to-red-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Estado del Sistema</p>
                <p className="text-lg font-bold text-orange-800 flex items-center">
                  <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mr-2 animate-pulse"></div>
                  Operativo
                </p>
                <p className="text-xs text-orange-500 mt-1">99.9% uptime</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-full shadow-lg">
                <Activity className="h-8 w-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas detalladas */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-t-4 border-t-cyan-500 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50">
            <CardTitle className="flex items-center text-cyan-700">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg mr-2">
                <Database className="h-5 w-5 text-white" />
              </div>
              Base de Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-cyan-600 font-medium">Tamaño:</span>
                <span className="font-bold text-cyan-800">{metrics.databaseSize}</span>
              </div>
              <div className="w-full bg-cyan-100 rounded-full h-2">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 h-2 rounded-full" style={{ width: '65%' }}></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-cyan-600 font-medium">Conexiones activas:</span>
                <span className="font-bold text-cyan-800">24/100</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-yellow-500 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50">
            <CardTitle className="flex items-center text-yellow-700">
              <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg mr-2">
                <Zap className="h-5 w-5 text-white" />
              </div>
              Rendimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-yellow-600 font-medium">Tiempo de respuesta:</span>
                <span className="font-bold text-yellow-800">{metrics.responseTime}</span>
              </div>
              <div className="w-full bg-yellow-100 rounded-full h-2">
                <div className="bg-gradient-to-r from-yellow-500 to-orange-600 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-yellow-600 font-medium">CPU:</span>
                <span className="font-bold text-yellow-800">45%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-red-500 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50">
            <CardTitle className="flex items-center text-red-700">
              <div className="p-2 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg mr-2">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              Errores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-red-600 font-medium">Tasa de error:</span>
                <span className="font-bold text-red-800">{metrics.errorRate}</span>
              </div>
              <div className="w-full bg-red-100 rounded-full h-2">
                <div className="bg-gradient-to-r from-red-500 to-pink-600 h-2 rounded-full" style={{ width: '15%' }}></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-red-600 font-medium">Errores hoy:</span>
                <span className="font-bold text-red-800">3</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estado del sistema */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-l-4 border-l-indigo-500 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
            <CardTitle className="flex items-center text-indigo-700">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg mr-2">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              Rendimiento del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                <span className="text-sm font-medium text-indigo-600">CPU</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-indigo-100 rounded-full h-2">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                  <span className="text-sm font-bold text-indigo-800">45%</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                <span className="text-sm font-medium text-indigo-600">Memoria</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-indigo-100 rounded-full h-2">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full" style={{ width: '68%' }}></div>
                  </div>
                  <span className="text-sm font-bold text-indigo-800">68%</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                <span className="text-sm font-medium text-indigo-600">Disco</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-indigo-100 rounded-full h-2">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full" style={{ width: '32%' }}></div>
                  </div>
                  <span className="text-sm font-bold text-indigo-800">32%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50">
            <CardTitle className="flex items-center text-teal-700">
              <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg mr-2">
                <Clock className="h-5 w-5 text-white" />
              </div>
              Estado del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg">
                <span className="text-sm font-medium text-teal-600">Tiempo activo</span>
                <span className="font-bold text-teal-800">{metrics.uptime}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg">
                <span className="text-sm font-medium text-teal-600">Último backup</span>
                <span className="font-bold text-teal-800">Hace 2 horas</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg">
                <span className="text-sm font-medium text-teal-600">Próximo mantenimiento</span>
                <span className="font-bold text-teal-800">En 3 días</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
