'use client'

import { AlertTriangle, TrendingDown, Package, DollarSign, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Alert } from '../lib/analytics-engine'
import { useState } from 'react'

interface AlertsPanelProps {
  alerts: Alert[]
  onDismiss?: (alertId: string) => void
  className?: string
}

export function AlertsPanel({ alerts, onDismiss, className }: AlertsPanelProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  if (alerts.length === 0) return null

  const visibleAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.id))

  if (visibleAlerts.length === 0) return null

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertId))
    onDismiss?.(alertId)
  }

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50'
      case 'info':
        return 'border-blue-200 bg-blue-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'warning':
        return <TrendingDown className="h-4 w-4 text-yellow-600" />
      case 'info':
        return <Package className="h-4 w-4 text-blue-600" />
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />
    }
  }

  const getSeverityBadge = (severity: Alert['severity']) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      info: 'bg-blue-100 text-blue-800 border-blue-200'
    }
    
    return (
      <Badge variant="outline" className={cn('text-xs', colors[severity])}>
        {severity === 'critical' ? 'Crítico' : severity === 'warning' ? 'Advertencia' : 'Info'}
      </Badge>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Alertas
          <Badge variant="secondary" className="ml-auto">
            {visibleAlerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'p-4 rounded-lg border transition-all',
                getSeverityColor(alert.severity)
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 mt-0.5">
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{alert.title}</p>
                      {getSeverityBadge(alert.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {alert.message}
                    </p>
                    {alert.metadata && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {Object.entries(alert.metadata).map(([key, value]) => (
                          <span key={key} className="mr-3">
                            <strong>{key}:</strong> {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss(alert.id)}
                  className="flex-shrink-0 h-6 w-6 p-0"
                  aria-label="Descartar alerta"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
