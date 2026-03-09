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
  ChevronRight,
  Zap
} from 'lucide-react'
import { useSecurityLogs, type SecurityLog } from '@/hooks/use-security-logs'
import { useToast } from '@/components/ui/use-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'

interface SecurityPanelProps {
  // Props opcionales para compatibilidad hacia atrás
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
  
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const [locations, setLocations] = useState<Record<string, string>>({})
  const [isBlocking, setIsBlocking] = useState<string | null>(null)
  const supabase = createClient()

  // Function to fetch location from IP
  const fetchLocation = async (ip: string) => {
    if (!ip || ip === 'N/A' || locations[ip]) return
    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`)
      const data = await res.json()
      if (data && data.city) {
        setLocations(prev => ({ ...prev, [ip]: `${data.city}, ${data.country_name}` }))
      } else {
        setLocations(prev => ({ ...prev, [ip]: 'Desconocida' }))
      }
    } catch {
      setLocations(prev => ({ ...prev, [ip]: 'Error al obtener' }))
    }
  }

  // Function to block user
  const blockUser = async (userId: string | undefined) => {
    if (!userId) {
      toast({ title: "Error", description: "No se encontró el ID del usuario.", variant: "destructive" })
      return
    }
    if (!isAdmin && !isSuperAdmin) {
      toast({ title: "Sin permisos", description: "Solo los administradores pueden bloquear usuarios.", variant: "destructive" })
      return
    }
    
    try {
      setIsBlocking(userId)
      // Bloquear usuario actualizando su perfil (si tienes una columna is_active) o a través de RPC
      const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', userId)
      if (error) throw error
      
      toast({ title: "Usuario bloqueado", description: "El usuario ha sido bloqueado exitosamente." })
      fetchSecurityLogs(requestFilters)
    } catch (err: any) {
      toast({ title: "Error al bloquear", description: err.message || "No se pudo bloquear al usuario.", variant: "destructive" })
    } finally {
      setIsBlocking(null)
    }
  }

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
          translateSeverity(log.severity),
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
        title: "Exportación exitosa",
        description: "Los logs filtrados se han exportado correctamente.",
      })
    } catch (error) {
      toast({
        title: "Error de exportación",
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

  const translateSeverity = (severity: SecurityLog['severity']) => {
    switch (severity) {
      case 'low': return 'Baja'
      case 'medium': return 'Media'
      case 'high': return 'Alta'
      case 'critical': return 'Crítica'
      default: return severity
    }
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
    if (event.includes('contraseña') || event.includes('password')) return <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
      {/* Header with Glassmorphism */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card/60 backdrop-blur-md p-6 shadow-sm relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 shadow-inner">
              <Shield className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                Panel de Seguridad
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Monitoreo y auditoría de eventos en tiempo real</p>
            </div>
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
      </motion.div>

      {/* Estadísticas de Seguridad con Animaciones */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Total de Eventos', value: stats.totalEvents, subtitle: 'Período seleccionado', icon: Shield, color: 'blue' },
          { title: 'Eventos Críticos', value: stats.criticalEvents, subtitle: 'Atención inmediata', icon: AlertTriangle, color: 'red' },
          { title: 'Alto Riesgo', value: stats.highRiskEvents, subtitle: 'Alta prioridad', icon: Zap, color: 'orange' },
          { title: 'Intentos Fallidos', value: stats.failedAttempts, subtitle: 'Accesos denegados', icon: Ban, color: 'rose' }
        ].map((item, idx) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ scale: 1.02, translateY: -4 }}
            className={`
              relative overflow-hidden rounded-2xl border p-5 transition-shadow hover:shadow-lg
              ${item.color === 'blue' ? 'bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50' : ''}
              ${item.color === 'red' ? 'bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900/50' : ''}
              ${item.color === 'orange' ? 'bg-orange-50/50 border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/50' : ''}
              ${item.color === 'rose' ? 'bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50' : ''}
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <p className={`text-sm font-bold uppercase tracking-wider opacity-70`}>{item.title}</p>
              <item.icon className="h-5 w-5 opacity-50" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tabular-nums tracking-tight">
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin opacity-20" />
                ) : (
                  item.value
                )}
              </span>
            </div>
            <p className="text-xs font-medium mt-1 opacity-60">{item.subtitle}</p>
            {item.color === 'red' && !isLoading && item.value > 0 && (
              <motion.div 
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute top-0 right-0 h-2 w-2 m-4 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              />
            )}
          </motion.div>
        ))}
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
                    Crítica
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-full sm:w-40 border-purple-200 focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-900 dark:border-purple-900">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Última hora</SelectItem>
                <SelectItem value="24h">Últimas 24 horas</SelectItem>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
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

            {/* Filtros avanzados: Ubicación/IP */}
            {uniqueLocations.length > 0 && (
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full sm:w-48 border-teal-200 focus:border-teal-500 focus:ring-teal-500 dark:bg-gray-900 dark:border-teal-900">
                  <SelectValue placeholder="Ubicación/IP" />
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
                Página {currentPage} de {totalPages}
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
                  <TableHead className="dark:text-gray-400">Ubicación</TableHead>
                  <TableHead className="dark:text-gray-400">Severidad</TableHead>
                  <TableHead className="dark:text-gray-400">Fecha/Hora</TableHead>
                  <TableHead className="dark:text-gray-400 text-right">Acciones</TableHead>
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
                          <div className="flex flex-col">
                            <span className="font-mono text-sm dark:text-gray-300">{log.ip}</span>
                            {log.ip !== 'N/A' && (
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {locations[log.ip] ? (
                                  locations[log.ip]
                                ) : (
                                  <button 
                                    onClick={() => fetchLocation(log.ip)}
                                    className="text-blue-500 hover:text-blue-700 hover:underline inline-flex items-center"
                                  >
                                    Ver ubicación
                                  </button>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(log.severity)}>
                          <span className="flex items-center space-x-1">
                            {getSeverityIcon(log.severity)}
                            <span className="capitalize">{translateSeverity(log.severity)}</span>
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
                      <TableCell className="text-right">
                        {log.user_id && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-900/30"
                            onClick={() => blockUser(log.user_id)}
                            disabled={isBlocking === log.user_id || log.user_id === user?.id || (!isAdmin && !isSuperAdmin)}
                            title={
                              log.user_id === user?.id 
                                ? "No puedes bloquearte a ti mismo" 
                                : (!isAdmin && !isSuperAdmin 
                                    ? "Solo administradores pueden bloquear usuarios" 
                                    : "Bloquear usuario")
                            }
                          >
                            {isBlocking === log.user_id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Ban className="h-3 w-3 mr-1" />
                            )}
                            Bloquear
                          </Button>
                        )}
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


