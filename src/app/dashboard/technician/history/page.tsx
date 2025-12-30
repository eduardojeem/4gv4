'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    CheckCircle2,
    Package,
    XCircle,
    Search,
    Calendar,
    User,
    Smartphone,
    Clock,
    TrendingUp,
    Award,
    DollarSign,
    Filter,
    Download,
    Eye,
    Star,
    Timer,
    Wrench
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { TechnicianPerformanceMetrics } from '@/components/dashboard/technicians/history/TechnicianPerformanceMetrics'
import { WorkHistoryChart } from '@/components/dashboard/technicians/history/WorkHistoryChart'
import { ProductivityStats } from '@/components/dashboard/technicians/history/ProductivityStats'
import { ExportButton } from '@/components/dashboard/technicians/history/ExportButton'
import { Repair } from '@/types/repairs'
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'

export default function TechnicianHistoryPage() {
    const { repairs, isLoading } = useRepairs()
    const { user } = useAuth()
    const [searchTerm, setSearchTerm] = useState('')
    const [dateFilter, setDateFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [sortBy, setSortBy] = useState('date')

    // Filter repairs for current technician
    const myRepairs = useMemo(() => {
        if (!user?.id) return []
        return repairs.filter(r => r.technician?.id === user.id)
    }, [repairs, user?.id])

    // Apply filters and sorting
    const filteredAndSortedRepairs = useMemo(() => {
        let filtered = [...myRepairs]

        // Date filter
        if (dateFilter !== 'all') {
            const now = new Date()
            let dateRange: { start: Date; end: Date }

            switch (dateFilter) {
                case 'thisMonth':
                    dateRange = { start: startOfMonth(now), end: endOfMonth(now) }
                    break
                case 'lastMonth':
                    const lastMonth = subMonths(now, 1)
                    dateRange = { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
                    break
                case 'last3Months':
                    dateRange = { start: subMonths(now, 3), end: now }
                    break
                default:
                    dateRange = { start: new Date(0), end: now }
            }

            filtered = filtered.filter(repair => {
                const repairDate = new Date(repair.completedAt || repair.createdAt)
                return isWithinInterval(repairDate, dateRange)
            })
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(repair => repair.dbStatus === statusFilter)
        }

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(r =>
                r.customer.name.toLowerCase().includes(term) ||
                r.device.toLowerCase().includes(term) ||
                r.id.toLowerCase().includes(term) ||
                r.issue.toLowerCase().includes(term) ||
                r.brand.toLowerCase().includes(term) ||
                r.model.toLowerCase().includes(term)
            )
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'date':
                    return new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
                case 'cost':
                    return (b.finalCost || b.estimatedCost) - (a.finalCost || a.estimatedCost)
                case 'customer':
                    return a.customer.name.localeCompare(b.customer.name)
                case 'device':
                    return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)
                default:
                    return 0
            }
        })

        return filtered
    }, [myRepairs, dateFilter, statusFilter, searchTerm, sortBy])

    // Categorize repairs
    const categorizedRepairs = useMemo(() => {
        const completed = myRepairs.filter(r => r.dbStatus === 'listo')
        const delivered = myRepairs.filter(r => r.dbStatus === 'entregado')
        const cancelled = myRepairs.filter(r => r.dbStatus === 'cancelado')
        const inProgress = myRepairs.filter(r => 
            ['recibido', 'diagnostico', 'reparacion', 'pausado'].includes(r.dbStatus || '')
        )

        return { completed, delivered, cancelled, inProgress }
    }, [myRepairs])

    // Performance metrics
    const performanceMetrics = useMemo(() => {
        const completedRepairs = myRepairs.filter(r => r.dbStatus === 'entregado')
        const totalRevenue = completedRepairs.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost), 0)
        const avgRepairTime = completedRepairs.length > 0 
            ? completedRepairs.reduce((sum, r) => {
                if (r.completedAt && r.createdAt) {
                    const days = Math.ceil((new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                    return sum + days
                }
                return sum
            }, 0) / completedRepairs.length
            : 0
        
        const avgRating = completedRepairs.length > 0
            ? completedRepairs.reduce((sum, r) => sum + (r.customerRating || 0), 0) / completedRepairs.length
            : 0

        return {
            totalCompleted: completedRepairs.length,
            totalRevenue,
            avgRepairTime: Math.round(avgRepairTime),
            avgRating: Math.round(avgRating * 10) / 10
        }
    }, [myRepairs])

    const RepairTable = ({ repairs, emptyMessage }: { repairs: Repair[], emptyMessage: string }) => {
        if (repairs.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 bg-slate-100 rounded-full mb-4 dark:bg-slate-800">
                        <Package className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-muted-foreground">{emptyMessage}</p>
                </div>
            )
        }

        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Dispositivo</TableHead>
                            <TableHead>Problema</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Duración</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Costo</TableHead>
                            <TableHead className="text-center">Calificación</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {repairs.map((repair) => {
                            const repairDuration = repair.completedAt && repair.createdAt 
                                ? Math.ceil((new Date(repair.completedAt).getTime() - new Date(repair.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                                : null

                            return (
                                <TableRow key={repair.id} className="cursor-pointer hover:bg-muted/50">
                                    <TableCell className="font-mono text-xs">
                                        {repair.id.slice(0, 8)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{repair.customer.name}</p>
                                                <p className="text-xs text-muted-foreground">{repair.customer.phone}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{repair.brand} {repair.model}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{repair.deviceType}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-xs">
                                            <p className="truncate text-sm">{repair.issue}</p>
                                            <div className="flex gap-1 mt-1">
                                                <Badge variant="outline" className="text-xs">
                                                    {repair.priority === 'high' ? 'Alta' : repair.priority === 'medium' ? 'Media' : 'Baja'}
                                                </Badge>
                                                {repair.urgency === 'urgent' && (
                                                    <Badge variant="destructive" className="text-xs">Urgente</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge 
                                            variant={
                                                repair.dbStatus === 'entregado' ? 'default' :
                                                repair.dbStatus === 'listo' ? 'secondary' :
                                                repair.dbStatus === 'cancelado' ? 'destructive' : 'outline'
                                            }
                                            className="text-xs"
                                        >
                                            {repair.dbStatus === 'entregado' ? 'Entregado' :
                                             repair.dbStatus === 'listo' ? 'Listo' :
                                             repair.dbStatus === 'cancelado' ? 'Cancelado' :
                                             repair.dbStatus === 'reparacion' ? 'En Reparación' :
                                             repair.dbStatus === 'diagnostico' ? 'Diagnóstico' :
                                             'Recibido'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {repairDuration && (
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Timer className="h-4 w-4" />
                                                {repairDuration} días
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Calendar className="h-4 w-4" />
                                            {format(new Date(repair.completedAt || repair.createdAt), 'dd MMM yyyy', { locale: es })}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1 font-medium">
                                            <GSIcon className="h-4 w-4" />
                                            {(repair.finalCost || repair.estimatedCost).toLocaleString()}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {repair.customerRating ? (
                                            <div className="flex items-center justify-center gap-1">
                                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                <span className="text-sm font-medium">{repair.customerRating}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Sin calificar</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        )
    }

    if (isLoading) return <div className="p-8 text-center">Cargando historial...</div>

    return (
        <div className="space-y-6 p-6 max-w-[1800px] mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Historial de Trabajo</h1>
                    <p className="text-muted-foreground">Registro completo de tu desempeño y reparaciones realizadas</p>
                </div>
                <div className="flex gap-2">
                    <ExportButton 
                        repairs={filteredAndSortedRepairs} 
                        disabled={isLoading}
                    />
                </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Total Completadas
                        </CardTitle>
                        <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {performanceMetrics.totalCompleted}
                        </div>
                        <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                            Reparaciones entregadas
                        </p>
                    </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                            Ingresos Generados
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900 dark:text-green-100 flex items-center gap-1">
                            <GSIcon className="h-5 w-5" />
                            {performanceMetrics.totalRevenue.toLocaleString()}
                        </div>
                        <p className="text-xs text-green-600/80 dark:text-green-400/80">
                            Total facturado
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100 dark:from-orange-950/20 dark:to-amber-950/20 dark:border-orange-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
                            Tiempo Promedio
                        </CardTitle>
                        <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                            {performanceMetrics.avgRepairTime}
                        </div>
                        <p className="text-xs text-orange-600/80 dark:text-orange-400/80">
                            Días por reparación
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-100 dark:from-purple-950/20 dark:to-violet-950/20 dark:border-purple-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
                            Calificación Promedio
                        </CardTitle>
                        <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 flex items-center gap-1">
                            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            {performanceMetrics.avgRating || 'N/A'}
                        </div>
                        <p className="text-xs text-purple-600/80 dark:text-purple-400/80">
                            Satisfacción del cliente
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Status Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                            Entregadas
                        </CardTitle>
                        <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                            {categorizedRepairs.delivered.length}
                        </div>
                        <p className="text-xs text-green-600/80 dark:text-green-400/80">
                            Completadas y entregadas
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Listas
                        </CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {categorizedRepairs.completed.length}
                        </div>
                        <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                            Esperando entrega
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-100 dark:from-yellow-950/20 dark:to-orange-950/20 dark:border-yellow-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                            En Progreso
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                            {categorizedRepairs.inProgress.length}
                        </div>
                        <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">
                            Trabajos activos
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-100 dark:from-red-950/20 dark:to-rose-950/20 dark:border-red-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
                            Canceladas
                        </CardTitle>
                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                            {categorizedRepairs.cancelled.length}
                        </div>
                        <p className="text-xs text-red-600/80 dark:text-red-400/80">
                            Sin completar
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters and Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por cliente, dispositivo, ID, problema, marca..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={dateFilter} onValueChange={setDateFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filtrar por fecha" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las fechas</SelectItem>
                                    <SelectItem value="thisMonth">Este mes</SelectItem>
                                    <SelectItem value="lastMonth">Mes pasado</SelectItem>
                                    <SelectItem value="last3Months">Últimos 3 meses</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="entregado">Entregadas</SelectItem>
                                    <SelectItem value="listo">Listas</SelectItem>
                                    <SelectItem value="reparacion">En Reparación</SelectItem>
                                    <SelectItem value="cancelado">Canceladas</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Ordenar por" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="date">Fecha</SelectItem>
                                    <SelectItem value="cost">Costo</SelectItem>
                                    <SelectItem value="customer">Cliente</SelectItem>
                                    <SelectItem value="device">Dispositivo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Performance Analytics */}
            <TechnicianPerformanceMetrics repairs={myRepairs} />

            {/* Work History Charts */}
            <WorkHistoryChart repairs={myRepairs} />

            {/* Productivity Statistics */}
            <ProductivityStats repairs={myRepairs} />

            {/* Main Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Historial Detallado ({filteredAndSortedRepairs.length} registros)
                    </CardTitle>
                    <CardDescription>
                        Registro completo de todas tus reparaciones con métricas de desempeño
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <RepairTable
                        repairs={filteredAndSortedRepairs}
                        emptyMessage="No se encontraron reparaciones con los filtros aplicados"
                    />
                </CardContent>
            </Card>
        </div>
    )
}
