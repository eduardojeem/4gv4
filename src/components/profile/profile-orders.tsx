'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ORDER_STATUS_META, PAYMENT_STATUS_META, UNKNOWN_STATUS_META } from '@/lib/orders/constants'
import { formatMoney } from '@/components/dashboard/orders/format'
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types'
import { CalendarClock, ChevronRight, Clock, MapPin, PackageSearch, ShoppingBag, Store, Truck } from 'lucide-react'

export interface ProfileOrder {
  id: string
  order_number: string
  status: string
  payment_status: string
  fulfillment_type: string
  customer_address: string | null
  estimated_delivery_date: string | null
  total: number
  created_at: string
}

interface ProfileOrdersProps {
  orders: ProfileOrder[]
  tenantPrefix?: string
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  } catch {
    return 'N/A'
  }
}

function normalizeStatus(value: string) {
  return value.trim().toUpperCase()
}

function isDeliveryOrder(value: string) {
  return normalizeStatus(value) === 'DELIVERY'
}

export function ProfileOrders({ orders, tenantPrefix = '' }: ProfileOrdersProps) {
  const trackHref = tenantPrefix ? `${tenantPrefix}/track` : '/track'

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Pedidos realizados</h2>
        </div>
        {orders.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {orders.length}
          </Badge>
        )}
      </div>

      <div className="divide-y divide-border">
        {orders.length > 0 ? (
          orders.map((order) => {
            const statusKey = normalizeStatus(order.status) as OrderStatus
            const paymentKey = normalizeStatus(order.payment_status) as PaymentStatus
            const statusInfo = ORDER_STATUS_META[statusKey] ?? UNKNOWN_STATUS_META
            const paymentInfo = PAYMENT_STATUS_META[paymentKey] ?? PAYMENT_STATUS_META.PENDING
            const delivery = isDeliveryOrder(order.fulfillment_type)

            return (
              <Link
                key={order.id}
                href={`${trackHref}?orderNumber=${encodeURIComponent(order.order_number)}`}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PackageSearch className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-mono text-sm font-semibold text-foreground">
                      {order.order_number}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 border text-[10px] font-medium', statusInfo.className)}
                    >
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDate(order.created_at)}
                    </span>
                    <span>{formatMoney(order.total)}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', paymentInfo.className)}>
                      {paymentInfo.label}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      {delivery ? <Truck className="h-3.5 w-3.5 shrink-0" /> : <Store className="h-3.5 w-3.5 shrink-0" />}
                      {delivery ? 'Envio a domicilio' : 'Retiro en tienda'}
                    </span>
                    {delivery && order.customer_address && (
                      <span className="inline-flex min-w-0 items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{order.customer_address}</span>
                      </span>
                    )}
                    {delivery && order.estimated_delivery_date && (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        Entrega estimada: {formatDate(order.estimated_delivery_date)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              </Link>
            )
          })
        ) : (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sin pedidos realizados</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tus compras desde la tienda apareceran aqui.
            </p>
          </div>
        )}
      </div>

      {orders.length > 0 && (
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" size="sm" className="w-full text-xs">
            <Link href={trackHref}>
              Rastrear otro pedido <ChevronRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
