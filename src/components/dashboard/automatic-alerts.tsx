'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, AlertTriangle, TrendingDown, Calendar, Package, Users, Activity } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'

// Tipos de alertas
export type AlertType = 
  | 'stock_low' 
  | 'stock_out' 
  | 'product_expired' 
  | 'product_expiring' 
  | 'sales_drop' 
  | 'high_return_rate' 
  | 'inventory_value_drop' 
  | 'new_customer_drop' 
  | 'system_performance'

export interface AlertRule {
  id: string
  type: AlertType
  name: string
  description: string
  enabled: boolean
  threshold: number
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly'
  lastTriggered?: Date
  conditions: Record<string, any>
}

export interface Alert {
  id: string
  type: AlertType
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  read: boolean
  data?: any
  actionable: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

// Configuración por defecto de reglas de alerta
const defaultAlertRules: AlertRule[] = [
  {
    id: 'stock-low',
    type: 'stock_low',
    name: 'Stock Bajo',
    description: 'Alerta cuando el stock está por debajo del mínimo',
    enabled: true,
    threshold: 10,
    frequency: 'immediate',
    conditions: { checkMinStock: true }
  },
  {
    id: 'stock-out',
    type: 'stock_out',
    name: 'Sin Stock',
    description: 'Alerta cuando un producto se agota',
    enabled: true,
    threshold: 0,
    frequency: 'immediate',
    conditions: {}
  },
  {
    id: 'product-expiring',
    type: 'product_expiring',
    name: 'Productos por Vencer',
    description: 'Alerta cuando productos están próximos a vencer',
    enabled: true,
    threshold: 7, // días
    frequency: 'daily',
    conditions: { daysBeforeExpiry: 7 }
  },
  {
    id: 'product-expired',
    type: 'product_expired',
    name: 'Productos Vencidos',
    description: 'Alerta cuando productos han vencido',
    enabled: true,
    threshold: 0,
    frequency: 'immediate',
    conditions: {}
  },
  {
    id: 'sales-drop',
    type: 'sales_drop',
    name: 'Caída en Ventas',
    description: 'Alerta cuando las ventas caen significativamente',
    enabled: true,
    threshold: 20, // porcentaje
    frequency: 'daily',
    conditions: { comparisonPeriod: 'week' }
  },
  {
    id: 'high-return-rate',
    type: 'high_return_rate',
    name: 'Alta Tasa de Devoluciones',
    description: 'Alerta cuando la tasa de devoluciones es alta',
    enabled: true,
    threshold: 15, // porcentaje
    frequency: 'weekly',
    conditions: {}
  },
  {
    id: 'inventory-value-drop',
    type: 'inventory_value_drop',
    name: 'Caída en Valor de Inventario',
    description: 'Alerta cuando el valor del inventario cae significativamente',
    enabled: true,
    threshold: 25, // porcentaje
    frequency: 'daily',
    conditions: {}
  }
]

// Hook para gestión de alertas automáticas
export function useAutomaticAlerts(products: any[] = []) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [alertRules, setAlertRules] = useState<AlertRule[]>(defaultAlertRules)
  const [isEnabled, setIsEnabled] = useState(true)
  const lastCheckRef = useRef<Record<string, Date>>({})
  const { toast } = useToast()

  // Función para verificar si una regla debe ejecutarse
  const shouldTriggerRule = useCallback((rule: AlertRule): boolean => {
    if (!rule.enabled || !isEnabled) return false

    const now = new Date()
    const lastCheck = lastCheckRef.current[rule.id]

    if (!lastCheck) return true

    const timeDiff = now.getTime() - lastCheck.getTime()
    const hourInMs = 60 * 60 * 1000
    const dayInMs = 24 * hourInMs
    const weekInMs = 7 * dayInMs

    switch (rule.frequency) {
      case 'immediate':
        return true
      case 'hourly':
        return timeDiff >= hourInMs
      case 'daily':
        return timeDiff >= dayInMs
      case 'weekly':
        return timeDiff >= weekInMs
      default:
        return false
    }
  }, [isEnabled])

