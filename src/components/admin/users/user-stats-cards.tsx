'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, UserCheck, UserX, Shield, UserPlus, TrendingUp } from 'lucide-react'
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

interface StatItem {
  label: string
  value: number
  icon: React.ElementType
  description: string
  gradient: string
  iconBg: string
  iconColor: string
  accent: string
  barColor: string
  barRatio?: number
}

export function UserStatsCards({ stats, isLoading }: UserStatsCardsProps) {
  const activeRatio = stats.totalUsers > 0 ? stats.activeUsers / stats.totalUsers : 0
  const inactiveRatio = stats.totalUsers > 0 ? stats.inactiveUsers / stats.totalUsers : 0
  const adminRatio = stats.totalUsers > 0 ? stats.adminsCount / stats.totalUsers : 0

  const items: StatItem[] = [
    {
      label: 'Total usuarios',
      value: stats.totalUsers,
      icon: Users,
      description: 'Registrados en el sistema',
      gradient: 'from-blue-50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/10',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
      accent: 'border-l-blue-500',
      barColor: 'bg-blue-500',
      barRatio: 1,
    },
    {
      label: 'Activos',
      value: stats.activeUsers,
      icon: UserCheck,
      description: `${Math.round(activeRatio * 100)}% del total`,
      gradient: 'from-emerald-50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      accent: 'border-l-emerald-500',
      barColor: 'bg-emerald-500',
      barRatio: activeRatio,
    },
    {
      label: 'Inactivos',
      value: stats.inactiveUsers,
      icon: UserX,
      description: `${Math.round(inactiveRatio * 100)}% del total`,
      gradient: 'from-rose-50 to-red-50/50 dark:from-rose-950/20 dark:to-red-950/10',
      iconBg: 'bg-rose-100 dark:bg-rose-900/40',
      iconColor: 'text-rose-600 dark:text-rose-400',
      accent: 'border-l-rose-500',
      barColor: 'bg-rose-500',
      barRatio: inactiveRatio,
    },
    {
      label: 'Administradores',
      value: stats.adminsCount,
      icon: Shield,
      description: `${Math.round(adminRatio * 100)}% del total`,
      gradient: 'from-violet-50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/10',
      iconBg: 'bg-violet-100 dark:bg-violet-900/40',
      iconColor: 'text-violet-600 dark:text-violet-400',
      accent: 'border-l-violet-500',
      barColor: 'bg-violet-500',
      barRatio: adminRatio,
    },
    {
      label: 'Nuevos este mes',
      value: stats.newUsersThisMonth,
      icon: UserPlus,
      description: 'Registros del mes actual',
      gradient: 'from-amber-50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/10',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
      accent: 'border-l-amber-500',
      barColor: 'bg-amber-500',
    },
  ]

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="border shadow-sm overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-12" />
                </div>
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-16 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon
        const hasBar = typeof item.barRatio === 'number'

        return (
          <Card
            key={item.label}
            className={cn(
              'border-l-4 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group',
              item.accent
            )}
          >
            <CardContent className={cn('p-4 bg-gradient-to-br h-full', item.gradient)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-none truncate">
                    {item.label}
                  </p>
                  <p className="text-2xl font-bold mt-1.5 tabular-nums leading-none tracking-tight">
                    {item.value.toLocaleString()}
                  </p>
                </div>
                <div className={cn('p-2 rounded-lg flex-shrink-0 transition-transform group-hover:scale-110', item.iconBg)}>
                  <Icon className={cn('h-4 w-4', item.iconColor)} />
                </div>
              </div>

              {/* Progress bar */}
              {hasBar && (
                <div className="mt-3">
                  <div className="h-1 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', item.barColor)}
                      style={{ width: `${Math.round((item.barRatio ?? 0) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                {item.label === 'Nuevos este mes' && item.value > 0 && (
                  <TrendingUp className="h-3 w-3 text-amber-500" />
                )}
                {item.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
