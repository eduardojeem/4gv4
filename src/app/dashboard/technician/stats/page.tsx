'use client'

import { useMemo, useState } from 'react'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { BarChart } from 'recharts/es6/chart/BarChart'
import { Bar } from 'recharts/es6/cartesian/Bar'
import { XAxis } from 'recharts/es6/cartesian/XAxis'
import { YAxis } from 'recharts/es6/cartesian/YAxis'
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid'
import { Tooltip } from 'recharts/es6/component/Tooltip'
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer'
import { PieChart } from 'recharts/es6/chart/PieChart'
import { Pie } from 'recharts/es6/polar/Pie'
import { Cell } from 'recharts/es6/component/Cell'
import { AreaChart } from 'recharts/es6/chart/AreaChart'
import { Area } from 'recharts/es6/cartesian/Area'
import {
  TrendingUp, Clock, CheckCircle2, CalendarRange,
  Smartphone, Banknote, BarChart3, PieChart as PieChartIcon,
  Activity
} from 'lucide-react'
import { Repair } from '@/types/repairs'
import { formatCurrency } from '@/lib/currency'
import { subDays, startOfYear, isAfter } from 'date-fns'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d' | 'year'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterByPeriod(repairs: Repair[], period: Period): Repair[] {
  const now = new Date()
  let cutoff: Date
  switch (period) {
    case '7d':   cutoff = subDays(now, 7); break
    case '30d':  cutoff = subDays(now, 30); break
    case '90d':  cutoff = subDays(now, 90); break
    case 'year': cutoff = startOfYear(now); break
  }
  return repairs.filter(r => isAfter(new Date(r.createdAt), cutoff))
}

