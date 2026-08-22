/**
 * AlertsBanner Component - Rediseñado
 * Notificación compacta, elegante y descartable para alertas de inventario
 */

import React, { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, X, ChevronRight, Eye, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProductAlert } from '@/types/products-dashboard'
import { groupAlertsByType } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'

export interface AlertsBannerProps {
  alerts: ProductAlert[]
  onAlertClick: (type: 'out_of_stock' | 'low_stock' | 'missing_data') => void
  onDismissAlert: (alertId: string) => void
  onDismissAll?: () => void
  className?: string
}

export function AlertsBanner({
  alerts,
  onAlertClick,
  onDismissAlert,
  onDismissAll,
  className
}: AlertsBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Only show active (unresolved and unread) alerts
  const activeAlerts = alerts.filter(alert => !alert.is_resolved && !alert.read)

  if (isDismissed || activeAlerts.length === 0) {
    return null
  }

  // Group alerts by type
  const grouped = groupAlertsByType(activeAlerts)

  const outOfStockCount = grouped.out_of_stock.length
  const lowStockCount = grouped.low_stock.length
  const missingDataCount = grouped.missing_data.length

  const displayAlerts = activeAlerts.slice(0, 3)
  const remainingCount = Math.max(0, activeAlerts.length - 3)

  // Determine primary alert type and theme
  let primaryType: 'out_of_stock' | 'low_stock' | 'missing_data' = 'low_stock'
  let toneClass = 'bg-amber-500/10 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200'
  let iconClass = 'text-amber-600 dark:text-amber-400'
  let buttonClass = 'hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
  let IconComponent = AlertTriangle

  if (outOfStockCount > 0) {
    primaryType = 'out_of_stock'
    toneClass = 'bg-red-500/10 border-red-300 dark:border-red-800/60 text-red-900 dark:text-red-200'
    iconClass = 'text-red-600 dark:text-red-400'
    buttonClass = 'hover:bg-red-500/20 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800'
    IconComponent = ShieldAlert
  } else if (missingDataCount > 0 && lowStockCount === 0) {
    primaryType = 'missing_data'
    toneClass = 'bg-blue-500/10 border-blue-300 dark:border-blue-800/60 text-blue-900 dark:text-blue-200'
    iconClass = 'text-blue-600 dark:text-blue-400'
    buttonClass = 'hover:bg-blue-500/20 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800'
    IconComponent = Info
  }

  const handleDismissBanner = () => {
    setIsDismissed(true)
    onDismissAll?.()
  }

  return (
    <div
      className={cn(
        'relative rounded-xl border p-3 md:py-2.5 md:px-4 text-xs transition-all shadow-xs backdrop-blur-md animate-in fade-in duration-300',
        toneClass,
        className
      )}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 md:gap-4">
        {/* Left side: Icon + Counts */}
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="p-1 rounded-md bg-white/70 dark:bg-black/20 shrink-0">
            <IconComponent className={cn('h-4 w-4', iconClass)} />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold">
              {activeAlerts.length === 1 ? '1 alerta de inventario:' : `${activeAlerts.length} alertas de inventario:`}
            </span>

            {outOfStockCount > 0 && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-bold bg-red-100/80 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300/80 dark:border-red-800/80">
                {outOfStockCount} {outOfStockCount === 1 ? 'agotado' : 'agotados'}
              </Badge>
            )}

            {lowStockCount > 0 && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-bold bg-amber-100/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300/80 dark:border-amber-800/80">
                {lowStockCount} bajo stock
              </Badge>
            )}

            {missingDataCount > 0 && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-bold bg-blue-100/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300/80 dark:border-blue-800/80">
                {missingDataCount} datos incompletos
              </Badge>
            )}
          </div>
        </div>

        {/* Right side: Action buttons & Close button */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAlertClick(primaryType)}
            className={cn('h-7 px-2.5 text-xs font-semibold rounded-lg', buttonClass)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Ver productos
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDismissBanner}
            title="Ocultar notificación"
            className="h-7 w-7 rounded-lg text-current opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-opacity"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Ocultar</span>
          </Button>
        </div>
      </div>

      {/* Optional Expanded Individual Badges if there are multiple alerts */}
      {isExpanded && displayAlerts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-current/10">
          {displayAlerts.map((alert) => (
            <Badge
              key={alert.id}
              variant="secondary"
              className="text-[10px] bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 hover:bg-white transition-colors cursor-pointer gap-1"
              onClick={() => onDismissAlert(alert.id)}
              title="Clic para descartar este producto"
            >
              <span className="truncate max-w-[180px]">{alert.message}</span>
              <X className="h-3 w-3 opacity-60 hover:opacity-100" />
            </Badge>
          ))}
          {remainingCount > 0 && (
            <span className="text-[10px] text-muted-foreground self-center">
              +{remainingCount} más
            </span>
          )}
        </div>
      )}
    </div>
  )
}
