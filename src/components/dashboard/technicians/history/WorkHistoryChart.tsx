'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Area,
    AreaChart
} from 'recharts'
import { TrendingUp, Calendar, DollarSign } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Repair } from '@/types/repairs'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'

interface WorkHistoryChartProps {
    repairs: Repair[]
}

export function WorkHistoryChart({ repairs }: WorkHistoryChartProps) {
    const chartData = useMemo(() => {
        const now = new Date()
        const months = []
        
        // Generar datos para los últimos 6 meses
        for (let i = 5; i >= 0; i--) {
            const monthDate = subMonths(now, i)
            const monthStart = startOfMonth(monthDate)
            const monthEnd = endOfMonth(monthDate)
            
            const monthRepairs = repairs.filter(repair => {
                const repairDate = new Date(repair.completedAt || repair.createdAt)
                return isWithinInterval(repairDate, { start: monthStart, end: monthEnd })
            })
            
            const completedRepairs = monthRepairs.filter(r => r.dbStatus === 'entregado')
            const revenue = completedRepairs.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost), 0)
            
            months.push({
                month: format(monthDate, 'MMM yyyy', { locale: es }),
                monthShort: format(monthDate, 'MMM', { locale: es }),
                total: monthRepairs.length,
                completed: completedRepairs.length,
                revenue: revenue,
                avgTime: completedRepairs.length > 0 
                    ? Math.round(completedRepairs.reduce((sum, r) => {
                        if (r.completedAt && r.createdAt) {
                            return sum + Math.ceil((new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                        }
                        return sum
                    }, 0) / completedRepairs.length)
                    : 0
            })
        }
        
        return months
    }, [repairs])

    const deviceTypeData = useMemo(() => {
        const deviceTypes = repairs.reduce((acc, repair) => {
            const type = repair.deviceType
            const typeName = type === 'smartphone' ? 'Smartphones' :
                           type === 'tablet' ? 'Tablets' :
                           type === 'laptop' ? 'Laptops' :
                           type === 'desktop' ? 'Desktops' : 'Accesorios'
            
            if (!acc[typeName]) {
                acc[typeName] = { name: typeName, count: 0, revenue: 0 }
            }
            acc[typeName].count++
            acc[typeName].revenue += (repair.finalCost || repair.estimatedCost)
            return acc
        }, {} as Record<string, { name: string; count: number; revenue: number }>)
        
        return Object.values(deviceTypes).sort((a, b) => b.count - a.count)
    }, [repairs])

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background border rounded-lg shadow-lg p-3">
                    <p className="font-medium">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: {entry.name === 'Ingresos' ? (
                                <span className="flex items-center gap-1">
                                    <GSIcon className="h-3 w-3" />
                                    {entry.value.toLocaleString()}
                                </span>
                            ) : entry.value}
                        </p>
                    ))}
                </div>
            )
        }
        return null
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Tendencias de Trabajo (Últimos 6 meses)
                </h3>
                
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Gráfico de reparaciones completadas */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Reparaciones por Mes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                    <XAxis 
                                        dataKey="monthShort" 
                                        tick={{ fontSize: 12 }}
                                        axisLine={false}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 12 }}
                                        axisLine={false}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="completed"
                                        stroke="#3b82f6"
                                        fill="#3b82f6"
                                        fillOpacity={0.1}
                                        strokeWidth={2}
                                        name="Completadas"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="#64748b"
                                        fill="#64748b"
                                        fillOpacity={0.05}
                                        strokeWidth={1}
                                        strokeDasharray="5 5"
                                        name="Total"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Gráfico de ingresos */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Ingresos Generados
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                    <XAxis 
                                        dataKey="monthShort" 
                                        tick={{ fontSize: 12 }}
                                        axisLine={false}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 12 }}
                                        axisLine={false}
                                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar
                                        dataKey="revenue"
                                        fill="#10b981"
                                        radius={[4, 4, 0, 0]}
                                        name="Ingresos"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Distribución por tipo de dispositivo */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Distribución por Tipo de Dispositivo</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={deviceTypeData} layout="horizontal">
                                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                    <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} />
                                    <YAxis 
                                        type="category" 
                                        dataKey="name" 
                                        tick={{ fontSize: 12 }}
                                        axisLine={false}
                                        width={80}
                                    />
                                    <Tooltip 
                                        formatter={(value, name) => [value, name === 'count' ? 'Cantidad' : 'Ingresos']}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill="#6366f1"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="space-y-3">
                            {deviceTypeData.map((item, index) => {
                                const percentage = Math.round((item.count / repairs.length) * 100)
                                return (
                                    <div key={item.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-3 h-3 rounded-full"
                                                style={{ 
                                                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index] || '#64748b'
                                                }}
                                            />
                                            <span className="font-medium text-sm">{item.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium">{item.count} reparaciones</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <GSIcon className="h-3 w-3" />
                                                {item.revenue.toLocaleString()}
                                            </div>
                                            <Badge variant="outline" className="text-xs mt-1">
                                                {percentage}%
                                            </Badge>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}