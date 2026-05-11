'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Repair } from '@/types/repairs'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { resolveRepairStatus } from '@/lib/constants/repair-status'

interface TechnicianWorkHistoryProps {
    repairs: Repair[]
}

const INITIAL_VISIBLE_ROWS = 25

const statusConfig = {
    listo: { label: 'Listo', color: 'bg-green-100 text-green-700' },
    entregado: { label: 'Entregado', color: 'bg-gray-100 text-gray-700' }
}

export function TechnicianWorkHistory({ repairs }: TechnicianWorkHistoryProps) {
    const router = useRouter()
    const [visibleRows, setVisibleRows] = useState(INITIAL_VISIBLE_ROWS)

    const sortedRepairs = useMemo(() => {
        return [...repairs].sort((a, b) => {
            const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0
            const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0
            return dateB - dateA
        })
    }, [repairs])

    const visibleRepairs = useMemo(() => {
        return sortedRepairs.slice(0, visibleRows)
    }, [sortedRepairs, visibleRows])

    if (repairs.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Historial de Trabajos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No hay trabajos completados aun</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Historial de Trabajos ({repairs.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                    Mostrando {visibleRepairs.length} de {sortedRepairs.length} trabajos
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Dispositivo</TableHead>
                                <TableHead>Problema</TableHead>
                                <TableHead>Fecha Inicio</TableHead>
                                <TableHead>Fecha Fin</TableHead>
                                <TableHead>Duracion</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleRepairs.map(repair => {
                                const startDate = new Date(repair.createdAt)
                                const endDate = repair.completedAt ? new Date(repair.completedAt) : null
                                const duration = endDate
                                    ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                                    : null
                                const resolvedStatus = resolveRepairStatus(repair)
                                const statusInfo = statusConfig[resolvedStatus as keyof typeof statusConfig]

                                return (
                                    <TableRow key={repair.id}>
                                        <TableCell className="font-mono text-xs">
                                            {repair.id.slice(0, 8)}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {repair.customer.name}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {repair.device}
                                                <div className="text-xs text-muted-foreground">
                                                    {repair.brand} {repair.model}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">
                                            {repair.issue}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {format(startDate, 'dd/MM/yyyy', { locale: es })}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {endDate ? format(endDate, 'dd/MM/yyyy', { locale: es }) : '-'}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {duration !== null ? `${duration}d` : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {statusInfo && (
                                                <Badge variant="outline" className={statusInfo.color}>
                                                    {statusInfo.label}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => router.push(`/dashboard/repairs?id=${repair.id}&edit=true`)}
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                {visibleRows < sortedRepairs.length && (
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            onClick={() => setVisibleRows(current => current + INITIAL_VISIBLE_ROWS)}
                        >
                            Mostrar mas
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
