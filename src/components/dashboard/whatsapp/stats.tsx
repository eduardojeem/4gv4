'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, TrendingUp, Users, MessageCircle, Calendar, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import {
  DashboardWhatsAppChartPoint,
  DashboardWhatsAppStats,
  fetchDashboardWhatsAppStats,
  subscribeDashboardWhatsAppUpdates,
} from '@/lib/dashboard-whatsapp-api'

const EMPTY_STATS: DashboardWhatsAppStats = {
  total: 0,
  today: 0,
  thisWeek: 0,
  thisMonth: 0,
  uniqueContacts: 0,
  avgPerDay: 0,
}

export function WhatsAppStats() {
  const [stats, setStats] = useState<DashboardWhatsAppStats>(EMPTY_STATS)
  const [chartData, setChartData] = useState<DashboardWhatsAppChartPoint[]>([])
  const [breakdown, setBreakdown] = useState<{
    byStatus: Record<string, number>
    bySource: Record<string, number>
  }>({ byStatus: {}, bySource: {} })
  const [loading, setLoading] = useState(false)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchDashboardWhatsAppStats()
      setStats(data.stats || EMPTY_STATS)
      setChartData(data.chartData || [])
      setBreakdown(data.breakdown || { byStatus: {}, bySource: {} })
    } catch (error) {
      console.error('WhatsApp stats load error:', error)
      setStats(EMPTY_STATS)
      setChartData([])
      setBreakdown({ byStatus: {}, bySource: {} })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    return subscribeDashboardWhatsAppUpdates(loadStats)
  }, [loadStats])

  const sentCount = Number(breakdown.byStatus.sent || 0)
  const failedCount = Number(breakdown.byStatus.failed || 0)

  const deliveryRate = useMemo(() => {
    if (stats.total <= 0) return 0
    return Math.round((sentCount / stats.total) * 100)
  }, [sentCount, stats.total])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mensajes</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Todos los mensajes enviados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <p className="text-xs text-muted-foreground">Mensajes enviados hoy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisWeek}</div>
            <p className="text-xs text-muted-foreground">Ultimos 7 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground">Ultimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contactos Unicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueContacts}</div>
            <p className="text-xs text-muted-foreground">Clientes diferentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio Diario</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgPerDay}</div>
            <p className="text-xs text-muted-foreground">Mensajes por dia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Entrega</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryRate}%</div>
            <p className="text-xs text-muted-foreground">{sentCount} enviados correctamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fallidos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedCount}</div>
            <p className="text-xs text-muted-foreground">Mensajes con error</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mensajes por Dia</CardTitle>
          <CardDescription>Ultimos 7 dias</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">Cargando metricas...</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="mensajes" fill="#25D366" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
