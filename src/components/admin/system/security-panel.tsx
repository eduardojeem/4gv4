'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FilterX,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Shield,
  User,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { useSecurityLogs, type SecurityLog } from '@/hooks/use-security-logs'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

const severityLabels: Record<SecurityLog['severity'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
}

const severityClasses: Record<SecurityLog['severity'], string> = {
  low: 'border-emerald-200 bg-emerald-100/80 text-emerald-800 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium',
  medium: 'border-amber-200 bg-amber-100/80 text-amber-800 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-400 font-medium',
  high: 'border-orange-200 bg-orange-100/80 text-orange-800 shadow-sm dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-400 font-medium',
  critical: 'border-red-300 bg-red-100 text-red-900 shadow-sm font-bold dark:border-red-800/80 dark:bg-red-950/60 dark:text-red-400 ring-1 ring-red-500/20',
}

function severityIcon(severity: SecurityLog['severity']) {
  if (severity === 'critical') return <XCircle className="h-3.5 w-3.5" />
  if (severity === 'high') return <AlertTriangle className="h-3.5 w-3.5" />
  if (severity === 'medium') return <AlertCircle className="h-3.5 w-3.5" />
  return <CheckCircle2 className="h-3.5 w-3.5" />
}

function eventIcon(log: SecurityLog) {
  const action = log.action || ''
  const event = log.event.toLowerCase()

  if (action.includes('failed') || event.includes('fallido') || event.includes('denegado')) {
    return <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
  }
  if (action.includes('status') || event.includes('estado')) {
    return <Ban className="h-4 w-4 text-orange-600 dark:text-orange-400" />
  }
  if (event.includes('inicio') || event.includes('acceso')) {
    return <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
  }

  return <Eye className="h-4 w-4 text-muted-foreground" />
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return { date: 'Sin fecha', time: '' }

  return {
    date: new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(date),
    time: new Intl.DateTimeFormat('es-PY', { timeStyle: 'short' }).format(date),
  }
}

