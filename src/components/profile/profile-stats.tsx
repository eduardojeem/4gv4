'use client'

import { cn } from '@/lib/utils'
import { Award, PackageCheck, ShoppingBag, TrendingUp, Wrench } from 'lucide-react'

interface ProfileStatsProps {
  totalRepairs: number
  activeRepairs: number
  readyRepairs: number
  deliveredRepairs: number
  totalOrders?: number
}

const stats = [
  { key: 'total', label: 'Total reparaciones', icon: Wrench, colorClass: 'text-primary bg-primary/10' },
  { key: 'active', label: 'En proceso', icon: TrendingUp, colorClass: 'text-warning bg-warning/10' },
  { key: 'ready', label: 'Listos para retirar', icon: PackageCheck, colorClass: 'text-info bg-info/10' },
  { key: 'delivered', label: 'Entregados', icon: Award, colorClass: 'text-success bg-success/10' },
  { key: 'orders', label: 'Pedidos', icon: ShoppingBag, colorClass: 'text-info bg-info/10' },
] as const

export function ProfileStats({ totalRepairs, activeRepairs, readyRepairs, deliveredRepairs, totalOrders = 0 }: ProfileStatsProps) {
  const values: Record<string, number> = {
    total: totalRepairs,
    active: activeRepairs,
    ready: readyRepairs,
    delivered: deliveredRepairs,
    orders: totalOrders,
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {stats.map(({ key, label, icon: Icon, colorClass }) => (
        <div
          key={key}
          className="flex min-h-24 flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:text-left"
        >
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', colorClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-xl font-bold tabular-nums text-foreground">{values[key]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
