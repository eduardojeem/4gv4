'use client'

import React, { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, ShoppingCart, Users, Wrench, Package, AlertTriangle } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
// Tipos locales para evitar dependencias profundas de generics de Supabase
type SaleRow = { id: string; total?: number | null; status: 'pendiente' | 'completada' | 'cancelada'; created_at: string }
type RepairRow = {
  id: string
  device_brand?: string | null
  device_model?: string | null
  status: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado'
  created_at: string
  final_cost?: number | null
}
type CustomerRow = { id: string; name?: string | null; created_at: string }

interface StatCardProps {
  title: string
  value: string
  change: string
  changeType: 'increase' | 'decrease' | 'neutral'
  icon: React.ReactNode
}

function StatCard({ title, value, change, changeType, icon }: StatCardProps) {
  const getChangeColor = () => {
    switch (changeType) {
      case 'increase':
        return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'decrease':
        return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
      default:
        return 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800'
    }
  }

  const getIconColor = () => {
    switch (changeType) {
      case 'increase':
        return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30'
      case 'decrease':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
      default:
        return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
    }
  }

  return (
    <Card className="relative overflow-hidden border-0 shadow-sm bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:shadow-md transition-all duration-200 group">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${getIconColor()}`}>
                {icon}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  {title}
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {value}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {changeType === 'increase' && <TrendingUp className="h-3 w-3 text-emerald-600" />}
              {changeType === 'decrease' && <TrendingDown className="h-3 w-3 text-red-600" />}
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${getChangeColor()}`}>
                {change}
              </span>
            </div>
          </div>
        </div>
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-slate-50/20 dark:to-slate-800/20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </CardContent>
    </Card>
  )
}

export function StatsOverview() {
  const stats = [
    {
      title: 'Ventas del Día',
      value: '$2,847',
      change: '+12% desde ayer',
      changeType: 'increase' as const,
      icon: <GSIcon className="h-4 w-4" />
    },
    {
      title: 'Órdenes Activas',
      value: '23',
      change: '+3 nuevas',
      changeType: 'increase' as const,
      icon: <ShoppingCart className="h-4 w-4" />
    },
    {
      title: 'Clientes Nuevos',
      value: '8',
      change: '+2 esta semana',
      changeType: 'increase' as const,
      icon: <Users className="h-4 w-4" />
    },
    {
      title: 'Reparaciones Pendientes',
      value: '15',
      change: '-2 desde ayer',
      changeType: 'decrease' as const,
      icon: <Wrench className="h-4 w-4" />
    },
    {
      title: 'Productos en Stock',
      value: '342',
      change: 'Stock normal',
      changeType: 'neutral' as const,
      icon: <Package className="h-4 w-4" />
    },
    {
      title: 'Stock Bajo',
      value: '7',
      change: 'Requiere atención',
      changeType: 'decrease' as const,
      icon: <AlertTriangle className="h-4 w-4" />
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          title={stat.title}
          value={stat.value}
          change={stat.change}
          changeType={stat.changeType}
          icon={stat.icon}
        />
      ))}
    </div>
  )
}

