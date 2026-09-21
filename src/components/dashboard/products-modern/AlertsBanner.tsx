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
  let toneClass = 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
  let iconClass = 'text-amber-600 dark:text-amber-400'
  let buttonClass = 'bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700/80'
  let IconComponent = AlertTriangle

  if (outOfStockCount > 0) {
    primaryType = 'out_of_stock'
    toneClass = 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
    iconClass = 'text-rose-600 dark:text-rose-400'
    buttonClass = 'bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700/80'
    IconComponent = ShieldAlert
  } else if (missingDataCount > 0 && lowStockCount === 0) {
    primaryType = 'missing_data'
    toneClass = 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200'
    iconClass = 'text-blue-600 dark:text-blue-400'
    buttonClass = 'bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700/80'
    IconComponent = Info
  }

  const handleDismissBanner = () => {
    setIsDismissed(true)
    onDismissAll?.()
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl border p-2.5 sm:px-4 sm:py-2.5 text-xs transition-all shadow-xs backdrop-blur-md animate-in fade-in duration-200',
        toneClass,
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4">
        {/* Left side: Icon + Counts */}
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/90 dark:bg-slate-900/90 shadow-2xs shrink-0">
            <IconComponent className={cn('h-3.5 w-3.5', iconClass)} />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {activeAlerts.length === 1 ? '1 alerta de inventario:' : `${activeAlerts.length} alertas de inventario:`}
            </span>

            {outOfStockCount > 0 && (
              <Badge variant="outline" className="px-2 py-0 text-[10px] font-bold rounded-full bg-rose-100/90 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300/80 dark:border-rose-800/80 shadow-2xs">
                {outOfStockCount} {outOfStockCount === 1 ? 'agotado' : 'agotados'}
              </Badge>
            )}

            {lowStockCount > 0 && (
              <Badge variant="outline" className="px-2 py-0 text-[10px] font-bold rounded-full bg-amber-100/90 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300/80 dark:border-amber-800/80 shadow-2xs">
                {lowStockCount} bajo stock
              </Badge>
            )}

            {missingDataCount > 0 && (
              <Badge variant="outline" className="px-2 py-0 text-[10px] font-bold rounded-full bg-blue-100/90 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-300/80 dark:border-blue-800/80 shadow-2xs">
                {missingDataCount} datos incompletos
              </Badge>
            )}
          </div>
        </div>

        {/* Right side: Action buttons & Close button */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAlertClick(primaryType)}
            className={cn('h-7 px-3 text-xs font-semibold rounded-xl shadow-2xs transition-all', buttonClass)}
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
            className="h-6 w-6 rounded-lg text-current opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
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
