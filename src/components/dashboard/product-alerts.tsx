'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  AlertTriangle, 
  X, 
  CheckCircle, 
  Package, 
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useProductAlerts } from '@/hooks/useProductAlerts'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const alertVariants = {
  initial: { opacity: 0, x: -20, scale: 0.95 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 20, scale: 0.95 }
}

const iconVariants = {
  initial: { scale: 0 },
  animate: { scale: 1 },
  hover: { scale: 1.1, rotate: 5 }
}

export function ProductAlerts() {
  const { alerts, isLoading, error, resolveAlert, resolveAllAlerts, refreshAlerts } = useProductAlerts()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshAlerts()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'out_of_stock':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'low_stock':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <Package className="h-4 w-4 text-blue-500" />
    }
  }

  const getAlertColor = (alertType: string) => {
    switch (alertType) {
      case 'out_of_stock':
        return 'destructive'
      case 'low_stock':
        return 'secondary'
      default:
        return 'default'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw className="h-5 w-5" />
            </motion.div>
            Alertas de Inventario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Cargando alertas...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Error en Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">{error}</div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <motion.div
              variants={iconVariants}
              initial="initial"
              animate="animate"
              whileHover="hover"
            >
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </motion.div>
            Alertas de Inventario
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {alerts.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <motion.div
                animate={isRefreshing ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
              >
                <RefreshCw className="h-4 w-4" />
              </motion.div>
            </Button>
            {alerts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={resolveAllAlerts}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Resolver Todas
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="popLayout">
          {alerts.length === 0 ? (
            <motion.div
              key="no-alerts"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
              </motion.div>
              <h3 className="font-medium text-green-700 mb-1">¡Todo en orden!</h3>
              <p className="text-sm text-muted-foreground">
                No hay alertas de inventario pendientes
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <motion.div
                  key={alert.id}
                  variants={alertVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ delay: index * 0.1 }}
                  layout
                  className="group"
                >
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <motion.div
                      variants={iconVariants}
                      initial="initial"
                      animate="animate"
                      className="mt-0.5"
                    >
                      {getAlertIcon(alert.alert_type)}
                    </motion.div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={getAlertColor(alert.alert_type) as any} className="text-xs">
                              {alert.alert_type === 'out_of_stock' ? 'Agotado' : 'Stock Bajo'}
                            </Badge>
                            {alert.product && (
                              <span className="text-xs text-muted-foreground">
                                {alert.product.name}
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm font-medium mb-1">
                            {alert.product?.name || 'Producto'}
                          </p>
                          
                          <p className="text-xs text-muted-foreground mb-2">
                            {alert.message}
                          </p>
                          
                          {alert.product && (
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Stock actual: {alert.product.stock_quantity}</span>
                              <span>Mínimo: {alert.product.min_stock}</span>
                            </div>
                          )}
                        </div>
                        
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => resolveAlert(alert.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                        >
                          <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </motion.button>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            try {
                              if (!alert.created_at) return 'Fecha no disponible'
                              const date = new Date(alert.created_at)
                              if (isNaN(date.getTime())) return 'Fecha inválida'
                              return formatDistanceToNow(date, { 
                                addSuffix: true, 
                                locale: es 
                              })
                            } catch (error) {
                              return 'Fecha no disponible'
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}