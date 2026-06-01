'use client'

import { Badge } from '@/components/ui/badge'
import { ORDER_STATUS_META, PAYMENT_STATUS_META, UNKNOWN_STATUS_META } from '@/lib/orders/constants'
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types'
import { cn } from '@/lib/utils'

// Color dot per status
const STATUS_DOT: Record<string, string> = {
  PENDING:   'bg-amber-400',
  CONFIRMED: 'bg-blue-400',
  PREPARING: 'bg-cyan-400',
  READY:     'bg-emerald-400',
  SHIPPED:   'bg-violet-400',
  DELIVERED: 'bg-slate-400',
  CANCELLED: 'bg-rose-400',
}

const PAYMENT_DOT: Record<string, string> = {
  PENDING:  'bg-amber-400',
  PAID:     'bg-emerald-400',
  PARTIAL:  'bg-blue-400',
  REFUNDED: 'bg-slate-400',
  FAILED:   'bg-rose-400',
}

export function OrderStatusBadge({ status, size = 'default' }: { status: string; size?: 'sm' | 'default' }) {
  const meta = ORDER_STATUS_META[status as OrderStatus] ?? UNKNOWN_STATUS_META
  const dot = STATUS_DOT[status] ?? 'bg-slate-400'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold',
        meta.className,
        size === 'sm'
          ? 'px-2 py-0.5 text-[10px]'
          : 'px-2.5 py-0.5 text-xs'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} />
      {meta.label}
    </span>
  )
}

export function PaymentStatusBadge({ status, size = 'default' }: { status: string; size?: 'sm' | 'default' }) {
  const meta = PAYMENT_STATUS_META[status as PaymentStatus] ?? PAYMENT_STATUS_META.PENDING
  const dot = PAYMENT_DOT[status] ?? 'bg-slate-400'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        meta.className,
        size === 'sm'
          ? 'px-2 py-0.5 text-[10px]'
          : 'px-2.5 py-0.5 text-xs'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} />
      {meta.label}
    </span>
  )
}

// Legacy Badge compat (for external usages)
export function OrderStatusBadgeLegacy({ status }: { status: string }) {
  const meta = ORDER_STATUS_META[status as OrderStatus] ?? UNKNOWN_STATUS_META
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={`gap-1.5 border ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  )
}
