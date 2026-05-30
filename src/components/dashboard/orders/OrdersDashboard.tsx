'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Package,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  Truck,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { ORDER_STATUS_META, ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } from '@/lib/orders/constants'
import type { CustomerOrder, OrderStatus, PaymentStatus } from '@/lib/orders/types'
import { CreateOrderDialog } from './CreateOrderDialog'
import { OrderStatusBadge, PaymentStatusBadge } from './OrderBadges'
import { formatDate, formatMoney } from './format'

type OrdersPayload = {
  orders: CustomerOrder[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  stats: Record<string, number> | null
}

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Todos' },
  ...ORDER_STATUS_OPTIONS,
]

const STAT_KEYS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'READY', 'SHIPPED']

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  statusKey,
  count,
  active,
  onClick,
}: {
  statusKey: OrderStatus
  count: number
  active: boolean
  onClick: () => void
}) {
  const meta = ORDER_STATUS_META[statusKey]
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
        active
          ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${active ? 'bg-primary/10' : 'bg-muted group-hover:bg-muted/80'}`}>
          <Icon className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
        </span>
      </div>
      <span className={`text-2xl font-bold tabular-nums tracking-tight ${active ? 'text-primary' : ''}`}>
        {count}
      </span>
    </button>
  )
}

// ─── Order row ────────────────────────────────────────────────────────────────
function OrderRow({
  order,
  selected,
  updating,
  cancelConfirmId,
  onSelect,
  onStatusChange,
  onPaymentChange,
  onCancelConfirm,
  onCancelDismiss,
}: {
  order: CustomerOrder
  selected: boolean
  updating: boolean
  cancelConfirmId: boolean
  onSelect: () => void
  onStatusChange: (status: OrderStatus) => void
  onPaymentChange: (status: PaymentStatus) => void
  onCancelConfirm: () => void
  onCancelDismiss: () => void
}) {
  return (
    <div
      className={`group rounded-xl border transition-all ${
        selected
          ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-border/80 hover:shadow-sm'
      }`}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onSelect}
                className="font-mono text-sm font-bold text-primary hover:underline"
              >
                {order.order_number}
              </button>
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status} />
              {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <p className="mt-1.5 truncate font-medium">{order.customer_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {order.customer_phone || order.customer_email || 'Sin contacto'}
              <span className="mx-1.5 opacity-40">·</span>
              {formatDate(order.created_at)}
            </p>
          </div>

          {/* Amount + items count */}
          <div className="text-right">
            <p className="text-base font-bold tabular-nums">{formatMoney(order.total)}</p>
            <p className="text-xs text-muted-foreground">
              {order.order_items.length} {order.order_items.length === 1 ? 'producto' : 'productos'}
            </p>
          </div>
        </div>

        {/* Bottom row — controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          {/* Fulfillment chip */}
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
            {order.fulfillment_type === 'PICKUP'
              ? <><Store className="h-3 w-3" /> Retiro</>
              : <><Truck className="h-3 w-3" /> Delivery</>
            }
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Status select */}
            <div className="w-[160px] space-y-1">
              <Select
                value={order.status}
                onValueChange={(v) => onStatusChange(v as OrderStatus)}
                disabled={updating}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cancelConfirmId && (
                <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span className="flex-1 leading-tight">¿Cancelar pedido?</span>
                  <button type="button" className="font-bold underline" onClick={onCancelConfirm}>Sí</button>
                  <button type="button" onClick={onCancelDismiss}>No</button>
                </div>
              )}
            </div>

            {/* Payment select */}
            <Select
              value={order.payment_status}
              onValueChange={(v) => onPaymentChange(v as PaymentStatus)}
              disabled={updating}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Detail toggle */}
            <Button
              variant={selected ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={onSelect}
            >
              {selected ? <X className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
              {selected ? 'Cerrar' : 'Ver'}
            </Button>
          </div>
        </div>
      </div>

      {/* Inline detail panel */}
      {selected && <OrderDetail order={order} />}
    </div>
  )
}

// ─── Inline order detail ──────────────────────────────────────────────────────
function OrderDetail({ order }: { order: CustomerOrder }) {
  return (
    <div className="border-t bg-muted/20 px-4 pb-4 pt-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        {/* Items */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Productos</p>
          {order.order_items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.product_sku || 'Sin SKU'}
                  <span className="mx-1 opacity-40">·</span>
                  {item.quantity} × {formatMoney(item.unit_price)}
                </p>
              </div>
              <span className="ml-4 shrink-0 text-sm font-bold tabular-nums">{formatMoney(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="space-y-3 rounded-xl border bg-card p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumen</p>

          {/* Fulfillment */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium">
            {order.fulfillment_type === 'PICKUP'
              ? <><Store className="h-3.5 w-3.5 text-muted-foreground" /> Retiro en local</>
              : <><Truck className="h-3.5 w-3.5 text-muted-foreground" /> Delivery</>
            }
          </div>

          <Separator />

          <div className="space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(order.subtotal)}</span>
            </div>
            {order.shipping_cost > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Envío</span>
                <span className="tabular-nums">{formatMoney(order.shipping_cost)}</span>
              </div>
            )}
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Descuento</span>
                <span className="tabular-nums">−{formatMoney(order.discount_amount)}</span>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span className="tabular-nums text-base">{formatMoney(order.total)}</span>
          </div>

          {/* Extra info */}
          {(order.customer_address || order.notes) && (
            <>
              <Separator />
              <div className="space-y-2 text-xs text-muted-foreground">
                {order.customer_address && (
                  <div className="flex gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{order.customer_address}</span>
                  </div>
                )}
                {order.notes && (
                  <p className="italic">{order.notes}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export function OrdersDashboard() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [globalStats, setGlobalStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', status, search })
      const response = await fetch(`/api/orders?${params}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || 'No se pudieron cargar los pedidos.')
      }
      const data = payload.data as OrdersPayload
      setOrders(data.orders)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      if (data.stats) setGlobalStats(data.stats)
    } catch (error) {
      toast({
        title: 'Error al cargar pedidos',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [page, search, status, toast])

  useEffect(() => {
    const t = window.setTimeout(() => void loadOrders(), 250)
    return () => window.clearTimeout(t)
  }, [loadOrders])

  const stats = useMemo(() => {
    if (Object.keys(globalStats).length > 0) return globalStats
    return orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1
      return acc
    }, {})
  }, [orders, globalStats])

  async function updateStatus(order: CustomerOrder, nextStatus: OrderStatus) {
    if (nextStatus === 'CANCELLED' && cancelConfirmId !== order.id) {
      setCancelConfirmId(order.id)
      return
    }
    setCancelConfirmId(null)
    setUpdatingId(order.id)
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'No se pudo actualizar.')
      setOrders((cur) => cur.map((r) => r.id === order.id ? payload.data : r))
      toast({ title: 'Estado actualizado', description: `${order.order_number} → ${ORDER_STATUS_META[nextStatus].label}` })
    } catch (error) {
      toast({ title: 'No se actualizó', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally {
      setUpdatingId(null)
    }
  }

  async function updatePayment(order: CustomerOrder, paymentStatus: PaymentStatus) {
    setUpdatingId(order.id)
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: paymentStatus }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'No se pudo actualizar.')
      setOrders((cur) => cur.map((r) => r.id === order.id ? payload.data : r))
    } catch (error) {
      toast({ title: 'No se actualizó el pago', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally {
      setUpdatingId(null)
    }
  }

  const hasActiveFilters = search !== '' || status !== 'ALL'

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gestiona pedidos, estados y pagos en tiempo real.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadOrders()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nuevo pedido
          </Button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_KEYS.map((key) => (
          <StatCard
            key={key}
            statusKey={key}
            count={stats[key] || 0}
            active={status === key}
            onClick={() => {
              setPage(1)
              setStatus((prev) => prev === key ? 'ALL' : key)
            }}
          />
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
            className="pl-9 h-9"
            placeholder="Buscar por número, cliente, email o teléfono…"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v) }}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-muted-foreground"
              onClick={() => { setPage(1); setSearch(''); setStatus('ALL') }}
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* ── Order list ── */}
      <div className="space-y-2">
        {/* List header */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-medium text-muted-foreground">
            {loading ? 'Cargando…' : `${total} pedido${total !== 1 ? 's' : ''}`}
          </span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              Filtrado
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-muted/20">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Cargando pedidos…</span>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
            <PackageSearch className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-medium">Sin pedidos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilters ? 'Ningún pedido coincide con los filtros.' : 'Crea el primer pedido.'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => { setPage(1); setSearch(''); setStatus('ALL') }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                selected={selectedOrderId === order.id}
                updating={updatingId === order.id}
                cancelConfirmId={cancelConfirmId === order.id}
                onSelect={() => setSelectedOrderId((prev) => prev === order.id ? null : order.id)}
                onStatusChange={(s) => void updateStatus(order, s)}
                onPaymentChange={(s) => void updatePayment(order, s)}
                onCancelConfirm={() => void updateStatus(order, 'CANCELLED')}
                onCancelDismiss={() => setCancelConfirmId(null)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página <strong>{page}</strong> de <strong>{totalPages}</strong>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="gap-1.5"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void loadOrders()} />
    </div>
  )
}
