'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, UserCheck, UserX, Shield, UserPlus } from 'lucide-react'
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
            label: 'Total',
            value: stats.totalUsers,
            icon: Users,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-950/30',
            border: 'border-l-blue-500',
        },
        {
            label: 'Activos',
            value: stats.activeUsers,
            icon: UserCheck,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-950/30',
            border: 'border-l-emerald-500',
        },
        {
            label: 'Inactivos',
            value: stats.inactiveUsers,
            icon: UserX,
            color: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-rose-50 dark:bg-rose-950/30',
            border: 'border-l-rose-500',
        },
        {
            label: 'Admins',
            value: stats.adminsCount,
            icon: Shield,
            color: 'text-violet-600 dark:text-violet-400',
            bg: 'bg-violet-50 dark:bg-violet-950/30',
            border: 'border-l-violet-500',
        },
        {
            label: 'Nuevos este mes',
            value: stats.newUsersThisMonth,
            icon: UserPlus,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-950/30',
            border: 'border-l-amber-500',
        },
    ]

    if (isLoading) {
        return (
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Card key={i} className="border shadow-sm">
                        <CardContent className="p-4">
                            <Skeleton className="h-4 w-16 mb-2" />
                            <Skeleton className="h-7 w-10" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {items.map((item) => (
                <Card key={item.label} className={`border-l-4 ${item.border} shadow-sm hover:shadow-md transition-shadow`}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                    {item.label}
                                </p>
                                <p className="text-2xl font-bold mt-1 tabular-nums">
                                    {item.value}
                                </p>
                            </div>
                            <div className={cn('p-2 rounded-lg', item.bg)}>
                                <item.icon className={cn('h-4 w-4', item.color)} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
