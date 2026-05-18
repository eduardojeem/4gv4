'use client'

import { memo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Clock3, User, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { WorkStatusBadge } from './WorkStatusBadge'
import type { TechnicianLoadState } from '@/hooks/use-technician-stats'

interface TechnicianListItemProps {
    id: string
    name: string
    specialty?: string
    loadState: TechnicianLoadState
    activeJobs: number
    completedThisMonth: number
    totalCompleted: number
    avgCompletionDays: number
    workloadPercentage: number
}

export const TechnicianListItem = memo(function TechnicianListItem({
    id,
    name,
    specialty,
    loadState,
    activeJobs,
    completedThisMonth,
    totalCompleted,
    avgCompletionDays,
    workloadPercentage
}: TechnicianListItemProps) {
    const router = useRouter()

    const handleViewDetails = () => {
        router.push(`/dashboard/repairs/technicians/${id}`)
    }

    const avgCompletionLabel = avgCompletionDays > 0
        ? `${avgCompletionDays.toFixed(1)} dias`
        : 'Sin datos'

    return (
        <div className="grid gap-4 px-4 py-4 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(220px,1.2fr)_auto] md:items-center">
            <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm">
                    <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-2">
                    <div className="space-y-1">
                        <p className="truncate text-base font-semibold">{name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                            {specialty || 'Tecnico general'}
                        </p>
                    </div>
                    <WorkStatusBadge status={loadState} variant="sm" />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-2xl border bg-muted/20 p-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Wrench className="h-3.5 w-3.5" />
                        <span className="text-xs uppercase tracking-wide">Activos</span>
                    </div>
                    <p className="text-lg font-semibold">{activeJobs}</p>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs uppercase tracking-wide">Mes</span>
                    </div>
                    <p className="text-lg font-semibold">{completedThisMonth}</p>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        <span className="text-xs uppercase tracking-wide">Promedio</span>
                    </div>
                    <p className="text-sm font-semibold">{avgCompletionLabel}</p>
                </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-dashed bg-background/70 p-3">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Carga de trabajo</span>
                    <span className="font-semibold">{workloadPercentage}%</span>
                </div>
                <Progress value={workloadPercentage} className="h-2.5" />
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Historico cerrado</span>
                    <span className="font-medium">{totalCompleted} trabajos</span>
                </div>
            </div>

            <div className="flex md:justify-end">
                <Button
                    onClick={handleViewDetails}
                    variant="outline"
                    className="w-full md:w-auto"
                >
                    Ver detalles
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    )
})
