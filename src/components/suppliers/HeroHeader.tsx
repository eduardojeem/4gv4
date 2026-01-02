'use client'

import React from 'react'
import { motion  } from '../ui/motion'
import { Building2, TrendingUp, Package, DollarSign, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeroHeaderProps {
    title: string
    subtitle: string
    stats: {
        total: number
        active: number
        totalOrders?: number
        totalAmount?: number
    }
    actions?: React.ReactNode
    className?: string
}

export function HeroHeader({ title, subtitle, stats, actions, className }: HeroHeaderProps) {
    const statCards = [
        {
            icon: Building2,
            label: 'Total',
            value: stats.total,
            color: 'from-blue-500 to-cyan-500',
            iconBg: 'bg-blue-500/10',
            iconColor: 'text-blue-600'
        },
        {
            icon: TrendingUp,
            label: 'Activos',
            value: stats.active,
            color: 'from-green-500 to-emerald-500',
            iconBg: 'bg-green-500/10',
            iconColor: 'text-green-600'
        },
        ...(stats.totalOrders !== undefined ? [{
            icon: Package,
            label: 'Órdenes',
            value: stats.totalOrders,
            color: 'from-purple-500 to-pink-500',
            iconBg: 'bg-purple-500/10',
            iconColor: 'text-purple-600'
        }] : []),
        ...(stats.totalAmount !== undefined ? [{
            icon: DollarSign,
            label: 'Total',
            value: `$${stats.totalAmount.toLocaleString()}`,
            color: 'from-amber-500 to-orange-500',
            iconBg: 'bg-amber-500/10',
            iconColor: 'text-amber-600'
        }] : [])
    ]

    return (
        <div className={cn("relative overflow-hidden rounded-2xl", className)}>
            {/* Animated Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-purple-600 to-pink-600">
                <div className="absolute inset-0 bg-black/10" />

                {/* Animated Orbs */}
                <motion.div
                    className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                <motion.div
                    className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            </div>

            {/* Content */}
            <div className="relative z-10 p-8">
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
                    <div className="flex-1">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="flex items-center gap-3 mb-3"
                        >
                            <Sparkles className="h-8 w-8 text-yellow-300" />
                            <h1 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                                {title}
                            </h1>
                        </motion.div>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="text-lg text-white/90 max-w-2xl"
                        >
                            {subtitle}
                        </motion.p>
                    </div>

                    {/* Actions */}
                    {actions && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="flex flex-wrap gap-3"
                        >
                            {actions}
                        </motion.div>
                    )}
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {statCards.map((stat, index) => (
                        <motion.div
                            key={`${stat.label}-${index}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
                            className="group relative overflow-hidden rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-4 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-xl"
                        >
                            {/* Gradient Overlay on Hover */}
                            <div className={cn(
                                "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-br",
                                stat.color
                            )} />

                            <div className="relative z-10 flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-white/70 mb-1">
                                        {stat.label}
                                    </p>
                                    <p className="text-2xl lg:text-3xl font-bold text-white">
                                        {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                                    </p>
                                </div>

                                <div className={cn(
                                    "rounded-lg p-2",
                                    stat.iconBg
                                )}>
                                    <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
                                </div>
                            </div>

                            {/* Shimmer Effect */}
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    )
}
