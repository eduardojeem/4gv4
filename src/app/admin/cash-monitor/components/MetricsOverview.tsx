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
  TrendingUp,
  Wallet,
  CreditCard,
  QrCode
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
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border shadow-xs rounded-2xl">
            <CardContent className="p-4">
              <Skeleton className="h-3.5 w-20 mb-2" />
              <Skeleton className="h-7 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const isNetOver = metrics.totalDiscrepancies > 0.5
  const isNetShort = metrics.totalDiscrepancies < -0.5

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {/* 1. Cajas Abiertas en Vivo */}
      <Card className="rounded-2xl border border-blue-500/20 bg-blue-500/5 shadow-xs">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">En Vivo</p>
            <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Monitor className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300 tabular-nums mt-1">{metrics.openSessions}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{metrics.totalRegisters} cajas registradas</p>
        </CardContent>
      </Card>

      {/* 2. Ventas Acumuladas */}
      <Card className="rounded-2xl border border-violet-500/20 bg-violet-500/5 shadow-xs">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">Ventas Período</p>
            <div className="p-1 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-black text-foreground font-mono tabular-nums mt-1 truncate">
            {formatCurrency(metrics.totalSales)}
          </p>
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate flex items-center gap-1">
            <span>Efec: {formatCurrency(metrics.salesCash)}</span>
            {(metrics.salesCard > 0 || metrics.salesTransfer > 0) && (
              <span>• Dig: {formatCurrency(metrics.salesCard + metrics.salesTransfer + metrics.salesMixed)}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Diferencia Acumulada (Sobrante vs Faltante) */}
      <Card
        className={`rounded-2xl border shadow-xs transition-colors ${
          isNetShort
            ? 'border-rose-500/30 bg-rose-500/5'
            : isNetOver
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-emerald-500/30 bg-emerald-500/5'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">Dif. Acumulada</p>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                isNetShort
                  ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300'
                  : isNetOver
                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {isNetShort ? 'Faltante' : isNetOver ? 'Sobrante' : 'Exacto'}
            </span>
          </div>

          <p
            className={`text-lg sm:text-xl font-black mt-1 font-mono tabular-nums ${
              isNetShort
                ? 'text-rose-600 dark:text-rose-400'
                : isNetOver
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isNetOver ? `+${formatCurrency(metrics.totalDiscrepancies)}` : isNetShort ? `-${formatCurrency(Math.abs(metrics.totalDiscrepancies))}` : 'Gs. 0'}
          </p>

          <div className="mt-0.5 text-[10px] text-muted-foreground truncate">
            {metrics.totalOver > 0 && metrics.totalShort > 0 ? (
              <span>▲ +{formatCurrency(metrics.totalOver)} | ▼ -{formatCurrency(metrics.totalShort)}</span>
            ) : metrics.totalOver > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">▲ Todo en sobrante</span>
            ) : metrics.totalShort > 0 ? (
              <span className="text-rose-600 dark:text-rose-400">▼ Todo en faltante</span>
            ) : (
              <span>Totalmente cuadrado</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Arqueos Exactos vs Con Descuadre */}
      <Card className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Arqueos</p>
            <div className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {metrics.perfectSessions}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {metrics.sessionsWithDiff > 0 ? `${metrics.sessionsWithDiff} con descuadre` : '100% exactos'}
          </p>
        </CardContent>
      </Card>

      {/* 5. Balance Estimado en Gaveta */}
      <Card className="rounded-2xl border border-border/70 bg-card shadow-xs">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gaveta en Vivo</p>
            <div className="p-1 rounded-md bg-muted text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-black text-foreground font-mono tabular-nums mt-1 truncate">
            {formatCurrency(metrics.totalBalance)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Efectivo en cajas activas</p>
        </CardContent>
      </Card>

      {/* 6. Alertas / Incidentes de Seguridad */}
      <Card
        className={`rounded-2xl border shadow-xs ${
          metrics.criticalAlerts > 0
            ? 'border-red-500/30 bg-red-500/5'
            : metrics.unresolvedAlerts > 0
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-border/70 bg-card'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p
              className={`text-[10px] font-bold uppercase tracking-wider ${
                metrics.criticalAlerts > 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'
              }`}
            >
              Alertas Activas
            </p>
            <div
              className={`p-1 rounded-md ${
                metrics.criticalAlerts > 0
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </div>
          <p
            className={`text-2xl font-black tabular-nums mt-1 ${
              metrics.criticalAlerts > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
            }`}
          >
            {metrics.unresolvedAlerts}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {metrics.criticalAlerts > 0
              ? `${metrics.criticalAlerts} críticas urgentes`
              : metrics.suspendedSessions + metrics.blockedSessions > 0
              ? `${metrics.suspendedSessions + metrics.blockedSessions} bloqueadas/susp.`
              : 'Sin incidentes'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
