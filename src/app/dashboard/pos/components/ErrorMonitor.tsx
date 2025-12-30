/**
 * Componente de monitoreo de errores para el dashboard POS
 * Muestra estadísticas de errores y permite gestión básica
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Info, 
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Clock,
  Bug
} from 'lucide-react'
import { useErrorHandler } from '../hooks/useErrorHandler'
import { ErrorType, ErrorSeverity, type POSError } from '../utils/error-handler'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ErrorMonitorProps {
  className?: string
  showDetails?: boolean
  maxRecentErrors?: number
}

export const ErrorMonitor: React.FC<ErrorMonitorProps> = ({
  className = '',
  showDetails = true,
  maxRecentErrors = 5
}) => {
  const { hasErrors, errorCount, lastError, getStats, getRecent, clearErrors } = useErrorHandler()
  const [stats, setStats] = useState(getStats())
  const [recentErrors, setRecentErrors] = useState<POSError[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Actualizar datos cada 30 segundos
  useEffect(() => {
    const updateData = () => {
      setStats(getStats())
      setRecentErrors(getRecent(maxRecentErrors))
    }

    updateData()
    const interval = setInterval(updateData, 30000)
    return () => clearInterval(interval)
  }, [maxRecentErrors, getStats, getRecent])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 500)) // Simular carga
    setStats(getStats())
    setRecentErrors(getRecent(maxRecentErrors))
    setIsRefreshing(false)
  }

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return <Info className="h-4 w-4 text-blue-500" />
      case ErrorSeverity.MEDIUM:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case ErrorSeverity.HIGH:
        return <XCircle className="h-4 w-4 text-orange-500" />
      case ErrorSeverity.CRITICAL:
        return <Bug className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case ErrorSeverity.MEDIUM:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case ErrorSeverity.HIGH:
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case ErrorSeverity.CRITICAL:
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTypeColor = (type: ErrorType) => {
    switch (type) {
      case ErrorType.NETWORK:
        return 'bg-purple-100 text-purple-800'
      case ErrorType.PAYMENT:
        return 'bg-red-100 text-red-800'
      case ErrorType.INVENTORY:
        return 'bg-orange-100 text-orange-800'
      case ErrorType.VALIDATION:
        return 'bg-blue-100 text-blue-800'
      case ErrorType.SYSTEM:
        return 'bg-gray-100 text-gray-800'
      case ErrorType.USER:
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = () => {
    if (!hasErrors) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    }
    
    const criticalErrors = stats.bySeverity[ErrorSeverity.CRITICAL] || 0
    const highErrors = stats.bySeverity[ErrorSeverity.HIGH] || 0
    
    if (criticalErrors > 0) {
      return <Bug className="h-5 w-5 text-red-500" />
    } else if (highErrors > 0) {
      return <XCircle className="h-5 w-5 text-orange-500" />
    } else {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusText = () => {
    if (!hasErrors) return 'Sistema funcionando correctamente'
    
    const criticalErrors = stats.bySeverity[ErrorSeverity.CRITICAL] || 0
    const highErrors = stats.bySeverity[ErrorSeverity.HIGH] || 0
    
    if (criticalErrors > 0) {
      return `${criticalErrors} error${criticalErrors > 1 ? 'es' : ''} crítico${criticalErrors > 1 ? 's' : ''} detectado${criticalErrors > 1 ? 's' : ''}`
    } else if (highErrors > 0) {
      return `${highErrors} error${highErrors > 1 ? 'es' : ''} de alta prioridad`
    } else {
      return `${errorCount} error${errorCount > 1 ? 'es' : ''} menor${errorCount > 1 ? 'es' : ''}`
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <CardTitle className="text-lg">Monitor de Errores</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
        <CardDescription>{getStatusText()}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Estado General */}
        <Alert className={hasErrors ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}>
          <AlertDescription className="flex items-center space-x-2">
            {getStatusIcon()}
            <span>{getStatusText()}</span>
            {lastError && (
              <span className="text-sm text-muted-foreground">
                • Último: {(() => {
                  try {
                    if (!lastError.timestamp) return 'Fecha no disponible'
                    const date = new Date(lastError.timestamp)
                    if (isNaN(date.getTime())) return 'Fecha inválida'
                    return formatDistanceToNow(date, { addSuffix: true, locale: es })
                  } catch (error) {
                    return 'Fecha no disponible'
                  }
                })()}
              </span>
            )}
          </AlertDescription>
        </Alert>

        {/* Estadísticas por Tipo */}
        {hasErrors && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Errores por Tipo (últimas 24h)
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <Badge variant="outline" className={getTypeColor(type as ErrorType)}>
                    {type}
                  </Badge>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estadísticas por Severidad */}
        {hasErrors && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center">
              <TrendingDown className="h-4 w-4 mr-2" />
              Errores por Severidad
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats.bySeverity).map(([severity, count]) => (
                <div key={severity} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-2">
                    {getSeverityIcon(severity as ErrorSeverity)}
                    <Badge variant="outline" className={getSeverityColor(severity as ErrorSeverity)}>
                      {severity}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errores Recientes */}
        {showDetails && recentErrors.length > 0 && (
          <div className="space-y-3">
            <Separator />
            <h4 className="text-sm font-medium flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Errores Recientes
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentErrors.map((error, index) => (
                <div key={index} className="p-3 rounded-lg border bg-card text-card-foreground">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 flex-1">
                      {getSeverityIcon(error.severity)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{error.message}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className={getTypeColor(error.type)}>
                            {error.type}
                          </Badge>
                          {error.code && (
                            <Badge variant="outline">
                              {error.code}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {formatDistanceToNow(error.timestamp, { addSuffix: true, locale: es })}
                    </span>
                  </div>
                  {error.context && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Contexto: {error.context}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        {hasErrors && (
          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" size="sm" onClick={clearErrors}>
              Marcar como Revisado
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ErrorMonitor