function csvCell(value: string | number | undefined) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function SecurityPanel() {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('24h')
  const [userFilter, setUserFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isBlocking, setIsBlocking] = useState<string | null>(null)
  const { logs, stats, totalCount, users, isLoading, error, fetchSecurityLogs } = useSecurityLogs()
  const { user, isAdmin, isSuperAdmin } = useAuth()

  const requestFilters = useMemo(() => ({
    timeRange: timeFilter,
    severity: severityFilter,
    search: debouncedSearchTerm,
    userId: userFilter,
    page: currentPage,
    pageSize: PAGE_SIZE,
  }), [currentPage, debouncedSearchTerm, severityFilter, timeFilter, userFilter])

  useEffect(() => {
    fetchSecurityLogs(requestFilters)
  }, [fetchSecurityLogs, requestFilters])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const paginatedLogs = logs

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, severityFilter, timeFilter, userFilter])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  async function refresh() {
    await fetchSecurityLogs(requestFilters, true)
    toast.success('Eventos actualizados', { description: 'Se recargó el registro de seguridad.' })
  }

  async function blockUser(userId?: string) {
    if (!userId) return

    if (userId === user?.id) {
      toast.error('Acción no permitida', { description: 'No puedes suspender tu propia cuenta.' })
      return
    }

    if (!isAdmin && !isSuperAdmin) {
      toast.error('Sin permisos', { description: 'Solo administradores pueden suspender usuarios.' })
      return
    }

    const confirmed = window.confirm(
      'Vas a suspender este usuario. La cuenta no podrá acceder hasta que un administrador la reactive. ¿Quieres continuar?'
    )
    if (!confirmed) return

    try {
      setIsBlocking(userId)
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo suspender al usuario.')
      }

      toast.success('Usuario suspendido', { description: 'La cuenta quedó inactiva para nuevos accesos.' })
      await fetchSecurityLogs(requestFilters, true)
    } catch (err) {
      toast.error('No se pudo suspender', {
        description: err instanceof Error ? err.message : 'Error inesperado.',
      })
    } finally {
      setIsBlocking(null)
    }
  }

  function exportCsv() {
    if (logs.length === 0) {
      toast.info('Sin datos', { description: 'No hay eventos para exportar con los filtros actuales.' })
      return
    }

    const rows = [
      ['Evento', 'Usuario', 'Fecha', 'IP', 'Severidad', 'Acción', 'Recurso', 'Detalles'],
      ...logs.map((log) => [
        log.event,
        log.user,
        log.timestamp,
        log.ip,
        severityLabels[log.severity],
        log.action || '',
        log.resource || '',
        log.details || '',
      ]),
    ]
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.href = url
    link.download = `security-logs-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function resetFilters() {
    setSearchTerm('')
    setDebouncedSearchTerm('')
    setSeverityFilter('all')
    setTimeFilter('24h')
    setUserFilter('all')
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Eventos" value={stats.totalEvents} detail="En el período elegido" icon={Shield} tone="default" loading={isLoading} />
        <MetricCard title="Críticos" value={stats.criticalEvents} detail="Requieren atención" icon={XCircle} tone="danger" loading={isLoading} />
        <MetricCard title="Alta prioridad" value={stats.highRiskEvents} detail="Riesgo elevado" icon={AlertTriangle} tone="warning" loading={isLoading} />
        <MetricCard title="Fallidos" value={stats.failedAttempts} detail="Intentos rechazados" icon={Lock} tone="muted" loading={isLoading} />
      </div>

      <Card className="border-0 shadow-2xl shadow-slate-200/40 dark:shadow-none ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl">
        <CardHeader className="border-b bg-slate-50/80 dark:bg-slate-900/80 px-6 py-5 backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-500" />
                Registro de Auditoría
              </CardTitle>
              <p className="text-sm text-muted-foreground font-medium">
                Monitoreo en tiempo real de accesos y acciones críticas del sistema.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2 bg-white/50 hover:bg-white dark:bg-slate-900/50 dark:hover:bg-slate-800 transition-all border-slate-200 dark:border-slate-700 shadow-sm">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> : <RefreshCw className="h-4 w-4 text-indigo-500" />}
                Actualizar
              </Button>
              <Button variant="outline" onClick={resetFilters} disabled={isLoading} className="gap-2 bg-white/50 hover:bg-white dark:bg-slate-900/50 dark:hover:bg-slate-800 transition-all border-slate-200 dark:border-slate-700 shadow-sm">
                <FilterX className="h-4 w-4 text-slate-500" />
                Limpiar
              </Button>
              <Button onClick={exportCsv} disabled={isLoading || logs.length === 0} className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02]">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_220px] bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar evento, usuario, acción, IP o detalle"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm focus:ring-indigo-500">
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm focus:ring-indigo-500">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Última hora</SelectItem>
                <SelectItem value="24h">Últimas 24 horas</SelectItem>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter} disabled={users.length === 0}>
              <SelectTrigger className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm focus:ring-indigo-500">
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {users.map((userOption) => (
                  <SelectItem key={userOption.id} value={userOption.id}>{userOption.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Evento</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Usuario</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">IP</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Severidad</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Fecha</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Cargando eventos de seguridad...
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && paginatedLogs.map((log) => {
                  const timestamp = formatTimestamp(log.timestamp)
                  return (
                    <TableRow key={log.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                      <TableCell className="min-w-[280px]">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 rounded-full p-1.5 bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors shadow-sm">
                            {eventIcon(log)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{log.event}</p>
                            {log.details && <p className="mt-1 max-w-xl truncate text-xs font-medium text-slate-500 dark:text-slate-400">{log.details}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[180px] items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shadow-sm">
                            <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <span className="truncate text-sm font-medium">{log.user}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium text-slate-600 dark:text-slate-300">{log.ip}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('gap-1.5 rounded-full px-2.5 py-0.5 border shadow-sm transition-all group-hover:scale-105', severityClasses[log.severity])}>
                          {severityIcon(log.severity)}
                          {severityLabels[log.severity]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[130px] items-center gap-2.5 text-sm">
                          <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">{timestamp.date}</span>
                            <span className="text-xs text-muted-foreground font-mono">{timestamp.time}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {log.user_id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => blockUser(log.user_id)}
                            disabled={isBlocking === log.user_id || log.user_id === user?.id || (!isAdmin && !isSuperAdmin)}
                            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 dark:border-red-900/30 dark:hover:bg-red-900/20 transition-all font-medium shadow-sm"
                          >
                            {isBlocking === log.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                            Suspender
                          </Button>
                        ) : (
                          <span className="text-sm text-slate-400 font-medium">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}

                {!isLoading && logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-36 text-center">
                      <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-3 font-medium">Sin eventos para mostrar</p>
                      <p className="mt-1 text-sm text-muted-foreground">Cambia los filtros o amplía el período de búsqueda.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoading && logs.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages}>
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type MetricCardProps = {
  title: string
  value: number
  detail: string
  icon: typeof Shield
  tone: 'default' | 'danger' | 'warning' | 'muted'
  loading: boolean
}

function MetricCard({ title, value, detail, icon: Icon, tone, loading }: MetricCardProps) {
  const toneStyles = {
    default: 'from-indigo-500/10 to-violet-500/5 border-indigo-200/50 dark:border-indigo-800/30 text-indigo-700 dark:text-indigo-400',
    danger: 'from-rose-500/10 to-red-500/5 border-rose-200/50 dark:border-rose-800/30 text-rose-700 dark:text-rose-400',
    warning: 'from-amber-500/10 to-orange-500/5 border-amber-200/50 dark:border-amber-800/30 text-amber-700 dark:text-amber-400',
    muted: 'from-slate-500/10 to-gray-500/5 border-slate-200/50 dark:border-slate-800/30 text-slate-700 dark:text-slate-400',
  }[tone]

  const iconBgStyles = {
    default: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/20',
    danger: 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-500/20',
    warning: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-orange-500/20',
    muted: 'bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-slate-500/20',
  }[tone]

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br",
      toneStyles
    )}>
      {/* Decorative background blur */}
      <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/40 blur-3xl dark:bg-black/20 transition-all group-hover:scale-110" />

      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase opacity-80">{title}</p>
            <p className="text-4xl font-extrabold tabular-nums tracking-tight">
              {loading ? <Loader2 className="h-8 w-8 animate-spin opacity-50 mt-1" /> : value}
            </p>
            <p className="text-xs font-medium opacity-80 mt-1">{detail}</p>
          </div>
          <div className={cn("rounded-2xl p-3 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", iconBgStyles)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
