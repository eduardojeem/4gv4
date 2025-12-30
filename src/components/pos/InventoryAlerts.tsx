'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, Package, X, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InventoryAlert, getInventoryManager } from '@/lib/inventory-manager'

interface InventoryAlertsProps {
  className?: string
  showInline?: boolean
  maxAlertsToShow?: number
}

export const InventoryAlerts: React.FC<InventoryAlertsProps> = ({
  className = '',
  showInline = false,
  maxAlertsToShow = 5
}) => {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [showModal, setShowModal] = useState(false)
  const inventoryManager = getInventoryManager()

  useEffect(() => {
    // Suscribirse a alertas
    const unsubscribe = inventoryManager.subscribeToAlerts((newAlerts) => {
      setAlerts(newAlerts.filter(alert => !alert.acknowledged))
    })

    // Cargar alertas iniciales
    setAlerts(inventoryManager.getActiveAlerts())

    return unsubscribe
  }, [inventoryManager])

  const getSeverityIcon = (severity: InventoryAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'low':
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const getSeverityColor = (severity: InventoryAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const acknowledgeAlert = (alertId: string) => {
    inventoryManager.acknowledgeAlert(alertId)
  }

  const acknowledgeAll = () => {
    alerts.forEach(alert => {
      inventoryManager.acknowledgeAlert(alert.id)
    })
  }

  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical')
  const highAlerts = alerts.filter(alert => alert.severity === 'high')
  const otherAlerts = alerts.filter(alert => !['critical', 'high'].includes(alert.severity))

  if (alerts.length === 0) {
    return null
  }

  const AlertItem: React.FC<{ alert: InventoryAlert; showActions?: boolean }> = ({ 
    alert, 
    showActions = true 
  }) => (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}>
      <div className="flex-shrink-0 mt-0.5">
        {getSeverityIcon(alert.severity)}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">
            {alert.type.replace('_', ' ').toUpperCase()}
          </Badge>
          <span className="text-xs text-gray-500">
            {new Date(alert.timestamp).toLocaleTimeString()}
          </span>
        </div>
        
        <p className="text-sm font-medium mb-1">
          {alert.message}
        </p>
        
        {showActions && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => acknowledgeAlert(alert.id)}
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Marcar como visto
          </Button>
        )}
      </div>
      
      {showActions && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 flex-shrink-0"
          onClick={() => acknowledgeAlert(alert.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )

  if (showInline) {
    const displayAlerts = alerts.slice(0, maxAlertsToShow)
    
    return (
      <div className={`space-y-2 ${className}`}>
        {displayAlerts.map(alert => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
        
        {alerts.length > maxAlertsToShow && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowModal(true)}
          >
            Ver {alerts.length - maxAlertsToShow} alertas más
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Indicador de alertas */}
      <div className={`relative ${className}`}>
        <Button
          variant="outline"
          size="sm"
          className={`relative ${
            criticalAlerts.length > 0 
              ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100' 
              : highAlerts.length > 0
              ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
              : 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
          }`}
          onClick={() => setShowModal(true)}
        >
          <Package className="h-4 w-4 mr-2" />
          Inventario
          
          {alerts.length > 0 && (
            <Badge 
              className={`ml-2 ${
                criticalAlerts.length > 0 
                  ? 'bg-red-500' 
                  : highAlerts.length > 0
                  ? 'bg-orange-500'
                  : 'bg-yellow-500'
              } text-white`}
            >
              {alerts.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Modal de alertas */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Alertas de Inventario
              <Badge variant="outline">{alerts.length} activas</Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Resumen de alertas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {criticalAlerts.length}
                  </div>
                  <div className="text-xs text-gray-600">Críticas</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {highAlerts.length}
                  </div>
                  <div className="text-xs text-gray-600">Altas</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {otherAlerts.length}
                  </div>
                  <div className="text-xs text-gray-600">Otras</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {alerts.length}
                  </div>
                  <div className="text-xs text-gray-600">Total</div>
                </CardContent>
              </Card>
            </div>

            {/* Acciones rápidas */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={acknowledgeAll}
                disabled={alerts.length === 0}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Marcar todas como vistas
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModal(false)}
              >
                Cerrar
              </Button>
            </div>

            {/* Lista de alertas por severidad */}
            {criticalAlerts.length > 0 && (
              <div>
                <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Alertas Críticas ({criticalAlerts.length})
                </h3>
                <div className="space-y-2">
                  {criticalAlerts.map(alert => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))}
                </div>
              </div>
            )}

            {highAlerts.length > 0 && (
              <div>
                <h3 className="font-semibold text-orange-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Alertas de Alta Prioridad ({highAlerts.length})
                </h3>
                <div className="space-y-2">
                  {highAlerts.map(alert => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))}
                </div>
              </div>
            )}

            {otherAlerts.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Otras Alertas ({otherAlerts.length})
                </h3>
                <div className="space-y-2">
                  {otherAlerts.map(alert => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))}
                </div>
              </div>
            )}

            {alerts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No hay alertas de inventario activas</p>
                <p className="text-sm">¡Todo está bajo control!</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default InventoryAlerts