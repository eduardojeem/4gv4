'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { 
  Bell, 
  AlertTriangle, 
  Package, 
  ImageOff, 
  UserX, 
  X,
  CheckCircle,
  AlertCircle,
  Info,
  Clock
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ProductAlert } from '@/types/products'

interface ProductNotificationsProps {
  alerts: ProductAlert[]
  onDismiss?: (alertId: string) => void
  onMarkAsRead?: (alertId: string) => void
  className?: string
}

const alertIcons = {
  low_stock: AlertTriangle,
  out_of_stock: Package,
  expiring: Clock,
  price_change: GSIcon,
  no_supplier: UserX,
  missing_supplier: UserX,
  no_category: Info,
  missing_category: Info,
  no_image: ImageOff,
  missing_image: ImageOff,
  inactive_with_sales: Info,
  new_product: CheckCircle
}

const alertColors = {
  low_stock: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  out_of_stock: 'text-red-600 bg-red-50 border-red-200',
  no_supplier: 'text-orange-600 bg-orange-50 border-orange-200',
  missing_supplier: 'text-orange-600 bg-orange-50 border-orange-200',
  no_category: 'text-purple-600 bg-purple-50 border-purple-200',
  missing_category: 'text-purple-600 bg-purple-50 border-purple-200',
  no_image: 'text-blue-600 bg-blue-50 border-blue-200',
  missing_image: 'text-blue-600 bg-blue-50 border-blue-200',
  inactive_with_sales: 'text-purple-600 bg-purple-50 border-purple-200',
  price_change: 'text-green-600 bg-green-50 border-green-200',
  new_product: 'text-emerald-600 bg-emerald-50 border-emerald-200'
}

const alertTitles = {
  low_stock: 'Stock Bajo',
  out_of_stock: 'Sin Stock',
  no_supplier: 'Sin Proveedor',
  missing_supplier: 'Sin Proveedor',
  no_category: 'Sin Categoría',
  missing_category: 'Sin Categoría',
  no_image: 'Sin Imagen',
  missing_image: 'Sin Imagen',
  inactive_with_sales: 'Producto Inactivo con Ventas',
  price_change: 'Cambio de Precio',
  new_product: 'Nuevo Producto'
}

export function ProductNotifications({ 
  alerts, 
  onDismiss, 
  onMarkAsRead,
  className = '' 
}: ProductNotificationsProps) {
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  const unreadAlerts = alerts.filter(alert => !alert.is_read)
  const criticalAlerts = alerts.filter(alert => 
    alert.type === 'out_of_stock' || alert.type === 'low_stock'
  )

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleDismiss = (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onDismiss?.(alertId)
  }

  const handleMarkAsRead = (alertId: string) => {
    onMarkAsRead?.(alertId)
    setExpandedAlert(null)
  }

  if (alerts.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay notificaciones</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones
            {unreadAlerts.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadAlerts.length}
              </Badge>
            )}
          </div>
          {criticalAlerts.length > 0 && (
            <Badge variant="outline" className="text-red-600 border-red-200">
              {criticalAlerts.length} críticas
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            <AnimatePresence>
              {alerts.map((alert) => {
                const Icon = alertIcons[alert.type] || AlertCircle
                const isExpanded = expandedAlert === alert.id
                
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.2 }}
                    className={`
                      border rounded-lg p-3 cursor-pointer transition-all
                      ${alertColors[alert.type]}
                      ${!alert.read ? 'shadow-sm' : 'opacity-75'}
                      ${isExpanded ? 'ring-2 ring-blue-200' : ''}
                    `}
                    onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">
                              {alertTitles[alert.type]}
                            </h4>
                            {!alert.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                          <p className="text-sm opacity-90 line-clamp-2">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs opacity-75">
                              {formatDate(alert.created_at)}
                            </span>
                            {alert.product_name && (
                              <Badge variant="outline" className="text-xs">
                                {alert.product_name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {!alert.read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkAsRead(alert.id)
                            }}
                          >
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => handleDismiss(alert.id, e)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && alert.details && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-3 pt-3 border-t border-current/20"
                        >
                          <div className="text-sm space-y-2">
                            {alert.details.current_stock !== undefined && (
                              <div className="flex justify-between">
                                <span>Stock actual:</span>
                                <span className="font-medium">{alert.details.current_stock}</span>
                              </div>
                            )}
                            {alert.details.min_stock !== undefined && (
                              <div className="flex justify-between">
                                <span>Stock mínimo:</span>
                                <span className="font-medium">{alert.details.min_stock}</span>
                              </div>
                            )}
                            {alert.details.last_sale && (
                              <div className="flex justify-between">
                                <span>Última venta:</span>
                                <span className="font-medium">
                                  {formatDate(alert.details.last_sale)}
                                </span>
                              </div>
                            )}
                            {alert.details.old_price !== undefined && (
                              <div className="flex justify-between">
                                <span>Precio anterior:</span>
                                <span className="font-medium">
                                  ${alert.details.old_price.toLocaleString()}
                                </span>
                              </div>
                            )}
                            {alert.details.new_price !== undefined && (
                              <div className="flex justify-between">
                                <span>Precio nuevo:</span>
                                <span className="font-medium">
                                  ${alert.details.new_price.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
        
        {unreadAlerts.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                unreadAlerts.forEach(alert => onMarkAsRead?.(alert.id))
              }}
            >
              Marcar todas como leídas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
export default ProductNotifications
