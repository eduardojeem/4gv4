'use client'

import { useMemo, useState } from 'react'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { PieChart } from 'recharts/es6/chart/PieChart';
import { Pie } from 'recharts/es6/polar/Pie';
import { Cell } from 'recharts/es6/component/Cell';
import { AreaChart } from 'recharts/es6/chart/AreaChart';
import { Area } from 'recharts/es6/cartesian/Area';
import {
    TrendingUp,
    Clock,
    CheckCircle2,
    CalendarRange,
    Smartphone,
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Repair } from '@/types/repairs'
import { subDays, subMonths, startOfYear, isAfter } from 'date-fns'

type Period = '7d' | '30d' | '90d' | 'year'

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
        .slice(-6) // last 6 periods
}

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

    // KPIs for selected period
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

    // Monthly chart data based on all my repairs (not filtered by period, for context)
    const monthlyData = useMemo(() => buildMonthlyData(myRepairs), [myRepairs])

    // Revenue monthly data based on period
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
            { name: 'Entregado', value: counts.entregado, color: '#4b5563' }
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
            .slice(0, 5)
    }, [myRepairs])

    const periodLabel: Record<Period, string> = {
        '7d': 'últimos 7 días',
        '30d': 'últimos 30 días',
        '90d': 'últimos 3 meses',
        'year': 'este año',
    }

    if (isLoading) return <div className="p-8 text-center">Cargando estadísticas...</div>

    return (
        <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Estadísticas de Rendimiento</h1>
                    <p className="text-muted-foreground">
                        Análisis de tus reparaciones — {periodLabel[period]}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={period} onValueChange={v => setPeriod(v as Period)}>
                        <SelectTrigger className="w-[180px]">
                            <CalendarRange className="mr-2 h-4 w-4" />
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
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-linear-to-br from-blue-50 to-indigo-50 border-blue-100 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Total Reparaciones
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{kpis.total}</div>
                        <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                            En el período seleccionado
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-linear-to-br from-green-50 to-emerald-50 border-green-100 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                            Ingresos Generados
                        </CardTitle>
                        <GSIcon className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                            ₲{kpis.revenue.toLocaleString()}
                        </div>
                        <p className="text-xs text-green-600/80 dark:text-green-400/80">
                            Reparaciones entregadas
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-linear-to-br from-purple-50 to-pink-50 border-purple-100 dark:from-purple-950/20 dark:to-pink-950/20 dark:border-purple-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
                            Tiempo Promedio
                        </CardTitle>
                        <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                            {kpis.avgTime > 0 ? `${kpis.avgTime} días` : '—'}
                        </div>
                        <p className="text-xs text-purple-600/80 dark:text-purple-400/80">
                            De creación a entrega
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-linear-to-br from-amber-50 to-orange-50 border-amber-100 dark:from-amber-950/20 dark:to-orange-950/20 dark:border-amber-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
                            Tasa de Éxito
                        </CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                            {kpis.completionRate}%
                        </div>
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                            {kpis.completed} de {kpis.total} completadas
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Visión General</TabsTrigger>
                    <TabsTrigger value="financial">Financiero</TabsTrigger>
                    <TabsTrigger value="devices">Dispositivos</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle>Reparaciones por Mes</CardTitle>
                                <CardDescription>Volumen histórico de reparaciones</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={monthlyData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="reparaciones" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>Estado Actual</CardTitle>
                                <CardDescription>Distribución en el período seleccionado</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {statusData.length === 0 ? (
                                    <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
                                        Sin datos para el período seleccionado
                                    </div>
                                ) : (
                                    <>
                                        <ResponsiveContainer width="100%" height={280}>
                                            <PieChart>
                                                <Pie
                                                    data={statusData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {statusData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="flex flex-wrap justify-center gap-4 mt-2">
                                            {statusData.map((entry, index) => (
                                                <div key={index} className="flex items-center gap-2 text-sm">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                                    <span className="text-muted-foreground">{entry.name}</span>
                                                    <span className="font-medium">({entry.value})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="financial" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tendencia de Ingresos</CardTitle>
                            <CardDescription>Ingresos generados por reparaciones finalizadas</CardDescription>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <ResponsiveContainer width="100%" height={400}>
                                <AreaChart data={revenueData}>
                                    <defs>
                                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `₲${Number(v).toLocaleString()}`} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <Tooltip
                                        formatter={value => [`₲${Number(value).toLocaleString()}`, 'Ingresos']}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="ingresos" stroke="#10b981" fillOpacity={1} fill="url(#colorIngresos)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="devices" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Marcas Más Comunes</CardTitle>
                                <CardDescription>Dispositivos que más reparas (histórico)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {deviceData.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-12">Sin datos</p>
                                ) : (
                                    <div className="space-y-4">
                                        {deviceData.map((device, index) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-100 rounded-lg dark:bg-slate-800">
                                                        <Smartphone className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                                    </div>
                                                    <span className="font-medium">{device.name}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                                                        <div
                                                            className="h-full bg-blue-600 rounded-full"
                                                            style={{ width: `${(device.value / Math.max(...deviceData.map(d => d.value))) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm text-muted-foreground w-8 text-right">{device.value}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Alertas de Calidad</CardTitle>
                                <CardDescription>Reparaciones con garantías o retornos</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4">
                                    <div className="p-4 bg-green-50 rounded-full dark:bg-green-900/20">
                                        <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold">¡Excelente Trabajo!</h3>
                                        <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                                            No tienes garantías activas ni reportes de calidad en el período seleccionado.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