export function QuickActions() {
  const actions = [
    {
      title: 'Nueva Venta',
      description: 'Procesar una nueva venta',
      href: '/dashboard/pos',
      icon: <ShoppingCart className="h-5 w-5" />,
      gradient: 'from-blue-500 to-blue-600',
      hoverGradient: 'hover:from-blue-600 hover:to-blue-700'
    },
    {
      title: 'Nueva Reparación',
      description: 'Registrar nueva reparación',
      href: '/dashboard/repairs',
      icon: <Wrench className="h-5 w-5" />,
      gradient: 'from-emerald-500 to-emerald-600',
      hoverGradient: 'hover:from-emerald-600 hover:to-emerald-700'
    },
    {
      title: 'Agregar Cliente',
      description: 'Registrar nuevo cliente',
      href: '/dashboard/customers',
      icon: <Users className="h-5 w-5" />,
      gradient: 'from-purple-500 to-purple-600',
      hoverGradient: 'hover:from-purple-600 hover:to-purple-700'
    },
    {
      title: 'Gestionar Inventario',
      description: 'Actualizar productos',
      href: '/dashboard/products',
      icon: <Package className="h-5 w-5" />,
      gradient: 'from-orange-500 to-orange-600',
      hoverGradient: 'hover:from-orange-600 hover:to-orange-700'
    }
  ]

  return (
    <Card className="border-0 shadow-sm bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Acciones Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <a
            key={index}
            href={action.href}
            className={`group relative overflow-hidden bg-gradient-to-r ${action.gradient} ${action.hoverGradient} text-white p-4 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-[1.02] block`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                {action.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{action.title}</h3>
                <p className="text-xs opacity-90 mt-0.5">{action.description}</p>
              </div>
            </div>
            
            {/* Subtle shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </a>
        ))}
      </CardContent>
    </Card>
  )
}

export function RecentActivity() {
  const [items, setItems] = useState<Array<{
    type: 'sale' | 'repair' | 'customer'
    description: string
    amount?: string
    time: string
    status: 'completed' | 'in_progress' | 'new' | 'updated'
    icon: React.ReactNode
  }>>([])

  useEffect(() => {
    const load = async () => {
      try {
        const { config } = await import('@/lib/config')
        if (!config.supabase.isConfigured) {
          setItems([
            { type: 'sale', description: 'Venta completada - iPhone 13 Pro', amount: '₲ 899.000', time: 'Hace 5 min', status: 'completed', icon: <ShoppingCart className="h-4 w-4" /> },
            { type: 'repair', description: 'Reparación iniciada - Samsung Galaxy S21', amount: '₲ 120.000', time: 'Hace 15 min', status: 'in_progress', icon: <Wrench className="h-4 w-4" /> },
            { type: 'customer', description: 'Nuevo cliente registrado', time: 'Hace 30 min', status: 'new', icon: <Users className="h-4 w-4" /> }
          ])
          return
        }
        const { createClient } = await import('@/lib/supabase/client')
        const { formatCurrency } = await import('@/lib/currency')
        const supabase = createClient()
        type SBQuery = {
          select: (...args: unknown[]) => SBQuery
          order: (...args: unknown[]) => SBQuery
          limit: (...args: unknown[]) => unknown
        }
        const from = (table: string) =>
          ((supabase as unknown as { from: (t: string) => unknown }).from(table) as unknown as SBQuery)
        // Evitar TS2589 por generics profundos usando cast a unknown en el builder
        const [{ data: sales }, { data: repairs }, { data: customers }] = await Promise.all([
          from('sales').select('id,total:total_amount,status,created_at').order('created_at', { ascending: false }).limit(5) as unknown as Promise<{ data?: unknown }>,
          from('repairs').select('id,device_brand,device_model,status,created_at,final_cost').order('created_at', { ascending: false }).limit(5) as unknown as Promise<{ data?: unknown }>,
          from('customers').select('id,name,created_at').order('created_at', { ascending: false }).limit(5) as unknown as Promise<{ data?: unknown }>
        ])

        const toTime = (iso?: string): string => {
          if (!iso) return ''
          const d = new Date(iso)
          const diff = Math.floor((Date.now() - d.getTime()) / 1000)
          if (diff < 60) return `Hace ${diff}s`
          const m = Math.floor(diff / 60)
          if (m < 60) return `Hace ${m} min`
          const h = Math.floor(m / 60)
          if (h < 24) return `Hace ${h} hora${h > 1 ? 's' : ''}`
          const days = Math.floor(h / 24)
          return `Hace ${days} día${days > 1 ? 's' : ''}`
        }

        const saleItems = ((sales || []) as SaleRow[]).map(s => ({
          type: 'sale' as const,
          description: 'Venta',
          amount: formatCurrency(Number(s.total ?? 0) || 0),
          time: toTime(s.created_at),
          status: (s.status === 'completada' ? 'completed' : s.status === 'pendiente' ? 'in_progress' : 'updated') as 'completed' | 'in_progress' | 'updated',
          icon: <ShoppingCart className="h-4 w-4" />
        }))

        const repairItems = ((repairs || []) as RepairRow[]).map(r => {
          const brand = r.device_brand || ''
          const model = r.device_model || ''
          const label = [brand, model].filter(Boolean).join(' ')
          const st = r.status
          const status: 'completed' | 'in_progress' | 'updated' =
            st === 'listo' || st === 'entregado' ? 'completed' : st === 'reparacion' ? 'in_progress' : 'updated'
          const amount = r.final_cost !== null && r.final_cost !== undefined ? formatCurrency(Number(r.final_cost) || 0) : undefined
          return {
            type: 'repair' as const,
            description: label ? `Reparación - ${label}` : 'Reparación',
            amount,
            time: toTime(r.created_at),
            status,
            icon: <Wrench className="h-4 w-4" />
          }
        })

        const customerItems = ((customers || []) as CustomerRow[]).map(c => ({
          type: 'customer' as const,
          description: c.name ? `Nuevo cliente - ${c.name}` : 'Nuevo cliente registrado',
          time: toTime(c.created_at),
          status: 'new' as const,
          icon: <Users className="h-4 w-4" />
        }))

        const merged = [...saleItems, ...repairItems, ...customerItems]
          .sort((a, b) => {
            const wa = a.time.includes('s') ? 0 : a.time.includes('min') ? 1 : a.time.includes('hora') ? 2 : 3
            const wb = b.time.includes('s') ? 0 : b.time.includes('min') ? 1 : b.time.includes('hora') ? 2 : 3
            return wa - wb
          })
          .slice(0, 10)

        setItems(merged as Array<{
          type: 'sale' | 'repair' | 'customer'
          description: string
          amount?: string
          time: string
          status: 'completed' | 'in_progress' | 'new' | 'updated'
          icon: React.ReactNode
        }>)
      } catch {
        setItems([
          { type: 'sale', description: 'Venta completada', amount: '₲ 899.000', time: 'Hace 5 min', status: 'completed', icon: <ShoppingCart className="h-4 w-4" /> },
          { type: 'repair', description: 'Reparación en progreso', amount: '₲ 120.000', time: 'Hace 15 min', status: 'in_progress', icon: <Wrench className="h-4 w-4" /> },
          { type: 'customer', description: 'Nuevo cliente registrado', time: 'Hace 30 min', status: 'new', icon: <Users className="h-4 w-4" /> }
        ])
      }
    }
    load()
  }, [])
  
  useEffect(() => {
    const subscribe = async () => {
      const { config } = await import('@/lib/config')
      if (!config.supabase.isConfigured) return
      const { createClient } = await import('@/lib/supabase/client')
      const { formatCurrency } = await import('@/lib/currency')
      const supabase = createClient()
      
      const toTime = (iso?: string): string => {
        if (!iso) return ''
        const d = new Date(iso)
        const diff = Math.floor((Date.now() - d.getTime()) / 1000)
        if (diff < 60) return `Hace ${diff}s`
        const m = Math.floor(diff / 60)
        if (m < 60) return `Hace ${m} min`
        const h = Math.floor(m / 60)
        if (h < 24) return `Hace ${h} hora${h > 1 ? 's' : ''}`
        const days = Math.floor(h / 24)
        return `Hace ${days} día${days > 1 ? 's' : ''}`
      }
      
      const channel = supabase
        .channel('dashboard-activity')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, (payload: unknown) => {
          const row = (payload as { new: SaleRow }).new
          const status: 'completed' | 'in_progress' | 'updated' =
            row.status === 'completada' ? 'completed' : row.status === 'pendiente' ? 'in_progress' : 'updated'
          const item = {
            type: 'sale' as const,
            description: 'Venta',
            amount: formatCurrency(Number(row.total ?? 0) || 0),
            time: toTime(row.created_at),
            status,
            icon: <ShoppingCart className="h-4 w-4" />
          }
          setItems(prev => [item, ...prev].slice(0, 10))
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'repairs' }, (payload: unknown) => {
          const row = (payload as { new: RepairRow }).new
          const label = [row.device_brand || '', row.device_model || ''].filter(Boolean).join(' ')
          const status: 'completed' | 'in_progress' | 'updated' =
            row.status === 'listo' || row.status === 'entregado' ? 'completed' : row.status === 'reparacion' ? 'in_progress' : 'updated'
          const item = {
            type: 'repair' as const,
            description: label ? `Reparación - ${label}` : 'Reparación',
            amount: row.final_cost !== null && row.final_cost !== undefined ? formatCurrency(Number(row.final_cost ?? 0) || 0) : undefined,
            time: toTime(row.created_at),
            status,
            icon: <Wrench className="h-4 w-4" />
          }
          setItems(prev => [item, ...prev].slice(0, 10))
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, (payload: unknown) => {
          const row = (payload as { new: CustomerRow }).new
          const item = {
            type: 'customer' as const,
            description: row.name ? `Nuevo cliente - ${row.name}` : 'Nuevo cliente registrado',
            time: toTime(row.created_at),
            status: 'new' as const,
            icon: <Users className="h-4 w-4" />
          }
          setItems(prev => [item, ...prev].slice(0, 10))
        })
        .subscribe()
      
      return () => {
        channel.unsubscribe()
      }
    }
    const cleanupPromise = subscribe()
    return () => {
      void cleanupPromise.then(cleanup => {
        if (typeof cleanup === 'function') cleanup()
      })
    }
  }, [])

  const getStatusConfig = (status: string) => {
    const statusConfig = {
      completed: { 
        label: 'Completado', 
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
        iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
      },
      in_progress: { 
        label: 'En Progreso', 
        color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
        iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
      },
      new: { 
        label: 'Nuevo', 
        color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
        iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
      },
      updated: { 
        label: 'Actualizado', 
        color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
        iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
      }
    }

    return statusConfig[status as keyof typeof statusConfig]
  }

  return (
    <div className="space-y-3">
      {items.map((activity, index) => {
        const statusConfig = getStatusConfig(activity.status)
        return (
          <div key={index} className="group flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors duration-200">
            <div className={`p-2 rounded-lg ${statusConfig.iconBg}`}>
              {activity.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                {activity.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`text-xs px-2 py-0.5 ${statusConfig.color}`}>
                  {statusConfig.label}
                </Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {activity.time}
                </span>
              </div>
            </div>
            
            {activity.amount && (
              <div className="text-right">
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  {activity.amount}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default StatsOverview
