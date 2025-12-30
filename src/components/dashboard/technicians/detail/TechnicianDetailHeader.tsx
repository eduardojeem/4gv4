'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WorkStatusBadge } from '../WorkStatusBadge'
import { ArrowLeft, Edit, UserPlus, Star, Clock, CheckCircle2, Wrench } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface TechnicianDetailHeaderProps {
    id: string
    name: string
    avatar?: string
    specialty?: string
    status: 'available' | 'busy' | 'offline' | 'unavailable'
    totalJobs: number
    activeJobs: number
    completedJobs: number
    rating?: number
    avgCompletionTime?: string
    onAssignRepair?: () => void
}

export function TechnicianDetailHeader({
    id,
    name,
    avatar,
    specialty,
    status,
    totalJobs,
    activeJobs,
    completedJobs,
    rating,
    avgCompletionTime,
    onAssignRepair
}: TechnicianDetailHeaderProps) {
    const router = useRouter()

    return (
        <div className="space-y-4">
            {/* Back Button */}
            <Button
                variant="ghost"
                onClick={() => router.push('/dashboard/repairs/technicians')}
                className="gap-2"
            >
                <ArrowLeft className="h-4 w-4" />
                Volver a técnicos
            </Button>

            {/* Header Card */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Avatar and Basic Info */}
                        <div className="flex items-center gap-4">
                            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-3xl relative">
                                {avatar ? (
                                    <img src={avatar} alt={name} className="h-24 w-24 rounded-full object-cover" />
                                ) : (
                                    name.charAt(0).toUpperCase()
                                )}
                                <div className={`absolute -bottom-2 -right-2 h-6 w-6 rounded-full border-4 border-white dark:border-gray-900 ${status === 'available' ? 'bg-green-500' :
                                        status === 'busy' ? 'bg-orange-500' :
                                            status === 'offline' ? 'bg-gray-400' :
                                                'bg-red-500'
                                    }`} />
                            </div>

                            <div className="flex-1">
                                <h1 className="text-3xl font-bold">{name}</h1>
                                {specialty && (
                                    <p className="text-lg text-muted-foreground">{specialty}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                    <WorkStatusBadge status={status} />
                                    {rating !== undefined && (
                                        <Badge variant="outline" className="gap-1">
                                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                            {rating.toFixed(1)}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-1">
                                    <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-xs text-muted-foreground">Total</span>
                                </div>
                                <p className="text-2xl font-bold">{totalJobs}</p>
                            </div>

                            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                    <span className="text-xs text-muted-foreground">Activos</span>
                                </div>
                                <p className="text-2xl font-bold">{activeJobs}</p>
                            </div>

                            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-2 mb-1">
                                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    <span className="text-xs text-muted-foreground">Completados</span>
                                </div>
                                <p className="text-2xl font-bold">{completedJobs}</p>
                            </div>

                            {avgCompletionTime && (
                                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                        <span className="text-xs text-muted-foreground">Promedio</span>
                                    </div>
                                    <p className="text-lg font-bold">{avgCompletionTime}</p>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex md:flex-col gap-2">
                            <Button variant="outline" className="gap-2">
                                <Edit className="h-4 w-4" />
                                Editar
                            </Button>
                            <Button onClick={onAssignRepair} className="gap-2">
                                <UserPlus className="h-4 w-4" />
                                Asignar Trabajo
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
