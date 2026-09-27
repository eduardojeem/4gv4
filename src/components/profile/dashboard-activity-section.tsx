'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Clock3,
  Flame,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  ArrowUpRight,
  Package,
  Users
} from 'lucide-react'

export interface DashboardActivityStats {
  totalSales: number
  completedTasks: number
  loginStreak: number
  lastActivity: string
}

interface DashboardActivitySectionProps {
  stats: DashboardActivityStats
}

export function DashboardActivitySection({ stats }: DashboardActivitySectionProps) {
  const [feedKey, setFeedKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const metrics = useMemo(() => {
    const weeklyTaskGoal = 20
    const taskGoalProgress = Math.min(100, Math.round((stats.completedTasks / weeklyTaskGoal) * 100))
    const streakProgress = Math.min(100, stats.loginStreak * 10)
    const healthScore = Math.min(
      100,
      Math.round((stats.completedTasks * 3 + stats.totalSales * 2 + stats.loginStreak * 4) / 2),
    )

    const healthLabel =
      healthScore >= 80 ? 'Excelente' : healthScore >= 60 ? 'Muy bien' : healthScore >= 40 ? 'Estable' : 'En progreso'

    return {
      weeklyTaskGoal,
      taskGoalProgress,
      streakProgress,
      healthScore,
      healthLabel,
    }
  }, [stats.completedTasks, stats.loginStreak, stats.totalSales])

  const summaryCards = useMemo(
    () => [
      {
        id: 'sales',
        label: 'Ventas registradas',
        value: stats.totalSales.toLocaleString('es-PY'),
        icon: ShoppingCart,
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        iconBg: 'bg-emerald-100 dark:bg-emerald-950/40',
      },
      {
        id: 'tasks',
        label: 'Tareas completadas',
        value: stats.completedTasks.toLocaleString('es-PY'),
        icon: CheckCircle2,
        iconColor: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-100 dark:bg-blue-950/40',
      },
      {
        id: 'streak',
        label: 'Racha de actividad',
        value: `${stats.loginStreak} días`,
        icon: Flame,
        iconColor: 'text-orange-600 dark:text-orange-400',
        iconBg: 'bg-orange-100 dark:bg-orange-950/40',
      },
      {
        id: 'last-active',
        label: 'Última actividad',
        value: stats.lastActivity,
        icon: Clock3,
        iconColor: 'text-violet-600 dark:text-violet-400',
        iconBg: 'bg-violet-100 dark:bg-violet-950/40',
      },
    ],
    [stats],
  )

  const handleRefreshFeed = () => {
    setRefreshing(true)
    setFeedKey((prev) => prev + 1)
    setTimeout(() => setRefreshing(false), 700)
  }

  return (
    <div className="space-y-6">
      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.id} className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{card.value}</p>
                </div>
                <div className={cn('rounded-lg p-2.5', card.iconBg)}>
                  <card.icon className={cn('h-4 w-4', card.iconColor)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* Tarjeta de Rendimiento y Atajos */}
        <div className="space-y-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Rendimiento Operativo</CardTitle>
              </div>
              <CardDescription>Resumen de productividad y consistencia diaria.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/60 p-3 bg-card">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Objetivo semanal</span>
                  <span className="font-semibold text-foreground">
                    {stats.completedTasks}/{metrics.weeklyTaskGoal}
                  </span>
                </div>
                <Progress value={metrics.taskGoalProgress} className="h-2" />
              </div>

              <div className="rounded-lg border border-border/60 p-3 bg-card">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Consistencia</span>
                  <span className="font-semibold text-foreground">{stats.loginStreak} días</span>
                </div>
                <Progress value={metrics.streakProgress} className="h-2" />
              </div>

              <div className="rounded-lg border border-border/60 p-3 bg-card">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Score general</span>
                  <Badge variant="outline" className="text-xs font-medium">{metrics.healthLabel}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-2xl font-bold text-foreground">{metrics.healthScore}/100</p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 border border-border/40 p-3 text-xs text-muted-foreground">
                <p className="mb-1.5 font-medium text-foreground">Lectura rápida</p>
                <ul className="space-y-1">
                  <li className="flex items-start gap-2">
                    <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>Tu avance semanal está en <strong className="text-foreground">{metrics.taskGoalProgress}%</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>Mantener la racha eleva el score de actividad global.</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Accesos Rápidos Operativos */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Accesos Rápidos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              <Button variant="outline" size="sm" asChild className="justify-between h-9 text-xs">
                <Link href="/dashboard/sales">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
                    Punto de Venta / Órdenes
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="justify-between h-9 text-xs">
                <Link href="/dashboard/customers">
                  <span className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-blue-600" />
                    Cartera de Clientes
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="justify-between h-9 text-xs">
                <Link href="/dashboard/inventory">
                  <span className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-amber-600" />
                    Inventario de Productos
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Historial Reciente */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Historial Reciente</CardTitle>
                <CardDescription>Movimientos de ventas, reparaciones y clientes en tiempo real.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  En vivo
                </Badge>
                <Button variant="outline" size="sm" onClick={handleRefreshFeed} disabled={refreshing}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
                  Actualizar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RecentActivity key={feedKey} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
