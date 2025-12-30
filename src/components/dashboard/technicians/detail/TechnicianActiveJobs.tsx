'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Repair } from '@/types/repairs'
import { Clock, ExternalLink, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface TechnicianActiveJobsProps {
    repairs: Repair[]
}

const statusConfig = {
    recibido: { label: 'Recibido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    diagnostico: { label: 'Diagnóstico', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    reparacion: { label: 'Reparación', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    listo: { label: 'Listo', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    entregado: { label: 'Entregado', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' }
}

const priorityConfig = {
    low: { label: 'Baja', color: 'bg-gray-100 text-gray-700' },
    medium: { label: 'Media', color: 'bg-blue-100 text-blue-700' },
    high: { label: 'Alta', color: 'bg-red-100 text-red-700' }
}

export function TechnicianActiveJobs({ repairs }: TechnicianActiveJobsProps) {
    const router = useRouter()

    if (repairs.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Trabajos Activos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No hay trabajos activos en este momento</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Trabajos Activos ({repairs.length})</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {repairs.map(repair => {
                        const statusInfo = statusConfig[repair.dbStatus as keyof typeof statusConfig]
                        const priorityInfo = priorityConfig[repair.priority]
                        const timeAgo = (() => {
                            try {
                                if (!repair.createdAt) return 'Fecha no disponible'
                                const date = new Date(repair.createdAt)
                                if (isNaN(date.getTime())) return 'Fecha inválida'
                                return formatDistanceToNow(date, {
                                    addSuffix: true,
                                    locale: es
                                })
                            } catch (error) {
                                return 'Fecha no disponible'
                            }
                        })()

                        return (
                            <div
                                key={repair.id}
                                className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-semibold">{repair.customer.name}</h4>
                                            <Badge variant="outline" className={statusInfo.color}>
                                                {statusInfo.label}
                                            </Badge>
                                            <Badge variant="outline" className={priorityInfo.color}>
                                                {priorityInfo.label}
                                            </Badge>
                                            {repair.urgency === 'urgent' && (
                                                <Badge variant="destructive">Urgente</Badge>
                                            )}
                                        </div>

                                        <div className="text-sm text-muted-foreground">
                                            <p className="font-medium text-foreground">
                                                {repair.device} - {repair.brand} {repair.model}
                                            </p>
                                            <p className="line-clamp-1">{repair.issue}</p>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {timeAgo}
                                            </div>
                                            <span>ID: {repair.id.slice(0, 8)}</span>
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => router.push(`/dashboard/repairs?id=${repair.id}`)}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
