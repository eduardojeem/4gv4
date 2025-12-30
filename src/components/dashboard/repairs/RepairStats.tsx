'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Repair, RepairStatus } from '@/types/repairs'
import { Activity, CheckCircle, Clock, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { useMemo, memo } from 'react'

interface RepairStatsProps {
    repairs: Repair[]
}

export const RepairStats = memo(function RepairStats({ repairs }: RepairStatsProps) {
    const stats = useMemo(() => {
        // Optimize with single pass through repairs array
        let total = 0
        let pending = 0
        let inProgress = 0
        let completed = 0
        let urgent = 0

        for (const repair of repairs) {
            total++
            
            // Count by status
            switch (repair.status) {
                case 'recibido':
                    pending++
                    break
                case 'diagnostico':
                case 'reparacion':
                case 'pausado':
                    inProgress++
                    break
                case 'entregado':
                    completed++
                    break
            }

            // Count urgent repairs (excluding completed/cancelled)
            if (repair.urgency === 'urgent' && 
                repair.status !== 'entregado' && 
                repair.status !== 'cancelado') {
                urgent++
            }
        }

        return { total, pending, inProgress, completed, urgent }
    }, [repairs])

    const statCards = [
        {
            title: 'Total Reparaciones',
            value: stats.total,
            subtitle: `${stats.completed} completadas`,
            icon: Activity,
            gradient: 'from-violet-500 to-purple-500',
            iconColor: 'text-violet-500',
            bgGradient: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 border border-violet-200 dark:border-violet-700'
        },
        {
            title: 'Pendientes',
            value: stats.pending,
            subtitle: 'Por recibir o diagnosticar',
            icon: Clock,
            gradient: 'from-amber-500 to-orange-500',
            iconColor: 'text-amber-500',
            bgGradient: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-700'
        },
        {
            title: 'En Progreso',
            value: stats.inProgress,
            subtitle: 'En reparación o espera',
            icon: Activity,
            gradient: 'from-blue-500 to-cyan-500',
            iconColor: 'text-blue-500',
            bgGradient: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border border-blue-200 dark:border-blue-700'
        },
        {
            title: 'Urgentes Activas',
            value: stats.urgent,
            subtitle: 'Atención inmediata',
            icon: AlertCircle,
            gradient: 'from-red-500 to-pink-500',
            iconColor: 'text-red-500',
            bgGradient: 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/40 dark:to-pink-950/40 border border-red-200 dark:border-red-700'
        }
    ]

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, index) => {
                const Icon = stat.icon
                return (
                    <Card
                        key={index}
                        className={`${stat.bgGradient} border-0 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 dark:shadow-lg dark:hover:shadow-xl`}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-foreground/80 dark:text-foreground/90">
                                {stat.title}
                            </CardTitle>
                            <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${stat.gradient} p-2 shadow-lg dark:shadow-xl`}>
                                <Icon className="h-full w-full text-white" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold bg-gradient-to-br bg-clip-text text-transparent from-foreground to-foreground/70 dark:from-foreground dark:to-foreground/80">
                                {stat.value}
                            </div>
                            <p className="text-xs text-muted-foreground dark:text-muted-foreground/90 mt-1">
                                {stat.subtitle}
                            </p>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}, (prevProps, nextProps) => {
    // Custom comparison: only re-render if repairs count or status distribution changes
    if (prevProps.repairs.length !== nextProps.repairs.length) return false

    // Check if status distribution changed
    const prevStats = {
        pending: prevProps.repairs.filter(r => r.status === 'recibido').length,
        inProgress: prevProps.repairs.filter(r => r.status === 'diagnostico' || r.status === 'reparacion' || r.status === 'pausado').length,
        completed: prevProps.repairs.filter(r => r.status === 'entregado').length,
        urgent: prevProps.repairs.filter(r => r.urgency === 'urgent' && r.status !== 'entregado' && r.status !== 'cancelado').length
    }

    const nextStats = {
        pending: nextProps.repairs.filter(r => r.status === 'recibido').length,
        inProgress: nextProps.repairs.filter(r => r.status === 'diagnostico' || r.status === 'reparacion' || r.status === 'pausado').length,
        completed: nextProps.repairs.filter(r => r.status === 'entregado').length,
        urgent: nextProps.repairs.filter(r => r.urgency === 'urgent' && r.status !== 'entregado' && r.status !== 'cancelado').length
    }

    return (
        prevStats.pending === nextStats.pending &&
        prevStats.inProgress === nextStats.inProgress &&
        prevStats.completed === nextStats.completed &&
        prevStats.urgent === nextStats.urgent
    )
})
