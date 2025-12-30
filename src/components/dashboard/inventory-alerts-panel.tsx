'use client'

import { useState, useMemo } from 'react'
import { 
  AlertTriangle, 
  Package, 
  TrendingDown, 
  Clock, 
  X,
  Eye,
  EyeOff,
  Filter,
  Bell,
  BellOff,
  ChevronRight,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  stock_quantity: number
  min_stock: number
  max_stock?: number
  sale_price: number
  purchase_price: number
  supplier: string
  last_updated?: string
  status?: string
}

interface Alert {
  id: string
  type: 'out_of_stock' | 'low_stock' | 'overstock' | 'price_change' | 'expiring'
  severity: 'critical' | 'warning' | 'info'
  product: Product
  message: string
  timestamp: Date
  acknowledged?: boolean
  actionRequired?: boolean
}

interface InventoryAlertsPanelProps {
  products: Product[]
  className?: string
  onProductClick?: (product: Product) => void
  onAlertAction?: (alert: Alert, action: string) => void
}

const alertTypeConfig = {
  out_of_stock: {
    icon: Package,
    label: 'Sin Stock',
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    severity: 'critical' as const
  },
  low_stock: {
    icon: TrendingDown,
    label: 'Stock Bajo',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    severity: 'warning' as const
  },
  overstock: {
    icon: Package,
    label: 'Sobrestock',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    severity: 'info' as const
  },
  price_change: {
    icon: TrendingDown,
    label: 'Cambio de Precio',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    severity: 'info' as const
  },
  expiring: {
    icon: Clock,
    label: 'Próximo a Vencer',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    severity: 'warning' as const
  }
}

