'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AreaChart } from 'recharts/es6/chart/AreaChart';
import { Area } from 'recharts/es6/cartesian/Area';
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { PieChart } from 'recharts/es6/chart/PieChart';
import { Pie } from 'recharts/es6/polar/Pie';
import { Cell } from 'recharts/es6/component/Cell';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import {
  TrendingUp,
  Wrench,
  DollarSign,
  Clock,
  Activity,
  Users,
  CheckCircle2,
  Download
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { useRepairs } from '@/contexts/RepairsContext'
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

interface RepairAnalyticsDashboardProps {
  className?: string
}

export function RepairAnalyticsDashboard({ className }: RepairAnalyticsDashboardProps) {
  const { repairs, isLoading } = useRepairs()
  const [timeRange, setTimeRange] = useState('6months')

  // Funciones auxiliares para etiquetas (movidas antes del useMemo)
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'recibido': 'Recibido',
      'diagnostico': 'En Diagnóstico',
      'reparacion': 'En Reparación',
      'pausado': 'Pausado',
      'listo': 'Listo',
      'entregado': 'Entregado',
      'cancelado': 'Cancelado'
    }
    return labels[status] || status
  }

  const getDeviceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'smartphone': 'Smartphones',
      'tablet': 'Tablets',
      'laptop': 'Laptops',
      'desktop': 'Desktops',
      'accessory': 'Accesorios'
    }
    return labels[type] || type
  }

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      'low': 'Baja',
      'medium': 'Media',
      'high': 'Alta'
    }
    return labels[priority] || priority
  }

  const analytics = useMemo(() => {
    const now = new Date()
    
    // Pre-calcular fechas para optimización
    const monthCount = timeRange === '12months' ? 12 : 6
    const monthRanges = Array.from({ length: monthCount }, (_, i) => {
      const monthDate = subMonths(now, monthCount - 1 - i)
      return {
        date: monthDate,
        start: startOfMonth(monthDate),
        end: endOfMonth(monthDate),
        monthShort: format(monthDate, 'MMM', { locale: es }),
        month: format(monthDate, 'MMM yyyy', { locale: es })
      }
    })
    
    // Optimizar filtrado con Map para mejor rendimiento
    const repairsByMonth = new Map()
    const completedByMonth = new Map()
    
    repairs.forEach(repair => {
      const repairDate = new Date(repair.createdAt)
      const monthKey = format(repairDate, 'yyyy-MM')
      
      if (!repairsByMonth.has(monthKey)) {
        repairsByMonth.set(monthKey, [])
        completedByMonth.set(monthKey, [])
      }
      
      repairsByMonth.get(monthKey).push(repair)
      if (repair.dbStatus === 'entregado') {
        completedByMonth.get(monthKey).push(repair)
      }
    })
    
    // Generar datos mensuales optimizado
    const months = monthRanges.map(range => {
      const monthKey = format(range.date, 'yyyy-MM')
      const monthRepairs = repairsByMonth.get(monthKey) || []
      const completedRepairs = completedByMonth.get(monthKey) || []
      
      const revenue = completedRepairs.reduce((sum: number, r: any) => sum + (r.finalCost || r.estimatedCost), 0)
      
      let avgRepairTime = 0
      if (completedRepairs.length > 0) {
        const totalTime = completedRepairs.reduce((sum: number, r: any) => {
          if (r.completedAt && r.createdAt) {
            return sum + differenceInDays(new Date(r.completedAt), new Date(r.createdAt))
          }
          return sum
        }, 0)
        avgRepairTime = totalTime / completedRepairs.length
      }
      
      return {
        month: range.month,
        monthShort: range.monthShort,
        totalRepairs: monthRepairs.length,
        completedRepairs: completedRepairs.length,
        revenue,
        avgRepairTime
      }
    })

    // Análisis por estado
    const statusAnalysis = repairs.reduce((acc, repair) => {
      const status = repair.dbStatus || 'unknown'
      if (!acc[status]) {
        acc[status] = { name: getStatusLabel(status), count: 0, revenue: 0 }
      }
      acc[status].count++
      acc[status].revenue += repair.finalCost || repair.estimatedCost || 0
      return acc
    }, {} as Record<string, { name: string; count: number; revenue: number }>)

    // Análisis por técnico
    const technicianAnalysis = repairs.reduce((acc, repair) => {
      const technicianName = repair.technician?.name || 'Sin asignar'
      if (!acc[technicianName]) {
        acc[technicianName] = {
          name: technicianName,
          totalRepairs: 0,
          completedRepairs: 0,
          revenue: 0,
          avgTime: 0,
          totalTime: 0
        }
      }
      acc[technicianName].totalRepairs++
      if (repair.dbStatus === 'entregado') {
        acc[technicianName].completedRepairs++
        acc[technicianName].revenue += repair.finalCost || repair.estimatedCost || 0
        
        if (repair.completedAt && repair.createdAt) {
          const days = differenceInDays(new Date(repair.completedAt), new Date(repair.createdAt))
          acc[technicianName].totalTime += days
        }
      }
      return acc
    }, {} as Record<string, { name: string; totalRepairs: number; completedRepairs: number; revenue: number; avgTime: number; totalTime: number }>)

    // Calcular tiempo promedio por técnico
    Object.values(technicianAnalysis).forEach(tech => {
      tech.avgTime = tech.completedRepairs > 0 ? tech.totalTime / tech.completedRepairs : 0
    })

    // Análisis por tipo de dispositivo
    const deviceTypeAnalysis = repairs.reduce((acc, repair) => {
      const type = repair.deviceType || 'unknown'
      if (!acc[type]) {
        acc[type] = { name: getDeviceTypeLabel(type), count: 0, revenue: 0 }
      }
      acc[type].count++
      acc[type].revenue += repair.finalCost || repair.estimatedCost || 0
      return acc
    }, {} as Record<string, { name: string; count: number; revenue: number }>)

    // Análisis por prioridad
    const priorityAnalysis = repairs.reduce((acc, repair) => {
      const priority = repair.priority || 'medium'
      if (!acc[priority]) {
        acc[priority] = { name: getPriorityLabel(priority), count: 0, avgTime: 0, totalTime: 0 }
      }
      acc[priority].count++
      
      if (repair.completedAt && repair.createdAt) {
        const days = differenceInDays(new Date(repair.completedAt), new Date(repair.createdAt))
        acc[priority].totalTime += days
      }
      return acc
    }, {} as Record<string, { name: string; count: number; avgTime: number; totalTime: number }>)

    // Calcular tiempo promedio por prioridad
    Object.values(priorityAnalysis).forEach(priority => {
      priority.avgTime = priority.count > 0 ? priority.totalTime / priority.count : 0
    })

    // Métricas generales
    const totalRepairs = repairs.length
    const completedRepairs = repairs.filter(r => r.dbStatus === 'entregado').length
    const inProgressRepairs = repairs.filter(r => 
      ['recibido', 'diagnostico', 'reparacion', 'pausado'].includes(r.dbStatus || '')
    ).length
    const totalRevenue = repairs.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost || 0), 0)
    const avgRepairValue = totalRepairs > 0 ? totalRevenue / totalRepairs : 0
    const completionRate = totalRepairs > 0 ? (completedRepairs / totalRepairs) * 100 : 0
    
    // Tiempo promedio de reparación
    const completedWithTime = repairs.filter(r => r.dbStatus === 'entregado' && r.completedAt && r.createdAt)
    const avgRepairTime = completedWithTime.length > 0
      ? completedWithTime.reduce((sum, r) => {
          return sum + differenceInDays(new Date(r.completedAt!), new Date(r.createdAt))
        }, 0) / completedWithTime.length
      : 0

    return {
      months,
      statusAnalysis: Object.values(statusAnalysis),
      technicianAnalysis: Object.values(technicianAnalysis).sort((a, b) => b.completedRepairs - a.completedRepairs),
      deviceTypeAnalysis: Object.values(deviceTypeAnalysis).sort((a, b) => b.count - a.count),
      priorityAnalysis: Object.values(priorityAnalysis),
      metrics: {
        totalRepairs,
        completedRepairs,
        inProgressRepairs,
        totalRevenue,
        avgRepairValue,
        completionRate,
        avgRepairTime,
        urgentRepairs: repairs.filter(r => r.urgency === 'urgent').length
      }
    }
  }, [repairs, timeRange])

  const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('Revenue') || entry.name.includes('Ingresos') ? (
                <span className="flex items-center gap-1">
                  <GSIcon className="h-3 w-3" />
                  {entry.value.toLocaleString()}
                </span>
              ) : entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const exportData = () => {
    const csvData = repairs.map(repair => ({
      ID: repair.id,
      Cliente: repair.customer.name,
      Dispositivo: `${repair.brand} ${repair.model}`,
      Tipo: repair.deviceType,
      Estado: getStatusLabel(repair.dbStatus || ''),
      Prioridad: getPriorityLabel(repair.priority),
      Técnico: repair.technician?.name || 'Sin asignar',
      'Costo Final': repair.finalCost || repair.estimatedCost || 0,
      'Fecha Creación': format(new Date(repair.createdAt), 'dd/MM/yyyy'),
      'Fecha Completado': repair.completedAt ? format(new Date(repair.completedAt), 'dd/MM/yyyy') : ''
    }))

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `repairs_analytics_${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    
    toast.success('Datos exportados exitosamente')
  }

  if (isLoading) {
    return <div className="p-8 text-center">Cargando analytics...</div>
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics de Reparaciones</h1>
          <p className="text-muted-foreground">
            Análisis detallado del rendimiento y métricas de reparaciones
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6months">Últimos 6 meses</SelectItem>
              <SelectItem value="12months">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-pink-400 via-red-400 to-yellow-400 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Total Reparaciones
            </CardTitle>
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <Wrench className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1">
              {analytics.metrics.totalRepairs}
            </div>
            <p className="text-xs text-white/80">
              {analytics.metrics.inProgressRepairs} en progreso
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Tasa de Completado
            </CardTitle>
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1">
              {Math.round(analytics.metrics.completionRate)}%
            </div>
            <p className="text-xs text-white/80">
              {analytics.metrics.completedRepairs} completadas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-400 via-pink-500 to-red-500 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Tiempo Promedio
            </CardTitle>
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <Clock className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1">
              {Math.round(analytics.metrics.avgRepairTime)} días
            </div>
            <p className="text-xs text-white/80">
              Por reparación
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-700 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Ingresos Totales
            </CardTitle>
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1 flex items-center gap-1">
              <GSIcon className="h-5 w-5" />
              {analytics.metrics.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-white/80">
              Promedio: {Math.round(analytics.metrics.avgRepairValue).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principales */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tendencia temporal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendencias Temporales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.months}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="monthShort" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="totalRepairs"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name="Total Reparaciones"
                />
                <Area
                  type="monotone"
                  dataKey="completedRepairs"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name="Completadas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribución por estado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Distribución por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.statusAnalysis}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {analytics.statusAnalysis.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Análisis detallado */}
      <Tabs defaultValue="technicians" className="w-full">
        <TabsList>
          <TabsTrigger value="technicians">Técnicos</TabsTrigger>
          <TabsTrigger value="devices">Dispositivos</TabsTrigger>
          <TabsTrigger value="priority">Prioridades</TabsTrigger>
          <TabsTrigger value="revenue">Ingresos</TabsTrigger>
        </TabsList>

        <TabsContent value="technicians" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Rendimiento por Técnico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.technicianAnalysis.map((tech, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {tech.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium">{tech.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {tech.completedRepairs} de {tech.totalRepairs} completadas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold flex items-center gap-1">
                        <GSIcon className="h-4 w-4" />
                        {tech.revenue.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {Math.round(tech.avgTime)} días promedio
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reparaciones por Tipo de Dispositivo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.deviceTypeAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Cantidad" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="priority" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis por Prioridad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {analytics.priorityAnalysis.map((priority, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{priority.name}</h3>
                      <Badge variant={
                        priority.name === 'Alta' ? 'destructive' :
                        priority.name === 'Media' ? 'default' : 'secondary'
                      }>
                        {priority.count}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Tiempo promedio: {Math.round(priority.avgTime)} días
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos por Mes</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.months}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="monthShort" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Ingresos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}