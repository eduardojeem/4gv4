'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Award, CheckCircle2, Clock3, Coins, Trophy, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useRepairAnalytics } from '@/hooks/use-repair-analytics'
import { cn } from '@/lib/utils'

export function AnalyticsTechnicians({ className, timeRange = '6months', onTimeRangeChange }: { className?: string; timeRange?: string; onTimeRangeChange?: (value: string) => void }) {
  const analytics = useRepairAnalytics(timeRange)
  const list = analytics.technicianAnalysis || []

  const totalTechnicians = list.length
  const avgEfficiency = totalTechnicians > 0
    ? list.reduce((acc, t) => acc + (t.efficiency || 0), 0) / totalTechnicians
    : 0
  const totalRevenue = list.reduce((acc, t) => acc + (t.revenue || 0), 0)
  const avgDays = totalTechnicians > 0
    ? list.reduce((acc, t) => acc + (t.avgTime || 0), 0) / totalTechnicians
    : 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* Controles de Período */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card/60 p-3.5 rounded-2xl border border-border/70 shadow-2xs">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Productividad y Eficiencia por Técnico
          </h2>
          <p className="text-xs text-muted-foreground">
            Evaluación comparativa del rendimiento del equipo en taller.
          </p>
        </div>

        <Select value={timeRange} onValueChange={onTimeRangeChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs bg-card border-border/70 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6months">Últimos 6 meses</SelectItem>
            <SelectItem value="12months">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards de Resumen del Equipo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary border-border/70 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Técnicos Evaluados
              </span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-1.5">
              {totalTechnicians}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Colaboradores activos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 border-border/70 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Eficiencia Promedio
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums mt-1.5">
              {Math.round(avgEfficiency)}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tasa global de resolución</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 border-border/70 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Facturación por Mano de Obra
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-1.5">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Generado por el taller</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 border-border/70 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Entrega Promedio
              </span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock3 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums mt-1.5">
              {avgDays > 0 ? `${avgDays.toFixed(1)} días` : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tiempo promedio de orden</p>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard de Técnicos */}
      <Card className="border-border/70 bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <Trophy className="h-4 w-4" />
            </div>
            <span>Ranking de Rendimiento por Técnico</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {list.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                No hay datos suficientes de técnicos para este rango temporal.
              </div>
            ) : (
              list.map((tech, index) => {
                const medalStyles = [
                  {
                    badge: 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-amber-500/10',
                    border: 'border-amber-500/30',
                    rankText: '1º Lugar',
                  },
                  {
                    badge: 'border-slate-400/40 bg-slate-400/15 text-slate-600 dark:text-slate-300 shadow-slate-500/10',
                    border: 'border-border/70',
                    rankText: '2º Lugar',
                  },
                  {
                    badge: 'border-amber-700/40 bg-amber-700/15 text-amber-700 dark:text-amber-500 shadow-amber-700/10',
                    border: 'border-border/70',
                    rankText: '3º Lugar',
                  },
                ]

                const style = medalStyles[index] || {
                  badge: 'border-border bg-muted/30 text-muted-foreground',
                  border: 'border-border/60',
                  rankText: `${index + 1}º Lugar`,
                }

                return (
                  <div
                    key={index}
                    className={cn(
                      'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-muted/10 transition-all duration-200 hover:bg-muted/25 shadow-2xs',
                      style.border,
                    )}
                  >
                    {/* Identidad y Posición */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm border shadow-xs', style.badge)}>
                        {index < 3 ? <Award className="h-5 w-5" /> : `#${index + 1}`}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-foreground truncate">{tech.name}</p>
                          <span className="text-[10px] font-semibold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/40">
                            {style.rankText}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <strong className="text-foreground">{tech.completedRepairs}</strong> de {tech.totalRepairs} reparaciones completadas
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 max-w-[200px]">
                          <Progress value={tech.efficiency} className="h-1.5 bg-muted/60" />
                          <span className="text-[11px] font-bold tabular-nums text-foreground">
                            {Math.round(tech.efficiency)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Métricas Económicas y Tiempos */}
                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                          Ingresos Generados
                        </span>
                        <span className="text-base font-bold text-foreground tabular-nums">
                          {formatCurrency(tech.revenue)}
                        </span>
                      </div>
                      <div className="text-right border-l border-border/60 pl-4">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                          Tiempo Promedio
                        </span>
                        <span className="text-sm font-bold text-muted-foreground tabular-nums">
                          {tech.avgTime > 0 ? `${tech.avgTime.toFixed(1)} días` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
