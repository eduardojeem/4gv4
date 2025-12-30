'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  UserCheck,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Star,
  Award,
  AlertTriangle,
  DollarSign,
  Activity,
  Clock,
  Target
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { cn } from '@/lib/utils'

interface CustomerStatsCardsProps {
  metrics: {
    totalCustomers: number
    activeCustomers: number
    totalRevenue: number
    avgOrderValue: number
    customersWithCredits: number
    totalPendingAmount: number
    overduePayments: number
    inactiveCustomers: number
    vipCustomers: number
    premiumCustomers: number
  }
  compact?: boolean
}

export function CustomerStatsCards({ metrics, compact = false }: CustomerStatsCardsProps) {
  const stats = [
    {
      title: 'Total Clientes',
      value: metrics.totalCustomers.toLocaleString(),
      change: '+12%',
      changeType: 'positive' as const,
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Clientes registrados',
      bgPattern: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      title: 'Clientes Activos',
      value: metrics.activeCustomers.toLocaleString(),
      change: '+8%',
      changeType: 'positive' as const,
      icon: UserCheck,
      gradient: 'from-green-500 to-emerald-500',
      description: `${Math.round((metrics.activeCustomers / metrics.totalCustomers) * 100)}% del total`,
      bgPattern: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      title: 'Ingresos Totales',
      value: (
        <div className="flex items-center gap-1">
          <GSIcon className="h-5 w-5" />
          {metrics.totalRevenue.toLocaleString()}
        </div>
      ),
      change: '+15%',
      changeType: 'positive' as const,
      icon: DollarSign,
      gradient: 'from-purple-500 to-violet-500',
      description: 'Valor total generado',
      bgPattern: 'bg-purple-50 dark:bg-purple-900/20'
    },
    {
      title: 'Créditos Activos',
      value: metrics.customersWithCredits.toLocaleString(),
      change: metrics.overduePayments > 0 ? '-3%' : '+18%',
      changeType: metrics.overduePayments > 0 ? 'negative' as const : 'positive' as const,
      icon: CreditCard,
      gradient: 'from-orange-500 to-red-500',
      description: `${metrics.overduePayments} pagos vencidos`,
      bgPattern: 'bg-orange-50 dark:bg-orange-900/20',
      alert: metrics.overduePayments > 0
    },
    {
      title: 'Clientes VIP',
      value: metrics.vipCustomers.toLocaleString(),
      change: '+25%',
      changeType: 'positive' as const,
      icon: Star,
      gradient: 'from-yellow-400 to-orange-500',
      description: 'Segmento premium',
      bgPattern: 'bg-yellow-50 dark:bg-yellow-900/20'
    },
    {
      title: 'Valor Promedio',
      value: (
        <div className="flex items-center gap-1">
          <GSIcon className="h-5 w-5" />
          {Math.round(metrics.avgOrderValue).toLocaleString()}
        </div>
      ),
      change: '+7%',
      changeType: 'positive' as const,
      icon: Target,
      gradient: 'from-indigo-500 to-purple-500',
      description: 'Por cliente',
      bgPattern: 'bg-indigo-50 dark:bg-indigo-900/20'
    }
  ]

  const StatCard = ({ 
    stat, 
    index 
  }: { 
    stat: typeof stats[0]
    index: number 
  }) => {
    const Icon = stat.icon
    const isPositive = stat.changeType === 'positive'
    const ChangeIcon = isPositive ? TrendingUp : TrendingDown

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ y: -2, scale: 1.02 }}
        className="h-full"
      >
        <Card className={cn(
          "relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300",
          "bg-gradient-to-br from-white via-white to-gray-50/50",
          "dark:from-slate-800 dark:via-slate-800 dark:to-slate-900/50",
          stat.alert && "ring-2 ring-red-200 dark:ring-red-800"
        )}>
          {/* Background Pattern */}
          <div className={cn(
            "absolute top-0 right-0 w-24 h-24 opacity-10 transform rotate-12 translate-x-6 -translate-y-6",
            stat.bgPattern
          )}>
            <Icon className="w-full h-full" />
          </div>

          {/* Alert Badge */}
          {stat.alert && (
            <div className="absolute top-2 right-2">
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Atención
              </Badge>
            </div>
          )}

          <CardHeader className={cn("pb-2", compact && "pb-1")}>
            <div className="flex items-center justify-between">
              <CardTitle className={cn(
                "text-sm font-medium text-gray-600 dark:text-gray-300",
                compact && "text-xs"
              )}>
                {stat.title}
              </CardTitle>
              <div className={cn(
                "p-2 rounded-lg bg-gradient-to-r shadow-sm",
                `bg-gradient-to-r ${stat.gradient}`
              )}>
                <Icon className={cn(
                  "text-white",
                  compact ? "h-4 w-4" : "h-5 w-5"
                )} />
              </div>
            </div>
          </CardHeader>

          <CardContent className={cn("space-y-2", compact && "space-y-1")}>
            {/* Main Value */}
            <div className={cn(
              "font-bold text-gray-900 dark:text-white",
              compact ? "text-xl" : "text-2xl"
            )}>
              {stat.value}
            </div>

            {/* Change Indicator */}
            <div className="flex items-center justify-between">
              <div className={cn(
                "flex items-center gap-1 text-xs",
                isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                <ChangeIcon className="h-3 w-3" />
                <span className="font-medium">{stat.change}</span>
                <span className="text-gray-500">vs mes anterior</span>
              </div>
            </div>

            {/* Description */}
            <p className={cn(
              "text-gray-500 dark:text-gray-400",
              compact ? "text-xs" : "text-sm"
            )}>
              {stat.description}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={cn(
        "grid gap-4",
        compact 
          ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" 
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      )}
    >
      {stats.map((stat, index) => (
        <StatCard key={stat.title} stat={stat} index={index} />
      ))}
    </motion.div>
  )
}