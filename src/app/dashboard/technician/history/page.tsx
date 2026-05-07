'use client'

import { useMemo, useState } from 'react'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  CheckCircle2, Package, XCircle, Search, Calendar, User,
  Smartphone, Clock, TrendingUp, Star, Timer, Wrench,
  ChevronLeft, ChevronRight, Banknote, Activity, BarChart3
} from 'lucide-react'
import { ExportButton } from '@/components/dashboard/technicians/history/ExportButton'
import { Repair } from '@/types/repairs'
import { formatCurrency } from '@/lib/currency'
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, subtitle, icon: Icon, accent,
}: {
  title: string; value: string | number; subtitle: string; icon: React.ElementType; accent: string
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

// ─── Paginated Table ──────────────────────────────────────────────────────────

function RepairTable({ repairs, page, pageSize, onPageChange }: {
  repairs: Repair[]; page: number; pageSize: number; onPageChange: (p: number) => void
}) {
  const totalPages = Math.ceil(repairs.length / pageSize)
  const paginated = repairs.slice((page - 1) * pageSize, page * pageSize)

  if (repairs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-10 w-10 text-gray-200 dark:text-gray-700 mb-3" />
        <p className="text-sm text-gray-400 dark:text-gray-500">No se encontraron reparaciones con los filtros aplicados</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-slate-900">
              <TableHead className="text-xs font-semibold">Cliente</TableHead>
              <TableHead className="text-xs font-semibold">Dispositivo</TableHead>
              <TableHead className="text-xs font-semibold">Estado</TableHead>
              <TableHead className="text-xs font-semibold">Duración</TableHead>
              <TableHead className="text-xs font-semibold">Fecha</TableHead>
              <TableHead className="text-xs font-semibold text-right">Costo</TableHead>
              <TableHead className="text-xs font-semibold text-center">Rating</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((repair) => {
              const duration = repair.completedAt && repair.createdAt
                ? Math.ceil((new Date(repair.completedAt).getTime() - new Date(repair.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : null

              return (
                <TableRow key={repair.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{repair.customer.name}</p>
                      <p className="text-xs text-gray-400">{repair.customer.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{repair.brand} {repair.model}</p>
                      <div className="flex gap-1 mt-0.5">
                        {repair.urgency === 'urgent' && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">Urgente</Badge>
                        )}
                        {repair.priority === 'high' && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">Alta</Badge>
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
                      className="text-[10px]"
                    >
                      {repair.dbStatus === 'entregado' ? 'Entregado' :
                       repair.dbStatus === 'listo' ? 'Listo' :
                       repair.dbStatus === 'cancelado' ? 'Cancelado' :
                       repair.dbStatus === 'reparacion' ? 'En Reparación' :
                       repair.dbStatus === 'diagnostico' ? 'Diagnóstico' : 'Recibido'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {duration !== null ? (
                      <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">{duration}d</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(repair.completedAt || repair.createdAt), 'dd MMM yy', { locale: es })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                      {formatCurrency(repair.finalCost || repair.estimatedCost)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {repair.customerRating ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium">{repair.customerRating}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-400">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, repairs.length)} de {repairs.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium px-2">{page} / {totalPages}</span>
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TechnicianHistoryPage() {
  const { repairs, isLoading } = useRepairs()
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [page, setPage] = useState(1)
  const pageSize = 15

  // Filter repairs for current technician
  const myRepairs = useMemo(() => {
    if (!user?.id) return []
    return repairs.filter(r => r.technician?.id === user.id)
  }, [repairs, user?.id])

  // Apply filters and sorting
  const filteredRepairs = useMemo(() => {
    let filtered = [...myRepairs]

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      let dateRange: { start: Date; end: Date }
      switch (dateFilter) {
        case 'thisMonth':
          dateRange = { start: startOfMonth(now), end: endOfMonth(now) }; break
        case 'lastMonth': {
          const lm = subMonths(now, 1)
          dateRange = { start: startOfMonth(lm), end: endOfMonth(lm) }; break
        }
        case 'last3Months':
          dateRange = { start: subMonths(now, 3), end: now }; break
        default:
          dateRange = { start: new Date(0), end: now }
      }
      filtered = filtered.filter(r => {
        const d = new Date(r.completedAt || r.createdAt)
        return isWithinInterval(d, dateRange)
      })
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.dbStatus === statusFilter)
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(r =>
        r.customer.name.toLowerCase().includes(term) ||
        r.device.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term) ||
        r.issue.toLowerCase().includes(term) ||
        r.brand.toLowerCase().includes(term)
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
        default:
          return 0
      }
    })

    return filtered
  }, [myRepairs, dateFilter, statusFilter, searchTerm, sortBy])

  // Reset page when filters change
  useMemo(() => { setPage(1) }, [dateFilter, statusFilter, searchTerm, sortBy])

  // KPIs (consolidated — no duplication)
  const kpis = useMemo(() => {
    const completed = myRepairs.filter(r => r.dbStatus === 'entregado')
    const active = myRepairs.filter(r => !['listo', 'entregado', 'cancelado'].includes(r.dbStatus || '')).length
    const revenue = completed.reduce((s, r) => s + (r.finalCost || r.estimatedCost || 0), 0)

    const withDates = completed.filter(r => r.completedAt && r.createdAt)
    const avgDays = withDates.length > 0
      ? Math.round(withDates.reduce((s, r) => {
          return s + Math.ceil((new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime()) / 86400000)
        }, 0) / withDates.length * 10) / 10
      : 0

    const rated = myRepairs.filter(r => r.customerRating && r.customerRating > 0)
    const avgRating = rated.length > 0
      ? Math.round(rated.reduce((s, r) => s + (r.customerRating || 0), 0) / rated.length * 10) / 10
      : 0

    return { total: myRepairs.length, completed: completed.length, active, revenue, avgDays, avgRating }
  }, [myRepairs])

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Historial</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {myRepairs.length} reparaciones totales
          </p>
        </div>
        <ExportButton repairs={filteredRepairs} disabled={isLoading} />
      </div>

      {/* KPIs — Single row, no duplication */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard title="Completadas" value={kpis.completed} subtitle="Entregadas al cliente" icon={CheckCircle2} accent="border-l-emerald-500" />
        <KpiCard title="En proceso" value={kpis.active} subtitle="Trabajos activos" icon={Activity} accent="border-l-blue-500" />
        <KpiCard title="Ingresos" value={formatCurrency(kpis.revenue)} subtitle="Total facturado" icon={Banknote} accent="border-l-green-500" />
        <KpiCard title="Tiempo prom." value={kpis.avgDays > 0 ? `${kpis.avgDays}d` : '—'} subtitle="Creación → entrega" icon={Clock} accent="border-l-violet-500" />
        <KpiCard title="Rating" value={kpis.avgRating > 0 ? `${kpis.avgRating}/5` : '—'} subtitle="Satisfacción" icon={Star} accent="border-l-amber-500" />
      </div>

      {/* Filters */}
      <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por cliente, dispositivo, marca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[150px] h-9 text-xs">
                  <SelectValue placeholder="Fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las fechas</SelectItem>
                  <SelectItem value="thisMonth">Este mes</SelectItem>
                  <SelectItem value="lastMonth">Mes pasado</SelectItem>
                  <SelectItem value="last3Months">Últimos 3 meses</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
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
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Más recientes</SelectItem>
                  <SelectItem value="cost">Mayor costo</SelectItem>
                  <SelectItem value="customer">Cliente A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              Registro de reparaciones
            </CardTitle>
            <Badge variant="secondary" className="text-xs">{filteredRepairs.length} resultados</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RepairTable
            repairs={filteredRepairs}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  )
}
