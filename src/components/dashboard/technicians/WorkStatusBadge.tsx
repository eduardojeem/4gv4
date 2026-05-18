'use client'

import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { TechnicianLoadState } from '@/hooks/use-technician-stats'

interface WorkStatusBadgeProps {
  status: TechnicianLoadState
  label?: string
  showIcon?: boolean
  variant?: 'default' | 'sm'
}

const statusConfig = {
  no_load: {
    label: 'Sin carga',
    icon: CheckCircle2,
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  light_load: {
    label: 'Carga baja',
    icon: Clock3,
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  },
  medium_load: {
    label: 'Carga media',
    icon: Clock3,
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  high_load: {
    label: 'Carga alta',
    icon: AlertCircle,
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  },
} as const

export function WorkStatusBadge({
  status,
  label,
  showIcon = true,
  variant = 'default',
}: WorkStatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const displayLabel = label || config.label
  const size = variant === 'sm' ? 'h-3 w-3' : 'h-4 w-4'

  return (
    <Badge variant="outline" className={`${config.className} gap-1.5`}>
      {showIcon && <Icon className={size} />}
      <span>{displayLabel}</span>
    </Badge>
  )
}
