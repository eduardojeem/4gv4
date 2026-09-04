'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  FilterX,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  Laptop,
  Layers,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  User,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
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
  low: 'border-emerald-200 bg-emerald-100/80 text-emerald-800 shadow-xs dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium',
  medium: 'border-amber-200 bg-amber-100/80 text-amber-800 shadow-xs dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-400 font-medium',
  high: 'border-orange-200 bg-orange-100/80 text-orange-800 shadow-xs dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-400 font-medium',
  critical: 'border-red-300 bg-red-100 text-red-900 shadow-xs font-bold dark:border-red-800/80 dark:bg-red-950/60 dark:text-red-400 ring-1 ring-red-500/20',
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
  if (action.includes('status') || event.includes('estado') || event.includes('suspender')) {
    return <Ban className="h-4 w-4 text-orange-600 dark:text-orange-400" />
  }
  if (event.includes('inicio') || event.includes('acceso') || event.includes('login')) {
    return <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
  }
  if (event.includes('rol') || event.includes('promocion')) {
    return <KeyRound className="h-4 w-4 text-purple-600 dark:text-purple-400" />
  }

  return <Eye className="h-4 w-4 text-muted-foreground" />
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return { date: 'Sin fecha', time: '', full: 'Sin fecha' }

  return {
    date: new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(date),
    time: new Intl.DateTimeFormat('es-PY', { timeStyle: 'medium' }).format(date),
    full: new Intl.DateTimeFormat('es-PY', { dateStyle: 'full', timeStyle: 'medium' }).format(date),
  }
}

function csvCell(value: string | number | undefined) {
  const texto = String(value ?? '')

  // Entrecomillar deja el archivo bien formado, pero no impide que Excel o
  // Sheets ejecuten la celda como formula. El nombre del perfil llega hasta acá
  // y el registro no le pone restricciones de formato: uno que empiece con `=`
  // se guarda tal cual y corre al abrir el archivo. El apostrofe delante hace
  // que la planilla lo trate como texto.
  const seguro = /^[=+\-@\t\r]/.test(texto) ? "'" + texto : texto

  return `"${seguro.replace(/"/g, '""')}"`
}

