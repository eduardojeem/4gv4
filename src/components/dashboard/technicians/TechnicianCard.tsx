'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { WorkStatusBadge } from './WorkStatusBadge'
import { User, Wrench, CheckCircle2, Clock, ArrowRight, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface TechnicianCardProps {
    id: string
    name: string
    avatar?: string
    specialty?: string
    status: 'available' | 'busy' | 'offline' | 'unavailable'
    activeJobs: number
    completedThisMonth: number
    totalCompleted: number
    rating?: number
    workloadPercentage: number
}

export function TechnicianCard({
    id,
    name,
    avatar,
    specialty,
    status,
    activeJobs,
    completedThisMonth,
    totalCompleted,
    rating,
    workloadPercentage
}: TechnicianCardProps) {
    const router = useRouter()

    const handleViewDetails = () => {
        router.push(`/dashboard/repairs/technicians/${id}`)
    }

    return (
        <Card className="hover:shadow-lg transition-all duration-200 group">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-lg relative">
                            {avatar ? (
                                <img src={avatar} alt={name} className="h-12 w-12 rounded-full object-cover" />
                            ) : (
                                <User className="h-6 w-6" />
                            )}
                            <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900 ${status === 'available' ? 'bg-green-500' :
                                    status === 'busy' ? 'bg-orange-500' :
                                        status === 'offline' ? 'bg-gray-400' :
                                            'bg-red-500'
                                }`} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-base">{name}</h3>
                            {specialty && (
                                <p className="text-sm text-muted-foreground">{specialty}</p>
                            )}
                        </div>
                    </div>
                    <WorkStatusBadge status={status} variant="sm" />
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <div className="h-8 w-8 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Activos</p>
                            <p className="text-lg font-bold">{activeJobs}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <div className="h-8 w-8 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Este mes</p>
                            <p className="text-lg font-bold">{completedThisMonth}</p>
                        </div>
                    </div>
                </div>

                {/* Rating and Total */}
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                        {rating !== undefined && (
                            <>
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="font-medium">{rating.toFixed(1)}</span>
                            </>
                        )}
                    </div>
                    <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">{totalCompleted}</span> totales
                    </div>
                </div>

                {/* Workload Progress */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Carga de trabajo</span>
                        <span className="font-medium">{workloadPercentage}%</span>
                    </div>
                    <Progress value={workloadPercentage} className="h-2" />
                </div>

                {/* Action Button */}
                <Button
                    onClick={handleViewDetails}
                    variant="outline"
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                >
                    Ver detalles
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardContent>
        </Card>
    )
}
