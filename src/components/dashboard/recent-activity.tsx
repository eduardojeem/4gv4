'use client'

import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Wrench, Users, Package, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Tipos locales
type SaleRow = { id: string; total_amount?: number | null; status: 'pendiente' | 'completada' | 'cancelada'; created_at: string }
type RepairRow = {
  id: string
  device_brand?: string | null
  device_model?: string | null
  status: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado'
  created_at: string
  final_cost?: number | null
}
type CustomerRow = { id: string; name?: string | null; created_at: string }

interface ActivityItem {
  id: string
  type: 'sale' | 'repair' | 'customer'
  description: string
  amount?: string
  timestamp: string
  status: 'completed' | 'in_progress' | 'new' | 'updated' | 'cancelled'
  icon: React.ReactNode
}

export function RecentActivity() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const { config } = await import('@/lib/config')
        if (!config.supabase.isConfigured) {
          if (isMounted) setLoading(false)
          return
        }
        
        const { createClient } = await import('@/lib/supabase/client')
        const { formatCurrency } = await import('@/lib/currency')
        const supabase = createClient()
        
        // Helper para cast de queries
        const from = (table: string) => supabase.from(table)

        const [{ data: sales }, { data: repairs }, { data: customers }] = await Promise.all([
          from('sales')
            .select('id,total_amount,status,created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          from('repairs')
            .select('id,device_brand,device_model,status,created_at,final_cost')
            .order('created_at', { ascending: false })
            .limit(5),
          from('customers')
            .select('id,name,created_at')
            .order('created_at', { ascending: false })
            .limit(5)
        ])

        const saleItems: ActivityItem[] = ((sales || []) as any[]).map((s: SaleRow) => ({
          id: `sale-${s.id}`,
          type: 'sale',
          description: 'Venta realizada',
          amount: formatCurrency(Number(s.total_amount ?? 0) || 0),
          timestamp: s.created_at,
          status: s.status === 'completada' ? 'completed' : s.status === 'cancelada' ? 'cancelled' : 'in_progress',
          icon: <ShoppingCart className="h-4 w-4" />
        }))

        const repairItems: ActivityItem[] = ((repairs || []) as any[]).map((r: RepairRow) => {
          const label = [r.device_brand, r.device_model].filter(Boolean).join(' ')
          const st = r.status
          const status = (st === 'listo' || st === 'entregado') ? 'completed' : st === 'reparacion' ? 'in_progress' : 'updated'
          
          return {
            id: `repair-${r.id}`,
            type: 'repair',
            description: label ? `Reparación - ${label}` : 'Reparación registrada',
            amount: r.final_cost ? formatCurrency(Number(r.final_cost)) : undefined,
            timestamp: r.created_at,
            status,
            icon: <Wrench className="h-4 w-4" />
          }
        })

        const customerItems: ActivityItem[] = ((customers || []) as any[]).map((c: CustomerRow) => ({
          id: `customer-${c.id}`,
          type: 'customer',
          description: c.name ? `Nuevo cliente: ${c.name}` : 'Nuevo cliente registrado',
          timestamp: c.created_at,
          status: 'new',
          icon: <Users className="h-4 w-4" />
        }))

        const merged = [...saleItems, ...repairItems, ...customerItems]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10)

        if (isMounted) {
          setItems(merged)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error loading activity:', error)
        if (isMounted) setLoading(false)
      }
    }

    load()

    // Suscripción a cambios en tiempo real
    let channel: any = null
    const setupRealtime = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      
      channel = supabase.channel('profile-activity')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, () => load())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'repairs' }, () => load())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, () => load())
        .subscribe()
    }
    
    setupRealtime()

    return () => {
      isMounted = false
      if (channel) channel.unsubscribe()
    }
  }, [])

  const getStatusConfig = (status: ActivityItem['status']) => {
    switch (status) {
      case 'completed':
        return { 
          label: 'Completado', 
          color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
          iconBg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
        }
      case 'in_progress':
        return { 
          label: 'En Proceso', 
          color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
          iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
        }
      case 'new':
        return { 
          label: 'Nuevo', 
          color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
          iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
        }
      case 'cancelled':
        return { 
          label: 'Cancelado', 
          color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
          iconBg: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
        }
      default:
        return { 
          label: 'Actualizado', 
          color: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800',
          iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900/50">
            <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-3 w-1/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
          <Clock className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Sin actividad reciente</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mt-1">
          Las ventas, reparaciones y nuevos clientes aparecerán aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((activity) => {
        const config = getStatusConfig(activity.status)
        return (
          <div 
            key={activity.id} 
            className="group flex items-start sm:items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 hover:bg-white hover:shadow-md hover:scale-[1.01] transition-all duration-300"
          >
            <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${config.iconBg}`}>
              {activity.icon}
            </div>
            
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {activity.description}
                </p>
                {activity.amount && (
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                    {activity.amount}
                  </span>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border-0 font-medium ${config.color}`}>
                  {config.label}
                </Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: es })}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default RecentActivity