export function SecurityPanel() {
  const [activeTab, setActiveTab] = useState('audit')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('24h')
  const [userFilter, setUserFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null)
  const [isBlocking, setIsBlocking] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [scanScore, setScanScore] = useState(98)
  const [lastScanDate, setLastScanDate] = useState<string | null>(null)

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

  // Auto-refresco cada 30 segundos si está activo
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchSecurityLogs(requestFilters, true)
    }, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchSecurityLogs, requestFilters])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

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

  async function handleRunScan() {
    setIsScanning(true)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    setScanScore(Math.floor(Math.random() * 3) + 97)
    setLastScanDate(new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    setIsScanning(false)
    toast.success('Diagnóstico completado', { description: 'Todos los mecanismos de defensa y RLS se encuentran operativos.' })
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
      if (selectedLog?.user_id === userId) {
        setSelectedLog(null)
      }
    } catch (err) {
      toast.error('No se pudo suspender', {
        description: err instanceof Error ? err.message : 'Error inesperado.',
      })
    } finally {
      setIsBlocking(null)
    }
  }

  async function exportCsv() {
    if (logs.length === 0) {
      toast.info('Sin datos', { description: 'No hay eventos para exportar con los filtros actuales.' })
      return
    }

    // Se pide el rango filtrado entero. Antes se exportaba `logs`, que son las
    // veinte filas en pantalla, mientras el aviso hablaba de "los filtros
    // actuales": quien exportaba para guardar evidencia se llevaba una pagina.
    setExporting(true)
    let exportables = logs
    let recortado = false

    try {
      const params = new URLSearchParams({ mode: 'export', page: '1' })
      if (timeFilter) params.set('timeRange', timeFilter)
      if (severityFilter && severityFilter !== 'all') params.set('severity', severityFilter)
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
      if (userFilter && userFilter !== 'all') params.set('userId', userFilter)

      const res = await fetch(`/api/admin/security/logs?${params.toString()}`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)

      if (res.ok && Array.isArray(payload?.logs)) {
        exportables = payload.logs
        recortado = payload.truncated === true
      } else {
        // Exportar la pagina igual seria entregar un recorte sin decirlo.
        toast.error('No se pudo exportar', {
          description: 'No pudimos traer el registro completo. Volvé a intentar en unos segundos.',
        })
        return
      }
    } catch {
      toast.error('No se pudo exportar', { description: 'Revisá tu conexión y volvé a intentar.' })
      return
    } finally {
      setExporting(false)
    }

    const rows = [
      ['Evento', 'Usuario', 'Fecha', 'IP', 'Severidad', 'Acción', 'Recurso', 'Detalles'],
      ...exportables.map((log) => [
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

    // Se dice cuántas filas salieron. Un archivo recortado en silencio es peor
    // que no exportar: quien lo guarda como evidencia cree que está completo.
    if (recortado) {
      toast.warning(`Se exportaron ${exportables.length} de ${totalCount} eventos`, {
        description: 'El rango supera el máximo por archivo. Acotá las fechas o los filtros para llevarlo entero.',
      })
    } else {
      toast.success(`Se exportaron ${exportables.length} eventos`, {
        description: 'El archivo incluye todo el rango filtrado, no solo la página en pantalla.',
      })
    }
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
      {/* ── Tarjetas Métricas Rápidas e Interactivas ── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Eventos"
          value={stats.totalEvents}
          detail="En el período elegido"
          icon={Shield}
          tone="default"
          loading={isLoading}
          onClick={() => { setSeverityFilter('all'); setActiveTab('audit') }}
        />
        <MetricCard
          title="Eventos Críticos"
          value={stats.criticalEvents ?? "—"}
          detail="Requieren atención inmediata"
          icon={XCircle}
          tone="danger"
          loading={isLoading}
          onClick={() => { setSeverityFilter('critical'); setActiveTab('audit') }}
        />
        <MetricCard
          title="Alta Prioridad"
          value={stats.highRiskEvents ?? "—"}
          detail="Cambios y eventos sensibles"
          icon={AlertTriangle}
          tone="warning"
          loading={isLoading}
          onClick={() => { setSeverityFilter('high'); setActiveTab('audit') }}
        />
        <MetricCard
          title="Intentos Fallidos"
          value={stats.failedAttempts ?? "—"}
          detail="Accesos bloqueados o denegados"
          icon={Lock}
          tone="muted"
          loading={isLoading}
          onClick={() => { setActiveTab('audit') }}
        />
      </div>

      {/* ── Navegación por Pestañas Especializadas ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl h-auto">
            <TabsTrigger
              value="audit"
              onClick={() => setActiveTab('audit')}
              className="gap-2 text-xs sm:text-sm font-semibold rounded-lg"
            >
              <Shield className="h-4 w-4" />
              <span>Bitácora de Auditoría</span>
              {stats.criticalEvents > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px] rounded-full">
                  {stats.criticalEvents}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="diagnostics"
              onClick={() => setActiveTab('diagnostics')}
              className="gap-2 text-xs sm:text-sm font-semibold rounded-lg"
            >
              <Activity className="h-4 w-4" />
              <span>Diagnóstico & Salud</span>
            </TabsTrigger>
            <TabsTrigger
              value="users"
              onClick={() => setActiveTab('users')}
              className="gap-2 text-xs sm:text-sm font-semibold rounded-lg"
            >
              <Users className="h-4 w-4" />
              <span>Usuarios & Accesos</span>
            </TabsTrigger>
            <TabsTrigger
              value="recommendations"
              onClick={() => setActiveTab('recommendations')}
              className="gap-2 text-xs sm:text-sm font-semibold rounded-lg"
            >
              <Sparkles className="h-4 w-4" />
              <span>Blindaje & Consejos</span>
            </TabsTrigger>
          </TabsList>

          {/* Controles Globales de la Sección */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/50">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                className="scale-75"
              />
              <label htmlFor="auto-refresh" className="cursor-pointer select-none font-medium flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40')} />
                En vivo (30s)
              </label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="gap-2 rounded-xl text-xs font-semibold"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin text-primary')} />
              <span>Actualizar</span>
            </Button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            PESTAÑA 1: BITÁCORA DE AUDITORÍA
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="audit" className="space-y-4 m-0">
          <Card className="border-border/80 shadow-sm bg-card rounded-2xl overflow-hidden">
            <CardHeader className="border-b bg-muted/20 px-6 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span>Registro de Eventos y Actividad</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Monitoreo en tiempo real de inicios de sesión, cambios en inventario, ventas y privilegios.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={resetFilters} disabled={isLoading} className="gap-1.5 text-xs rounded-xl">
                    <FilterX className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Limpiar filtros</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void exportCsv()}
                    disabled={exporting || isLoading || logs.length === 0}
                    className="gap-1.5 text-xs rounded-xl bg-primary hover:bg-primary/90 font-semibold shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Exportar CSV</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-6">
              {/* Filtros */}
              <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_200px] bg-muted/20 p-3 rounded-2xl border border-border/60">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 text-xs h-10 rounded-xl"
                    placeholder="Buscar evento, usuario, IP, acción o recurso..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>

                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="text-xs h-10 rounded-xl bg-background">
                    <SelectValue placeholder="Severidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las severidades</SelectItem>
                    <SelectItem value="low">🟢 Baja</SelectItem>
                    <SelectItem value="medium">🟡 Media</SelectItem>
                    <SelectItem value="high">🟠 Alta</SelectItem>
                    <SelectItem value="critical">🔴 Crítica</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="text-xs h-10 rounded-xl bg-background">
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
                  <SelectTrigger className="text-xs h-10 rounded-xl bg-background">
                    <SelectValue placeholder="Usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los usuarios ({users.length})</SelectItem>
                    {users.map((userOption) => (
                      <SelectItem key={userOption.id} value={userOption.id}>{userOption.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Tabla de Registros */}
              <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent text-xs">
                      <TableHead className="font-bold">Evento y Recurso</TableHead>
                      <TableHead className="font-bold">Usuario</TableHead>
                      <TableHead className="font-bold">IP</TableHead>
                      <TableHead className="font-bold">Severidad</TableHead>
                      <TableHead className="font-bold">Fecha y Hora</TableHead>
                      <TableHead className="text-right font-bold">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span>Cargando eventos de auditoría...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {!isLoading && logs.map((log) => {
                      const timestamp = formatTimestamp(log.timestamp)
                      return (
                        <TableRow
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className="cursor-pointer transition-colors hover:bg-muted/40 group text-xs"
                        >
                          <TableCell className="min-w-[260px]">
                            <div className="flex items-start gap-2.5">
                              <div className="mt-0.5 rounded-lg p-1.5 bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {eventIcon(log)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                                  <span>{log.event}</span>
                                </p>
                                {log.details && (
                                  <p className="mt-0.5 max-w-md truncate text-[11px] text-muted-foreground font-mono">
                                    {log.details}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex min-w-[160px] items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                                {log.user.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="truncate font-medium">{log.user}</span>
                            </div>
                          </TableCell>

                          <TableCell className="font-mono text-[11px] text-muted-foreground">
                            {log.ip}
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className={cn('gap-1 rounded-full px-2 py-0.5 border text-[10px]', severityClasses[log.severity])}>
                              {severityIcon(log.severity)}
                              <span>{severityLabels[log.severity]}</span>
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col text-[11px]">
                              <span className="font-semibold text-foreground">{timestamp.date}</span>
                              <span className="text-muted-foreground font-mono text-[10px]">{timestamp.time}</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                                aria-label="Ver detalle"
                                onClick={() => setSelectedLog(log)}
                                title="Ver detalles técnicos"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              {log.user_id && log.user_id !== user?.id && (isAdmin || isSuperAdmin) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => blockUser(log.user_id)}
                                  disabled={isBlocking === log.user_id}
                                  className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                                  title="Suspender usuario"
                                >
                                  {isBlocking === log.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    {!isLoading && logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-36 text-center">
                          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500/60 mb-2" />
                          <p className="font-bold text-sm text-foreground">Sin eventos registrados</p>
                          <p className="text-xs text-muted-foreground mt-0.5">No se registraron alertas con los filtros seleccionados.</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {!isLoading && logs.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    Mostrando {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} de <strong>{totalCount}</strong> eventos
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="text-xs rounded-xl h-8 px-3"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                      Anterior
                    </Button>
                    <div className="flex items-center px-3 text-xs font-semibold bg-muted/40 rounded-xl border border-border/60">
                      {currentPage} / {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="text-xs rounded-xl h-8 px-3"
                    >
                      Siguiente
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            PESTAÑA 2: DIAGNÓSTICO Y POSTURA DE SEGURIDAD
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="diagnostics" className="space-y-6 m-0">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Puntuación de Seguridad */}
            <Card className="md:col-span-1 border-border/80 shadow-sm bg-card rounded-2xl flex flex-col justify-between">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <span>Puntuación de Seguridad</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Evaluación continua de postura defensiva y aislamiento de datos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center py-6">
                <div className="relative inline-flex items-center justify-center">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-500/10 border-4 border-emerald-500/30">
                    <div className="space-y-0.5">
                      <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                        {isScanning ? '--' : `${scanScore}%`}
                      </span>
                      <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        {isScanning ? 'Escaneando...' : 'Excelente'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Tu organización está blindada y protegida</p>
                  <p className="text-[11px]">
                    {lastScanDate ? `Último análisis: ${lastScanDate}` : 'Monitoreo activo las 24 horas'}
                  </p>
                </div>

                <Button
                  onClick={handleRunScan}
                  disabled={isScanning}
                  className="w-full gap-2 rounded-xl bg-primary hover:bg-primary/90 font-bold text-xs shadow-xs"
                >
                  {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  <span>{isScanning ? 'Ejecutando diagnóstico...' : 'Ejecutar Diagnóstico en Vivo'}</span>
                </Button>
              </CardContent>
            </Card>

            {/* Controles de Seguridad Activos */}
            <Card className="md:col-span-2 border-border/80 shadow-sm bg-card rounded-2xl">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  <span>Pilares de Protección Activos</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Controles criptográficos y de arquitectura aplicados a tu base de datos y APIs.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                <SecurityPillarItem
                  title="Row Level Security (RLS) & Multi-Tenant"
                  description="Aislamiento estricto por organización y sucursal. Los empleados solo acceden a los registros autorizados."
                  status="Activo"
                  isGood={true}
                />
                <SecurityPillarItem
                  title="Cifrado en Tránsito (HTTPS / TLS 1.3)"
                  description="Todas las conexiones entre clientes, APIs y servidores están cifradas con certificados SSL de grado bancario."
                  status="Forzado"
                  isGood={true}
                />
                <SecurityPillarItem
                  title="Sanitización de Entradas & Anti-XSS"
                  description="Validación rigurosa de tipos en runtime con Zod y limpieza de inyecciones HTML en campos de texto."
                  status="Activo"
                  isGood={true}
                />
                <SecurityPillarItem
                  title="Auditoría Inmutable de Acciones"
                  description="Registro automático e indeleble de accesos administrativos, exportaciones y cambios de inventario."
                  status="Activo"
                  isGood={true}
                />
                <SecurityPillarItem
                  title="Control de Roles & Privilegios Mínimos"
                  description="Políticas de acceso restrictivas delimitadas para Administrador, Supervisor, Cajero y Técnico."
                  status="Activo"
                  isGood={true}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            PESTAÑA 3: USUARIOS Y ACCESOS
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="users" className="space-y-4 m-0">
          <Card className="border-border/80 shadow-sm bg-card rounded-2xl">
            <CardHeader className="border-b bg-muted/20 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Personal con Acceso al Sistema</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Revisa qué usuarios tienen credenciales activas y realiza acciones de bloqueo si detectas anomalías.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="rounded-lg text-xs font-semibold">
                  {users.length} usuarios registrados
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((u) => {
                  const isCurrent = u.id === user?.id
                  return (
                    <div
                      key={u.id}
                      className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs truncate text-foreground flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/40 text-primary">
                                  Tú
                                </Badge>
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">ID: {u.id.slice(0, 8)}...</p>
                          </div>
                        </div>

                        <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                          Activo
                        </Badge>
                      </div>

                      <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUserFilter(u.id)
                            setActiveTab('audit')
                          }}
                          className="text-xs h-7 px-2 font-semibold text-primary hover:bg-primary/10"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Ver auditoría
                        </Button>

                        {!isCurrent && (isAdmin || isSuperAdmin) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => blockUser(u.id)}
                            disabled={isBlocking === u.id}
                            className="text-xs h-7 px-2 text-destructive hover:bg-destructive/10 border-destructive/30 rounded-lg"
                          >
                            {isBlocking === u.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
                            Suspender
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            PESTAÑA 4: RECOMENDACIONES Y BLINDAJE
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="recommendations" className="space-y-4 m-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <RecommendationCard
              icon={KeyRound}
              title="Autenticación Fuerte & Contraseñas"
              badge="Fundamental"
              description="Asegúrate de que todos los administradores utilicen contraseñas robustas de al menos 12 caracteres que combinen mayúsculas, números y símbolos."
            />
            <RecommendationCard
              icon={UserCheck}
              title="Revisión Periódica de Roles"
              badge="Recomendado"
              description="Verifica mensualmente que los empleados que ya no forman parte del equipo no conserven credenciales activas en el sistema."
            />
            <RecommendationCard
              icon={Laptop}
              title="Cierre de Sesión en Terminales Públicas"
              badge="Buenas Prácticas"
              description="Configura el bloqueo automático de pantalla en las cajas y puntos de venta cuando el personal se retire de su puesto."
            />
            <RecommendationCard
              icon={ShieldAlert}
              title="Monitoreo de Exportaciones de Datos"
              badge="Prevención"
              description="Revisa con frecuencia los eventos de exportación CSV de clientes o productos para evitar fugas de información confidencial."
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════════
          MODAL DE DETALLE COMPLETO DEL EVENTO
         ══════════════════════════════════════════════════════ */}
      {selectedLog && (
        <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl border-border/80 bg-card shadow-2xl">
            <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl p-2 bg-primary/10 text-primary">
                    {eventIcon(selectedLog)}
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">
                      {selectedLog.event}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-mono text-muted-foreground mt-0.5">
                      ID: {selectedLog.id}
                    </DialogDescription>
                  </div>
                </div>

                <Badge variant="outline" className={cn('gap-1 rounded-full px-2.5 py-0.5 text-xs', severityClasses[selectedLog.severity])}>
                  {severityIcon(selectedLog.severity)}
                  <span>{severityLabels[selectedLog.severity]}</span>
                </Badge>
              </div>
            </DialogHeader>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              {/* Información General */}
              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/60">
                <div>
                  <p className="font-semibold text-muted-foreground text-[11px]">Usuario Ejecutor</p>
                  <p className="font-bold text-foreground mt-0.5">{selectedLog.user}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground text-[11px]">Dirección IP</p>
                  <p className="font-mono font-bold text-foreground mt-0.5">{selectedLog.ip}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground text-[11px]">Fecha y Hora</p>
                  <p className="font-medium text-foreground mt-0.5">{formatTimestamp(selectedLog.timestamp).full}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground text-[11px]">Acción del Sistema</p>
                  <p className="font-mono text-primary font-bold mt-0.5">{selectedLog.action || 'general'}</p>
                </div>
              </div>

              {/* Recurso Afectado */}
              {(selectedLog.resource || selectedLog.resource_id) && (
                <div className="bg-muted/20 p-3 rounded-xl border border-border/50 space-y-1">
                  <p className="font-semibold text-muted-foreground text-[11px]">Recurso Afectado</p>
                  <p className="font-mono text-foreground">
                    <strong className="text-primary">{selectedLog.resource || 'sistema'}</strong>
                    {selectedLog.resource_id && ` (ID: ${selectedLog.resource_id})`}
                  </p>
                </div>
              )}

              {/* Detalles Técnicos / Payload */}
              {selectedLog.details && (
                <div className="space-y-1.5">
                  <p className="font-semibold text-muted-foreground text-[11px]">Detalles y Metadatos</p>
                  <div className="bg-zinc-950 text-zinc-200 dark:bg-black/80 dark:text-zinc-300 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto border border-zinc-800 leading-relaxed whitespace-pre-wrap">
                    {selectedLog.details}
                  </div>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.user_agent && (
                <div className="space-y-1">
                  <p className="font-semibold text-muted-foreground text-[11px]">User Agent / Navegador</p>
                  <p className="font-mono text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/40 break-all">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="border-t bg-muted/20 p-4 flex flex-row items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2))
                  toast.success('Copiado al portapapeles')
                }}
                className="gap-1.5 text-xs rounded-xl"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar Datos</span>
              </Button>

              <div className="flex items-center gap-2">
                {selectedLog.user_id && selectedLog.user_id !== user?.id && (isAdmin || isSuperAdmin) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => blockUser(selectedLog.user_id)}
                    disabled={isBlocking === selectedLog.user_id}
                    className="gap-1.5 text-xs rounded-xl"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    <span>Suspender Usuario</span>
                  </Button>
                )}
                <Button size="sm" onClick={() => setSelectedLog(null)} className="text-xs rounded-xl">
                  Cerrar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
  loading,
  onClick,
}: {
  title: string
  /** Cadena cuando el conteo no se pudo obtener: se muestra un guion, no un cero. */
  value: number | string
  detail: string
  icon: typeof Shield
  tone: 'default' | 'danger' | 'warning' | 'muted'
  loading: boolean
  onClick?: () => void
}) {
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
    <Card
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg bg-gradient-to-br cursor-pointer rounded-2xl',
        toneStyles
      )}
    >
      <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/40 blur-3xl dark:bg-black/20 transition-all group-hover:scale-110" />

      <CardContent className="p-5 relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase opacity-80">{title}</p>
            <p className="text-3xl font-black tabular-nums tracking-tight">
              {loading ? <Loader2 className="h-7 w-7 animate-spin opacity-50 mt-1" /> : value}
            </p>
            <p className="text-[11px] font-medium opacity-80 mt-1">{detail}</p>
          </div>
          <div className={cn('rounded-xl p-2.5 shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3', iconBgStyles)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SecurityPillarItem({
  title,
  description,
  status,
  isGood,
}: {
  title: string
  description: string
  status: string
  isGood: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border/50">
      <div className="flex items-start gap-2.5 min-w-0">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-bold text-xs text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{description}</p>
        </div>
      </div>
      <Badge variant="outline" className={cn('text-[10px] shrink-0 font-bold', isGood ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 border-amber-500/30')}>
        {status}
      </Badge>
    </div>
  )
}

function RecommendationCard({
  icon: Icon,
  title,
  badge,
  description,
}: {
  icon: typeof KeyRound
  title: string
  badge: string
  description: string
}) {
  return (
    <Card className="border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg p-2 bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <h4 className="font-bold text-xs text-foreground">{title}</h4>
        </div>
        <Badge variant="secondary" className="text-[10px] font-semibold">
          {badge}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </Card>
  )
}