function buildMonthlyData(repairs: Repair[]) {
  const buckets: Record<string, { name: string; reparaciones: number; ingresos: number }> = {}
  repairs.forEach(r => {
    const d = new Date(r.completedAt || r.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' })
    if (!buckets[key]) buckets[key] = { name: label, reparaciones: 0, ingresos: 0 }
    buckets[key].reparaciones += 1
    buckets[key].ingresos += r.finalCost || r.estimatedCost || 0
  })
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
    .slice(-6)
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <Card className={cn('border-l-4 shadow-sm', accent)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">
          {value}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {subtitle}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TechnicianStatsPage() {
  const { repairs, isLoading } = useRepairs()
  const { user } = useAuth()
  const [period, setPeriod] = useState<Period>('30d')

  // Filter repairs for current technician
  const myRepairs = useMemo(() => {
    if (!user?.id) return []
    return repairs.filter(r => r.technician?.id === user.id)
  }, [repairs, user?.id])

  // Repairs filtered by selected period
  const periodRepairs = useMemo(() => filterByPeriod(myRepairs, period), [myRepairs, period])

  // KPIs
  const kpis = useMemo(() => {
    const total = periodRepairs.length
    const completed = periodRepairs.filter(r => r.dbStatus === 'listo' || r.dbStatus === 'entregado').length
    const totalRevenue = periodRepairs
      .filter(r => r.dbStatus === 'entregado')
      .reduce((acc, r) => acc + (r.finalCost || r.estimatedCost || 0), 0)

    const completedWithDates = periodRepairs.filter(
      r => r.dbStatus === 'entregado' && r.completedAt && r.createdAt
    )
    const avgTime = completedWithDates.length > 0
      ? completedWithDates.reduce((acc, r) => {
          const days = Math.ceil(
            (new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
          )
          return acc + days
        }, 0) / completedWithDates.length
      : 0

    return {
      total,
      completed,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      revenue: totalRevenue,
      avgTime: Math.round(avgTime * 10) / 10,
    }
  }, [periodRepairs])

  // Chart data
  const monthlyData = useMemo(() => buildMonthlyData(myRepairs), [myRepairs])
  const revenueData = useMemo(() => buildMonthlyData(periodRepairs), [periodRepairs])

  const statusData = useMemo(() => {
    const counts = { recibido: 0, diagnostico: 0, reparacion: 0, listo: 0, entregado: 0 }
    periodRepairs.forEach(r => {
      if (r.dbStatus && r.dbStatus in counts) {
        counts[r.dbStatus as keyof typeof counts]++
      }
    })
    return [
      { name: 'Recibido', value: counts.recibido, color: '#94a3b8' },
      { name: 'Diagnóstico', value: counts.diagnostico, color: '#ca8a04' },
      { name: 'En Reparación', value: counts.reparacion, color: '#2563eb' },
      { name: 'Listo', value: counts.listo, color: '#16a34a' },
      { name: 'Entregado', value: counts.entregado, color: '#4b5563' },
    ].filter(d => d.value > 0)
  }, [periodRepairs])

  const deviceData = useMemo(() => {
    const brands: Record<string, number> = {}
    myRepairs.forEach(r => {
      const brand = r.brand || 'Otros'
      brands[brand] = (brands[brand] || 0) + 1
    })
    return Object.entries(brands)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [myRepairs])

  const periodLabel: Record<Period, string> = {
    '7d': 'últimos 7 días',
    '30d': 'últimos 30 días',
    '90d': 'últimos 3 meses',
    'year': 'este año',
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Estadísticas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Rendimiento — {periodLabel[period]}
          </p>
        </div>
        <Select value={period} onValueChange={v => setPeriod(v as Period)}>
          <SelectTrigger className="w-[170px] h-9 text-sm">
            <CalendarRange className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="90d">Últimos 3 meses</SelectItem>
            <SelectItem value="year">Este año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Reparaciones"
          value={kpis.total}
          subtitle="En el período"
          icon={TrendingUp}
          accent="border-l-blue-500"
        />
        <KpiCard
          title="Ingresos Generados"
          value={formatCurrency(kpis.revenue)}
          subtitle="Reparaciones entregadas"
          icon={Banknote}
          accent="border-l-emerald-500"
        />
        <KpiCard
          title="Tiempo Promedio"
          value={kpis.avgTime > 0 ? `${kpis.avgTime} días` : '—'}
          subtitle="De creación a entrega"
          icon={Clock}
          accent="border-l-violet-500"
        />
        <KpiCard
          title="Tasa de Éxito"
          value={`${kpis.completionRate}%`}
          subtitle={`${kpis.completed} de ${kpis.total} completadas`}
          icon={CheckCircle2}
          accent="border-l-amber-500"
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-1 rounded-lg">
          {[
            { value: 'overview', icon: BarChart3, label: 'General' },
            { value: 'financial', icon: Activity, label: 'Financiero' },
            { value: 'devices', icon: Smartphone, label: 'Dispositivos' },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-1.5 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md px-3 py-1.5"
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4 border border-gray-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Reparaciones por Mes</CardTitle>
                <CardDescription>Volumen histórico (últimos 6 meses)</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                {monthlyData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-sm text-gray-400">
                    Sin datos históricos aún
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                      />
                      <Bar dataKey="reparaciones" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 border border-gray-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribución por Estado</CardTitle>
                <CardDescription>Período: {periodLabel[period]}</CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-sm text-gray-400">
                    Sin datos para este período
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-3 mt-3">
                      {statusData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-1.5 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-gray-600 dark:text-gray-400">{entry.name}</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-4">
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tendencia de Ingresos</CardTitle>
              <CardDescription>Ingresos por reparaciones finalizadas</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {revenueData.length === 0 ? (
                <div className="flex items-center justify-center h-[350px] text-sm text-gray-400">
                  Sin datos de ingresos para este período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => formatCurrency(Number(v))} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Ingresos']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    />
                    <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIngresos)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Marcas Más Reparadas</CardTitle>
              <CardDescription>Top dispositivos (histórico completo)</CardDescription>
            </CardHeader>
            <CardContent>
              {deviceData.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
                  Sin datos de dispositivos
                </div>
              ) : (
                <div className="space-y-3">
                  {deviceData.map((device, index) => {
                    const maxVal = deviceData[0].value
                    const pct = Math.round((device.value / maxVal) * 100)
                    return (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex items-center gap-2.5 w-32 flex-shrink-0">
                          <div className="p-1.5 bg-gray-100 dark:bg-slate-800 rounded-md">
                            <Smartphone className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {device.name}
                          </span>
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <Badge variant="secondary" className="text-xs tabular-nums min-w-[2rem] justify-center">
                          {device.value}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
