'use client'

import { useMemo, useState } from 'react'
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
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      },
      {
        id: 'tasks',
        label: 'Tareas completadas',
        value: stats.completedTasks.toLocaleString('es-PY'),
        icon: CheckCircle2,
        iconColor: 'text-blue-600',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      },
      {
        id: 'streak',
        label: 'Racha actual',
        value: `${stats.loginStreak} dias`,
        icon: Flame,
        iconColor: 'text-orange-600',
        iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      },
      {
        id: 'last-active',
        label: 'Ultima actividad',
        value: stats.lastActivity,
        icon: Clock3,
        iconColor: 'text-violet-600',
        iconBg: 'bg-violet-100 dark:bg-violet-900/30',
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.id} className="border-slate-200/80 dark:border-slate-800">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
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
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-600" />
              <CardTitle className="text-base">Rendimiento</CardTitle>
            </div>
            <CardDescription>Resumen de productividad y consistencia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-slate-200/80 p-3 dark:border-slate-800">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-400">Objetivo semanal</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {stats.completedTasks}/{metrics.weeklyTaskGoal}
                </span>
              </div>
              <Progress value={metrics.taskGoalProgress} className="h-2.5" />
            </div>

            <div className="rounded-lg border border-slate-200/80 p-3 dark:border-slate-800">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-400">Consistencia</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{stats.loginStreak} dias</span>
              </div>
              <Progress value={metrics.streakProgress} className="h-2.5" />
            </div>

            <div className="rounded-lg border border-slate-200/80 p-3 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Score general</span>
                <Badge variant="outline">{metrics.healthLabel}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.healthScore}/100</p>
              </div>
            </div>

            <div className="rounded-lg bg-slate-100/70 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <p className="mb-1.5 font-medium">Lectura rapida</p>
              <ul className="space-y-1">
                <li className="flex items-start gap-2">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  Tu avance semanal esta en <strong>{metrics.taskGoalProgress}%</strong>.
                </li>
                <li className="flex items-start gap-2">
                  <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  Mantener la racha eleva el score de actividad.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Historial reciente</CardTitle>
                <CardDescription>Ventas, reparaciones y clientes en tiempo real.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
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
