'use client'

import { cn } from '@/lib/utils'
import { Award, PackageCheck, ShoppingBag, TrendingUp, Wrench } from 'lucide-react'

interface ProfileStatsProps {
  totalRepairs: number
  activeRepairs: number
  readyRepairs: number
  deliveredRepairs: number
  totalOrders?: number
  variant?: 'full' | 'activity'
}

const stats = [
  { key: 'total', label: 'Total reparaciones', icon: Wrench, colorClass: 'text-primary bg-primary/10' },
  { key: 'active', label: 'En proceso', icon: TrendingUp, colorClass: 'text-warning bg-warning/10' },
  { key: 'ready', label: 'Listos para retirar', icon: PackageCheck, colorClass: 'text-info bg-info/10' },
  { key: 'delivered', label: 'Entregados', icon: Award, colorClass: 'text-success bg-success/10' },
  { key: 'orders', label: 'Pedidos', icon: ShoppingBag, colorClass: 'text-info bg-info/10' },
] as const

export function ProfileStats({ totalRepairs, activeRepairs, readyRepairs, deliveredRepairs, totalOrders = 0, variant = 'full' }: ProfileStatsProps) {
  const values: Record<string, number> = {
    total: totalRepairs,
    active: activeRepairs,
    ready: readyRepairs,
    delivered: deliveredRepairs,
    orders: totalOrders,
  }

  const visibleStats = variant === 'activity'
    ? stats.filter(({ key }) => key === 'active' || key === 'ready' || key === 'orders')
    : stats

  return (
    <div className={cn(
      'grid gap-2',
      variant === 'activity' ? 'grid-cols-3' : 'grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5'
    )}>
      {visibleStats.map(({ key, label, icon: Icon, colorClass }) => (
        <div
          key={key}
          className={cn(
            'flex items-center rounded-lg border border-border bg-card',
            variant === 'activity'
              ? 'min-w-0 flex-col gap-1.5 px-2 py-3 text-center sm:flex-row sm:gap-3 sm:px-4 sm:text-left'
              : 'min-h-24 flex-col gap-2 p-4 text-center shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:text-left'
          )}
        >
          <div className={cn(
            'flex shrink-0 items-center justify-center rounded-lg',
            variant === 'activity' ? 'h-8 w-8' : 'h-10 w-10',
            colorClass
          )}>
            <Icon className={variant === 'activity' ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</p>
            <p className={cn('font-bold tabular-nums text-foreground', variant === 'activity' ? 'text-lg' : 'text-xl')}>
              {values[key]}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
