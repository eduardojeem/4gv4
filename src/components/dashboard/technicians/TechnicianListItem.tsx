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
        ? `${avgCompletionDays.toFixed(1)} días`
        : 'S/D'

    return (
        <div className="group grid gap-4 px-5 py-4 transition-all duration-300 hover:bg-muted/40 hover:shadow-md border border-transparent hover:border-border/50 rounded-2xl md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(220px,1.2fr)_auto] md:items-center relative overflow-hidden bg-background/50 backdrop-blur-sm mx-2 my-1">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
            <div className="flex items-start gap-4 relative z-10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 transform transition-transform duration-300 group-hover:scale-105">
                    <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-2">
                    <div className="space-y-1">
                        <p className="truncate text-base font-bold group-hover:text-primary transition-colors">{name}</p>
                        <p className="truncate text-sm font-medium text-muted-foreground">
                            {specialty || 'Técnico general'}
                        </p>
                    </div>
                    <WorkStatusBadge status={loadState} variant="sm" />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-3 relative z-10 group-hover:border-primary/20 transition-colors duration-300">
                <div className="space-y-1 text-center">
                    <div className="flex justify-center items-center gap-1.5 text-muted-foreground mb-1">
                        <Wrench className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-[10px] uppercase tracking-wider font-bold">Activos</span>
                    </div>
                    <p className="text-xl font-bold tracking-tight">{activeJobs}</p>
                </div>
                <div className="space-y-1 text-center border-x border-border/50 px-2">
                    <div className="flex justify-center items-center gap-1.5 text-muted-foreground mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-[10px] uppercase tracking-wider font-bold">Mes</span>
                    </div>
                    <p className="text-xl font-bold tracking-tight">{completedThisMonth}</p>
                </div>
                <div className="space-y-1 text-center">
                    <div className="flex justify-center items-center gap-1.5 text-muted-foreground mb-1">
                        <Clock3 className="h-3.5 w-3.5 text-cyan-500" />
                        <span className="text-[10px] uppercase tracking-wider font-bold">Promedio</span>
                    </div>
                    <p className="text-sm font-bold tracking-tight mt-2">{avgCompletionLabel}</p>
                </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-dashed border-border/60 bg-muted/10 p-3 relative z-10 group-hover:border-primary/30 transition-colors duration-300">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Carga de trabajo</span>
                    <span className="font-bold">{workloadPercentage}%</span>
                </div>
                <Progress value={workloadPercentage} className="h-2 bg-muted-foreground/10" indicatorClassName={workloadPercentage > 80 ? 'bg-red-500' : workloadPercentage > 50 ? 'bg-amber-500' : 'bg-primary'} />
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Histórico cerrado</span>
                    <span className="font-bold text-foreground">{totalCompleted} <span className="font-normal text-muted-foreground">trabajos</span></span>
                </div>
            </div>

            <div className="flex md:justify-end relative z-10">
                <Button
                    onClick={handleViewDetails}
                    variant="outline"
                    className="w-full md:w-auto bg-background/50 backdrop-blur-sm border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-sm"
                >
                    Ver perfil
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
            </div>
        </div>
    )
})
