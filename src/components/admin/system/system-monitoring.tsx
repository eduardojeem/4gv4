"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  Activity, Cpu, HardDrive, Wifi, Database, Server, 
  AlertTriangle, CheckCircle, XCircle, Clock, Users,
  TrendingUp, TrendingDown, Zap, Thermometer, 
  RefreshCw, Settings, Download, Eye, BarChart3,
  Globe, Shield, MemoryStick, Network, Timer
} from 'lucide-react'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface SystemMetric {
  id: string
  name: string
  value: number
  unit: string
  status: 'normal' | 'warning' | 'critical'
  threshold: { warning: number; critical: number }
  history: { time: string; value: number }[]
}

interface Service {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error' | 'warning'
  uptime: string
  cpu: number
  memory: number
  port?: number
  lastCheck: Date
}

interface Alert {
  id: string
  type: 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
  resolved: boolean
  service?: string
}

// Datos mock con simulación en tiempo real
const generateMockData = () => {
  const now = new Date()
  const history = Array.from({ length: 20 }, (_, i) => ({
    time: new Date(now.getTime() - (19 - i) * 60000).toLocaleTimeString(),
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    disk: Math.random() * 100,
    network: Math.random() * 1000,
    requests: Math.floor(Math.random() * 500),
    users: Math.floor(Math.random() * 100)
  }))

  return history
}

const mockServices: Service[] = [
  {
    id: '1',
    name: 'API Server',
    status: 'running',
    uptime: '15d 8h 23m',
    cpu: 45.2,
    memory: 67.8,
    port: 3000,
    lastCheck: new Date()
  },
  {
    id: '2',
    name: 'Database',
    status: 'running',
    uptime: '15d 8h 23m',
    cpu: 23.1,
    memory: 78.9,
    port: 5432,
    lastCheck: new Date()
  },
  {
    id: '3',
    name: 'Redis Cache',
    status: 'running',
    uptime: '15d 8h 23m',
    cpu: 12.5,
    memory: 34.2,
    port: 6379,
    lastCheck: new Date()
  },
  {
    id: '4',
    name: 'File Storage',
    status: 'warning' as any, // TODO: Update Service type to include 'warning'
    uptime: '2d 14h 45m',
    cpu: 8.7,
    memory: 89.3,
    port: 9000,
    lastCheck: new Date()
  },
  {
    id: '5',
    name: 'Email Service',
    status: 'error',
    uptime: '0m',
    cpu: 0,
    memory: 0,
    port: 587,
    lastCheck: new Date(Date.now() - 300000)
  }
]

const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'error',
    title: 'Servicio de Email Caído',
    message: 'El servicio de email no responde desde hace 5 minutos',
    timestamp: new Date(Date.now() - 300000),
    resolved: false,
    service: 'Email Service'
  },
  {
    id: '2',
    type: 'warning',
    title: 'Alto Uso de Memoria',
    message: 'El servicio de almacenamiento está usando 89% de memoria',
    timestamp: new Date(Date.now() - 600000),
    resolved: false,
    service: 'File Storage'
  },
  {
    id: '3',
    type: 'warning',
    title: 'Disco Casi Lleno',
    message: 'El disco principal está al 85% de capacidad',
    timestamp: new Date(Date.now() - 900000),
    resolved: false
  },
  {
    id: '4',
    type: 'info',
    title: 'Backup Completado',
    message: 'Backup automático completado exitosamente',
    timestamp: new Date(Date.now() - 1800000),
    resolved: true
  }
]

