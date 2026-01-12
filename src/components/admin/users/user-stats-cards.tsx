'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Users, UserCheck, UserX, Shield, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserStats {
    totalUsers: number
    activeUsers: number
    inactiveUsers: number
    adminsCount: number
    newUsersThisMonth: number
}

interface UserStatsCardsProps {
    stats: UserStats
    isLoading?: boolean
}

export function UserStatsCards({ stats, isLoading }: UserStatsCardsProps) {
    const items = [
        {
            label: 'Total Usuarios',
            value: stats.totalUsers,
            icon: Users,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            trend: '+12% vs mes anterior'
        },
        {
            label: 'Usuarios Activos',
            value: stats.activeUsers,
            icon: UserCheck,
            color: 'text-green-600 dark:text-green-400',
            bg: 'bg-green-50 dark:bg-green-900/20',
            trend: '98% tasa de actividad'
        },
        {
            label: 'Inactivos',
            value: stats.inactiveUsers,
            icon: UserX,
            color: 'text-red-600 dark:text-red-400',
            bg: 'bg-red-50 dark:bg-red-900/20',
            trend: 'Requieren atención'
        },
        {
            label: 'Administradores',
            value: stats.adminsCount,
            icon: Shield,
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            trend: 'Acceso privilegiado'
        }
    ]

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="animate-pulse dark:bg-gray-800">
                        <CardContent className="p-6">
                            <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full mb-4" />
                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
                <Card key={item.label} className="border-none shadow-md hover:shadow-lg transition-shadow duration-200 dark:bg-gray-800 dark:shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-3 rounded-full", item.bg)}>
                                <item.icon className={cn("h-6 w-6", item.color)} />
                            </div>
                            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full flex items-center">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                {item.trend}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                                {item.label}
                            </p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                                {item.value}
                            </h3>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
