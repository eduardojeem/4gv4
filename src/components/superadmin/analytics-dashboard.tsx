'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  DollarSign,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SuperAdminAnalyticsData } from '@/lib/superadmin/analytics'

const COLORS: Record<string, string> = {
  FREE: '#94a3b8',
  BASIC: '#3b82f6',
  STARTER: '#3b82f6',
  PROFESSIONAL: '#8b5cf6',
  PRO: '#8b5cf6',
  ENTERPRISE: '#f59e0b',
}

const emptyAnalytics: SuperAdminAnalyticsData = {
  growthData: [],
  planDistribution: [],
  activityData: [],
  revenueData: {
    mrr: 0,
    arr: 0,
    activeSubscriptions: 0,
    averageRevenuePerSub: 0,
  },
  topOrganizations: [],
  generatedAt: new Date().toISOString(),
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function SuperAdminAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<SuperAdminAnalyticsData>(emptyAnalytics)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/superadmin/analytics', { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || 'Error al cargar analytics')
      }

      setAnalytics(payload as SuperAdminAnalyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
        <p className="font-medium text-slate-500">Cargando analytics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[400px] max-w-md flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/20">
          <AlertTriangle className="h-10 w-10 text-rose-500" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white">Error al cargar</h2>
          <p className="mt-2 text-slate-500">{error}</p>
        </div>
        <Button onClick={refresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    )
  }

  const { growthData, planDistribution, activityData, revenueData, topOrganizations } = analytics
  const planDistributionChartData = planDistribution as unknown as Array<Record<string, string | number>>
  const currentMonth = growthData[growthData.length - 1]?.count || 0
  const previousMonth = growthData[growthData.length - 2]?.count || 0
  const growthPercentage = previousMonth > 0
    ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 backdrop-blur-xl dark:border-purple-800 dark:from-purple-950/30 dark:to-purple-900/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Total Organizaciones
              </CardTitle>
              <div className="rounded-xl bg-purple-500 p-2 shadow-lg">
                <Building2 className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
              {growthData.reduce((sum, item) => sum + item.count, 0)}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
              <TrendingUp className="h-3 w-3" />
              +{currentMonth} este mes
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 backdrop-blur-xl dark:border-emerald-800 dark:from-emerald-950/30 dark:to-emerald-900/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                MRR (Ingresos Mensuales)
              </CardTitle>
              <div className="rounded-xl bg-emerald-500 p-2 shadow-lg">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
              {formatCurrency(revenueData.mrr)}
            </div>
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              ARR: {formatCurrency(revenueData.arr)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 backdrop-blur-xl dark:border-blue-800 dark:from-blue-950/30 dark:to-blue-900/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Suscripciones Activas
              </CardTitle>
              <div className="rounded-xl bg-blue-500 p-2 shadow-lg">
                <Users className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
              {revenueData.activeSubscriptions}
            </div>
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
              Prom: {formatCurrency(revenueData.averageRevenuePerSub)}/sub
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 backdrop-blur-xl dark:border-amber-800 dark:from-amber-950/30 dark:to-amber-900/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Tasa de Crecimiento
              </CardTitle>
              <div className="rounded-xl bg-amber-500 p-2 shadow-lg">
                <Activity className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
              {growthPercentage > 0 ? '+' : ''}{growthPercentage}%
            </div>
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              vs mes anterior
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              Crecimiento de Organizaciones
            </CardTitle>
            <CardDescription>Ultimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9' }} />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', r: 5 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-blue-600" />
              Distribucion de Planes
            </CardTitle>
            <CardDescription>Por cantidad de organizaciones</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={planDistributionChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {planDistributionChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[String(entry.name)] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Actividad de Usuarios
            </CardTitle>
            <CardDescription>Activos vs inactivos por mes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9' }} />
                <Legend />
                <Bar dataKey="active" fill="#10b981" name="Activos" radius={[8, 8, 0, 0]} />
                <Bar dataKey="inactive" fill="#64748b" name="Inactivos" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              Top 5 Organizaciones
            </CardTitle>
            <CardDescription>Por cantidad de usuarios</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topOrganizations.map((org, index) => (
                <div key={`${org.name}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? 'bg-amber-500 text-white' : ''} ${index === 1 ? 'bg-slate-400 text-white' : ''} ${index === 2 ? 'bg-orange-600 text-white' : ''} ${index > 2 ? 'bg-slate-300 text-slate-700' : ''}`}>
                      {index + 1}
                    </div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{org.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{org.user_count}</span>
                  </div>
                </div>
              ))}
              {topOrganizations.length === 0 && (
                <div className="py-8 text-center text-slate-500">No hay datos disponibles</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-xs text-slate-500">
        Ultima actualizacion: {new Date(analytics.generatedAt).toLocaleString('es-PY')}
      </div>
    </div>
  )
}
