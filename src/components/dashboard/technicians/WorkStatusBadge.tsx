'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react'

type WorkStatus = 'available' | 'busy' | 'offline' | 'unavailable'

interface WorkStatusBadgeProps {
    status: WorkStatus
    label?: string
    showIcon?: boolean
    variant?: 'default' | 'sm'
}

const statusConfig = {
    available: {
        label: 'Disponible',
        icon: CheckCircle2,
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
    },
    busy: {
        label: 'Ocupado',
        icon: Clock,
        className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800'
    },
    offline: {
        label: 'Fuera de servicio',
        icon: XCircle,
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800'
    },
    unavailable: {
        label: 'No disponible',
        icon: AlertCircle,
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
    }
}

export function WorkStatusBadge({
    status,
    label,
    showIcon = true,
    variant = 'default'
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
