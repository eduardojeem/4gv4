'use client'

import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TechnicianLoadState } from '@/hooks/use-technician-stats'

interface WorkStatusBadgeProps {
  status: TechnicianLoadState
  label?: string
  showIcon?: boolean
  showDot?: boolean
  variant?: 'default' | 'sm'
  className?: string
}

const statusConfig = {
  no_load: {
    label: 'Sin carga (Disponible)',
    shortLabel: 'Disponible',
    icon: CheckCircle2,
    className:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    dotClass: 'bg-emerald-500',
  },
  light_load: {
    label: 'Carga baja',
    shortLabel: 'Carga baja',
    icon: Clock3,
    className:
      'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
    dotClass: 'bg-blue-500',
  },
  medium_load: {
    label: 'Carga media',
    shortLabel: 'Carga media',
    icon: Clock3,
    className:
      'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    dotClass: 'bg-amber-500',
  },
  high_load: {
    label: 'Carga alta (Sobrecarga)',
    shortLabel: 'Sobrecarga',
    icon: AlertCircle,
    className:
      'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    dotClass: 'bg-rose-500',
  },
} as const

export function WorkStatusBadge({
  status,
  label,
  showIcon = true,
  showDot = true,
  variant = 'default',
  className,
}: WorkStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.no_load
  const Icon = config.icon
  const displayLabel = label || (variant === 'sm' ? config.shortLabel : config.label)
  const size = variant === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium transition-colors items-center gap-1.5',
        variant === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        config.className,
        className,
      )}
    >
      {showDot && (
        <span
          className={cn(
            'inline-block rounded-full',
            variant === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
            config.dotClass,
          )}
        />
      )}
      {showIcon && <Icon className={size} />}
      <span className="truncate">{displayLabel}</span>
    </Badge>
  )
}