export function InventoryAlertsPanel({ 
  products, 
  className, 
  onProductClick,
  onAlertAction 
}: InventoryAlertsPanelProps) {
  const [showAcknowledged, setShowAcknowledged] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mutedAlerts, setMutedAlerts] = useState<Set<string>>(new Set())

  // Generar alertas basadas en los productos
  const alerts = useMemo(() => {
    const generatedAlerts: Alert[] = []

    // Safety check to ensure products is defined and is an array
    if (!products || !Array.isArray(products)) {
      return generatedAlerts
    }

    products.forEach(product => {
      const alertId = `${product.id}-${Date.now()}`

      // Alerta de sin stock
      if (product.stock_quantity === 0) {
        generatedAlerts.push({
          id: `${alertId}-out`,
          type: 'out_of_stock',
          severity: 'critical',
          product,
          message: `${product.name} está agotado`,
          timestamp: new Date(),
          actionRequired: true
        })
      }
      // Alerta de stock bajo
      else if (product.stock_quantity <= product.min_stock) {
        generatedAlerts.push({
          id: `${alertId}-low`,
          type: 'low_stock',
          severity: 'warning',
          product,
          message: `${product.name} tiene stock bajo (${product.stock_quantity} unidades)`,
          timestamp: new Date(),
          actionRequired: true
        })
      }

      // Alerta de sobrestock (si se define max_stock)
      if (product.max_stock && product.stock_quantity > product.max_stock) {
        generatedAlerts.push({
          id: `${alertId}-over`,
          type: 'overstock',
          severity: 'info',
          product,
          message: `${product.name} tiene sobrestock (${product.stock_quantity}/${product.max_stock})`,
          timestamp: new Date()
        })
      }

      // Alerta de margen bajo
      if (product.purchase_price > 0 && product.sale_price > 0) {
        const margin = ((product.sale_price - product.purchase_price) / product.purchase_price) * 100
        if (margin < 10) {
          generatedAlerts.push({
            id: `${alertId}-margin`,
            type: 'price_change',
            severity: 'warning',
            product,
            message: `${product.name} tiene margen bajo (${margin.toFixed(1)}%)`,
            timestamp: new Date()
          })
        }
      }
    })

    return generatedAlerts.sort((a, b) => {
      // Ordenar por severidad y luego por fecha
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      return b.timestamp.getTime() - a.timestamp.getTime()
    })
  }, [products])

  // Filtrar alertas
  const filteredAlerts = useMemo(() => {
    let filtered = alerts

    if (!showAcknowledged) {
      filtered = filtered.filter(alert => !alert.acknowledged)
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(alert => alert.type === filterType)
    }

    return filtered.filter(alert => !mutedAlerts.has(alert.id))
  }, [alerts, showAcknowledged, filterType, mutedAlerts])

  // Estadísticas de alertas
  const alertStats = useMemo(() => {
    const stats = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
      actionRequired: alerts.filter(a => a.actionRequired).length
    }
    return stats
  }, [alerts])

  const handleAlertClick = (alert: Alert) => {
    if (onProductClick) {
      onProductClick(alert.product)
    }
  }

  const handleAcknowledge = (alert: Alert) => {
    onAlertAction?.(alert, 'acknowledge')
  }

  const handleMute = (alert: Alert) => {
    setMutedAlerts(prev => new Set([...prev, alert.id]))
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Ahora'
    if (diffMins < 60) return `${diffMins}m`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`
    return `${Math.floor(diffMins / 1440)}d`
  }

  const getSeverityBadge = (severity: Alert['severity']) => {
    const variants = {
      critical: 'destructive' as const,
      warning: 'default' as const,
      info: 'secondary' as const
    }
    
    const labels = {
      critical: 'Crítico',
      warning: 'Advertencia',
      info: 'Info'
    }

    return (
      <Badge variant={variants[severity]} className="text-xs">
        {labels[severity]}
      </Badge>
    )
  }

  if (isCollapsed) {
    return (
      <Card className={cn("w-16", className)}>
        <CardContent className="p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(false)}
            className="w-full h-12 flex flex-col items-center justify-center"
          >
            <Bell className="h-4 w-4" />
            {alertStats.critical > 0 && (
              <Badge variant="destructive" className="text-xs mt-1 h-4 w-4 rounded-full p-0 flex items-center justify-center">
                {alertStats.critical}
              </Badge>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("w-80", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg">Alertas de Inventario</CardTitle>
          </div>
          <div className="flex items-center space-x-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCollapsed(true)}
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Minimizar panel</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span>{alertStats.critical} críticas</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span>{alertStats.warning} advertencias</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span>{alertStats.info} info</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="show-acknowledged" className="text-sm">
              Mostrar reconocidas
            </Label>
            <Switch
              id="show-acknowledged"
              checked={showAcknowledged}
              onCheckedChange={setShowAcknowledged}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm border rounded px-2 py-1 flex-1"
            >
              <option value="all">Todas las alertas</option>
              <option value="out_of_stock">Sin stock</option>
              <option value="low_stock">Stock bajo</option>
              <option value="overstock">Sobrestock</option>
              <option value="price_change">Cambios de precio</option>
            </select>
          </div>
        </div>

        <Separator />

        {/* Lista de alertas */}
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay alertas activas</p>
                <p className="text-xs">¡Todo está bajo control!</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const config = alertTypeConfig[alert.type]
                const Icon = config.icon

                return (
                  <Card
                    key={alert.id}
                    className={cn(
                      "p-3 cursor-pointer transition-all hover:shadow-md",
                      config.bgColor,
                      alert.acknowledged && "opacity-60"
                    )}
                    onClick={() => handleAlertClick(alert)}
                  >
                    <div className="space-y-2">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <Icon className={cn("h-4 w-4", config.color)} />
                          <div className="flex items-center space-x-2">
                            {getSeverityBadge(alert.severity)}
                            <Badge variant="outline" className="text-xs">
                              {config.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(alert.timestamp)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMute(alert)
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <BellOff className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Contenido */}
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {alert.product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alert.message}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>SKU: {alert.product.sku}</span>
                          <span>{alert.product.category}</span>
                        </div>
                      </div>

                      {/* Acciones */}
                      {alert.actionRequired && !alert.acknowledged && (
                        <div className="flex items-center space-x-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAcknowledge(alert)
                            }}
                            className="text-xs h-6"
                          >
                            Reconocer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAlertClick(alert)
                            }}
                            className="text-xs h-6"
                          >
                            Ver producto
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </ScrollArea>

        {/* Acciones globales */}
        {filteredAlerts.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  filteredAlerts.forEach(alert => {
                    if (alert.actionRequired && !alert.acknowledged) {
                      handleAcknowledge(alert)
                    }
                  })
                }}
                disabled={!filteredAlerts.some(a => a.actionRequired && !a.acknowledged)}
              >
                Reconocer todas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Refresh alerts
                  window.location.reload()
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Actualizar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}