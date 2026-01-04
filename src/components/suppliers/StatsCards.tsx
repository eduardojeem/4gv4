'use client'

import React from 'react'
import { motion } from '../ui/motion'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface StatCardProps {
    icon: LucideIcon
    label: string
    value: number | string
    trend?: {
        value: number
        isPositive: boolean
    }
    color: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'cyan'
    onClick?: () => void
    loading?: boolean
}

const colorVariants = {
    blue: {
        gradient: 'from-blue-500 to-cyan-500',
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800',
        icon: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-100 dark:bg-blue-900/50',
        hover: 'hover:border-blue-300 dark:hover:border-blue-700',
        shadow: 'hover:shadow-blue-500/20'
    },
    green: {
        gradient: 'from-green-500 to-emerald-500',
        bg: 'bg-green-50 dark:bg-green-950/30',
        border: 'border-green-200 dark:border-green-800',
        icon: 'text-green-600 dark:text-green-400',
        iconBg: 'bg-green-100 dark:bg-green-900/50',
        hover: 'hover:border-green-300 dark:hover:border-green-700',
        shadow: 'hover:shadow-green-500/20'
    },
    purple: {
        gradient: 'from-purple-500 to-pink-500',
        bg: 'bg-purple-50 dark:bg-purple-950/30',
        border: 'border-purple-200 dark:border-purple-800',
        icon: 'text-purple-600 dark:text-purple-400',
        iconBg: 'bg-purple-100 dark:bg-purple-900/50',
        hover: 'hover:border-purple-300 dark:hover:border-purple-700',
        shadow: 'hover:shadow-purple-500/20'
    },
    amber: {
        gradient: 'from-amber-500 to-orange-500',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800',
        icon: 'text-amber-600 dark:text-amber-400',
        iconBg: 'bg-amber-100 dark:bg-amber-900/50',
        hover: 'hover:border-amber-300 dark:hover:border-amber-700',
        shadow: 'hover:shadow-amber-500/20'
    },
    red: {
        gradient: 'from-red-500 to-rose-500',
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-600 dark:text-red-400',
        iconBg: 'bg-red-100 dark:bg-red-900/50',
        hover: 'hover:border-red-300 dark:hover:border-red-700',
        shadow: 'hover:shadow-red-500/20'
    },
    cyan: {
        gradient: 'from-cyan-500 to-teal-500',
        bg: 'bg-cyan-50 dark:bg-cyan-950/30',
        border: 'border-cyan-200 dark:border-cyan-800',
        icon: 'text-cyan-600 dark:text-cyan-400',
        iconBg: 'bg-cyan-100 dark:bg-cyan-900/50',
        hover: 'hover:border-cyan-300 dark:hover:border-cyan-700',
        shadow: 'hover:shadow-cyan-500/20'
    }
}

export function StatCard({ icon: Icon, label, value, trend, color, onClick, loading }: StatCardProps) {
    const colors = colorVariants[color]

    if (loading) {
        return (
            <div className="rounded-xl border bg-card p-6">
                <div className="flex items-start justify-between mb-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            className={cn(
                "group relative overflow-hidden rounded-xl border-2 p-6 transition-all duration-300",
                colors.bg,
                colors.border,
                colors.hover,
                colors.shadow,
                onClick && "cursor-pointer hover:shadow-lg",
                "backdrop-blur-sm"
            )}
        >
            {/* Gradient Overlay */}
            <div className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 bg-gradient-to-br",
                colors.gradient
            )} />

            {/* Content */}
            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                        "rounded-lg p-2.5 transition-transform duration-300 group-hover:scale-110",
                        colors.iconBg
                    )}>
                        <Icon className={cn("h-6 w-6", colors.icon)} />
                    </div>

                    {trend && (
                        <div className={cn(
                            "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full",
                            trend.isPositive
                                ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30"
                                : trend.value === 0
                                    ? "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30"
                                    : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30"
                        )}>
                            {trend.value > 0 ? (
                                <TrendingUp className="h-3.5 w-3.5" />
                            ) : trend.value < 0 ? (
                                <TrendingDown className="h-3.5 w-3.5" />
                            ) : (
                                <Minus className="h-3.5 w-3.5" />
                            )}
                            <span>{Math.abs(trend.value)}%</span>
                        </div>
                    )}
                </div>

                {/* Value */}
                <div className="mb-2">
                    <h3 className="text-3xl font-bold text-foreground">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </h3>
                </div>

                {/* Label */}
                <p className="text-sm font-medium text-muted-foreground">
                    {label}
                </p>
            </div>

            {/* Shimmer Effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </motion.div>
    )
}

interface StatsGridProps {
    stats: Array<Omit<StatCardProps, 'loading'>>
    loading?: boolean
    className?: string
}

export function StatsGrid({ stats, loading, className }: StatsGridProps) {
    return (
        <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6",
            className
        )}>
            {stats.map((stat, index) => (
                <StatCard key={index} {...stat} loading={loading} />
            ))}
        </div>
    )
}
