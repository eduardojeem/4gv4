/**
 * MetricCard Component
 * Displays a single metric with icon, value, and description
 */

import React from 'react'
import { LucideIcon } from 'lucide-react'
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
  onClick,
  className
}: MetricCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${value}. ${subtitle}. Haz clic para filtrar`}
      className={cn(
        'border-0 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className={cn('text-sm font-medium', textColor)} id={`metric-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
              {title}
            </p>
            <p className={cn('text-3xl font-bold', textColor.replace('700', '900'))} aria-labelledby={`metric-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
              {value}
            </p>
            <p className={cn('text-xs', textColor.replace('700', '600'))} role="note">
              {subtitle}
            </p>
          </div>
          <div 
            className={cn(
              'h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg',
              iconBg
            )}
            aria-hidden="true"
          >
            <Icon className="h-7 w-7 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
