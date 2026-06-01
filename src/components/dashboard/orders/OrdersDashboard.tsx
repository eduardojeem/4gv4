'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, CheckCircle2,
  ChevronLeft, ChevronRight, Download, Loader2,
  Mail, MapPin, MessageSquare, Package, PackageSearch, Phone,
  Plus, RefreshCw, Search, ShoppingBag, Store, Truck, X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { isPaymentConfirmable } from '@/lib/orders/payment-flow'
import {
  ORDER_FLOW, ORDER_STATUS_META, ORDER_STATUS_OPTIONS,
  PAYMENT_METHOD_META, PAYMENT_STATUS_META, PAYMENT_STATUS_OPTIONS,
} from '@/lib/orders/constants'
import type { CustomerOrder, OrderStatus, PaymentStatus } from '@/lib/orders/types'
import { CreateOrderDialog } from './CreateOrderDialog'
import { formatDate, formatMoney } from './format'

// ─── Types ────────────────────────────────────────────────────────────────────
type DatePreset = 'all' | 'today' | 'week' | 'month'
type SortDir = 'desc' | 'asc'

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

// ─── Status tab config ────────────────────────────────────────────────────────
type StatusTab = { value: string; label: string; sublabel: string; icon: React.ElementType }

const STATUS_TABS: StatusTab[] = [
  { value: 'PENDING',   label: 'Por confirmar', sublabel: 'Pedidos nuevos',        icon: ORDER_STATUS_META.PENDING.icon },
  { value: 'CONFIRMED', label: 'Confirmados',   sublabel: 'Listos para preparar',  icon: ORDER_STATUS_META.CONFIRMED.icon },
  { value: 'PREPARING', label: 'Preparando',    sublabel: 'En armado',             icon: ORDER_STATUS_META.PREPARING.icon },
  { value: 'READY',     label: 'Listos',        sublabel: 'Para enviar o retirar', icon: ORDER_STATUS_META.READY.icon },
  { value: 'SHIPPED',   label: 'En camino',     sublabel: 'Despachados',           icon: ORDER_STATUS_META.SHIPPED.icon },
  { value: 'ALL',       label: 'Todos',         sublabel: 'Historial completo',    icon: ShoppingBag },
]

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

// ─── Status tab ───────────────────────────────────────────────────────────────
function StatusTab({ tab, count, active, onClick }: {
  tab: StatusTab; count: number; active: boolean; onClick: () => void
}) {
  const Icon = tab.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-all duration-150 min-w-[130px]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
        active
          ? 'border-blue-500/50 bg-blue-600/20 text-white shadow-lg shadow-blue-500/10'
          : 'border-white/8 bg-white/4 text-slate-400 hover:border-white/15 hover:bg-white/8 hover:text-slate-200'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5', active ? 'text-blue-400' : 'text-slate-500')} />
          <span className="text-sm font-semibold">{tab.label}</span>
        </div>
        <span className={cn(
          'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums',
          active ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-300'
        )}>{count}</span>
      </div>
      <p className={cn('text-[11px]', active ? 'text-blue-300/80' : 'text-slate-600')}>{tab.sublabel}</p>
    </button>
  )
}

// ─── Payment status pill ──────────────────────────────────────────────────────
function PaymentPill({ status }: { status: PaymentStatus }) {
  const colors: Record<PaymentStatus, string> = {
    PENDING:  'text-rose-300',
    PAID:     'text-emerald-400',
    PARTIAL:  'text-blue-400',
    REFUNDED: 'text-slate-400',
    FAILED:   'text-rose-400',
  }
  const normalized = (String(status).toUpperCase()) as PaymentStatus
  const label = PAYMENT_STATUS_META[normalized]?.label ?? status
  return (
    <span className={cn('text-xs font-semibold', colors[normalized] ?? 'text-slate-400')}>
      {label}
    </span>
  )
}