export default function SystemMonitoring() {
  const [systemData, setSystemData] = useState(generateMockData())
  const [services] = useState<Service[]>(mockServices)
  const [alerts] = useState<Alert[]>(mockAlerts)
  const [isRealTime, setIsRealTime] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Simulación de datos en tiempo real
  useEffect(() => {
    if (!isRealTime) return

    const interval = setInterval(() => {
      setSystemData(prev => {
        const newData = [...prev.slice(1)]
        const now = new Date()
        newData.push({
          time: now.toLocaleTimeString(),
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          disk: Math.random() * 100,
          network: Math.random() * 1000,
          requests: Math.floor(Math.random() * 500),
          users: Math.floor(Math.random() * 100)
        })
        return newData
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [isRealTime])

  const currentMetrics = systemData[systemData.length - 1] || systemData[0]

  const getStatusColor = (status: string) => {
    const colors = {
      running: 'bg-green-100 text-green-800',
      stopped: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800'
    }
    return colors[status as keyof typeof colors] || colors.running
  }

  const getStatusIcon = (status: string) => {
    const icons = {
      running: <CheckCircle className="h-4 w-4" />,
      stopped: <XCircle className="h-4 w-4" />,
      error: <XCircle className="h-4 w-4" />,
      warning: <AlertTriangle className="h-4 w-4" />
    }
    return icons[status as keyof typeof icons] || icons.running
  }

  const getAlertColor = (type: string) => {
    const colors = {
      error: 'bg-red-100 text-red-800 border-red-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      info: 'bg-blue-100 text-blue-800 border-blue-200'
    }
    return colors[type as keyof typeof colors] || colors.info
  }

  const getAlertIcon = (type: string) => {
    const icons = {
      error: <XCircle className="h-4 w-4" />,
      warning: <AlertTriangle className="h-4 w-4" />,
      info: <CheckCircle className="h-4 w-4" />
    }
    return icons[type as keyof typeof icons] || icons.info
  }

  const getProgressColor = (value: number) => {
    if (value >= 90) return 'bg-red-500'
    if (value >= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const pieData = [
    { name: 'CPU', value: currentMetrics.cpu, color: '#3B82F6' },
    { name: 'Memoria', value: currentMetrics.memory, color: '#10B981' },
    { name: 'Disco', value: currentMetrics.disk, color: '#F59E0B' },
    { name: 'Red', value: currentMetrics.network / 10, color: '#8B5CF6' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center text-cyan-700">
              <Activity className="h-6 w-6 mr-2 text-cyan-600" />
              Monitoreo del Sistema
            </h2>
            <p className="text-cyan-600 mt-1">Supervisión en tiempo real del estado del sistema</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isRealTime ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">{isRealTime ? 'En vivo' : 'Pausado'}</span>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsRealTime(!isRealTime)}
              className="border-cyan-300 text-cyan-600 hover:bg-cyan-50"
            >
              {isRealTime ? <Timer className="h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {isRealTime ? 'Pausar' : 'Reanudar'}
            </Button>
            
            <Button 
              variant="outline" 
              className="border-cyan-300 text-cyan-600 hover:bg-cyan-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            
            <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </div>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-blue-50">
                <Cpu className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900">{currentMetrics.cpu.toFixed(1)}%</p>
                <p className="text-sm text-blue-600">CPU</p>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={currentMetrics.cpu} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-green-50">
                <MemoryStick className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-900">{currentMetrics.memory.toFixed(1)}%</p>
                <p className="text-sm text-green-600">Memoria</p>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={currentMetrics.memory} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-yellow-50">
                <HardDrive className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yellow-900">{currentMetrics.disk.toFixed(1)}%</p>
                <p className="text-sm text-yellow-600">Disco</p>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={currentMetrics.disk} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-purple-50">
                <Network className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-900">{currentMetrics.network.toFixed(0)}</p>
                <p className="text-sm text-purple-600">MB/s Red</p>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={(currentMetrics.network / 1000) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 bg-gradient-to-r from-cyan-100 to-blue-100 p-1">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Resumen
          </TabsTrigger>
          <TabsTrigger 
            value="services" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white"
          >
            <Server className="h-4 w-4 mr-2" />
            Servicios
          </TabsTrigger>
          <TabsTrigger 
            value="performance" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Rendimiento
          </TabsTrigger>
          <TabsTrigger 
            value="alerts" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alertas
          </TabsTrigger>
          <TabsTrigger 
            value="logs" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-500 data-[state=active]:to-gray-600 data-[state=active]:text-white"
          >
            <Eye className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Recursos */}
            <Card className="border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-800">Uso de Recursos en Tiempo Real</CardTitle>
                <CardDescription>CPU, Memoria y Disco</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={systemData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="cpu" stroke="#3B82F6" strokeWidth={2} name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="#10B981" strokeWidth={2} name="Memoria %" />
                    <Line type="monotone" dataKey="disk" stroke="#F59E0B" strokeWidth={2} name="Disco %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribución de Recursos */}
            <Card className="border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-800">Distribución Actual</CardTitle>
                <CardDescription>Uso de recursos del sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Actividad de Red */}
            <Card className="border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-800">Actividad de Red</CardTitle>
                <CardDescription>Tráfico de red y solicitudes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={systemData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="network" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} name="Red (MB/s)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Usuarios Activos */}
            <Card className="border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-800">Usuarios y Solicitudes</CardTitle>
                <CardDescription>Actividad de usuarios en tiempo real</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={systemData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="users" fill="#06B6D4" name="Usuarios Activos" />
                    <Bar dataKey="requests" fill="#EC4899" name="Solicitudes/min" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Servicios */}
        <TabsContent value="services" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Card key={service.id} className="border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center">
                      <Server className="h-5 w-5 mr-2 text-gray-600" />
                      {service.name}
                    </CardTitle>
                    <Badge className={getStatusColor(service.status)}>
                      {getStatusIcon(service.status)}
                      <span className="ml-1 capitalize">{service.status}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Uptime:</span>
                      <p className="font-medium">{service.uptime}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Puerto:</span>
                      <p className="font-medium">{service.port || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>CPU:</span>
                      <span className="font-medium">{service.cpu}%</span>
                    </div>
                    <Progress value={service.cpu} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Memoria:</span>
                      <span className="font-medium">{service.memory}%</span>
                    </div>
                    <Progress value={service.memory} className="h-2" />
                  </div>
                  
                  <div className="flex justify-between pt-3 border-t">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                      <Eye className="h-4 w-4 mr-1" />
                      Logs
                    </Button>
                    <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800">
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Reiniciar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-800">
                      <Settings className="h-4 w-4 mr-1" />
                      Config
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Rendimiento */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Métricas de Rendimiento */}
            <Card className="border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-800">Métricas de Rendimiento</CardTitle>
                <CardDescription>Indicadores clave del sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Zap className="h-8 w-8 text-blue-600" />
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-900">98.5%</p>
                        <p className="text-sm text-blue-600">Disponibilidad</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Clock className="h-8 w-8 text-green-600" />
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-900">245ms</p>
                        <p className="text-sm text-green-600">Latencia</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <TrendingUp className="h-8 w-8 text-yellow-600" />
                      <div className="text-right">
                        <p className="text-2xl font-bold text-yellow-900">1,247</p>
                        <p className="text-sm text-yellow-600">Req/min</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Thermometer className="h-8 w-8 text-purple-600" />
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-900">42°C</p>
                        <p className="text-sm text-purple-600">Temperatura</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tendencias */}
            <Card className="border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-800">Tendencias de Uso</CardTitle>
                <CardDescription>Comparación con períodos anteriores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                      <span className="text-sm font-medium">CPU promedio</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-green-600">+5.2%</span>
                      <p className="text-xs text-gray-500">vs. semana anterior</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
                      <span className="text-sm font-medium">Memoria libre</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-red-600">-12.8%</span>
                      <p className="text-xs text-gray-500">vs. semana anterior</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium">Tráfico de red</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-blue-600">+23.1%</span>
                      <p className="text-xs text-gray-500">vs. semana anterior</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Alertas */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="space-y-4">
            {alerts.map((alert) => (
              <Card key={alert.id} className={`border-2 shadow-lg ${getAlertColor(alert.type)} ${alert.resolved ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="mt-1">
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>{alert.timestamp.toLocaleString()}</span>
                          {alert.service && <span>Servicio: {alert.service}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {alert.resolved ? (
                        <Badge className="bg-green-100 text-green-800">Resuelto</Badge>
                      ) : (
                        <Button size="sm" variant="outline">
                          Resolver
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Logs */}
        <TabsContent value="logs" className="space-y-6">
          <Card className="border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-gray-800">Logs del Sistema</CardTitle>
              <CardDescription>Registro de eventos y actividades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
                <div className="space-y-1">
                  <div>[2024-01-15 10:30:15] INFO: Sistema iniciado correctamente</div>
                  <div>[2024-01-15 10:30:16] INFO: Conectando a base de datos...</div>
                  <div>[2024-01-15 10:30:17] INFO: Base de datos conectada exitosamente</div>
                  <div>[2024-01-15 10:30:18] INFO: Servidor API iniciado en puerto 3000</div>
                  <div>[2024-01-15 10:30:19] INFO: Cache Redis conectado</div>
                  <div>[2024-01-15 10:35:22] WARN: Alto uso de memoria detectado (89%)</div>
                  <div>[2024-01-15 10:40:15] ERROR: Fallo en conexión SMTP</div>
                  <div>[2024-01-15 10:40:16] INFO: Reintentando conexión SMTP...</div>
                  <div>[2024-01-15 10:40:17] ERROR: Conexión SMTP falló después de 3 intentos</div>
                  <div>[2024-01-15 10:45:30] INFO: Backup automático iniciado</div>
                  <div>[2024-01-15 10:47:45] INFO: Backup completado exitosamente</div>
                  <div>[2024-01-15 10:50:12] WARN: Disco principal al 85% de capacidad</div>
                  <div>[2024-01-15 10:55:33] INFO: Usuario admin@empresa.com autenticado</div>
                  <div>[2024-01-15 11:00:00] INFO: Limpieza automática de logs completada</div>
                  <div className="text-yellow-400">[2024-01-15 11:05:15] WARN: Servicio de almacenamiento respondiendo lentamente</div>
                  <div className="text-red-400">[2024-01-15 11:10:22] ERROR: Servicio de email no responde</div>
                  <div>[2024-01-15 11:15:30] INFO: Monitoreo de sistema actualizado</div>
                  <div className="animate-pulse">[2024-01-15 11:20:45] INFO: Sistema funcionando normalmente</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}