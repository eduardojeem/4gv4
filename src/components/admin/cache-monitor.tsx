"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  RefreshCw, 
  Trash2, 
  TrendingUp, 
  Database, 
  Clock, 
  Zap,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { cacheUtils as swrCacheUtils } from '@/providers/swr-provider'
import { cacheUtils as apiCacheUtils } from '@/lib/cache/api-cache'

interface CacheStats {
  swr: {
    totalKeys: number
    ageMinutes: number
    sizeKB: number
    keys: string[]
  } | null
  api: {
    size: number
    maxSize: number
    hits: number
    misses: number
    totalRequests: number
    hitRatio: number
    memoryUsage: number
  }
}

export function CacheMonitor() {
  const [stats, setStats] = useState<CacheStats>({
    swr: null,
    api: {
      size: 0,
      maxSize: 0,
      hits: 0,
      misses: 0,
      totalRequests: 0,
      hitRatio: 0,
      memoryUsage: 0
    }
  })
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshStats = async () => {
    setIsRefreshing(true)
    try {
      const swrStats = swrCacheUtils.getStats()
      const apiStats = apiCacheUtils.getStats()
      
      setStats({
        swr: swrStats,
        api: apiStats
      })
    } catch (error) {
      console.error('Error refreshing cache stats:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    refreshStats()
    
    // Refrescar cada 30 segundos
    const interval = setInterval(refreshStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const clearSWRCache = () => {
    swrCacheUtils.clearAll()
    refreshStats()
  }

  const clearAPICache = () => {
    apiCacheUtils.clear()
    refreshStats()
  }

  const getHitRatioColor = (ratio: number) => {
    if (ratio >= 70) return 'text-green-600'
    if (ratio >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getHitRatioStatus = (ratio: number) => {
    if (ratio >= 70) return { icon: CheckCircle, text: 'Excelente', color: 'bg-green-100 text-green-800' }
    if (ratio >= 50) return { icon: AlertTriangle, text: 'Bueno', color: 'bg-yellow-100 text-yellow-800' }
    return { icon: AlertTriangle, text: 'Necesita mejora', color: 'bg-red-100 text-red-800' }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Monitor de Cache</h2>
          <p className="text-muted-foreground">
            Monitoreo en tiempo real del rendimiento del cache
          </p>
        </div>
        <Button 
          onClick={refreshStats} 
          disabled={isRefreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Hit Ratio API</p>
                <p className={`text-2xl font-bold ${getHitRatioColor(stats.api.hitRatio)}`}>
                  {stats.api.hitRatio}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Entradas Cache</p>
                <p className="text-2xl font-bold">
                  {stats.api.size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Requests Totales</p>
                <p className="text-2xl font-bold">
                  {stats.api.totalRequests}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Memoria Usada</p>
                <p className="text-2xl font-bold">
                  {stats.api.memoryUsage} KB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalles por Tipo de Cache */}
      <Tabs defaultValue="api" className="space-y-4">
        <TabsList>
          <TabsTrigger value="api">Cache API</TabsTrigger>
          <TabsTrigger value="swr">Cache SWR</TabsTrigger>
          <TabsTrigger value="recommendations">Recomendaciones</TabsTrigger>
        </TabsList>

        {/* Cache API */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Cache de API</CardTitle>
              <Button 
                onClick={clearAPICache} 
                variant="destructive" 
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar Cache
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hit Ratio */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Hit Ratio</span>
                  <Badge className={getHitRatioStatus(stats.api.hitRatio).color}>
                    {getHitRatioStatus(stats.api.hitRatio).text}
                  </Badge>
                </div>
                <Progress value={stats.api.hitRatio} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Hits: {stats.api.hits}</span>
                  <span>Misses: {stats.api.misses}</span>
                </div>
              </div>

              {/* Uso de Memoria */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Uso de Memoria</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.api.memoryUsage} KB
                  </span>
                </div>
                <Progress 
                  value={(stats.api.memoryUsage / 1024) * 100} // Asumiendo 1MB como máximo
                  className="h-2" 
                />
              </div>

              {/* Capacidad */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Capacidad</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.api.size} / {stats.api.maxSize}
                  </span>
                </div>
                <Progress 
                  value={(stats.api.size / stats.api.maxSize) * 100} 
                  className="h-2" 
                />
              </div>

              {/* Estadísticas Detalladas */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                  <p className="text-lg font-semibold">{stats.api.totalRequests}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cache Hits</p>
                  <p className="text-lg font-semibold text-green-600">{stats.api.hits}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cache Misses</p>
                  <p className="text-lg font-semibold text-red-600">{stats.api.misses}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entradas Activas</p>
                  <p className="text-lg font-semibold">{stats.api.size}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cache SWR */}
        <TabsContent value="swr" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Cache SWR (Cliente)</CardTitle>
              <Button 
                onClick={clearSWRCache} 
                variant="destructive" 
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar Cache
              </Button>
            </CardHeader>
            <CardContent>
              {stats.swr ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total de Claves</p>
                      <p className="text-2xl font-bold">{stats.swr.totalKeys}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tamaño</p>
                      <p className="text-2xl font-bold">{stats.swr.sizeKB} KB</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Antigüedad</p>
                      <p className="text-2xl font-bold">{stats.swr.ageMinutes} min</p>
                    </div>
                  </div>

                  {/* Claves Recientes */}
                  {stats.swr.keys.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Claves Recientes</h4>
                      <div className="space-y-1">
                        {stats.swr.keys.map((key, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay datos de cache SWR disponibles</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recomendaciones */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recomendaciones de Optimización</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Recomendaciones basadas en hit ratio */}
                {stats.api.hitRatio < 50 && (
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-800">Hit Ratio Bajo ({stats.api.hitRatio}%)</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Considera aumentar el TTL de cache o implementar prefetching para mejorar el rendimiento.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {stats.api.hitRatio >= 70 && (
                  <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-green-800">Excelente Hit Ratio ({stats.api.hitRatio}%)</h4>
                        <p className="text-sm text-green-700 mt-1">
                          El cache está funcionando de manera óptima. Mantén las configuraciones actuales.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recomendaciones de memoria */}
                {stats.api.memoryUsage > 500 && (
                  <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-800">Alto Uso de Memoria ({stats.api.memoryUsage} KB)</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          Considera habilitar compresión o reducir el TTL para liberar memoria.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recomendaciones generales */}
                <div className="space-y-2">
                  <h4 className="font-medium">Mejores Prácticas</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Monitorea el hit ratio regularmente (objetivo: &gt;70%)</li>
                    <li>• Implementa prefetching para datos críticos</li>
                    <li>• Usa invalidación selectiva en lugar de limpiar todo el cache</li>
                    <li>• Configura TTL apropiados según la frecuencia de cambio de datos</li>
                    <li>• Habilita compresión para datos grandes</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default CacheMonitor