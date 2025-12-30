"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Search, Filter, Download, Eye, AlertTriangle, 
  CheckCircle, XCircle, Info, User, Settings, 
  Database, Shield, FileText, Calendar, Clock,
  Activity, Trash2, Edit, Plus, RefreshCw,
  Globe, Lock, Unlock, LogIn, LogOut, UserPlus,
  FileEdit, FilePlus, FileX, Server, Zap
} from 'lucide-react'
import { format, subDays, subHours, subMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

interface AuditLog {
  id: string
  timestamp: Date
  level: 'info' | 'warning' | 'error' | 'critical'
  category: 'auth' | 'user' | 'system' | 'security' | 'data' | 'api'
  action: string
  description: string
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
  resource?: string
  ip?: string
  userAgent?: string
  details?: Record<string, any>
  status: 'success' | 'failed' | 'pending'
}

interface SecurityEvent {
  id: string
  timestamp: Date
  type: 'login_attempt' | 'failed_login' | 'suspicious_activity' | 'data_breach' | 'unauthorized_access'
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  target?: string
  description: string
  resolved: boolean
  assignedTo?: string
}

interface SystemEvent {
  id: string
  timestamp: Date
  component: string
  event: string
  status: 'success' | 'warning' | 'error'
  duration?: number
  details: string
}

// Datos mock para logs de auditoría
const generateMockAuditLogs = (): AuditLog[] => {
  const actions = [
    { action: 'login', description: 'Usuario inició sesión', category: 'auth' as const, level: 'info' as const },
    { action: 'logout', description: 'Usuario cerró sesión', category: 'auth' as const, level: 'info' as const },
    { action: 'create_user', description: 'Nuevo usuario creado', category: 'user' as const, level: 'info' as const },
    { action: 'update_user', description: 'Usuario actualizado', category: 'user' as const, level: 'info' as const },
    { action: 'delete_user', description: 'Usuario eliminado', category: 'user' as const, level: 'warning' as const },
    { action: 'failed_login', description: 'Intento de login fallido', category: 'security' as const, level: 'warning' as const },
    { action: 'password_change', description: 'Contraseña cambiada', category: 'security' as const, level: 'info' as const },
    { action: 'data_export', description: 'Datos exportados', category: 'data' as const, level: 'info' as const },
    { action: 'system_backup', description: 'Backup del sistema', category: 'system' as const, level: 'info' as const },
    { action: 'config_change', description: 'Configuración modificada', category: 'system' as const, level: 'warning' as const },
    { action: 'api_call', description: 'Llamada a API', category: 'api' as const, level: 'info' as const },
    { action: 'unauthorized_access', description: 'Acceso no autorizado detectado', category: 'security' as const, level: 'error' as const }
  ]

  const users = [
    { id: '1', name: 'Juan Pérez', email: 'juan@empresa.com', role: 'Admin' },
    { id: '2', name: 'María García', email: 'maria@empresa.com', role: 'Manager' },
    { id: '3', name: 'Carlos López', email: 'carlos@empresa.com', role: 'User' },
    { id: '4', name: 'Ana Martínez', email: 'ana@empresa.com', role: 'Auditor' }
  ]

  const ips = ['192.168.1.100', '192.168.1.101', '10.0.0.50', '172.16.0.25', '203.0.113.45']
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
  ]

  return Array.from({ length: 50 }, (_, i) => {
    const action = actions[Math.floor(Math.random() * actions.length)]
    const user = users[Math.floor(Math.random() * users.length)]
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    
    return {
      id: `log-${i + 1}`,
      timestamp,
      level: action.level,
      category: action.category,
      action: action.action,
      description: action.description,
      user: Math.random() > 0.1 ? user : undefined,
      resource: Math.random() > 0.5 ? `/api/users/${Math.floor(Math.random() * 100)}` : undefined,
      ip: ips[Math.floor(Math.random() * ips.length)],
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      status: (Math.random() > 0.1 ? 'success' : (Math.random() > 0.5 ? 'failed' : 'pending')) as AuditLog['status'],
      details: {
        sessionId: `sess_${Math.random().toString(36).substr(2, 9)}`,
        requestId: `req_${Math.random().toString(36).substr(2, 9)}`
      }
    }
  }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

const mockSecurityEvents: SecurityEvent[] = [
  {
    id: 'sec-1',
    timestamp: subMinutes(new Date(), 15),
    type: 'failed_login',
    severity: 'medium',
    source: '203.0.113.45',
    description: 'Múltiples intentos de login fallidos desde IP sospechosa',
    resolved: false
  },
  {
    id: 'sec-2',
    timestamp: subHours(new Date(), 2),
    type: 'suspicious_activity',
    severity: 'high',
    source: '192.168.1.200',
    target: '/admin/users',
    description: 'Acceso a panel de administración desde ubicación inusual',
    resolved: true,
    assignedTo: 'security@empresa.com'
  },
  {
    id: 'sec-3',
    timestamp: subHours(new Date(), 6),
    type: 'unauthorized_access',
    severity: 'critical',
    source: '10.0.0.99',
    target: '/api/sensitive-data',
    description: 'Intento de acceso a datos sensibles sin autorización',
    resolved: false
  }
]

const mockSystemEvents: SystemEvent[] = [
  {
    id: 'sys-1',
    timestamp: subMinutes(new Date(), 5),
    component: 'Database',
    event: 'Backup Completed',
    status: 'success',
    duration: 1200,
    details: 'Backup automático completado exitosamente. Tamaño: 2.3GB'
  },
  {
    id: 'sys-2',
    timestamp: subMinutes(new Date(), 30),
    component: 'API Server',
    event: 'High Memory Usage',
    status: 'warning',
    details: 'Uso de memoria del servidor API alcanzó 85%'
  },
  {
    id: 'sys-3',
    timestamp: subHours(new Date(), 1),
    component: 'Email Service',
    event: 'Service Restart',
    status: 'error',
    duration: 45,
    details: 'Servicio de email reiniciado debido a fallo de conexión SMTP'
  }
]

export default function AuditLogs() {
  const [auditLogs] = useState<AuditLog[]>(generateMockAuditLogs())
  const [securityEvents] = useState<SecurityEvent[]>(mockSecurityEvents)
  const [systemEvents] = useState<SystemEvent[]>(mockSystemEvents)
  const [activeTab, setActiveTab] = useState('audit')
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.user?.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter
    
    let matchesDate = true
    if (dateFilter !== 'all') {
      const now = new Date()
      const logDate = log.timestamp
      switch (dateFilter) {
        case 'today':
          matchesDate = logDate >= subDays(now, 1)
          break
        case 'week':
          matchesDate = logDate >= subDays(now, 7)
          break
        case 'month':
          matchesDate = logDate >= subDays(now, 30)
          break
      }
    }
    
    return matchesSearch && matchesLevel && matchesCategory && matchesDate
  })

  const getLevelColor = (level: string) => {
    const colors = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      critical: 'bg-purple-100 text-purple-800'
    }
    return colors[level as keyof typeof colors] || colors.info
  }

  const getLevelIcon = (level: string) => {
    const icons = {
      info: <Info className="h-4 w-4" />,
      warning: <AlertTriangle className="h-4 w-4" />,
      error: <XCircle className="h-4 w-4" />,
      critical: <AlertTriangle className="h-4 w-4" />
    }
    return icons[level as keyof typeof icons] || icons.info
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      auth: 'bg-green-100 text-green-800',
      user: 'bg-blue-100 text-blue-800',
      system: 'bg-purple-100 text-purple-800',
      security: 'bg-red-100 text-red-800',
      data: 'bg-yellow-100 text-yellow-800',
      api: 'bg-indigo-100 text-indigo-800'
    }
    return colors[category as keyof typeof colors] || colors.auth
  }

  const getCategoryIcon = (category: string) => {
    const icons = {
      auth: <LogIn className="h-4 w-4" />,
      user: <User className="h-4 w-4" />,
      system: <Settings className="h-4 w-4" />,
      security: <Shield className="h-4 w-4" />,
      data: <Database className="h-4 w-4" />,
      api: <Globe className="h-4 w-4" />
    }
    return icons[category as keyof typeof icons] || icons.auth
  }

  const getStatusColor = (status: string) => {
    const colors = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    }
    return colors[status as keyof typeof colors] || colors.success
  }

  const getStatusIcon = (status: string) => {
    const icons = {
      success: <CheckCircle className="h-4 w-4" />,
      failed: <XCircle className="h-4 w-4" />,
      pending: <Clock className="h-4 w-4" />
    }
    return icons[status as keyof typeof icons] || icons.success
  }

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    }
    return colors[severity as keyof typeof colors] || colors.low
  }

  const getActionIcon = (action: string) => {
    const icons: Record<string, React.ReactNode> = {
      login: <LogIn className="h-4 w-4" />,
      logout: <LogOut className="h-4 w-4" />,
      create_user: <UserPlus className="h-4 w-4" />,
      update_user: <Edit className="h-4 w-4" />,
      delete_user: <Trash2 className="h-4 w-4" />,
      failed_login: <XCircle className="h-4 w-4" />,
      password_change: <Lock className="h-4 w-4" />,
      data_export: <Download className="h-4 w-4" />,
      system_backup: <Database className="h-4 w-4" />,
      config_change: <Settings className="h-4 w-4" />,
      api_call: <Globe className="h-4 w-4" />,
      unauthorized_access: <Shield className="h-4 w-4" />
    }
    return icons[action] || <Activity className="h-4 w-4" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-6 rounded-lg border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-600 to-gray-600 bg-clip-text text-transparent flex items-center">
              <FileText className="h-6 w-6 mr-2 text-slate-600" />
              Logs y Auditoría
            </h2>
            <p className="text-slate-600 mt-1">Sistema completo de registro y auditoría de eventos</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              className="border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            
            <Button 
              variant="outline" 
              className="border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            
            <Button className="bg-gradient-to-r from-slate-600 to-gray-600 hover:from-slate-700 hover:to-gray-700 text-white">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-gray-200 shadow-lg">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar en logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500">
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los niveles</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value="auth">Autenticación</SelectItem>
                <SelectItem value="user">Usuarios</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
                <SelectItem value="security">Seguridad</SelectItem>
                <SelectItem value="data">Datos</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                <SelectValue placeholder="Fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las fechas</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mes</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('')
                setLevelFilter('all')
                setCategoryFilter('all')
                setDateFilter('all')
              }}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-blue-50">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900">{auditLogs.length}</p>
                <p className="text-sm text-blue-600">Total Logs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-red-50">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-900">{securityEvents.length}</p>
                <p className="text-sm text-red-600">Eventos Seguridad</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-yellow-50">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yellow-900">
                  {auditLogs.filter(log => log.level === 'warning' || log.level === 'error').length}
                </p>
                <p className="text-sm text-yellow-600">Alertas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-green-50">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-900">
                  {auditLogs.filter(log => log.status === 'success').length}
                </p>
                <p className="text-sm text-green-600">Exitosos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-slate-100 to-gray-100 p-1">
          <TabsTrigger 
            value="audit" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-500 data-[state=active]:to-slate-600 data-[state=active]:text-white"
          >
            <FileText className="h-4 w-4 mr-2" />
            Logs de Auditoría
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white"
          >
            <Shield className="h-4 w-4 mr-2" />
            Eventos de Seguridad
          </TabsTrigger>
          <TabsTrigger 
            value="system" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
          >
            <Server className="h-4 w-4 mr-2" />
            Eventos del Sistema
          </TabsTrigger>
        </TabsList>

        {/* Tab: Logs de Auditoría */}
        <TabsContent value="audit" className="space-y-4">
          <div className="space-y-4">
            {filteredAuditLogs.map((log) => (
              <Card key={log.id} className="border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="mt-1">
                        {getActionIcon(log.action)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={getLevelColor(log.level)}>
                            {getLevelIcon(log.level)}
                            <span className="ml-1 capitalize">{log.level}</span>
                          </Badge>
                          
                          <Badge className={getCategoryColor(log.category)}>
                            {getCategoryIcon(log.category)}
                            <span className="ml-1 capitalize">{log.category}</span>
                          </Badge>
                          
                          <Badge className={getStatusColor(log.status)}>
                            {getStatusIcon(log.status)}
                            <span className="ml-1 capitalize">{log.status}</span>
                          </Badge>
                        </div>
                        
                        <h4 className="font-semibold text-gray-900 mb-1">{log.description}</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Fecha:</span>
                            <p>{format(log.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: es })}</p>
                          </div>
                          
                          {log.user && (
                            <div>
                              <span className="font-medium">Usuario:</span>
                              <p>{log.user.name} ({log.user.role})</p>
                            </div>
                          )}
                          
                          {log.ip && (
                            <div>
                              <span className="font-medium">IP:</span>
                              <p>{log.ip}</p>
                            </div>
                          )}
                          
                          {log.resource && (
                            <div>
                              <span className="font-medium">Recurso:</span>
                              <p className="truncate">{log.resource}</p>
                            </div>
                          )}
                        </div>
                        
                        {log.details && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <span className="font-medium">Detalles:</span>
                            <pre className="mt-1 text-gray-600">{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Eventos de Seguridad */}
        <TabsContent value="security" className="space-y-4">
          <div className="space-y-4">
            {securityEvents.map((event) => (
              <Card key={event.id} className="border-red-200 shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="mt-1">
                        <Shield className="h-5 w-5 text-red-600" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={getSeverityColor(event.severity)}>
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            {event.severity.toUpperCase()}
                          </Badge>
                          
                          <Badge className={event.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {event.resolved ? <CheckCircle className="h-4 w-4 mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                            {event.resolved ? 'Resuelto' : 'Pendiente'}
                          </Badge>
                        </div>
                        
                        <h4 className="font-semibold text-gray-900 mb-2">{event.description}</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Tipo:</span>
                            <p className="capitalize">{event.type.replace('_', ' ')}</p>
                          </div>
                          
                          <div>
                            <span className="font-medium">Origen:</span>
                            <p>{event.source}</p>
                          </div>
                          
                          {event.target && (
                            <div>
                              <span className="font-medium">Objetivo:</span>
                              <p>{event.target}</p>
                            </div>
                          )}
                          
                          <div>
                            <span className="font-medium">Fecha:</span>
                            <p>{format(event.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: es })}</p>
                          </div>
                          
                          {event.assignedTo && (
                            <div>
                              <span className="font-medium">Asignado a:</span>
                              <p>{event.assignedTo}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {!event.resolved && (
                        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                          Resolver
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Eventos del Sistema */}
        <TabsContent value="system" className="space-y-4">
          <div className="space-y-4">
            {systemEvents.map((event) => (
              <Card key={event.id} className="border-purple-200 shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="mt-1">
                        <Server className="h-5 w-5 text-purple-600" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={getStatusColor(event.status)}>
                            {getStatusIcon(event.status)}
                            <span className="ml-1 capitalize">{event.status}</span>
                          </Badge>
                          
                          <Badge className="bg-purple-100 text-purple-800">
                            <Zap className="h-4 w-4 mr-1" />
                            {event.component}
                          </Badge>
                        </div>
                        
                        <h4 className="font-semibold text-gray-900 mb-2">{event.event}</h4>
                        <p className="text-gray-600 mb-2">{event.details}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Componente:</span>
                            <p>{event.component}</p>
                          </div>
                          
                          <div>
                            <span className="font-medium">Fecha:</span>
                            <p>{format(event.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: es })}</p>
                          </div>
                          
                          {event.duration && (
                            <div>
                              <span className="font-medium">Duración:</span>
                              <p>{event.duration}s</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}