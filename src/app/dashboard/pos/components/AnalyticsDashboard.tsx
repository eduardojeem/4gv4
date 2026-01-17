'use client'

import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { POSMetrics } from '../lib/analytics-engine'

interface AnalyticsDashboardProps {
  metrics: POSMetrics
  className?: string
}

export function AnalyticsDashboard({ metrics, className }: AnalyticsDashboardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
  }

  const stats = [
    {
      title: 'Ventas Hoy',
      value: formatCurrency(metrics.totalRevenue),
      change: metrics.revenueChange,
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      title: 'Ganancia',
      value: formatCurrency(metrics.totalProfit),
      change: metrics.profitChange,
      icon: TrendingUp,
      color: 'text-blue-600'
    },
    {
      title: 'Ticket Promedio',
      value: formatCurrency(metrics.averageTicket),
      change: metrics.ticketChange,
      icon: ShoppingCart,
      color: 'text-purple-600'
    },
    {
      title: 'Margen',
      value: `${metrics.profitMargin.toFixed(1)}%`,
      change: metrics.marginChange,
      icon: Package,
      color: 'text-orange-600'
    }
  ]

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const isPositive = stat.change >= 0
          const TrendIcon = isPositive ? TrendingUp : TrendingDown

          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className={cn('h-4 w-4', stat.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendIcon
                    className={cn(
                      'h-3 w-3',
                      isPositive ? 'text-green-600' : 'text-red-600'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isPositive ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {formatPercent(stat.change)}
                  </span>
                  <span className="text-xs text-muted-foreground">vs ayer</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {metrics.totalSales === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center gap-2 pt-6">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              No hay ventas registradas hoy. Las métricas se actualizarán automáticamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