  // Función para crear una alerta
  const createAlert = useCallback((
    type: AlertType,
    title: string,
    message: string,
    severity: Alert['severity'],
    data?: any,
    actionable: boolean = false,
    action?: Alert['action']
  ): Alert => {
    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      message,
      severity,
      timestamp: new Date(),
      read: false,
      data,
      actionable,
      action
    }
  }, [])

  // Verificar stock bajo y agotado
  const checkStockAlerts = useCallback(() => {
    const stockLowRule = alertRules.find(r => r.type === 'stock_low')
    const stockOutRule = alertRules.find(r => r.type === 'stock_out')

    if (stockLowRule && shouldTriggerRule(stockLowRule)) {
      const lowStockProducts = products.filter(p => 
        p.stock_quantity <= (p.min_stock || stockLowRule.threshold) && 
        p.stock_quantity > 0
      )

      if (lowStockProducts.length > 0) {
        const alert = createAlert(
          'stock_low',
          'Stock Bajo Detectado',
          `${lowStockProducts.length} producto${lowStockProducts.length > 1 ? 's' : ''} con stock bajo`,
          'medium',
          { products: lowStockProducts },
          true,
          {
            label: 'Ver Productos',
            onClick: () => console.log('Navigate to low stock products')
          }
        )
        setAlerts(prev => [alert, ...prev])
        toast({
          title: alert.title,
          description: alert.message,
          variant: 'default'
        })
        lastCheckRef.current[stockLowRule.id] = new Date()
      }
    }

    if (stockOutRule && shouldTriggerRule(stockOutRule)) {
      const outOfStockProducts = products.filter(p => p.stock_quantity === 0)

      if (outOfStockProducts.length > 0) {
        const alert = createAlert(
          'stock_out',
          'Productos Agotados',
          `${outOfStockProducts.length} producto${outOfStockProducts.length > 1 ? 's' : ''} sin stock`,
          'high',
          { products: outOfStockProducts },
          true,
          {
            label: 'Reabastecer',
            onClick: () => console.log('Navigate to restock products')
          }
        )
        setAlerts(prev => [alert, ...prev])
        toast({
          title: alert.title,
          description: alert.message,
          variant: 'destructive'
        })
        lastCheckRef.current[stockOutRule.id] = new Date()
      }
    }
  }, [products, alertRules, shouldTriggerRule, createAlert, toast])

  // Verificar productos vencidos y por vencer
  const checkExpiryAlerts = useCallback(() => {
    const expiringRule = alertRules.find(r => r.type === 'product_expiring')
    const expiredRule = alertRules.find(r => r.type === 'product_expired')

    const now = new Date()

    if (expiringRule && shouldTriggerRule(expiringRule)) {
      const expiringProducts = products.filter(p => {
        if (!p.expiry_date) return false
        const expiryDate = new Date(p.expiry_date)
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return daysUntilExpiry <= expiringRule.threshold && daysUntilExpiry > 0
      })

      if (expiringProducts.length > 0) {
        const alert = createAlert(
          'product_expiring',
          'Productos por Vencer',
          `${expiringProducts.length} producto${expiringProducts.length > 1 ? 's' : ''} vencen en ${expiringRule.threshold} días`,
          'medium',
          { products: expiringProducts },
          true,
          {
            label: 'Revisar Productos',
            onClick: () => console.log('Navigate to expiring products')
          }
        )
        setAlerts(prev => [alert, ...prev])
        lastCheckRef.current[expiringRule.id] = new Date()
      }
    }

    if (expiredRule && shouldTriggerRule(expiredRule)) {
      const expiredProducts = products.filter(p => {
        if (!p.expiry_date) return false
        const expiryDate = new Date(p.expiry_date)
        return expiryDate < now
      })

      if (expiredProducts.length > 0) {
        const alert = createAlert(
          'product_expired',
          'Productos Vencidos',
          `${expiredProducts.length} producto${expiredProducts.length > 1 ? 's' : ''} han vencido`,
          'critical',
          { products: expiredProducts },
          true,
          {
            label: 'Retirar del Inventario',
            onClick: () => console.log('Navigate to expired products')
          }
        )
        setAlerts(prev => [alert, ...prev])
        toast({
          title: alert.title,
          description: alert.message,
          variant: 'destructive'
        })
        lastCheckRef.current[expiredRule.id] = new Date()
      }
    }
  }, [products, alertRules, shouldTriggerRule, createAlert, toast])

  // Verificar métricas de ventas
  const checkSalesAlerts = useCallback(() => {
    const salesDropRule = alertRules.find(r => r.type === 'sales_drop')

    if (salesDropRule && shouldTriggerRule(salesDropRule)) {
      // Simulación de verificación de caída en ventas
      const currentSales = Math.random() * 1000
      const previousSales = currentSales * 1.3 // Simular ventas anteriores más altas
      const dropPercentage = ((previousSales - currentSales) / previousSales) * 100

      if (dropPercentage >= salesDropRule.threshold) {
        const alert = createAlert(
          'sales_drop',
          'Caída en Ventas Detectada',
          `Las ventas han caído un ${dropPercentage.toFixed(1)}% respecto al período anterior`,
          'high',
          { dropPercentage, currentSales, previousSales },
          true,
          {
            label: 'Ver Análisis',
            onClick: () => console.log('Navigate to sales analysis')
          }
        )
        setAlerts(prev => [alert, ...prev])
        lastCheckRef.current[salesDropRule.id] = new Date()
      }
    }
  }, [alertRules, shouldTriggerRule, createAlert])

  // Ejecutar todas las verificaciones
  const runAlertChecks = useCallback(() => {
    if (!isEnabled) return

    checkStockAlerts()
    checkExpiryAlerts()
    checkSalesAlerts()
  }, [isEnabled, checkStockAlerts, checkExpiryAlerts, checkSalesAlerts])

  // Ejecutar verificaciones periódicamente
  useEffect(() => {
    if (!isEnabled) return

    runAlertChecks()
    const interval = setInterval(runAlertChecks, 5 * 60 * 1000) // Cada 5 minutos

    return () => clearInterval(interval)
  }, [runAlertChecks, isEnabled])

  // Funciones de gestión de alertas
  const markAsRead = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ))
  }, [])

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }, [])

  const clearAllAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  const updateAlertRule = useCallback((ruleId: string, updates: Partial<AlertRule>) => {
    setAlertRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ))
  }, [])

  return {
    alerts,
    alertRules,
    isEnabled,
    setIsEnabled,
    markAsRead,
    dismissAlert,
    clearAllAlerts,
    updateAlertRule,
    runAlertChecks
  }
}

