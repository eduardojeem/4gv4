'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Calendar, Check,
  ChevronLeft, ChevronRight, Download, Loader2, Mail, MapPin,
  Package, PackageSearch, Phone, Plus, RefreshCw, Search,
  SlidersHorizontal, Store, Truck, X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  ORDER_FLOW, ORDER_STATUS_META, ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_META, PAYMENT_STATUS_OPTIONS,
} from '@/lib/orders/constants'
import type { CustomerOrder, OrderStatus, PaymentStatus } from '@/lib/orders/types'
import { CreateOrderDialog } from './CreateOrderDialog'
import { OrderStatusBadge, PaymentStatusBadge } from './OrderBadges'
import { formatDate, formatMoney, formatRelativeTime } from './format'

// ─── Types ────────────────────────────────────────────────────────────────────
type DatePreset = 'all' | 'today' | 'week' | 'month'
type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'
type OrdersPayload = {
  orders: CustomerOrder[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  stats: Record<string, number> | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDateFrom(preset: DatePreset): string | null {
  if (preset === 'all') return null
  const now = new Date()
  if (preset === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  if (preset === 'week') return new Date(now.getTime() - 7 * 86400000).toISOString()
  return new Date(now.getTime() - 30 * 86400000).toISOString()
}

function exportOrdersCSV(orders: CustomerOrder[]) {
  const headers = ['Número','Fecha','Cliente','Teléfono','Email','Estado','Pago','Entrega','Productos','Total']
  const rows = orders.map((o) => [
    o.order_number, formatDate(o.created_at), o.customer_name,
    o.customer_phone ?? '', o.customer_email ?? '',
    ORDER_STATUS_META[o.status]?.label ?? o.status,
    PAYMENT_STATUS_META[o.payment_status]?.label ?? o.payment_status,
    o.fulfillment_type === 'PICKUP' ? 'Retiro' : 'Delivery',
    String(o.order_items.length), String(o.total),
  ])
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `pedidos-${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function getInitials(name: string) {
  return name.split(' ').slice(0,2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

// ─── Stat card ────────────────────────────────────────────────────────────────
const STAT_KEYS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'READY', 'SHIPPED']

function StatCard({ statusKey, count, active, onClick }: {
  statusKey: OrderStatus; count: number; active: boolean; onClick: () => void
}) {
  const meta = ORDER_STATUS_META[statusKey]
  const Icon = meta.icon
  return (
    <button
      type="button" onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        active
          ? 'border-primary/30 bg-gradient-to-br from-primary/8 to-primary/4 shadow-md ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/20 hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-semibold', active ? 'text-primary/80' : 'text-muted-foreground')}>
          {meta.label}
        </span>
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
          active ? 'bg-primary/15' : 'bg-muted group-hover:bg-primary/10'
        )}>
          <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground group-hover:text-primary/70')} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className={cn('text-3xl font-bold tabular-nums tracking-tight', active ? 'text-primary' : 'text-foreground')}>
          {count}
        </span>
        {active && (
          <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary/60">activo</span>
        )}
      </div>
      {active && <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary/40" />}
    </button>
  )
}

// ─── Status timeline ──────────────────────────────────────────────────────────
function StatusTimeline({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') return (
    <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
      <X className="h-4 w-4 shrink-0" /> Pedido cancelado
    </div>
  )
  const currentIdx = ORDER_FLOW.indexOf(status)
  return (
    <div className="flex items-start">
      {ORDER_FLOW.map((s, i) => {
        const done = currentIdx > i
        const active = currentIdx === i
        const meta = ORDER_STATUS_META[s]
        const Icon = meta.icon
        return (
          <div key={s} className="flex flex-1 items-start">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
                done ? 'border-primary bg-primary shadow-sm shadow-primary/30'
                  : active ? 'border-primary bg-primary/10 shadow-sm shadow-primary/20'
                  : 'border-muted bg-muted/30'
              )}>
                {done
                  ? <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  : <Icon className={cn('h-3 w-3', active ? 'text-primary' : 'text-muted-foreground/30')} />
                }
              </div>
              <span className={cn(
                'mt-1.5 px-0.5 text-center text-[10px] font-medium leading-tight',
                done || active ? 'text-foreground' : 'text-muted-foreground/40'
              )}>{meta.label}</span>
            </div>
            {i < ORDER_FLOW.length - 1 && (
              <div className={cn('mt-4 h-0.5 flex-1 rounded-full transition-colors duration-300', done ? 'bg-primary' : 'bg-muted')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Order row ────────────────────────────────────────────────────────────────
function OrderRow({ order, selected, updating, onClick, onAdvanceStatus }: {
  order: CustomerOrder; selected: boolean; updating: boolean
  onClick: () => void; onAdvanceStatus: (s: OrderStatus) => void
}) {
  const currentIdx = ORDER_FLOW.indexOf(order.status)
  const isTerminal = ['DELIVERED', 'CANCELLED'].includes(order.status)
  const nextStatus = !isTerminal && currentIdx < ORDER_FLOW.length - 1 ? ORDER_FLOW[currentIdx + 1] : null

  return (
    <div className={cn(
      'group rounded-2xl border transition-all duration-200',
      selected
        ? 'border-primary/30 bg-gradient-to-r from-primary/5 to-transparent shadow-md ring-1 ring-primary/20'
        : 'border-border bg-card hover:border-primary/20 hover:shadow-md hover:-translate-y-px'
    )}>
      <button type="button" onClick={onClick}
        className="w-full rounded-t-2xl p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={cn(
            'hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors',
            selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary/70'
          )}>
            {getInitials(order.customer_name)}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="font-mono text-sm font-bold text-primary">{order.order_number}</span>
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status} />
              {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-sm font-semibold truncate">{order.customer_name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {order.customer_phone && <span>{order.customer_phone}</span>}
              {order.customer_phone && <span className="opacity-30">·</span>}
              <span className="flex items-center gap-1">
                {order.fulfillment_type === 'PICKUP'
                  ? <><Store className="h-3 w-3" /> Retiro</>
                  : <><Truck className="h-3 w-3" /> Delivery</>}
              </span>
              <span className="opacity-30">·</span>
              <span>{order.order_items.length} {order.order_items.length === 1 ? 'producto' : 'productos'}</span>
            </div>
          </div>
          {/* Amount */}
          <div className="text-right shrink-0">
            <p className="font-bold tabular-nums text-base">{formatMoney(order.total)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatRelativeTime(order.created_at)}</p>
          </div>
        </div>
      </button>

      {/* Action bar */}
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 gap-2">
        <button type="button" onClick={onClick}
          className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          {selected ? 'Cerrar detalle' : 'Ver detalle →'}
        </button>
        <div className="flex items-center gap-1.5">
          {isTerminal ? (
            <span className={cn('text-xs font-semibold',
              order.status === 'DELIVERED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
            )}>
              {ORDER_STATUS_META[order.status].label}
            </span>
          ) : nextStatus ? (
            <button type="button" disabled={updating}
              onClick={(e) => { e.stopPropagation(); onAdvanceStatus(nextStatus) }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-all',
                'border-primary/25 bg-primary/8 text-primary hover:bg-primary/15 hover:border-primary/40',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}>
              {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
              {ORDER_STATUS_META[nextStatus].label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Order detail panel ───────────────────────────────────────────────────────
function OrderDetailPanel({ order, updating, cancelConfirmId, onClose, onStatusChange, onPaymentChange, onCancelConfirm, onCancelDismiss }: {
  order: CustomerOrder; updating: boolean; cancelConfirmId: string | null
  onClose: () => void; onStatusChange: (s: OrderStatus) => void
  onPaymentChange: (s: PaymentStatus) => void; onCancelConfirm: () => void; onCancelDismiss: () => void
}) {
  const currentIdx = ORDER_FLOW.indexOf(order.status)
  const isTerminal = ['DELIVERED', 'CANCELLED'].includes(order.status)
  const nextStatus = !isTerminal && currentIdx < ORDER_FLOW.length - 1 ? ORDER_FLOW[currentIdx + 1] : null
  const prevStatus = !isTerminal && currentIdx > 0 ? ORDER_FLOW[currentIdx - 1] : null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between border-b bg-muted/30 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-bold text-primary">{order.order_number}</p>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-lg" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-5">

          {/* Timeline */}
          <section>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Progreso</p>
            <StatusTimeline status={order.status} />
          </section>

          <Separator />

          {/* Customer */}
          <section>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Cliente</p>
            <div className="rounded-xl border bg-muted/20 p-3.5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                  {getInitials(order.customer_name)}
                </div>
                <span className="font-semibold text-sm">{order.customer_name}</span>
              </div>
              <div className="space-y-1.5">
                {order.customer_phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />{order.customer_phone}
                  </div>
                )}
                {order.customer_email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="truncate">{order.customer_email}</span>
                  </div>
                )}
                {order.customer_address && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />{order.customer_address}
                  </div>
                )}
                {!order.customer_phone && !order.customer_email && !order.customer_address && (
                  <p className="text-xs italic text-muted-foreground/60">Sin datos de contacto</p>
                )}
              </div>
            </div>
          </section>

          {/* Items */}
          <section>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Productos <span className="text-muted-foreground/40">({order.order_items.length})</span>
            </p>
            <div className="space-y-1.5">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.product_sku ?? 'Sin SKU'} · {item.quantity} × {formatMoney(item.unit_price)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Financial summary */}
          <section className="rounded-xl border bg-muted/20 p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Resumen</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span className="tabular-nums">{formatMoney(order.subtotal)}</span>
              </div>
              {order.shipping_cost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Envío</span>
                  <span className="tabular-nums">{formatMoney(order.shipping_cost)}</span>
                </div>
              )}
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Descuento</span><span className="tabular-nums">−{formatMoney(order.discount_amount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span><span className="tabular-nums">{formatMoney(order.total)}</span>
              </div>
            </div>
          </section>

          {/* Payment */}
          <section>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Estado de pago</p>
            <Select value={order.payment_status} onValueChange={(v) => onPaymentChange(v as PaymentStatus)} disabled={updating}>
              <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* Notes */}
          {order.notes && (
            <section>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Notas</p>
              <p className="rounded-xl border bg-muted/20 px-3.5 py-3 text-sm italic text-muted-foreground">{order.notes}</p>
            </section>
          )}
        </div>
      </div>

      {/* Footer actions */}
      {!isTerminal && (
        <div className="shrink-0 space-y-2 border-t bg-muted/20 p-4">
          {cancelConfirmId && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-xs font-medium">
                {cancelConfirmId.startsWith('regress-')
                  ? `¿Retroceder a "${prevStatus ? ORDER_STATUS_META[prevStatus].label : ''}"?`
                  : '¿Cancelar este pedido?'}
              </span>
              <button type="button" className="text-xs font-bold underline" onClick={onCancelConfirm}>Sí</button>
              <button type="button" className="ml-1 text-xs opacity-70 hover:opacity-100" onClick={onCancelDismiss}>No</button>
            </div>
          )}
          <div className="flex gap-2">
            {prevStatus && (
              <Button variant="outline" size="sm" className="flex-1 gap-1.5 rounded-xl text-xs"
                onClick={() => onStatusChange(prevStatus)} disabled={updating}>
                <ArrowLeft className="h-3.5 w-3.5" />{ORDER_STATUS_META[prevStatus].label}
              </Button>
            )}
            {nextStatus && (
              <Button size="sm" className="flex-1 gap-1.5 rounded-xl text-xs"
                onClick={() => onStatusChange(nextStatus)} disabled={updating}>
                {ORDER_STATUS_META[nextStatus].label}<ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {!cancelConfirmId && (
            <Button variant="ghost" size="sm"
              className="w-full rounded-xl text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
              onClick={() => onStatusChange('CANCELLED')} disabled={updating}>
              Cancelar pedido
            </Button>
          )}
        </div>
      )}
      {order.status === 'DELIVERED' && (
        <div className="shrink-0 border-t bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> Pedido entregado exitosamente
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function OrderListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /></div>
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-60" />
            </div>
            <div className="space-y-1.5 text-right">
              <Skeleton className="ml-auto h-5 w-24" />
              <Skeleton className="ml-auto h-3 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Date presets ─────────────────────────────────────────────────────────────
const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: '7 días' },
  { value: 'month', label: '30 días' },
  { value: 'all', label: 'Todo' },
]

// ─── Main dashboard ───────────────────────────────────────────────────────────
export function OrdersDashboard() {
  const { toast } = useToast()
  const abortRef = useRef<AbortController | null>(null)
  const statsLoadedRef = useRef(false)

  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [fulfillmentFilter, setFulfillmentFilter] = useState('ALL')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)

  const toastRef = useRef(toast)
  toastRef.current = toast

  const loadOrders = useCallback(async (opts?: { forceStats?: boolean }) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const needStats = !statsLoadedRef.current || Boolean(opts?.forceStats)
      const params = new URLSearchParams({ page: String(page), limit: '20', status: statusFilter, search, sort })
      if (paymentFilter !== 'ALL') params.set('payment_status', paymentFilter)
      if (fulfillmentFilter !== 'ALL') params.set('fulfillment_type', fulfillmentFilter)
      if (needStats) params.set('include_stats', 'true')
      const dateFrom = getDateFrom(datePreset)
      if (dateFrom) params.set('date_from', dateFrom)

      const response = await fetch(`/api/orders?${params}`, { signal: controller.signal, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) throw new Error(payload?.error ?? 'No se pudieron cargar los pedidos.')
      const data = payload.data as OrdersPayload
      setOrders(data.orders)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      if (data.stats) { setStats(data.stats); statsLoadedRef.current = true }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      toastRef.current({ title: 'Error al cargar pedidos', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }, [page, search, statusFilter, paymentFilter, fulfillmentFilter, datePreset, sort])

  useEffect(() => {
    const t = window.setTimeout(() => void loadOrders(), 250)
    return () => window.clearTimeout(t)
  }, [loadOrders])

  async function updateStatus(order: CustomerOrder, nextStatus: OrderStatus) {
    if (nextStatus === 'CANCELLED' && cancelConfirmId !== order.id) { setCancelConfirmId(order.id); return }
    const currentIdx = ORDER_FLOW.indexOf(order.status)
    const nextIdx = ORDER_FLOW.indexOf(nextStatus)
    const isRegression = nextIdx !== -1 && nextIdx < currentIdx
    const rKey = `regress-${order.id}-${nextStatus}`
    if (isRegression && cancelConfirmId !== rKey) { setCancelConfirmId(rKey); return }
    setCancelConfirmId(null); setUpdatingId(order.id)
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) throw new Error(payload?.error ?? 'No se pudo actualizar.')
      const updated = payload.data as CustomerOrder
      setOrders((cur) => {
        const mapped = cur.map((r) => r.id === order.id ? updated : r)
        return statusFilter !== 'ALL' && updated.status !== statusFilter ? mapped.filter((r) => r.id !== order.id) : mapped
      })
      if (selectedOrder?.id === order.id) {
        if (statusFilter !== 'ALL' && updated.status !== statusFilter) setSelectedOrder(null)
        else setSelectedOrder(updated)
      }
      setStats((cur) => ({ ...cur, [order.status]: Math.max(0, (cur[order.status] ?? 0) - 1), [nextStatus]: (cur[nextStatus] ?? 0) + 1 }))
      toast({ title: 'Estado actualizado', description: `${order.order_number} → ${ORDER_STATUS_META[nextStatus].label}` })
    } catch (error) {
      toast({ title: 'No se pudo actualizar', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally { setUpdatingId(null) }
  }

  async function updatePayment(order: CustomerOrder, paymentStatus: PaymentStatus) {
    setUpdatingId(order.id)
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: paymentStatus }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) throw new Error(payload?.error ?? 'No se pudo actualizar.')
      const updated = payload.data as CustomerOrder
      setOrders((cur) => {
        const mapped = cur.map((r) => r.id === order.id ? updated : r)
        return paymentFilter !== 'ALL' && updated.payment_status !== paymentFilter ? mapped.filter((r) => r.id !== order.id) : mapped
      })
      if (selectedOrder?.id === order.id) {
        if (paymentFilter !== 'ALL' && updated.payment_status !== paymentFilter) setSelectedOrder(null)
        else setSelectedOrder(updated)
      }
      toast({ title: 'Pago actualizado', description: `${order.order_number} → ${PAYMENT_STATUS_META[paymentStatus].label}` })
    } catch (error) {
      toast({ title: 'No se pudo actualizar el pago', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally { setUpdatingId(null) }
  }

  const hasActiveFilters = search !== '' || statusFilter !== 'ALL' || paymentFilter !== 'ALL' || fulfillmentFilter !== 'ALL' || datePreset !== 'all'
  function clearFilters() { setPage(1); setSearch(''); setStatusFilter('ALL'); setPaymentFilter('ALL'); setFulfillmentFilter('ALL'); setDatePreset('all') }
  function handleSelectOrder(order: CustomerOrder) { setSelectedOrder((prev) => prev?.id === order.id ? null : order) }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Gestiona pedidos, estados y pagos en tiempo real.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportOrdersCSV(orders)} disabled={orders.length === 0} className="gap-1.5 rounded-xl">
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadOrders({ forceStats: true })} disabled={loading} className="gap-1.5 rounded-xl">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Actualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 rounded-xl">
            <Plus className="h-3.5 w-3.5" /> Nuevo pedido
          </Button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_KEYS.map((key) => (
          <StatCard key={key} statusKey={key} count={stats[key] ?? 0} active={statusFilter === key}
            onClick={() => { setPage(1); setStatusFilter((prev) => prev === key ? 'ALL' : key) }} />
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }}
              className="h-9 rounded-xl pl-9 pr-8" placeholder="Número, cliente, email o teléfono…" />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setPage(1); setStatusFilter(v) }}>
            <SelectTrigger className="h-9 w-[160px] gap-1.5 rounded-xl">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              {ORDER_STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={(v) => { setPage(1); setPaymentFilter(v) }}>
            <SelectTrigger className="h-9 w-[145px] rounded-xl"><SelectValue placeholder="Pago" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todo pago</SelectItem>
              {PAYMENT_STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fulfillmentFilter} onValueChange={(v) => { setPage(1); setFulfillmentFilter(v) }}>
            <SelectTrigger className="h-9 w-[135px] rounded-xl"><SelectValue placeholder="Entrega" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toda entrega</SelectItem>
              <SelectItem value="PICKUP">Retiro en local</SelectItem>
              <SelectItem value="DELIVERY">Delivery</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => { setPage(1); setSort(v as SortKey) }}>
            <SelectTrigger className="h-9 w-[155px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más reciente</SelectItem>
              <SelectItem value="oldest">Más antiguo</SelectItem>
              <SelectItem value="amount_desc">Mayor monto</SelectItem>
              <SelectItem value="amount_asc">Menor monto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex overflow-hidden rounded-xl border">
              {DATE_PRESETS.map((preset) => (
                <button key={preset.value} type="button"
                  onClick={() => { setPage(1); setDatePreset(preset.value) }}
                  className={cn('px-3 py-1.5 text-xs font-semibold transition-colors',
                    datePreset === preset.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-xl text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="h-3 w-3" /> Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className={cn('grid gap-4', selectedOrder ? 'lg:grid-cols-[1fr_420px]' : 'grid-cols-1')}>
        {/* List */}
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-medium text-muted-foreground">
              {loading ? 'Cargando…' : `${total} pedido${total !== 1 ? 's' : ''}`}
            </span>
            {hasActiveFilters && <Badge variant="secondary" className="rounded-full text-xs">Filtrado</Badge>}
          </div>

          {loading ? <OrderListSkeleton /> : orders.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 text-center">
              <PackageSearch className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 font-semibold">Sin pedidos</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilters ? 'Ningún pedido coincide con los filtros.' : 'Crea el primer pedido para comenzar.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={clearFilters}>Limpiar filtros</Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <OrderRow key={order.id} order={order}
                  selected={selectedOrder?.id === order.id}
                  updating={updatingId === order.id}
                  onClick={() => handleSelectOrder(order)}
                  onAdvanceStatus={(s) => void updateStatus(order, s)} />
              ))}
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="gap-1.5 rounded-xl">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground">Página <strong>{page}</strong> de <strong>{totalPages}</strong></span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="gap-1.5 rounded-xl">
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Detail panel — desktop sticky */}
        {selectedOrder && (
          <div className="hidden lg:block">
            <div className="sticky top-4 overflow-hidden rounded-2xl border bg-card shadow-lg" style={{ maxHeight: 'calc(100vh - 7rem)' }}>
              <OrderDetailPanel
                order={selectedOrder} updating={updatingId === selectedOrder.id}
                cancelConfirmId={cancelConfirmId?.startsWith(selectedOrder.id) || cancelConfirmId === selectedOrder.id ? cancelConfirmId : null}
                onClose={() => setSelectedOrder(null)}
                onStatusChange={(s) => void updateStatus(selectedOrder, s)}
                onPaymentChange={(s) => void updatePayment(selectedOrder, s)}
                onCancelConfirm={() => void updateStatus(selectedOrder, 'CANCELLED')}
                onCancelDismiss={() => setCancelConfirmId(null)} />
            </div>
          </div>
        )}
      </div>

      {/* Detail panel — mobile overlay */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setSelectedOrder(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold">Detalle del pedido</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <OrderDetailPanel
              order={selectedOrder} updating={updatingId === selectedOrder.id}
              cancelConfirmId={cancelConfirmId?.startsWith(selectedOrder.id) || cancelConfirmId === selectedOrder.id ? cancelConfirmId : null}
              onClose={() => setSelectedOrder(null)}
              onStatusChange={(s) => void updateStatus(selectedOrder, s)}
              onPaymentChange={(s) => void updatePayment(selectedOrder, s)}
              onCancelConfirm={() => void updateStatus(selectedOrder, 'CANCELLED')}
              onCancelDismiss={() => setCancelConfirmId(null)} />
          </div>
        </div>
      )}

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen}
        onCreated={() => void loadOrders({ forceStats: true })} />
    </div>
  )
}
