/**
 * RepairCard - Card component for grid/kanban views
 * 
 * Clean design with:
 * - Color-coded left border by status
 * - Urgency indicator
 * - Key info at a glance (device, customer, technician, date, cost)
 * - Compact but readable
 */

import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, User, Wrench, Zap, ImageIcon } from 'lucide-react'
import { Repair } from '@/types/repairs'
import { statusConfig, priorityConfig } from '@/config/repair-constants'
import { formatCurrency } from '@/lib/currency'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface RepairCardProps {
  repair: Repair
  onClick?: () => void
  className?: string
}

const statusBorderColors: Record<string, string> = {
  recibido: 'border-l-gray-400',
  diagnostico: 'border-l-amber-500',
  reparacion: 'border-l-blue-500',
  pausado: 'border-l-orange-400',
  listo: 'border-l-emerald-500',
  entregado: 'border-l-gray-300',
  cancelado: 'border-l-red-400',
}

export const RepairCard = memo<RepairCardProps>(
  function RepairCard({ repair, onClick, className }) {
    const status = statusConfig[repair.status]
    const priority = priorityConfig[repair.priority]
    const borderColor = statusBorderColors[repair.status] || 'border-l-gray-300'
    const imageCount = Array.isArray(repair.images) ? repair.images.length : 0
    const ticketLabel = repair.ticketNumber || repair.id.slice(0, 8)

    const timeAgo = (() => {
      try {
        if (!repair.createdAt) return ''
        const date = new Date(repair.createdAt)
        if (isNaN(date.getTime())) return ''
        return formatDistanceToNow(date, { addSuffix: false, locale: es })
      } catch {
        return ''
      }
    })()

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onClick) return

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onClick()
      }
    }

    return (
      <Card
        className={cn(
          'border border-gray-100 bg-white transition-shadow dark:border-slate-800 dark:bg-slate-900',
          'border-l-4',
          onClick && 'cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          borderColor,
          className
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? `Abrir reparacion ${ticketLabel} de ${repair.customer.name}` : undefined}
      >
        <CardContent className="p-3.5 space-y-2.5">
          {/* Header: Device + Priority/Urgency */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {repair.device}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                #{ticketLabel}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {repair.urgency === 'urgent' && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                  <Zap className="h-2.5 w-2.5" />
                  Urgente
                </Badge>
              )}
              {repair.urgency !== 'urgent' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                  {priority.icon} {priority.label}
                </Badge>
              )}
            </div>
          </div>

          {/* Issue description */}
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
            {repair.issue}
          </p>

          {/* Customer + Technician */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 min-w-0">
              <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
              <span className="truncate font-medium">{repair.customer.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 min-w-0">
              <Wrench className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{repair.technician?.name || 'Sin asignar'}</span>
            </div>
          </div>

          {/* Footer: Status + Date + Cost */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
            <Badge
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0 h-5 font-medium', status.color)}
            >
              {status.label}
            </Badge>
            <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
              {imageCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <ImageIcon className="h-3 w-3" />{imageCount}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />{timeAgo}
              </span>
              {repair.estimatedCost > 0 && (
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {formatCurrency(repair.estimatedCost)}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  },
  (prevProps, nextProps) => {
    const prev = prevProps.repair
    const next = nextProps.repair
    if (prev === next) return true

    const prevImageCount = Array.isArray(prev.images) ? prev.images.length : 0
    const nextImageCount = Array.isArray(next.images) ? next.images.length : 0

    return (
      prev.id === next.id &&
      prev.status === next.status &&
      prev.priority === next.priority &&
      prev.urgency === next.urgency &&
      prev.lastUpdate === next.lastUpdate &&
      prev.technician?.id === next.technician?.id &&
      prevImageCount === nextImageCount
    )
  }
)

RepairCard.displayName = 'RepairCard'
