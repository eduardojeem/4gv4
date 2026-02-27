'use client'

import { useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  Clock, 
  MapPin, 
  User, 
  Search,
  Download,
  RefreshCw,
  Lock,
  Unlock,
  Ban,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FilterX,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useSecurityLogs, type SecurityLog } from '@/hooks/use-security-logs'
import { useToast } from '@/components/ui/use-toast'

interface SecurityPanelProps {
  // Props opcionales para compatibilidad hacia atrÃ¡s
}

export function SecurityPanel({}: SecurityPanelProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [timeFilter, setTimeFilter] = useState<string>('24h')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 25

  const { 
    logs: securityLogs, 
    stats, 
    isLoading, 
    error, 
    fetchSecurityLogs
  } = useSecurityLogs()
  
  const { toast } = useToast()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  const requestFilters = useMemo(() => ({
    timeRange: timeFilter,
    severity: severityFilter !== 'all' ? severityFilter : undefined,
    limit: 200
  }), [timeFilter, severityFilter])

  // Refrescar logs cuando cambien los filtros de servidor
  useEffect(() => {
    fetchSecurityLogs(requestFilters)
  }, [fetchSecurityLogs, requestFilters])

  // Opciones derivadas para filtros avanzados
  const uniqueUsers = useMemo(
    () => Array.from(new Set(securityLogs.map(l => l.user))).sort(),
    [securityLogs]
  )
  const uniqueLocations = useMemo(
    () => Array.from(new Set(securityLogs.map(l => l.ip).filter(ip => ip !== 'N/A'))).sort(),
    [securityLogs]
  )

  const filteredLogs = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase()
    return securityLogs.filter(log => {
      const matchesSearch = !term ||
        log.event.toLowerCase().includes(term) ||
        log.user.toLowerCase().includes(term) ||
        log.ip.toLowerCase().includes(term) ||
        (log.details && log.details.toLowerCase().includes(term))
      const matchesUser = userFilter === 'all' || log.user === userFilter
      const matchesLocation = locationFilter === 'all' || log.ip === locationFilter
      return matchesSearch && matchesUser && matchesLocation
    })
  }, [securityLogs, debouncedSearchTerm, userFilter, locationFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredLogs.slice(start, start + PAGE_SIZE)
  }, [filteredLogs, currentPage, PAGE_SIZE])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, userFilter, locationFilter, timeFilter, severityFilter])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const handleRefresh = async () => {
    try {
      await fetchSecurityLogs(requestFilters)
      toast({
        title: "Logs actualizados",
        description: "Los logs de seguridad se han actualizado correctamente.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron actualizar los logs de seguridad.",
        variant: "destructive"
      })
    }
  }

  const handleExport = () => {
    try {
      if (filteredLogs.length === 0) {
        toast({
          title: "Sin datos",
          description: "No hay registros para exportar con los filtros actuales.",
          variant: "destructive"
        })
        return
      }

      const headers = ['ID', 'Evento', 'Usuario', 'Fecha/Hora', 'IP', 'Severidad', 'Detalles']
      const csvContent = [
        headers.join(','),
        ...filteredLogs.map(log => [
          log.id,
          `"${log.event}"`,
          `"${log.user}"`,
          log.timestamp,
          log.ip,
          log.severity,
          `"${log.details || ''}"`
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `security-logs-filtered-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast({
        title: "ExportaciÃ³n exitosa",
        description: "Los logs filtrados se han exportado correctamente.",
      })
    } catch (error) {
      toast({
        title: "Error de exportaciÃ³n",
        description: "No se pudieron exportar los logs.",
        variant: "destructive"
      })
    }
  }

  const resetFilters = () => {
    setSearchTerm('')
    setDebouncedSearchTerm('')
    setSeverityFilter('all')
    setTimeFilter('24h')
    setUserFilter('all')
    setLocationFilter('all')
  }

  const getSeverityColor = (severity: SecurityLog['severity']) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getSeverityIcon = (severity: SecurityLog['severity']) => {
    switch (severity) {
      case 'low': return <CheckCircle className="h-4 w-4" />
      case 'medium': return <AlertCircle className="h-4 w-4" />
      case 'high': return <AlertTriangle className="h-4 w-4" />
      case 'critical': return <XCircle className="h-4 w-4" />
      default: return <Eye className="h-4 w-4" />
    }
  }

  const getEventIcon = (event: string) => {
    if (event.includes('inicio') || event.includes('login') || event.includes('exitoso')) return <Unlock className="h-4 w-4 text-green-600 dark:text-green-400" />
    if (event.includes('fallido') || event.includes('failed') || event.includes('denegado')) return <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
    if (event.includes('bloqueado') || event.includes('blocked')) return <Ban className="h-4 w-4 text-red-600 dark:text-red-400" />
    if (event.includes('contraseÃ±a') || event.includes('password')) return <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    return <Eye className="h-4 w-4 text-gray-600 dark:text-gray-400" />
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString('es-PY'),
      time: date.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
    }
  }

  // Mostrar error si existe
  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span>Error al cargar los logs de seguridad: {error}</span>
            </div>
            <Button 
              onClick={handleRefresh} 
              className="mt-4 mx-auto block"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-r from-red-50 to-orange-50 p-4 dark:from-red-950/30 dark:to-orange-950/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 flex items-center">
              <Shield className="h-6 w-6 mr-2 text-red-700 dark:text-red-300" />
              Panel de Seguridad
            </h2>
            <p className="text-red-700/90 dark:text-red-300/90 mt-1">Monitoreo y auditorÃ­a de eventos de seguridad</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={isLoading}
              className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Actualizar
            </Button>
            <Button 
              onClick={handleExport}
              disabled={isLoading || filteredLogs.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button
              variant="outline"
              onClick={resetFilters}
              disabled={isLoading}
            >
              <FilterX className="h-4 w-4 mr-2" />
              Limpiar filtros
            </Button>
          </div>
        </div>
      </div>

      {/* EstadÃ­sticas de Seguridad */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 shadow dark:shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Total de Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {isLoading ? '-' : stats.totalEvents}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">PerÃ­odo seleccionado</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800 shadow dark:shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Eventos CrÃ­ticos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {isLoading ? '-' : stats.criticalEvents}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400">Requieren atenciÃ³n inmediata</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-orange-200 dark:border-orange-800 shadow dark:shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">Eventos de Alto Riesgo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {isLoading ? '-' : stats.highRiskEvents}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">Eventos de alta prioridad</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800 shadow dark:shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Intentos Fallidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {isLoading ? '-' : stats.failedAttempts}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400">Accesos denegados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500 dark:text-red-400" />
                <Input
                  placeholder="Buscar eventos, usuarios o IPs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-red-200 focus:border-red-500 focus:ring-red-500 dark:bg-gray-900 dark:border-red-900 dark:placeholder-gray-400"
                />
              </div>
            </div>
            
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-40 border-orange-200 focus:border-orange-500 focus:ring-orange-500 dark:bg-gray-900 dark:border-orange-900">
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las severidades</SelectItem>
                <SelectItem value="low">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    Baja
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
                    Media
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mr-2" />
                    Alta
                  </div>
                </SelectItem>
                <SelectItem value="critical">
                  <div className="flex items-center">
                    <XCircle className="h-4 w-4 text-red-600 mr-2" />
                    CrÃ­tica
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-full sm:w-40 border-purple-200 focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-900 dark:border-purple-900">
                <SelectValue placeholder="PerÃ­odo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Ãšltima hora</SelectItem>
                <SelectItem value="24h">Ãšltimas 24 horas</SelectItem>
                <SelectItem value="7d">Ãšltimos 7 dÃ­as</SelectItem>
                <SelectItem value="30d">Ãšltimos 30 dÃ­as</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtros avanzados: Usuario */}
            {uniqueUsers.length > 0 && (
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-full sm:w-40 border-blue-200 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:border-blue-900">
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {uniqueUsers.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Filtros avanzados: UbicaciÃ³n/IP */}
            {uniqueLocations.length > 0 && (
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full sm:w-48 border-teal-200 focus:border-teal-500 focus:ring-teal-500 dark:bg-gray-900 dark:border-teal-900">
                  <SelectValue placeholder="UbicaciÃ³n/IP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ubicaciones</SelectItem>
                  {uniqueLocations.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Logs de Seguridad */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="dark:text-gray-100 flex items-center justify-between gap-2">
            <span>Registro de Eventos ({isLoading ? '...' : filteredLogs.length})</span>
            {!isLoading && filteredLogs.length > 0 && (
              <Badge variant="secondary">
                PÃ¡gina {currentPage} de {totalPages}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Cargando logs de seguridad...</span>
            </div>
          ) : (
            <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="dark:border-gray-700 hover:bg-transparent">
                  <TableHead className="dark:text-gray-400">Evento</TableHead>
                  <TableHead className="dark:text-gray-400">Usuario</TableHead>
                  <TableHead className="dark:text-gray-400">UbicaciÃ³n</TableHead>
                  <TableHead className="dark:text-gray-400">Severidad</TableHead>
                  <TableHead className="dark:text-gray-400">Fecha/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log) => {
                  const { date, time } = formatTimestamp(log.timestamp)
                  return (
                    <TableRow key={log.id} className="dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          {getEventIcon(log.event)}
                          <div>
                            <div className="font-medium dark:text-gray-200">{log.event}</div>
                            {log.details && (
                              <div className="text-sm text-muted-foreground dark:text-gray-400">{log.details}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground dark:text-gray-500" />
                          <span className="font-mono text-sm dark:text-gray-300">{log.user}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-muted-foreground dark:text-gray-500" />
                          <span className="font-mono text-sm dark:text-gray-300">{log.ip}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(log.severity)}>
                          <span className="flex items-center space-x-1">
                            {getSeverityIcon(log.severity)}
                            <span className="capitalize">{log.severity}</span>
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground dark:text-gray-500" />
                          <div className="text-sm">
                            <div className="dark:text-gray-300">{date}</div>
                            <div className="text-muted-foreground dark:text-gray-500">{time}</div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          )}
          
          {!isLoading && filteredLogs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground dark:text-gray-400">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron eventos de seguridad con los filtros aplicados</p>
            </div>
          )}
          {!isLoading && filteredLogs.length > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} de {filteredLogs.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

