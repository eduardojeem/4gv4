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
import { useToast } from '@/components/ui/use-toast'
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
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
  high: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300',
  critical: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
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
  const { logs, stats, isLoading, error, fetchSecurityLogs } = useSecurityLogs()
  const { toast } = useToast()
  const { user, isAdmin, isSuperAdmin } = useAuth()

  const requestFilters = useMemo(() => ({
    timeRange: timeFilter,
    severity: severityFilter,
    limit: 300,
  }), [severityFilter, timeFilter])

  useEffect(() => {
    fetchSecurityLogs(requestFilters)
  }, [fetchSecurityLogs, requestFilters])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  const users = useMemo(
    () => Array.from(new Set(logs.map((log) => log.user).filter(Boolean))).sort(),
    [logs]
  )

  const filteredLogs = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase()

    return logs.filter((log) => {
      const matchesSearch = !term ||
        log.event.toLowerCase().includes(term) ||
        log.user.toLowerCase().includes(term) ||
        log.ip.toLowerCase().includes(term) ||
        log.action?.toLowerCase().includes(term) ||
        log.details?.toLowerCase().includes(term)
      const matchesUser = userFilter === 'all' || log.user === userFilter

      return matchesSearch && matchesUser
    })
  }, [debouncedSearchTerm, logs, userFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, severityFilter, timeFilter, userFilter])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  async function refresh() {
    await fetchSecurityLogs(requestFilters, true)
    toast({ title: 'Eventos actualizados', description: 'Se recargó el registro de seguridad.' })
  }

  async function blockUser(userId?: string) {
    if (!userId) return

    if (userId === user?.id) {
      toast({ title: 'Acción no permitida', description: 'No puedes suspender tu propia cuenta.', variant: 'destructive' })
      return
    }

    if (!isAdmin && !isSuperAdmin) {
      toast({ title: 'Sin permisos', description: 'Solo administradores pueden suspender usuarios.', variant: 'destructive' })
      return
    }

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

      toast({ title: 'Usuario suspendido', description: 'La cuenta quedó inactiva para nuevos accesos.' })
      await fetchSecurityLogs(requestFilters, true)
    } catch (err) {
      toast({
        title: 'No se pudo suspender',
        description: err instanceof Error ? err.message : 'Error inesperado.',
        variant: 'destructive',
      })
    } finally {
      setIsBlocking(null)
    }
  }

  function exportCsv() {
    if (filteredLogs.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay eventos para exportar con los filtros actuales.', variant: 'destructive' })
      return
    }

    const rows = [
      ['Evento', 'Usuario', 'Fecha', 'IP', 'Severidad', 'Acción', 'Recurso', 'Detalles'],
      ...filteredLogs.map((log) => [
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
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Eventos" value={stats.totalEvents} detail="En el período elegido" icon={Shield} tone="default" loading={isLoading} />
        <MetricCard title="Críticos" value={stats.criticalEvents} detail="Requieren atención" icon={XCircle} tone="danger" loading={isLoading} />
        <MetricCard title="Alta prioridad" value={stats.highRiskEvents} detail="Riesgo elevado" icon={AlertTriangle} tone="warning" loading={isLoading} />
        <MetricCard title="Fallidos" value={stats.failedAttempts} detail="Intentos o permisos rechazados" icon={Lock} tone="muted" loading={isLoading} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Eventos de seguridad</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Auditoría de accesos, cambios sensibles y acciones administrativas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Actualizar
              </Button>
              <Button variant="outline" onClick={resetFilters} disabled={isLoading} className="gap-2">
                <FilterX className="h-4 w-4" />
                Limpiar
              </Button>
              <Button onClick={exportCsv} disabled={isLoading || filteredLogs.length === 0} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_220px]">
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
              <SelectTrigger>
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
              <SelectTrigger>
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
              <SelectTrigger>
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {users.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
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
                    <TableRow key={log.id}>
                      <TableCell className="min-w-[280px]">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{eventIcon(log)}</div>
                          <div className="min-w-0">
                            <p className="font-medium">{log.event}</p>
                            {log.details && <p className="mt-1 max-w-xl truncate text-sm text-muted-foreground">{log.details}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[180px] items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate text-sm">{log.user}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.ip}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('gap-1 rounded-full border', severityClasses[log.severity])}>
                          {severityIcon(log.severity)}
                          {severityLabels[log.severity]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[130px] items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p>{timestamp.date}</p>
                            <p className="text-muted-foreground">{timestamp.time}</p>
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
                            className="gap-1 text-red-600 hover:text-red-700"
                          >
                            {isBlocking === log.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                            Suspender
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}

                {!isLoading && filteredLogs.length === 0 && (
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

          {!isLoading && filteredLogs.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} de {filteredLogs.length}
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
  return (
    <Card className={cn(
      tone === 'danger' && 'border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20',
      tone === 'warning' && 'border-orange-200 bg-orange-50/60 dark:border-orange-900/60 dark:bg-orange-950/20',
      tone === 'muted' && 'bg-muted/40'
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className="rounded-md border bg-background p-2 text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
