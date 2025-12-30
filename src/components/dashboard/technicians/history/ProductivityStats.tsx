'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    Trophy,
    Target,
    Clock,
    Star,
    TrendingUp,
    Calendar,
    Zap,
    Award,
    CheckCircle2
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Repair } from '@/types/repairs'
import { format, differenceInDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'

interface ProductivityStatsProps {
    repairs: Repair[]
}

export function ProductivityStats({ repairs }: ProductivityStatsProps) {
    const stats = useMemo(() => {
        const now = new Date()
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Lunes
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 }) // Domingo
        
        const completedRepairs = repairs.filter(r => r.dbStatus === 'entregado')
        
        // Reparaciones de esta semana
        const thisWeekRepairs = completedRepairs.filter(r => {
            const repairDate = new Date(r.completedAt || r.createdAt)
            return isWithinInterval(repairDate, { start: weekStart, end: weekEnd })
        })

        // Calcular métricas de productividad
        const totalRevenue = completedRepairs.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost), 0)
        const avgRevenue = completedRepairs.length > 0 ? totalRevenue / completedRepairs.length : 0
        
        // Tiempo promedio de reparación
        const repairTimes = completedRepairs
            .filter(r => r.completedAt && r.createdAt)
            .map(r => differenceInDays(new Date(r.completedAt!), new Date(r.createdAt)))
        
        const avgRepairTime = repairTimes.length > 0 
            ? repairTimes.reduce((sum, time) => sum + time, 0) / repairTimes.length 
            : 0

        // Reparaciones rápidas (menos de 3 días)
        const fastRepairs = repairTimes.filter(time => time <= 3).length
        const fastRepairRate = repairTimes.length > 0 ? (fastRepairs / repairTimes.length) * 100 : 0

        // Calificaciones del cliente
        const ratedRepairs = completedRepairs.filter(r => r.customerRating && r.customerRating > 0)
        const avgRating = ratedRepairs.length > 0 
            ? ratedRepairs.reduce((sum, r) => sum + (r.customerRating || 0), 0) / ratedRepairs.length 
            : 0
        
        const excellentRatings = ratedRepairs.filter(r => (r.customerRating || 0) >= 4.5).length
        const excellentRatingRate = ratedRepairs.length > 0 ? (excellentRatings / ratedRepairs.length) * 100 : 0

        // Análisis por prioridad
        const priorityStats = {
            high: completedRepairs.filter(r => r.priority === 'high').length,
            medium: completedRepairs.filter(r => r.priority === 'medium').length,
            low: completedRepairs.filter(r => r.priority === 'low').length
        }

        // Reparaciones urgentes completadas
        const urgentRepairs = completedRepairs.filter(r => r.urgency === 'urgent').length
        
        // Eficiencia semanal
        const weeklyEfficiency = thisWeekRepairs.length

        // Logros y badges
        const achievements = []
        
        if (completedRepairs.length >= 50) achievements.push({ name: 'Experto', icon: Trophy, color: 'gold' })
        if (completedRepairs.length >= 100) achievements.push({ name: 'Maestro', icon: Award, color: 'purple' })
        if (fastRepairRate >= 70) achievements.push({ name: 'Velocista', icon: Zap, color: 'blue' })
        if (avgRating >= 4.5) achievements.push({ name: 'Excelencia', icon: Star, color: 'yellow' })
        if (urgentRepairs >= 10) achievements.push({ name: 'Rescatista', icon: Target, color: 'red' })

        return {
            total: completedRepairs.length,
            thisWeek: thisWeekRepairs.length,
            totalRevenue,
            avgRevenue,
            avgRepairTime: Math.round(avgRepairTime * 10) / 10,
            fastRepairRate: Math.round(fastRepairRate),
            avgRating: Math.round(avgRating * 10) / 10,
            excellentRatingRate: Math.round(excellentRatingRate),
            priorityStats,
            urgentRepairs,
            weeklyEfficiency,
            achievements
        }
    }, [repairs])

    const StatCard = ({ 
        title, 
        value, 
        subtitle, 
        icon: Icon, 
        progress, 
        color = 'blue',
        format = 'number' 
    }: {
        title: string
        value: number | string
        subtitle: string
        icon: any
        progress?: number
        color?: 'blue' | 'green' | 'orange' | 'purple' | 'red'
        format?: 'number' | 'currency' | 'percentage' | 'rating'
    }) => {
        const formatValue = (val: number | string) => {
            if (typeof val === 'string') return val
            
            switch (format) {
                case 'currency':
                    return (
                        <div className="flex items-center gap-1">
                            <GSIcon className="h-5 w-5" />
                            {val.toLocaleString()}
                        </div>
                    )
                case 'percentage':
                    return `${val}%`
                case 'rating':
                    return (
                        <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {val}
                        </div>
                    )
                default:
                    return val.toString()
            }
        }

        const colors = {
            blue: 'from-blue-50 to-indigo-50 border-blue-100 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-900 text-blue-700 dark:text-blue-300',
            green: 'from-green-50 to-emerald-50 border-green-100 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-900 text-green-700 dark:text-green-300',
            orange: 'from-orange-50 to-amber-50 border-orange-100 dark:from-orange-950/20 dark:to-amber-950/20 dark:border-orange-900 text-orange-700 dark:text-orange-300',
            purple: 'from-purple-50 to-violet-50 border-purple-100 dark:from-purple-950/20 dark:to-violet-950/20 dark:border-purple-900 text-purple-700 dark:text-purple-300',
            red: 'from-red-50 to-rose-50 border-red-100 dark:from-red-950/20 dark:to-rose-950/20 dark:border-red-900 text-red-700 dark:text-red-300'
        }

        return (
            <Card className={`bg-gradient-to-br ${colors[color]}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    <Icon className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold mb-1">
                        {formatValue(value)}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>
                    {progress !== undefined && (
                        <Progress value={progress} className="h-2" />
                    )}
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Estadísticas de Productividad
                </h3>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Eficiencia Semanal"
                        value={stats.thisWeek}
                        subtitle="Reparaciones esta semana"
                        icon={Calendar}
                        color="blue"
                    />
                    
                    <StatCard
                        title="Reparaciones Rápidas"
                        value={stats.fastRepairRate}
                        subtitle="Completadas en ≤3 días"
                        icon={Zap}
                        progress={stats.fastRepairRate}
                        format="percentage"
                        color="green"
                    />
                    
                    <StatCard
                        title="Tiempo Promedio"
                        value={`${stats.avgRepairTime} días`}
                        subtitle="Por reparación"
                        icon={Clock}
                        color="orange"
                    />
                    
                    <StatCard
                        title="Satisfacción Cliente"
                        value={stats.avgRating}
                        subtitle={`${stats.excellentRatingRate}% excelentes`}
                        icon={Star}
                        progress={stats.excellentRatingRate}
                        format="rating"
                        color="purple"
                    />
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Análisis por prioridad */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Distribución por Prioridad
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                    <span className="text-sm font-medium">Alta Prioridad</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold">{stats.priorityStats.high}</span>
                                    <Badge variant="destructive" className="text-xs">
                                        {Math.round((stats.priorityStats.high / stats.total) * 100)}%
                                    </Badge>
                                </div>
                            </div>
                            <Progress 
                                value={(stats.priorityStats.high / stats.total) * 100} 
                                className="h-2"
                            />
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                    <span className="text-sm font-medium">Media Prioridad</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold">{stats.priorityStats.medium}</span>
                                    <Badge variant="outline" className="text-xs">
                                        {Math.round((stats.priorityStats.medium / stats.total) * 100)}%
                                    </Badge>
                                </div>
                            </div>
                            <Progress 
                                value={(stats.priorityStats.medium / stats.total) * 100} 
                                className="h-2"
                            />
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span className="text-sm font-medium">Baja Prioridad</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold">{stats.priorityStats.low}</span>
                                    <Badge variant="secondary" className="text-xs">
                                        {Math.round((stats.priorityStats.low / stats.total) * 100)}%
                                    </Badge>
                                </div>
                            </div>
                            <Progress 
                                value={(stats.priorityStats.low / stats.total) * 100} 
                                className="h-2"
                            />
                        </div>

                        <div className="pt-3 border-t">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-red-600">Reparaciones Urgentes:</span>
                                <Badge variant="destructive">{stats.urgentRepairs}</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Logros y badges */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Trophy className="h-4 w-4" />
                            Logros Desbloqueados
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.achievements.length > 0 ? (
                            <div className="grid gap-3">
                                {stats.achievements.map((achievement, index) => {
                                    const Icon = achievement.icon
                                    return (
                                        <div 
                                            key={index}
                                            className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                                        >
                                            <div className={`p-2 rounded-full bg-${achievement.color}-100 dark:bg-${achievement.color}-900/20`}>
                                                <Icon className={`h-4 w-4 text-${achievement.color}-600 dark:text-${achievement.color}-400`} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{achievement.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {achievement.name === 'Experto' && 'Completaste 50+ reparaciones'}
                                                    {achievement.name === 'Maestro' && 'Completaste 100+ reparaciones'}
                                                    {achievement.name === 'Velocista' && 'Más del 70% de reparaciones rápidas'}
                                                    {achievement.name === 'Excelencia' && 'Calificación promedio ≥4.5'}
                                                    {achievement.name === 'Rescatista' && 'Completaste 10+ reparaciones urgentes'}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">
                                    Completa más reparaciones para desbloquear logros
                                </p>
                            </div>
                        )}
                        
                        <div className="mt-6 pt-4 border-t">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <div className="text-2xl font-bold text-green-600">
                                        {stats.total}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Total Completadas</p>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-1">
                                        <GSIcon className="h-5 w-5" />
                                        {Math.round(stats.avgRevenue).toLocaleString()}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Promedio por Reparación</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}