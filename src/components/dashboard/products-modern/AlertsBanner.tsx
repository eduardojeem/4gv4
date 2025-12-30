/**
 * AlertsBanner Component
 * Displays inventory alerts prominently at the top of the dashboard
 */

import React from 'react'
import { AlertTriangle, AlertCircle, Info, X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ProductAlert } from '@/types/products-dashboard'
import { groupAlertsByType } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'

export interface AlertsBannerProps {
  alerts: ProductAlert[]
  onAlertClick: (type: 'out_of_stock' | 'low_stock' | 'missing_data') => void
  onDismissAlert: (alertId: string) => void
  className?: string
}

export function AlertsBanner({
  alerts,
  onAlertClick,
  onDismissAlert,
  className
}: AlertsBannerProps) {
  // Only show active (unresolved and unread) alerts
  const activeAlerts = alerts.filter(alert => !alert.is_resolved && !alert.read)

  if (activeAlerts.length === 0) {
    return null
  }

  // Group alerts by type
  const grouped = groupAlertsByType(activeAlerts)

  // Count alerts by type
  const outOfStockCount = grouped.out_of_stock.length
  const lowStockCount = grouped.low_stock.length
  const missingDataCount = grouped.missing_data.length

  // Get first 3 alerts to display
  const displayAlerts = activeAlerts.slice(0, 3)
  const remainingCount = Math.max(0, activeAlerts.length - 3)

  // Determine primary alert type and styling
  let primaryType: 'out_of_stock' | 'low_stock' | 'missing_data' = 'low_stock'
  let bgGradient = 'from-amber-500 to-orange-500'
  let icon = <AlertTriangle className="h-6 w-6" />

  if (outOfStockCount > 0) {
    primaryType = 'out_of_stock'
    bgGradient = 'from-red-500 to-red-600'
    icon = <AlertCircle className="h-6 w-6" />
  } else if (lowStockCount > 0) {
    primaryType = 'low_stock'
    bgGradient = 'from-amber-500 to-orange-500'
    icon = <AlertTriangle className="h-6 w-6" />
  } else if (missingDataCount > 0) {
    primaryType = 'missing_data'
    bgGradient = 'from-blue-500 to-blue-600'
    icon = <Info className="h-6 w-6" />
  }

  return (
    <Card
      className={cn(
        'border-0 shadow-lg overflow-hidden',
        className
      )}
    >
      <div className={cn('bg-gradient-to-r text-white p-4', bgGradient)}>
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 mt-1">
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg">
                Alertas de Inventario
              </h3>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {activeAlerts.length}
              </Badge>
            </div>

            {/* Alert Summary */}
            <p className="text-sm text-white/90 mb-3">
              {outOfStockCount > 0 && `${outOfStockCount} ${outOfStockCount === 1 ? 'producto agotado' : 'productos agotados'}`}
              {outOfStockCount > 0 && lowStockCount > 0 && ', '}
              {lowStockCount > 0 && `${lowStockCount} con bajo stock`}
              {(outOfStockCount > 0 || lowStockCount > 0) && missingDataCount > 0 && ', '}
              {missingDataCount > 0 && `${missingDataCount} con datos faltantes`}
            </p>

            {/* Alert Badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              {displayAlerts.map((alert) => (
                <Badge
                  key={alert.id}
                  variant="secondary"
                  className="bg-white/90 text-gray-900 hover:bg-white transition-colors cursor-pointer group"
                  onClick={() => onDismissAlert(alert.id)}
                >
                  <span className="truncate max-w-[200px]">{alert.message}</span>
                  <X className="h-3 w-3 ml-1 opacity-50 group-hover:opacity-100" />
                </Badge>
              ))}
              {remainingCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-white/70 text-gray-900"
                >
                  +{remainingCount} más
                </Badge>
              )}
            </div>

            {/* Action Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAlertClick(primaryType)}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              Ver Productos
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
