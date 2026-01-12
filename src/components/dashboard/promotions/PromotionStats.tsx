'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  BarChart3,
  AlertTriangle
} from 'lucide-react'
import type { PromotionStats as Stats } from '@/types/promotion'

interface PromotionStatsProps {
  stats: Stats
  loading?: boolean
}

export function PromotionStats({ stats, loading }: PromotionStatsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Promociones',
      value: stats.total,
      description: `${stats.active} activas`,
      icon: BarChart3,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-950'
    },
    {
      title: 'Activas',
      value: stats.active,
      description: 'En funcionamiento',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-950'
    },
    {
      title: 'Programadas',
      value: stats.scheduled,
      description: 'Próximas a iniciar',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-950'
    },
    {
      title: 'Por Expirar',
      value: stats.expiringSoon,
      description: 'En 7 días o menos',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-950',
      alert: stats.expiringSoon > 0
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title} className={stat.alert ? 'border-amber-500/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <div className={`${stat.bgColor} p-2 rounded-lg`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.alert && (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  ¡Atención!
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}

      {/* Additional stats row */}
      <Card className="md:col-span-2 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Uso Total</CardTitle>
          <div className="bg-purple-100 dark:bg-purple-950 p-2 rounded-lg">
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalUsage.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Aplicaciones de promociones
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estado General</CardTitle>
          <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
            <AlertCircle className="h-4 w-4 text-gray-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-xs text-muted-foreground">
                {stats.expired} expiradas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gray-500" />
              <span className="text-xs text-muted-foreground">
                {stats.inactive} inactivas
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