// Componente de configuración de alertas
export function AlertConfiguration({ 
  alertRules, 
  onUpdateRule 
}: { 
  alertRules: AlertRule[]
  onUpdateRule: (ruleId: string, updates: Partial<AlertRule>) => void 
}) {
  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'stock_low':
      case 'stock_out':
        return <Package className="h-4 w-4" />
      case 'product_expired':
      case 'product_expiring':
        return <Calendar className="h-4 w-4" />
      case 'sales_drop':
        return <TrendingDown className="h-4 w-4" />
      case 'high_return_rate':
        return <Users className="h-4 w-4" />
      case 'inventory_value_drop':
        return <GSIcon className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getSeverityColor = (type: AlertType) => {
    switch (type) {
      case 'stock_out':
      case 'product_expired':
        return 'destructive'
      case 'stock_low':
      case 'product_expiring':
      case 'sales_drop':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Configuración de Alertas
        </CardTitle>
        <CardDescription>
          Configura las reglas de alertas automáticas para tu inventario
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {alertRules.map((rule) => (
          <div key={rule.id} className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getAlertIcon(rule.type)}
                <div>
                  <h4 className="font-medium">{rule.name}</h4>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getSeverityColor(rule.type)}>
                  {rule.type.replace('_', ' ')}
                </Badge>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(enabled) => onUpdateRule(rule.id, { enabled })}
                />
              </div>
            </div>

            {rule.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor={`threshold-${rule.id}`}>Umbral</Label>
                  <Input
                    id={`threshold-${rule.id}`}
                    type="number"
                    value={rule.threshold}
                    onChange={(e) => onUpdateRule(rule.id, { threshold: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`frequency-${rule.id}`}>Frecuencia</Label>
                  <Select
                    value={rule.frequency}
                    onValueChange={(frequency: AlertRule['frequency']) => 
                      onUpdateRule(rule.id, { frequency })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Inmediata</SelectItem>
                      <SelectItem value="hourly">Cada hora</SelectItem>
                      <SelectItem value="daily">Diaria</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Última activación</Label>
                  <p className="text-sm text-muted-foreground">
                    {rule.lastTriggered 
                      ? rule.lastTriggered.toLocaleDateString()
                      : 'Nunca'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Componente principal de alertas automáticas
export default function AutomaticAlerts({ products = [] }: { products?: any[] }) {
  const {
    alerts,
    alertRules,
    isEnabled,
    setIsEnabled,
    markAsRead,
    dismissAlert,
    clearAllAlerts,
    updateAlertRule,
    runAlertChecks
  } = useAutomaticAlerts(products)

  const unreadCount = alerts.filter(alert => !alert.read).length

  return (
    <div className="space-y-6">
      {/* Header con controles principales */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Sistema de Alertas Automáticas
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Monitoreo automático de inventario y métricas críticas
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="alerts-enabled">Alertas Activas</Label>
                <Switch
                  id="alerts-enabled"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                />
              </div>
              <Button onClick={runAlertChecks} variant="outline">
                Verificar Ahora
              </Button>
              {alerts.length > 0 && (
                <Button onClick={clearAllAlerts} variant="outline">
                  Limpiar Todo
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de alertas activas */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas Activas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 border rounded-lg ${
                  alert.read ? 'opacity-60' : ''
                } ${
                  alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                  alert.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                  alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{alert.title}</h4>
                      <Badge variant={
                        alert.severity === 'critical' ? 'destructive' :
                        alert.severity === 'high' ? 'destructive' :
                        alert.severity === 'medium' ? 'secondary' :
                        'outline'
                      }>
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {alert.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alert.timestamp.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.actionable && alert.action && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={alert.action.onClick}
                      >
                        {alert.action.label}
                      </Button>
                    )}
                    {!alert.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsRead(alert.id)}
                      >
                        Marcar como leída
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      Descartar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Configuración de alertas */}
      <AlertConfiguration
        alertRules={alertRules}
        onUpdateRule={updateAlertRule}
      />
    </div>
  )
}
