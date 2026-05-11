'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SalesChart } from '@/components/dashboard/sales-chart'
import { RepairsChart } from '@/components/dashboard/repairs-chart'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import {
  Users, Shield, Globe, Database, Settings,
  BarChart3, AlertTriangle, TrendingUp, Clock, Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminHome() {
  const { repairs } = useRepairs()
  const { user } = useAuth()

  // Real-time metrics from repairs data
  const metrics = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const active = repairs.filter(r => !['entregado', 'cancelado'].includes(r.status || ''))
    const urgent = repairs.filter(r => r.urgency === 'urgent' && !['entregado', 'cancelado'].includes(r.status || ''))
    const todayRepairs = repairs.filter(r => new Date(r.createdAt) >= today)
    const pending = repairs.filter(r => r.status === 'recibido')

    return {
      totalActive: active.length,
      urgent: urgent.length,
      today: todayRepairs.length,
      pending: pending.length,
    }
  }, [repairs])

  const navSections = [
    { title: 'Usuarios', description: 'Gestión de cuentas y roles', icon: Users, href: '/admin/users', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { title: 'Sitio Web', description: 'Configuración pública', icon: Globe, href: '/admin/website', color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
    { title: 'Seguridad', description: 'Auditoría y accesos', icon: Shield, href: '/admin/security', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
    { title: 'Base de Datos', description: 'Monitoreo y salud', icon: Database, href: '/admin/database-monitoring', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/30' },
    { title: 'Reportes', description: 'Analíticas y métricas', icon: BarChart3, href: '/admin/analytics', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { title: 'Configuración', description: 'Ajustes del sistema', icon: Settings, href: '/admin/settings', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Panel de Administración
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Bienvenido, {user?.profile?.name || user?.email?.split('@')[0] || 'Admin'}
        </p>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Reparaciones Activas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-1">{metrics.totalActive}</p>
              </div>
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Urgentes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-1">{metrics.urgent}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            {metrics.urgent > 0 && (
              <Badge variant="destructive" className="mt-2 text-[10px]">Requieren atención</Badge>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Ingresadas Hoy</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-1">{metrics.today}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Pendientes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-1">{metrics.pending}</p>
              </div>
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {navSections.map((section) => {
          const Icon = section.icon
          return (
            <Link key={section.href} href={section.href}>
              <Card className="hover:shadow-md transition-shadow h-full border border-gray-200 dark:border-slate-800">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-lg', section.bg)}>
                    <Icon className={cn('h-5 w-5', section.color)} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{section.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{section.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-gray-200 dark:border-slate-800 shadow-sm min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventas</CardTitle>
            <CardDescription>Tendencia semanal</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <SalesChart />
          </CardContent>
        </Card>
        <Card className="border border-gray-200 dark:border-slate-800 shadow-sm min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reparaciones</CardTitle>
            <CardDescription>Distribución por estado</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <RepairsChart />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
