'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    TrendingUp,
    TrendingDown,
    Clock,
    Star,
    Award,
    Target,
    Calendar,
    DollarSign
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Repair } from '@/types/repairs'
import { format, subMonths, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

interface TechnicianPerformanceMetricsProps {
    repairs: Repair[]
}

export function TechnicianPerformanceMetrics({ repairs }: TechnicianPerformanceMetricsProps) {
    const metrics = useMemo(() => {
        const now = new Date()
        const thisMonth = { start: startOfMonth(now), end: endOfMonth(now) }
        const lastMonth = { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) }
        
        // Filtrar reparaciones completadas
        const completedRepairs = repairs.filter(r => r.dbStatus === 'entregado')
        
        // Métricas del mes actual
        const thisMonthRepairs = completedRepairs.filter(r => 
            isWithinInterval(new Date(r.completedAt || r.createdAt), thisMonth)
        )
        
        // Métricas del mes pasado
        const lastMonthRepairs = completedRepairs.filter(r => 
            isWithinInterval(new Date(r.completedAt || r.createdAt), lastMonth)
        )

        // Calcular tiempo promedio de reparación
        const calculateAvgRepairTime = (repairList: Repair[]) => {
            if (repairList.length === 0) return 0
            const totalDays = repairList.reduce((sum, r) => {
                if (r.completedAt && r.createdAt) {
                    return sum + Math.ceil((new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                }
                return sum
            }, 0)
            return Math.round(totalDays / repairList.length)
        }

        // Calcular ingresos
        const calculateRevenue = (repairList: Repair[]) => 
            repairList.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost), 0)

        // Calcular calificación promedio
        const calculateAvgRating = (repairList: Repair[]) => {
            const ratedRepairs = repairList.filter(r => r.customerRating && r.customerRating > 0)
            if (ratedRepairs.length === 0) return 0
            return ratedRepairs.reduce((sum, r) => sum + (r.customerRating || 0), 0) / ratedRepairs.length
        }

        // Métricas actuales
        const thisMonthMetrics = {
            count: thisMonthRepairs.length,
            revenue: calculateRevenue(thisMonthRepairs),
            avgTime: calculateAvgRepairTime(thisMonthRepairs),
            avgRating: calculateAvgRating(thisMonthRepairs)
        }

        // Métricas del mes pasado
        const lastMonthMetrics = {
            count: lastMonthRepairs.length,
            revenue: calculateRevenue(lastMonthRepairs),
            avgTime: calculateAvgRepairTime(lastMonthRepairs),
            avgRating: calculateAvgRating(lastMonthRepairs)
        }

        // Calcular cambios porcentuales
        const calculateChange = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0
            return Math.round(((current - previous) / previous) * 100)
        }

        // Análisis por tipo de dispositivo
        const deviceTypeAnalysis = completedRepairs.reduce((acc, repair) => {
            const type = repair.deviceType
            if (!acc[type]) {
                acc[type] = { count: 0, revenue: 0, avgTime: 0, totalTime: 0 }
            }
            acc[type].count++
            acc[type].revenue += (repair.finalCost || repair.estimatedCost)
            
            if (repair.completedAt && repair.createdAt) {
                const days = Math.ceil((new Date(repair.completedAt).getTime() - new Date(repair.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                acc[type].totalTime += days
            }
            return acc
        }, {} as Record<string, { count: number; revenue: number; avgTime: number; totalTime: number }>)

        // Calcular tiempo promedio por tipo
        Object.keys(deviceTypeAnalysis).forEach(type => {
            const data = deviceTypeAnalysis[type]
            data.avgTime = data.count > 0 ? Math.round(data.totalTime / data.count) : 0
        })

        return {
            thisMonth: thisMonthMetrics,
            lastMonth: lastMonthMetrics,
            changes: {
                count: calculateChange(thisMonthMetrics.count, lastMonthMetrics.count),
                revenue: calculateChange(thisMonthMetrics.revenue, lastMonthMetrics.revenue),
                avgTime: calculateChange(thisMonthMetrics.avgTime, lastMonthMetrics.avgTime),
                avgRating: calculateChange(thisMonthMetrics.avgRating, lastMonthMetrics.avgRating)
            },
            deviceTypes: deviceTypeAnalysis,
            total: {
                count: completedRepairs.length,
                revenue: calculateRevenue(completedRepairs),
                avgTime: calculateAvgRepairTime(completedRepairs),
                avgRating: calculateAvgRating(completedRepairs)
            }
        }
    }, [repairs])

    const MetricCard = ({ 
        title, 
        value, 
        change, 
        icon: Icon, 
        format = 'number',
        colorScheme = 'blue' 
    }: {
        title: string
        value: number
        change: number
        icon: any
        format?: 'number' | 'currency' | 'rating' | 'days'
        colorScheme?: 'blue' | 'green' | 'orange' | 'purple'
    }) => {
        const formatValue = (val: number) => {
            switch (format) {
                case 'currency':
                    return (
                        <div className="flex items-center gap-1">
                            <GSIcon className="h-5 w-5" />
                            {val.toLocaleString()}
                        </div>
                    )
                case 'rating':
                    return (
                        <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {val.toFixed(1)}
                        </div>
                    )
                case 'days':
                    return `${val} días`
                default:
                    return val.toString()
            }
        }

        const isPositive = change > 0
        const isNegative = change < 0
        const changeColor = format === 'days' 
            ? (isNegative ? 'text-green-600' : 'text-red-600') // Para tiempo, menos es mejor
            : (isPositive ? 'text-green-600' : 'text-red-600')

        const colors = {
            blue: 'from-blue-50 to-indigo-50 border-blue-100 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-900 text-blue-700 dark:text-blue-300',
            green: 'from-green-50 to-emerald-50 border-green-100 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-900 text-green-700 dark:text-green-300',
            orange: 'from-orange-50 to-amber-50 border-orange-100 dark:from-orange-950/20 dark:to-amber-950/20 dark:border-orange-900 text-orange-700 dark:text-orange-300',
            purple: 'from-purple-50 to-violet-50 border-purple-100 dark:from-purple-950/20 dark:to-violet-950/20 dark:border-purple-900 text-purple-700 dark:text-purple-300'
        }

        return (
            <Card className={`bg-gradient-to-br ${colors[colorScheme]}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        {title}
                    </CardTitle>
                    <Icon className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatValue(value)}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                        {change !== 0 && (
                            <>
                                {(format === 'days' ? change < 0 : change > 0) ? (
                                    <TrendingUp className="h-3 w-3" />
                                ) : (
                                    <TrendingDown className="h-3 w-3" />
                                )}
                                <span className={changeColor}>
                                    {Math.abs(change)}%
                                </span>
                            </>
                        )}
                        <span className="text-muted-foreground">vs mes anterior</span>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Métricas mensuales */}
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Rendimiento Mensual
                </h3>
                <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard
                        title="Reparaciones Completadas"
                        value={metrics.thisMonth.count}
                        change={metrics.changes.count}
                        icon={Target}
                        colorScheme="blue"
                    />
                    <MetricCard
                        title="Ingresos Generados"
                        value={metrics.thisMonth.revenue}
                        change={metrics.changes.revenue}
                        icon={DollarSign}
                        format="currency"
                        colorScheme="green"
                    />
                    <MetricCard
                        title="Tiempo Promedio"
                        value={metrics.thisMonth.avgTime}
                        change={metrics.changes.avgTime}
                        icon={Clock}
                        format="days"
                        colorScheme="orange"
                    />
                    <MetricCard
                        title="Calificación Promedio"
                        value={metrics.thisMonth.avgRating}
                        change={metrics.changes.avgRating}
                        icon={Award}
                        format="rating"
                        colorScheme="purple"
                    />
                </div>
            </div>

            {/* Análisis por tipo de dispositivo */}
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Análisis por Tipo de Dispositivo
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(metrics.deviceTypes)
                        .sort(([,a], [,b]) => b.count - a.count)
                        .map(([type, data]) => (
                        <Card key={type}>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium capitalize flex items-center justify-between">
                                    {type === 'smartphone' ? 'Smartphones' :
                                     type === 'tablet' ? 'Tablets' :
                                     type === 'laptop' ? 'Laptops' :
                                     type === 'desktop' ? 'Desktops' : 'Accesorios'}
                                    <Badge variant="secondary">{data.count}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Ingresos:</span>
                                    <div className="flex items-center gap-1 font-medium">
                                        <GSIcon className="h-3 w-3" />
                                        {data.revenue.toLocaleString()}
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tiempo promedio:</span>
                                    <span className="font-medium">{data.avgTime} días</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span>Participación</span>
                                        <span>{Math.round((data.count / metrics.total.count) * 100)}%</span>
                                    </div>
                                    <Progress 
                                        value={(data.count / metrics.total.count) * 100} 
                                        className="h-2"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}