// ─── Order status pill ────────────────────────────────────────────────────────
function StatusPill({ status }: { status: OrderStatus }) {
  const colors: Record<OrderStatus, string> = {
    PENDING:   'border-amber-500/40 bg-amber-500/15 text-amber-300',
    CONFIRMED: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
    PREPARING: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300',
    READY:     'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    SHIPPED:   'border-violet-500/40 bg-violet-500/15 text-violet-300',
    DELIVERED: 'border-slate-500/40 bg-slate-500/15 text-slate-300',
    CANCELLED: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
  }
  const normalized = (String(status).toUpperCase()) as OrderStatus
  const meta = ORDER_STATUS_META[normalized]
  if (!meta) return <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{status}</span>
  const Icon = meta.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', colors[normalized] ?? 'border-white/10 bg-white/5 text-slate-400')}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}

// ─── Source / channel badge ───────────────────────────────────────────────────
function ChannelBadge({ channel = 'Web' }: { channel?: string }) {
  return (
    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
      {channel}
    </span>
  )
}

// ─── Fulfillment badge ────────────────────────────────────────────────────────
function FulfillmentBadge({ type }: { type: 'PICKUP' | 'DELIVERY' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium',
      type === 'DELIVERY'
        ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
        : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
    )}>
      {type === 'DELIVERY' ? <Truck className="h-3 w-3" /> : <Store className="h-3 w-3" />}
      {type === 'DELIVERY' ? 'Delivery' : 'Retiro'}
    </span>
  )
}

