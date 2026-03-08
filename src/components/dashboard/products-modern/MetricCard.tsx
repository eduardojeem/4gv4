/**
 * MetricCard Component - Premium Edition
 * Displays a single metric with icon, value, description and optional trend delta
 */

import React from 'react'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface MetricCardProps {
  title: string
  value: number | string
  subtitle: string
  icon: LucideIcon
  gradient: string
  iconBg: string
  textColor: string
  /** Optional trend percentage vs previous period */
  delta?: number | null
  onClick?: () => void
  className?: string
}

export const MetricCard = React.memo(function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  iconBg,
  textColor,
  delta,
  onClick,
  className
}: MetricCardProps) {
  const isPositiveDelta = delta !== null && delta !== undefined && delta >= 0

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${value}. ${subtitle}. Haz clic para filtrar`}
      className={cn(
        'border-0 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
        'hover:-translate-y-0.5 group rounded-2xl overflow-hidden',
        gradient,
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <p
              className={cn('text-xs font-semibold uppercase tracking-wider', textColor)}
              id={`metric-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {title}
            </p>
            <p
              className={cn('text-3xl font-black tracking-tight', textColor.replace('700', '900').replace('400', '200'))}
              aria-labelledby={`metric-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {value}
            </p>
            <p className={cn('text-xs', textColor.replace('700', '500').replace('400', '400'))} role="note">
              {subtitle}
            </p>
          </div>

          <div
            className={cn(
              'h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg',
              'group-hover:scale-110 transition-transform duration-200',
              iconBg
            )}
            aria-hidden="true"
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Delta indicator */}
        {delta !== null && delta !== undefined && (
          <div className={cn(
            'mt-3 pt-3 border-t border-white/20 dark:border-black/10',
            'flex items-center gap-1.5 text-xs font-semibold',
            isPositiveDelta ? textColor.replace('700', '600').replace('400', '300') : 'text-red-600 dark:text-red-400'
          )}>
            {isPositiveDelta
              ? <TrendingUp className="h-3.5 w-3.5" />
              : <TrendingDown className="h-3.5 w-3.5" />
            }
            <span>
              {isPositiveDelta ? '+' : ''}{delta.toFixed(1)}% vs periodo anterior
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
