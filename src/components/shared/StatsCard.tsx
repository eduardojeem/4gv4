'use client'

import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

// ============================================================================
// Types
// ============================================================================

export interface StatsCardProps {
    title: string
    value: string | number
    subtitle?: string
    change?: {
        value: number
        label: string
        type: 'increase' | 'decrease'
    }
    icon: LucideIcon
    color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan'
    trend?: number[]
    className?: string
    variant?: 'default' | 'compact' | 'progress'
    maxValue?: number // For progress variant
}

// ============================================================================
// Color Classes
// ============================================================================

const colorClasses = {
    blue: {
        gradient: 'from-blue-500 to-blue-600',
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-600 dark:text-blue-400',
        shadow: 'shadow-blue-500/20'
    },
    green: {
        gradient: 'from-green-500 to-green-600',
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-600 dark:text-green-400',
        shadow: 'shadow-green-500/20'
    },
    orange: {
        gradient: 'from-orange-500 to-orange-600',
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-600 dark:text-orange-400',
        shadow: 'shadow-orange-500/20'
    },
    red: {
        gradient: 'from-red-500 to-red-600',
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-600 dark:text-red-400',
        shadow: 'shadow-red-500/20'
    },
    purple: {
        gradient: 'from-purple-500 to-purple-600',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-600 dark:text-purple-400',
        shadow: 'shadow-purple-500/20'
    },
    cyan: {
        gradient: 'from-cyan-500 to-cyan-600',
        bg: 'bg-cyan-100 dark:bg-cyan-900/30',
        text: 'text-cyan-600 dark:text-cyan-400',
        shadow: 'shadow-cyan-500/20'
    }
}

// ============================================================================
// Main Component - Default Variant
// ============================================================================

export function StatsCard({
    title,
    value,
    subtitle,
    change,
    icon: Icon,
    color = 'blue',
    trend,
    className,
    variant = 'default',
    maxValue
}: StatsCardProps) {
    const colors = colorClasses[color]

    if (variant === 'compact') {
        return <CompactStatsCard {...{ title, value, icon: Icon, color, className }} />
    }

    if (variant === 'progress' && maxValue) {
        return <ProgressStatsCard {...{ title, value, maxValue, icon: Icon, color, className }} />
    }

    return (
        <Card
            className={cn(
                "group hover:shadow-lg transition-all duration-300 border-0",
                "bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50",
                "overflow-hidden relative",
                className
            )}
        >
            <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity",
                colors.gradient
            )} />

            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className="text-3xl font-bold tracking-tight">{value}</p>

                        {subtitle && (
                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                        )}

                        {change && (
                            <div className="flex items-center gap-1">
                                {change.type === 'increase' ? (
                                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        <TrendingUp className="h-3 w-3" />
                                        <span className="text-xs font-semibold">
                                            {change.value > 0 ? '+' : ''}{change.value}%
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                        <TrendingDown className="h-3 w-3" />
                                        <span className="text-xs font-semibold">{change.value}%</span>
                                    </div>
                                )}
                                {change.label && (
                                    <span className="text-xs text-muted-foreground ml-1">{change.label}</span>
                                )}
                            </div>
                        )}

                        {trend && trend.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                                Tendencia: {trend.length} puntos
                            </div>
                        )}
                    </div>

                    <div className={cn(
                        "p-3 rounded-xl text-white shadow-lg",
                        `bg-gradient-to-br ${colors.gradient}`,
                        colors.shadow
                    )}>
                        <Icon className="h-6 w-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// ============================================================================
// Compact Variant
// ============================================================================

function CompactStatsCard({
    title,
    value,
    icon: Icon,
    color = 'blue',
    className
}: {
    title: string
    value: string | number
    icon: LucideIcon
    color?: StatsCardProps['color']
    className?: string
}) {
    const colors = colorClasses[color!]

    return (
        <Card className={cn(
            "hover:shadow-md transition-all duration-200 border-0",
            "bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50",
            className
        )}>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                            {title}
                        </p>
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                            {value}
                        </p>
                    </div>
                    <div className={cn("p-2 rounded-lg flex-shrink-0 ml-2", colors.bg)}>
                        <Icon className={cn("h-5 w-5", colors.text)} />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// ============================================================================
// Progress Variant
// ============================================================================

function ProgressStatsCard({
    title,
    value,
    maxValue,
    icon: Icon,
    color = 'blue',
    className
}: {
    title: string
    value: string | number
    maxValue: number
    icon: LucideIcon
    color?: StatsCardProps['color']
    className?: string
}) {
    const colors = colorClasses[color!]
    const numericValue = typeof value === 'string' ? parseFloat(value) : value
    const percentage = Math.min((numericValue / maxValue) * 100, 100)

    return (
        <Card className={cn(
            "hover:shadow-md transition-all duration-200 border-0",
            "bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50",
            className
        )}>
            <CardContent className="p-4">
                <div className="space-y-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">{title}</p>
                            <p className="text-2xl font-bold mt-1">{value}</p>
                        </div>
                        <div className={cn("p-2 rounded-lg", colors.bg)}>
                            <Icon className={cn("h-5 w-5", colors.text)} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                                {percentage.toFixed(1)}%
                            </span>
                            <span className="text-muted-foreground">
                                de {maxValue}
                            </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// ============================================================================
// Exports
// ============================================================================

export { CompactStatsCard, ProgressStatsCard }