// ─── Order row (always-expanded card, actions on right column) ────────────────
function OrderRow({
  order, selected, updating, onSelect,
  onStatusChange, onPaymentChange, onAdvanceStatus, onCancelRequest, onDetailRequest,
}: {
  order: CustomerOrder
  selected: boolean
  updating: boolean
  onSelect: (checked: boolean) => void
  onStatusChange: (s: OrderStatus) => void
  onPaymentChange: (s: PaymentStatus) => void
  onAdvanceStatus: (s: OrderStatus) => void
  onCancelRequest: () => void
  onDetailRequest: () => void
}) {
  const { toast } = useToast()
  const currentIdx = ORDER_FLOW.indexOf(order.status)
  const isTerminal = ['DELIVERED', 'CANCELLED'].includes(order.status)
  const nextStatus = !isTerminal && currentIdx < ORDER_FLOW.length - 1 ? ORDER_FLOW[currentIdx + 1] : null
  const PayIcon = PAYMENT_METHOD_META[order.payment_method]?.icon
  const payLabel = PAYMENT_METHOD_META[order.payment_method]?.label ?? order.payment_method
  const paymentPending = isPaymentConfirmable(order.payment_status)
  const canConfirmPayment = paymentPending && order.status !== 'CANCELLED'
  const paymentActionLabel = order.payment_status === 'PAID'
    ? 'Pago confirmado'
    : order.payment_status === 'REFUNDED'
      ? 'Pago reembolsado'
      : order.status === 'CANCELLED'
        ? 'Pedido cancelado'
        : 'Confirmar pago'
  const manualStatusOptions = ORDER_STATUS_OPTIONS.filter((opt) =>
    opt.value === nextStatus || opt.value === 'CANCELLED'
  )

  const handleWhatsApp = () => {
    if (!order.customer_phone) return
    const phone = order.customer_phone.replace(/\D/g, '')
    const msg = `¡Hola ${order.customer_name}! Te contactamos sobre tu pedido ${order.order_number}.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handleCopy = () => {
    const items = order.order_items.map((i) => `• ${i.quantity}x ${i.product_name}`).join('\n')
    const text = `Pedido: ${order.order_number}\nCliente: ${order.customer_name}\nTel: ${order.customer_phone ?? '-'}\nTotal: ${formatMoney(order.total)}\n${items}`
    navigator.clipboard.writeText(text)
    toast({ title: 'Copiado', description: order.order_number })
  }

  return (
    <div className={cn(
      'flex overflow-hidden rounded-xl border transition-all duration-150',
      selected ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/8 bg-white/3 hover:border-white/12'
    )}>
      {/* ── Left: main content ── */}
      <div className="flex-1 min-w-0 px-4 py-3.5 space-y-3">

        {/* Top row: checkbox | order# | badges | amount */}
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox
            checked={selected} onCheckedChange={onSelect}
            className="border-white/20 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500"
          />
          <span className="font-mono text-sm font-bold text-blue-400 shrink-0">ORD {order.order_number}</span>
          <StatusPill status={order.status} />
          <ChannelBadge />
          <FulfillmentBadge type={order.fulfillment_type} />
          {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <div className="ml-auto text-right shrink-0">
            <p className="text-base font-bold tabular-nums text-white">{formatMoney(order.total)}</p>
            <p className="text-[11px] text-slate-500">{order.order_items.length} {order.order_items.length === 1 ? 'producto' : 'productos'}</p>
          </div>
        </div>

        {/* Date */}
        <p className="text-[11px] text-slate-600">Creado el {formatDate(order.created_at)}</p>

        {/* Info panels: Cliente | Pago | Entrega */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          {/* Cliente */}
          <div className="rounded-lg border border-white/8 bg-white/3 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Cliente</p>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-1.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[10px] font-bold text-blue-400">
                {order.customer_name[0]?.toUpperCase()}
              </div>
              <span className="truncate">{order.customer_name}</span>
            </div>
            {order.customer_email && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                <Mail className="h-3 w-3 shrink-0" />{order.customer_email}
              </div>
            )}
            {order.customer_phone && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="font-medium text-slate-400">{order.customer_phone}</span>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="ml-1 inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 hover:text-emerald-200"
                >
                  <MessageSquare className="h-3 w-3" />
                  Escribir
                </button>
              </div>
            )}
          </div>

          {/* Pago */}
          <div className={cn(
            'rounded-lg border p-3',
            paymentPending
              ? 'border-rose-500/45 bg-rose-500/10 shadow-inner shadow-rose-950/20'
              : 'border-white/8 bg-white/3'
          )}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Pago</p>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-1.5">
              {PayIcon && <PayIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
              {payLabel}
            </div>
            <PaymentPill status={order.payment_status} />
            {canConfirmPayment && (
              <p className="mt-1.5 text-[11px] font-bold text-rose-300 leading-snug">
                Pago pendiente. Confirmar cuando el cliente pague.
              </p>
            )}
            <div className="mt-2 space-y-0.5 text-xs text-slate-500">
              <div className="flex justify-between"><span>Subtotal:</span><span className="tabular-nums text-slate-400">{formatMoney(order.subtotal)}</span></div>
              {order.shipping_cost > 0 && <div className="flex justify-between"><span>Envío:</span><span className="tabular-nums text-slate-400">{formatMoney(order.shipping_cost)}</span></div>}
              {order.discount_amount > 0 && <div className="flex justify-between text-emerald-500"><span>Descuento:</span><span>−{formatMoney(order.discount_amount)}</span></div>}
            </div>
          </div>

          {/* Entrega */}
          <div className="rounded-lg border border-white/8 bg-white/3 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Entrega</p>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-1.5">
              {order.fulfillment_type === 'DELIVERY'
                ? <Truck className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                : <Store className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
              {order.fulfillment_type === 'DELIVERY' ? 'Delivery' : 'Retiro en local'}
            </div>
            {order.customer_address && (
              <div className="flex items-start gap-1.5 text-xs text-slate-500">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="leading-snug">{order.customer_address}</span>
              </div>
            )}
            {order.notes && <p className="mt-1.5 text-[11px] italic text-slate-600 truncate">{order.notes}</p>}
          </div>
        </div>

        {/* Product chips */}
        <div className="flex flex-wrap gap-1.5">
          {order.order_items.map((item) => (
            <span key={item.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-2.5 py-1 text-xs font-medium text-slate-300">
              <Package className="h-3 w-3 text-slate-500" />
              {item.quantity}x {item.product_name}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right: action column ── */}
      <div className="flex shrink-0 flex-col gap-2 border-l border-white/8 p-3 min-w-[160px] justify-start">
        {/* Advance status */}
        {nextStatus && (
          <Button size="sm" disabled={updating}
            onClick={() => onAdvanceStatus(nextStatus)}
            className="w-full h-8 gap-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40 justify-center">
            {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {ORDER_STATUS_META[nextStatus].label}
          </Button>
        )}
        {isTerminal && (
          <span className={cn(
            'rounded-lg px-3 py-1.5 text-center text-xs font-bold',
            order.status === 'DELIVERED' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
          )}>
            {ORDER_STATUS_META[order.status].label}
          </span>
        )}

        {/* Detail */}
        <Button size="sm" variant="ghost"
          onClick={onDetailRequest}
          className="w-full h-7 gap-1 rounded-lg text-[11px] text-slate-400 hover:bg-white/8 hover:text-slate-200 justify-center">
          <PackageSearch className="h-3 w-3" /> Detalle producto
        </Button>

        {/* Payment action */}
        {canConfirmPayment ? (
          <Button size="sm" disabled={updating}
            onClick={() => onPaymentChange('PAID')}
            className="h-9 w-full justify-center gap-1.5 rounded-lg border border-emerald-300/70 bg-emerald-500 px-3 text-xs font-bold text-emerald-950 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-200/30 transition-all hover:bg-emerald-400 hover:text-emerald-950 hover:shadow-emerald-500/20 disabled:opacity-45">
            <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar pago
          </Button>
        ) : (
          <span className={cn(
            'flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold',
            order.payment_status === 'PAID'
              ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300'
              : 'border-white/10 bg-white/5 text-slate-500'
          )}>
            <CheckCircle2 className="h-3.5 w-3.5" /> {paymentActionLabel}
          </span>
        )}

        <div className="border-t border-white/8 my-0.5" />

        {/* Status selector — usar value vacío para que el estado actual
            siempre sea seleccionable y dispare onChange */}
        <Select value="" onValueChange={(v) => v && onStatusChange(v as OrderStatus)} disabled={updating || isTerminal}>
          <SelectTrigger className="h-8 rounded-lg border-white/10 bg-white/5 text-xs text-slate-300">
            <span className="truncate">{ORDER_STATUS_META[order.status]?.label ?? order.status}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__placeholder" disabled className="text-xs text-slate-500 italic">
              Cambiar estado a…
            </SelectItem>
            {manualStatusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Cancel */}
        {!isTerminal && (
          <button type="button" onClick={onCancelRequest}
            className="text-[11px] text-rose-500 hover:text-rose-400 transition-colors text-center mt-auto pt-1">
            Cancelar pedido
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function OrderSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-xl border border-white/8 bg-white/3 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded bg-white/10" />
            <Skeleton className="h-4 w-36 rounded bg-white/10" />
            <Skeleton className="h-5 w-20 rounded-full bg-white/10" />
            <Skeleton className="h-5 w-16 rounded bg-white/10" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-8 w-28 rounded-lg bg-white/10" />
              <Skeleton className="h-7 w-20 rounded-lg bg-white/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Cancel confirm dialog ────────────────────────────────────────────────────
function CancelConfirmBanner({ onConfirm, onDismiss }: { onConfirm: () => void; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
      <span className="flex-1 text-sm font-medium text-rose-300">¿Cancelar este pedido? Esta acción no se puede deshacer.</span>
      <button type="button" onClick={onConfirm} className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-500">Sí, cancelar</button>
      <button type="button" onClick={onDismiss} className="text-xs text-slate-400 hover:text-slate-200">No</button>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
function OrderDetailDialog({ order, open, onOpenChange }: {
  order: CustomerOrder | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto border-white/10 bg-[#0d1117] text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PackageSearch className="h-5 w-5 text-blue-400" />
            Detalle del pedido {order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cliente</p>
            <p className="mt-1 text-sm font-semibold text-white">{order.customer_name}</p>
            {order.customer_phone && <p className="mt-1 text-xs text-slate-400">{order.customer_phone}</p>}
            {order.customer_email && <p className="mt-1 text-xs text-slate-400">{order.customer_email}</p>}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Estado</p>
            <p className="mt-1 text-sm font-semibold text-white">{ORDER_STATUS_META[order.status]?.label ?? order.status}</p>
            <p className="mt-1 text-xs text-slate-400">Creado {formatDate(order.created_at)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pago</p>
            <p className={cn('mt-1 text-sm font-semibold', order.payment_status === 'PAID' ? 'text-emerald-300' : 'text-rose-300')}>
              {PAYMENT_STATUS_META[order.payment_status]?.label ?? order.payment_status}
            </p>
            <p className="mt-1 text-xs text-slate-400">{PAYMENT_METHOD_META[order.payment_method]?.label ?? order.payment_method}</p>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5">
          <div className="grid grid-cols-[1fr_70px_110px_110px] gap-2 border-b border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Producto</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Subtotal</span>
          </div>
          {order.order_items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_70px_110px_110px] gap-2 border-b border-white/5 px-3 py-3 text-sm last:border-0">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-100">{item.product_name}</p>
                {item.product_sku && <p className="mt-0.5 text-xs text-slate-500">SKU {item.product_sku}</p>}
              </div>
              <span className="text-right tabular-nums text-slate-300">{item.quantity}</span>
              <span className="text-right tabular-nums text-slate-300">{formatMoney(item.unit_price)}</span>
              <span className="text-right tabular-nums font-semibold text-white">{formatMoney(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="ml-auto w-full max-w-xs space-y-1 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
          <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
          <div className="flex justify-between text-slate-400"><span>Envio</span><span>{formatMoney(order.shipping_cost)}</span></div>
          {order.discount_amount > 0 && <div className="flex justify-between text-emerald-300"><span>Descuento</span><span>-{formatMoney(order.discount_amount)}</span></div>}
          <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold text-white"><span>Total</span><span>{formatMoney(order.total)}</span></div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function OrdersDashboard() {
  const { toast } = useToast()
  const abortRef = useRef<AbortController | null>(null)
  const statsLoadedRef = useRef(false)

  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('PENDING')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<CustomerOrder | null>(null)

  const toastRef = useRef(toast)
  toastRef.current = toast

  // Derived metrics
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayOrders = orders.filter((o) => o.created_at.startsWith(todayStr))
  const todayPaidRevenue = todayOrders.filter((o) => o.payment_status === 'PAID').reduce((s, o) => s + o.total, 0)
  const needsAction = (stats['PENDING'] ?? 0) + (stats['READY'] ?? 0)

  const loadOrders = useCallback(async (opts?: { forceStats?: boolean }) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const needStats = !statsLoadedRef.current || Boolean(opts?.forceStats)
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        status: statusTab,
        search,
        sort: sortDir === 'desc' ? 'newest' : 'oldest',
      })
      if (paymentFilter !== 'ALL') params.set('payment_status', paymentFilter)
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
  }, [page, search, statusTab, paymentFilter, datePreset, sortDir])

  useEffect(() => {
    const t = window.setTimeout(() => void loadOrders(), 250)
    return () => window.clearTimeout(t)
  }, [loadOrders])

  async function updateStatus(order: CustomerOrder, nextStatus: OrderStatus) {
    if (nextStatus === 'CANCELLED' && cancelConfirmId !== order.id) { setCancelConfirmId(order.id); return }
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
        return statusTab !== 'ALL' && updated.status !== statusTab ? mapped.filter((r) => r.id !== order.id) : mapped
      })
      setStats((cur) => ({ ...cur, [order.status]: Math.max(0, (cur[order.status] ?? 0) - 1), [nextStatus]: (cur[nextStatus] ?? 0) + 1 }))
      toast({ title: 'Estado actualizado', description: `${order.order_number} → ${ORDER_STATUS_META[nextStatus].label}` })
    } catch (error) {
      toast({ title: 'No se pudo actualizar', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally { setUpdatingId(null) }
  }

  async function updatePayment(order: CustomerOrder, paymentStatus: PaymentStatus) {
    setUpdatingId(order.id)
    try {
      const response = await fetch(`/api/orders/${order.id}/payment`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: paymentStatus }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error ?? 'No se pudo actualizar.')
      }
      const updated = payload.data as CustomerOrder
      setOrders((cur) => cur.map((r) => r.id === order.id ? updated : r))
      setDetailOrder((cur) => cur?.id === order.id ? updated : cur)
      toast({ title: 'Pago actualizado', description: `${order.order_number} → ${PAYMENT_STATUS_META[paymentStatus].label}` })
    } catch (error) {
      toast({ title: 'No se pudo actualizar el pago', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally {
      setUpdatingId(null) 
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  const hasActiveFilters = search !== '' || paymentFilter !== 'ALL' || datePreset !== 'all'

  function resetFilters() {
    setSearch(''); setPaymentFilter('ALL'); setDatePreset('all'); setPage(1)
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Pedidos del canal digital</h1>
            <p className="mt-1 text-sm text-slate-500">Gestiona cumplimiento, cambios de estado y altas manuales desde una sola vista.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadOrders({ forceStats: true })} disabled={loading}
              className="gap-1.5 rounded-lg border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportOrdersCSV(orders)} disabled={orders.length === 0}
              className="gap-1.5 rounded-lg border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white">
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}
              className="gap-1.5 rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-500">
              <Plus className="h-3.5 w-3.5" /> Nueva orden
            </Button>
          </div>
        </div>

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Pedidos totales" value={Object.values(stats).reduce((s, v) => s + v, 0) || total} />
          <MetricCard label="Requieren acción" value={needsAction} />
          <MetricCard label="Pedidos hoy" value={todayOrders.length} />
          <MetricCard label="Cobrado hoy" value={`Gs. ${todayPaidRevenue.toLocaleString('es-PY')}`} />
        </div>

        {/* ── Status tabs ── */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'ALL'
              ? Object.values(stats).reduce((s, v) => s + v, 0) || total
              : (stats[tab.value] ?? 0)
            return (
              <StatusTab key={tab.value} tab={tab} count={count}
                active={statusTab === tab.value}
                onClick={() => { setStatusTab(tab.value); setPage(1) }} />
            )
          })}
        </div>

        {/* ── Filters bar ── */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }}
                className="h-9 rounded-lg border-white/10 bg-white/5 pl-9 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-blue-500/20"
                placeholder="Buscar por número, cliente, email o teléfono…" />
            </div>

            <Select value={datePreset} onValueChange={(v) => { setDatePreset(v as DatePreset); setPage(1) }}>
              <SelectTrigger className="h-9 w-[150px] rounded-lg border-white/10 bg-white/5 text-xs text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los días</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Últimos 7 días</SelectItem>
                <SelectItem value="month">Últimos 30 días</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusTab} onValueChange={(v) => { setStatusTab(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[150px] rounded-lg border-white/10 bg-white/5 text-xs text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                {ORDER_STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[145px] rounded-lg border-white/10 bg-white/5 text-xs text-slate-300">
                <SelectValue placeholder="Todos los pagos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los pagos</SelectItem>
                {PAYMENT_STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value="created_at" onValueChange={() => {}}>
              <SelectTrigger className="h-9 w-[110px] rounded-lg border-white/10 bg-white/5 text-xs text-slate-300">
                <SelectValue placeholder="Fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Fecha</SelectItem>
                <SelectItem value="total">Monto</SelectItem>
              </SelectContent>
            </Select>

            <button type="button" onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10">
              <ArrowLeft className={cn('h-3.5 w-3.5 transition-transform', sortDir === 'asc' && 'rotate-90')} />
              {sortDir === 'desc' ? 'Descendente' : 'Ascendente'}
            </button>
          </div>

          {/* Active filter chips + reset */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
              {statusTab !== 'ALL' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-300">
                  Estado activo
                  <button type="button" onClick={() => setStatusTab('ALL')} className="ml-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              )}
              {paymentFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-400">
                  {PAYMENT_STATUS_META[paymentFilter as PaymentStatus]?.label}
                  <button type="button" onClick={() => setPaymentFilter('ALL')} className="ml-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              )}
              <button type="button" onClick={resetFilters}
                className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors">
                Restablecer filtros
              </button>
            </div>
          )}
        </div>

        {/* ── Cancel confirm ── */}
        {cancelConfirmId && (
          <CancelConfirmBanner
            onConfirm={() => {
              const order = orders.find((o) => o.id === cancelConfirmId || cancelConfirmId.includes(o.id))
              if (order) void updateStatus(order, 'CANCELLED')
              else setCancelConfirmId(null)
            }}
            onDismiss={() => setCancelConfirmId(null)}
          />
        )}

        {/* ── Order list ── */}
        <div className="space-y-2">
          {/* List header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-300">
                  Pedidos <span className="text-slate-500">({loading ? '…' : total})</span>
                </span>
              </div>
              {selectedIds.size > 0 && (
                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
                  {selectedIds.size} seleccionados
                </span>
              )}
            </div>
            {totalPages > 1 && (
              <button type="button" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Seleccionar página
              </button>
            )}
          </div>

          {loading ? <OrderSkeleton /> : orders.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-white/8 bg-white/3 text-center">
              <PackageSearch className="h-10 w-10 text-slate-700" />
              <p className="mt-3 font-semibold text-slate-400">Sin pedidos</p>
              <p className="mt-1 text-sm text-slate-600">
                {hasActiveFilters ? 'Ningún pedido coincide con los filtros.' : 'Crea el primer pedido para comenzar.'}
              </p>
              {hasActiveFilters && (
                <button type="button" onClick={resetFilters}
                  className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  selected={selectedIds.has(order.id)}
                  updating={updatingId === order.id}
                  onSelect={(checked) => toggleSelect(order.id, checked)}
                  onStatusChange={(s) => void updateStatus(order, s)}
                  onPaymentChange={(s) => void updatePayment(order, s)}
                  onAdvanceStatus={(s) => void updateStatus(order, s)}
                  onCancelRequest={() => setCancelConfirmId(order.id)}
                  onDetailRequest={() => setDetailOrder(order)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1.5 rounded-lg border-white/10 bg-white/5 text-slate-300 hover:bg-white/10">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-slate-500">
                Página <strong className="text-slate-300">{page}</strong> de <strong className="text-slate-300">{totalPages}</strong>
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="gap-1.5 rounded-lg border-white/10 bg-white/5 text-slate-300 hover:bg-white/10">
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Footer count */}
          {!loading && orders.length > 0 && (
            <p className="pt-1 text-center text-xs text-slate-700">
              {total} pedido{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen}
        onCreated={() => void loadOrders({ forceStats: true })} />
      <OrderDetailDialog
        order={detailOrder}
        open={Boolean(detailOrder)}
        onOpenChange={(open) => { if (!open) setDetailOrder(null) }}
      />
    </div>
  )
}
