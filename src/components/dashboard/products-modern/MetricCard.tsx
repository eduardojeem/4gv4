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
        'border border-slate-200/60 dark:border-slate-800/60 shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
        'hover:-translate-y-0.5 group rounded-xl overflow-hidden',
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
      <CardContent className="p-3 sm:px-3.5 sm:py-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="space-y-0.5 min-w-0 flex-1">
            <p
              className={cn('text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate', textColor)}
              id={`metric-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {title}
            </p>
            <p
              className={cn('text-xl sm:text-2xl font-black tracking-tight leading-tight', textColor.replace('700', '900').replace('400', '200'))}
              aria-labelledby={`metric-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {value}
            </p>
            <p className={cn('text-[11px] sm:text-xs truncate block font-medium opacity-90', textColor.replace('700', '600').replace('400', '300'))} role="note">
              {subtitle}
            </p>
          </div>

          <div
            className={cn(
              'h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs',
              'group-hover:scale-105 transition-transform duration-150',
              iconBg
            )}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-white" />
          </div>
        </div>

        {/* Delta indicator */}
        {delta !== null && delta !== undefined && (
          <div className={cn(
            'mt-2 pt-1.5 border-t border-white/20 dark:border-black/10',
            'flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold',
            isPositiveDelta ? textColor.replace('700', '600').replace('400', '300') : 'text-red-600 dark:text-red-400'
          )}>
            {isPositiveDelta
              ? <TrendingUp className="h-3 w-3" />
              : <TrendingDown className="h-3 w-3" />
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
