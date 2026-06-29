'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { WorkStatusBadge } from './WorkStatusBadge'
import { User, Wrench, CheckCircle2, ArrowRight, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { TechnicianLoadState } from '@/hooks/use-technician-stats'

interface TechnicianCardProps {
    id: string
    name: string
    avatar?: string
    specialty?: string
    loadState: TechnicianLoadState
    activeJobs: number
    completedThisMonth: number
    totalCompleted: number
    rating?: number
    workloadPercentage: number
}

export const TechnicianCard = memo(function TechnicianCard({
    id,
    name,
    avatar,
    specialty,
    loadState,
    activeJobs,
    completedThisMonth,
    totalCompleted,
    rating,
    workloadPercentage
}: TechnicianCardProps) {
    const router = useRouter()

    const dotColor =
        loadState === 'no_load'
            ? 'bg-emerald-500 shadow-emerald-500/50'
            : loadState === 'light_load'
                ? 'bg-blue-500 shadow-blue-500/50'
                : loadState === 'medium_load'
                    ? 'bg-amber-500 shadow-amber-500/50'
                    : 'bg-red-500 shadow-red-500/50'

    const handleViewDetails = () => {
        router.push(`/dashboard/repairs/technicians/${id}`)
    }

    return (
        <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 border-border/50 bg-background/50 backdrop-blur-md">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
            <CardHeader className="pb-3 relative z-10">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg relative shadow-lg shadow-indigo-500/20 transform transition-transform duration-300 group-hover:scale-105">
                            {avatar ? (
                                <img src={avatar} alt={name} className="h-14 w-14 rounded-2xl object-cover" />
                            ) : (
                                <User className="h-7 w-7" />
                            )}
                            <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background shadow-sm ${dotColor}`} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-none tracking-tight mb-1 group-hover:text-primary transition-colors">{name}</h3>
                            {specialty ? (
                                <p className="text-sm text-muted-foreground font-medium">{specialty}</p>
                            ) : (
                                <p className="text-sm text-muted-foreground font-medium">Técnico general</p>
                            )}
                        </div>
                    </div>
                    <WorkStatusBadge status={loadState} variant="sm" />
                </div>
            </CardHeader>

            <CardContent className="space-y-5 relative z-10">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-gradient-to-br from-muted/50 to-muted/10 border border-border/50 transition-colors duration-300 group-hover:border-primary/20">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <Wrench className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Activos</p>
                        </div>
                        <p className="text-2xl font-bold tracking-tight">{activeJobs}</p>
                    </div>

                    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-gradient-to-br from-muted/50 to-muted/10 border border-border/50 transition-colors duration-300 group-hover:border-primary/20">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Este mes</p>
                        </div>
                        <p className="text-2xl font-bold tracking-tight">{completedThisMonth}</p>
                    </div>
                </div>

                {/* Rating and Total */}
                <div className="flex items-center justify-between text-sm px-1">
                    <div className="flex items-center gap-1.5">
                        {rating !== undefined && (
                            <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                                <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                                <span className="font-semibold text-yellow-600 dark:text-yellow-500">{rating.toFixed(1)}</span>
                            </div>
                        )}
                    </div>
                    <div className="text-muted-foreground text-xs font-medium">
                        <span className="font-bold text-foreground text-sm">{totalCompleted}</span> históricos
                    </div>
                </div>

                {/* Workload Progress */}
                <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/30">
                    <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Carga de trabajo</span>
                        <span className="font-bold">{workloadPercentage}%</span>
                    </div>
                    <Progress value={workloadPercentage} className="h-1.5 bg-muted-foreground/10" indicatorClassName={workloadPercentage > 80 ? 'bg-red-500' : workloadPercentage > 50 ? 'bg-amber-500' : 'bg-primary'} />
                </div>

                {/* Action Button */}
                <Button
                    onClick={handleViewDetails}
                    variant="outline"
                    className="w-full bg-background/50 backdrop-blur-sm border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-sm"
                >
                    Ver perfil completo
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
            </CardContent>
        </Card>
    )
})

