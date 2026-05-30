'use client'

import { Badge } from '@/components/ui/badge'
import { ORDER_STATUS_META, PAYMENT_STATUS_META, UNKNOWN_STATUS_META } from '@/lib/orders/constants'
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types'

export function OrderStatusBadge({ status }: { status: string }) {
  const meta = ORDER_STATUS_META[status as OrderStatus] ?? UNKNOWN_STATUS_META
  const Icon = meta.icon

  return (
    <Badge variant="outline" className={`gap-1.5 border ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const meta = PAYMENT_STATUS_META[status as PaymentStatus] ?? PAYMENT_STATUS_META.PENDING

  return (
    <Badge variant="outline" className={`border ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}
