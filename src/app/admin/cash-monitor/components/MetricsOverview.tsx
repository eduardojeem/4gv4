'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Monitor,
  DollarSign,
  AlertTriangle,
  Lock,
  PauseCircle,
  CheckCircle2,
  TrendingUp
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { CashMonitorMetrics } from '../types'

interface MetricsOverviewProps {
  metrics: CashMonitorMetrics
  loading: boolean
}

export function MetricsOverview({ metrics, loading }: MetricsOverviewProps) {
  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border shadow-sm">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    {
      label: 'Cajas Abiertas',
      value: metrics.openSessions,
      icon: Monitor,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      border: 'border-l-blue-500'
    },
    {
      label: 'Cerradas Hoy',
      value: metrics.closedToday,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-l-emerald-500'
    },
    {
      label: 'Suspendidas',
      value: metrics.suspendedSessions,
      icon: PauseCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-l-amber-500'
    },
    {
      label: 'Bloqueadas',
      value: metrics.blockedSessions,
      icon: Lock,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-l-red-500'
    },
    {
      label: 'Balance Total',
      value: formatCurrency(metrics.totalBalance),
      icon: DollarSign,
      color: 'text-violet-600',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
      border: 'border-l-violet-500',
      isText: true
    },
    {
      label: 'Diferencias',
      value: formatCurrency(metrics.totalDiscrepancies),
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-950/30',
      border: 'border-l-orange-500',
      isText: true
    },
    {
      label: 'Alertas Activas',
      value: metrics.unresolvedAlerts,
      icon: AlertTriangle,
      color: metrics.criticalAlerts > 0 ? 'text-red-600' : 'text-amber-600',
      bg: metrics.criticalAlerts > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-amber-50 dark:bg-amber-950/30',
      border: metrics.criticalAlerts > 0 ? 'border-l-red-500' : 'border-l-amber-500'
    },
    {
      label: 'Registros',
      value: metrics.totalRegisters,
      icon: Monitor,
      color: 'text-slate-600',
      bg: 'bg-slate-50 dark:bg-slate-950/30',
      border: 'border-l-slate-500'
    }
  ]

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label} className={`border-l-4 ${card.border} shadow-sm hover:shadow-md transition-shadow`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                    {card.label}
                  </p>
                  <p className="text-xl font-bold mt-1 tabular-nums truncate">
                    {card.value}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${card.bg} flex-shrink-0`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
