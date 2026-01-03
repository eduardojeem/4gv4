"use client"

import React, { useState, useEffect, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Users, Activity, TrendingUp, TrendingDown, 
  RefreshCw, Download, AlertTriangle, CheckCircle, Clock
} from 'lucide-react'
import { LineChart as RechartsLineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { SystemMetrics } from '@/hooks/use-admin-dashboard'
import { GSIcon } from '@/components/ui/standardized-components'
import { formatCurrency } from '@/lib/currency'
import { 
  StandardGrid, 
  KPICard, 
  SectionHeader, 
  Container, 
  FlexContainer, 
  IconWrapper 
} from '@/components/ui/standardized-components'

interface EnhancedOverviewProps {
  metrics: SystemMetrics
  users: any[]
  securityLogs: any[]
}

// Datos simplificados para el gráfico principal
const salesData = [
  { name: 'Ene', ventas: 4000 },
  { name: 'Feb', ventas: 3000 },
  { name: 'Mar', ventas: 2000 },
  { name: 'Abr', ventas: 2780 },
  { name: 'May', ventas: 1890 },
  { name: 'Jun', ventas: 2390 },
  { name: 'Jul', ventas: 3490 }
]

// Actividades críticas únicamente
const criticalActivities = [
  { id: 1, user: 'Juan Pérez', action: 'Venta completada', amount: 150000, time: '2 min', type: 'success' },
  { id: 2, user: 'Sistema', action: 'Alerta de stock bajo', time: '5 min', type: 'warning' },
  { id: 3, user: 'María García', action: 'Acceso administrativo', time: '8 min', type: 'info' }
]

// Alertas esenciales
const systemAlerts = [
  { id: 1, type: 'warning', message: 'Stock bajo en 3 productos', priority: 'high' },
  { id: 2, type: 'error', message: 'Intentos de acceso fallidos detectados', priority: 'high' }
]

function EnhancedOverviewComponent({ metrics, users, securityLogs }: EnhancedOverviewProps) {
  const [timeRange, setTimeRange] = useState('7d')
  const [isRealTime, setIsRealTime] = useState(true)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [salesData, setSalesData] = useState<ChartData[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const supabase = createClient()

  useEffect(() => {
    setIsClient(true)
    setCurrentTime(new Date())
    
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Sales for Chart
        const { data: sales } = await supabase
          .from('sales')
          .select('created_at, total_amount')
          .order('created_at', { ascending: true })

        if (sales) {
          const groupedSales: Record<string, number> = {}
          sales.forEach(sale => {
            const date = new Date(sale.created_at)
            const monthName = format(date, 'MMM', { locale: es })
            groupedSales[monthName] = (groupedSales[monthName] || 0) + (sale.total_amount || 0)
          })

          const chartData = Object.entries(groupedSales).map(([name, ventas]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            ventas
          }))
          setSalesData(chartData)
        }

        // Fetch Recent Activities (Sales)
        const { data: recentSales } = await supabase
          .from('sales')
          .select('id, created_at, total_amount, client:clients(name)')
          .order('created_at', { ascending: false })
          .limit(5)

        if (recentSales) {
          const newActivities: ActivityItem[] = recentSales.map(sale => ({
            id: sale.id,
            user: sale.client?.name || 'Cliente Casual',
            action: 'Venta completada',
            amount: sale.total_amount,
            time: format(new Date(sale.created_at), 'HH:mm', { locale: es }),
            type: 'success'
          }))
          setActivities(newActivities)
        }

        // Fetch Alerts (Low Stock)
        const { data: lowStockProducts } = await supabase
          .from('products')
          .select('id, name, stock_quantity, min_stock')
          
        if (lowStockProducts) {
          const stockAlerts = lowStockProducts
            .filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0))
            .map(p => ({
              id: p.id,
              type: 'warning' as const,
              message: `Stock bajo: ${p.name} (${p.stock_quantity})`,
              priority: 'high' as const
            }))
            .slice(0, 5)
          setAlerts(stockAlerts)
        }

      } catch (error) {
        console.error('Error fetching overview data:', error)
      }
    }

    fetchData()
  }, [])

  

  return (
    <Container variant="section" className="min-h-screen bg-gray-50 p-6">
      <Container variant="content" maxWidth="2xl" className="mx-auto space-y-8">
        
        {/* Header minimalista */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
          <CardContent className="p-6">
            <FlexContainer 
              direction="col" 
              className="lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0"
            >
              <SectionHeader
                title="Panel de Administración"
                description="Resumen ejecutivo y métricas clave"
              />
              
              <FlexContainer 
                direction="col" 
                className="sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4"
              >
                <FlexContainer variant="tight" className="text-sm text-gray-600">
                  <IconWrapper size="sm">
                    <Clock />
                  </IconWrapper>
                  <span>
                    {isClient && currentTime ? currentTime.toLocaleTimeString('es-ES') : '--:--:--'}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${isRealTime ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                </FlexContainer>
                
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1d">Hoy</SelectItem>
                    <SelectItem value="7d">7 días</SelectItem>
                    <SelectItem value="30d">30 días</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsRealTime(!isRealTime)}
                >
                  <FlexContainer variant="tight">
                    <IconWrapper size="sm">
                      <RefreshCw className={isRealTime ? 'animate-spin' : ''} />
                    </IconWrapper>
                    <span>{isRealTime ? 'Pausar' : 'Reanudar'}</span>
                  </FlexContainer>
                </Button>
                
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <FlexContainer variant="tight">
                    <IconWrapper size="sm">
                      <Download />
                    </IconWrapper>
                    <span>Exportar</span>
                  </FlexContainer>
                </Button>
              </FlexContainer>
            </FlexContainer>
          </CardContent>
        </Card>

        {/* KPIs esenciales - Solo 3 métricas críticas */}
        <StandardGrid variant="kpi" gap="normal">
          {[
            {
              title: "Usuarios Activos",
              value: metrics.totalUsers.toLocaleString(),
              change: "+12%",
              trend: "up",
              icon: Users,
              color: "blue"
            },
            {
              title: "Ingresos del Mes",
              value: formatCurrency(metrics.totalSales),
              change: "+8%",
              trend: "up",
              icon: GSIcon,
              color: "green"
            },
            {
              title: "Estado del Sistema",
              value: `${metrics.systemHealth.toFixed(1)}%`,
              change: metrics.systemHealth >= 95 ? "+1%" : "-2%",
              trend: metrics.systemHealth >= 95 ? "up" : "down",
              icon: Activity,
              color: metrics.systemHealth >= 95 ? "green" : "red"
            }
          ].map((kpi, index) => (
            <KPICard
              key={index}
              title={kpi.title}
              value={kpi.value}
              icon={<kpi.icon />}
              trend={{
                value: parseFloat(kpi.change.replace('%', '').replace('+', '')),
                isPositive: kpi.trend === 'up'
              }}
              variant="standard"
            />
          ))}
        </StandardGrid>

        {/* Gráfico principal simplificado */}
        <Card className="bg-white border border-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Tendencia de Ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ventas" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sección inferior: Actividad reciente y Alertas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Actividad reciente crítica */}
          <Card className="bg-white border border-gray-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {criticalActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.type === 'success' ? 'bg-green-500' :
                        activity.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                        <p className="text-xs text-gray-600">{activity.user}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{activity.time}</p>
                      {activity.amount && (
                        <p className="text-sm font-medium text-green-600">
                          {formatCurrency(activity.amount)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alertas del sistema esenciales */}
          <Card className="bg-white border border-gray-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Alertas del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemAlerts.map((alert) => (
                  <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${
                    alert.type === 'warning' ? 'bg-yellow-50 border-yellow-400' : 'bg-red-50 border-red-400'
                  }`}>
                    <div className="flex items-center space-x-3">
                      {alert.type === 'warning' ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          alert.type === 'warning' ? 'text-yellow-800' : 'text-red-800'
                        }`}>
                          {alert.message}
                        </p>
                        <Badge variant={alert.type === 'warning' ? 'secondary' : 'destructive'} className="mt-1">
                          Prioridad {alert.priority === 'high' ? 'Alta' : 'Media'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Container>
  )
}

export default memo(EnhancedOverviewComponent)
