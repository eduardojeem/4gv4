'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Repair } from '@/types/repairs'
import { Activity, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { useMemo, memo } from 'react'
import { cn } from '@/lib/utils'

interface RepairStatsProps {
    repairs: Repair[]
}

function StatCard({ title, value, subtitle, icon: Icon, accent }: {
  title: string; value: number; subtitle: string; icon: React.ElementType; accent: string
}) {
  return (
    <Card className={cn('border-l-4 shadow-sm', accent)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</CardTitle>
        <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">{value}</div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export const RepairStats = memo(function RepairStats({ repairs }: RepairStatsProps) {
    const stats = useMemo(() => {
        let total = 0
        let pending = 0
        let inProgress = 0
        let completed = 0
        let urgent = 0

        for (const repair of repairs) {
            total++
            switch (repair.status) {
                case 'recibido':
                    pending++
                    break
                case 'diagnostico':
                case 'reparacion':
                case 'pausado':
                case 'listo':
                    inProgress++
                    break
                case 'entregado':
                    completed++
                    break
            }
            if (repair.urgency === 'urgent' && 
                repair.status !== 'entregado' && 
                repair.status !== 'cancelado') {
                urgent++
            }
        }

        return { total, pending, inProgress, completed, urgent }
    }, [repairs])

    return (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard
                title="Total Reparaciones"
                value={stats.total}
                subtitle={`${stats.completed} completadas`}
                icon={Activity}
                accent="border-l-blue-500"
            />
            <StatCard
                title="Pendientes"
                value={stats.pending}
                subtitle="Por recibir o diagnosticar"
                icon={Clock}
                accent="border-l-amber-500"
            />
            <StatCard
                title="En Progreso"
                value={stats.inProgress}
                subtitle="En reparación o espera"
                icon={Activity}
                accent="border-l-violet-500"
            />
            <StatCard
                title="Urgentes Activas"
                value={stats.urgent}
                subtitle="Atención inmediata"
                icon={AlertCircle}
                accent="border-l-red-500"
            />
        </div>
    )
}, (prevProps, nextProps) => {
    if (prevProps.repairs.length !== nextProps.repairs.length) return false

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
