'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, CheckCircle2,
  ChevronLeft, ChevronRight, Coins, Copy, Download, Loader2,
  Mail, MapPin, MessageSquare, Package, PackageSearch, Phone,
  Plus, RefreshCw, Search, ShoppingBag, Store, Truck, X, Info
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
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
  meta: { todayCount: number; todayRevenue: number } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDateFrom(preset: DatePreset): string | null {
  if (preset === 'all') return null
  const now = new Date()
  if (preset === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  if (preset === 'week') return new Date(now.getTime() - 7 * 86400000).toISOString()
  return new Date(now.getTime() - 30 * 86400000).toISOString()
}

// Escape a CSV cell: double internal quotes and neutralize spreadsheet formula
// injection (values starting with = + - @ or a control char are treated as
// formulas by Excel/Sheets) by prefixing a single quote.
function csvCell(value: unknown): string {
  let s = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

// Map the sort field + direction to the API's `sort` param value.
function buildSortParam(field: 'created_at' | 'total', dir: SortDir): string {
  if (field === 'total') return dir === 'desc' ? 'amount_desc' : 'amount_asc'
  return dir === 'desc' ? 'newest' : 'oldest'
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
  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `pedidos-${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ─── Status tab config ────────────────────────────────────────────────────────
type TabAccent = 'amber' | 'blue' | 'cyan' | 'emerald' | 'violet' | 'slate'
type StatusTab = { value: string; label: string; sublabel: string; icon: React.ElementType; accent: TabAccent }

const STATUS_TABS: StatusTab[] = [
  { value: 'PENDING',   label: 'Por confirmar', sublabel: 'Pedidos nuevos',        icon: ORDER_STATUS_META.PENDING.icon,   accent: 'amber' },
  { value: 'CONFIRMED', label: 'Confirmados',   sublabel: 'Listos para preparar',  icon: ORDER_STATUS_META.CONFIRMED.icon, accent: 'blue' },
  { value: 'PREPARING', label: 'Preparando',    sublabel: 'En armado',             icon: ORDER_STATUS_META.PREPARING.icon, accent: 'cyan' },
  { value: 'READY',     label: 'Listos',        sublabel: 'Para enviar o retirar', icon: ORDER_STATUS_META.READY.icon,     accent: 'emerald' },
  { value: 'SHIPPED',   label: 'En camino',     sublabel: 'Despachados',           icon: ORDER_STATUS_META.SHIPPED.icon,   accent: 'violet' },
  { value: 'ALL',       label: 'Todos',         sublabel: 'Historial completo',    icon: ShoppingBag,                      accent: 'slate' },
]

const TAB_ACCENTS: Record<TabAccent, {
  activeBorder: string; activeBg: string; activeGlow: string
  activeIcon: string; activeBadge: string; idleIcon: string
}> = {
  amber:   { activeBorder: 'border-amber-500/50',   activeBg: 'bg-amber-50 dark:bg-amber-500/12',     activeGlow: 'shadow-amber-500/10',   activeIcon: 'text-amber-600 dark:text-amber-300',    activeBadge: 'bg-amber-500 text-amber-950',     idleIcon: 'text-amber-500 dark:text-amber-400/60' },
  blue:    { activeBorder: 'border-blue-500/50',    activeBg: 'bg-blue-50 dark:bg-blue-500/12',       activeGlow: 'shadow-blue-500/10',    activeIcon: 'text-blue-600 dark:text-blue-300',      activeBadge: 'bg-blue-500 text-white',          idleIcon: 'text-blue-500 dark:text-blue-400/60' },
  cyan:    { activeBorder: 'border-cyan-500/50',    activeBg: 'bg-cyan-50 dark:bg-cyan-500/12',       activeGlow: 'shadow-cyan-500/10',    activeIcon: 'text-cyan-600 dark:text-cyan-300',      activeBadge: 'bg-cyan-500 text-cyan-950',       idleIcon: 'text-cyan-500 dark:text-cyan-400/60' },
  emerald: { activeBorder: 'border-emerald-500/50', activeBg: 'bg-emerald-50 dark:bg-emerald-500/12', activeGlow: 'shadow-emerald-500/10', activeIcon: 'text-emerald-600 dark:text-emerald-300', activeBadge: 'bg-emerald-500 text-emerald-950', idleIcon: 'text-emerald-500 dark:text-emerald-400/60' },
  violet:  { activeBorder: 'border-violet-500/50',  activeBg: 'bg-violet-50 dark:bg-violet-500/12',   activeGlow: 'shadow-violet-500/10',  activeIcon: 'text-violet-600 dark:text-violet-300',  activeBadge: 'bg-violet-500 text-white',        idleIcon: 'text-violet-500 dark:text-violet-400/60' },
  slate:   { activeBorder: 'border-slate-400/40',   activeBg: 'bg-slate-100 dark:bg-white/8',         activeGlow: 'shadow-black/20',       activeIcon: 'text-slate-700 dark:text-slate-200',   activeBadge: 'bg-slate-400 text-slate-950',     idleIcon: 'text-slate-500' },
}

// ─── Metric card ──────────────────────────────────────────────────────────────
type MetricAccent = 'slate' | 'blue' | 'amber' | 'emerald'

const METRIC_ACCENTS: Record<MetricAccent, { ring: string; chip: string; glow: string }> = {
  slate:   { ring: 'border-slate-200 dark:border-white/10',         chip: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',            glow: 'from-slate-400/10' },
  blue:    { ring: 'border-blue-200 dark:border-blue-500/20',       chip: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',             glow: 'from-blue-500/15' },
  amber:   { ring: 'border-amber-200 dark:border-amber-500/25',     chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',         glow: 'from-amber-500/15' },
  emerald: { ring: 'border-emerald-200 dark:border-emerald-500/20', chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', glow: 'from-emerald-500/15' },
}

function MetricCard({ label, value, sub, icon: Icon, accent = 'slate', alert = false }: {
  label: string
  value: string | number
  sub?: string
  icon?: React.ElementType
  accent?: MetricAccent
  alert?: boolean
}) {
  const a = METRIC_ACCENTS[accent]
  return (
    <div className={cn(
      'group relative overflow-hidden rounded-2xl border bg-white p-4 transition-colors duration-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]',
      a.ring
    )}>
      <div className={cn('pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent blur-2xl opacity-70', a.glow)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-[26px] font-bold leading-none tabular-nums text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', a.chip)}>
            <Icon className="h-4.5 w-4.5" />
            {alert && (
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Status tab ───────────────────────────────────────────────────────────────
function StatusTab({ tab, count, active, onClick }: {
  tab: StatusTab; count: number; active: boolean; onClick: () => void
}) {
  const Icon = tab.icon
  const a = TAB_ACCENTS[tab.accent]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-all duration-150 min-w-[132px]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
        active
          ? cn('text-slate-800 dark:text-white shadow-lg', a.activeBorder, a.activeBg, a.activeGlow)
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-white/15 dark:hover:bg-white/[0.06] dark:hover:text-slate-200'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            'flex h-5 w-5 items-center justify-center rounded-md transition-colors',
            active ? cn('bg-slate-200/80 dark:bg-white/10', a.activeIcon) : cn('bg-slate-100 dark:bg-white/5', a.idleIcon, 'group-hover:bg-slate-200 dark:group-hover:bg-white/10')
          )}>
            <Icon className="h-3 w-3" />
          </span>
          <span className="text-sm font-semibold">{tab.label}</span>
        </div>
        <span className={cn(
          'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums transition-colors',
          active ? a.activeBadge : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
        )}>{count}</span>
      </div>
      <p className={cn('pl-7 text-[11px]', active ? 'text-slate-700 dark:text-slate-300/70' : 'text-slate-500 dark:text-slate-600')}>{tab.sublabel}</p>
    </button>
  )
}

// ─── Payment status pill ──────────────────────────────────────────────────────
function PaymentPill({ status }: { status: PaymentStatus }) {
  const colors: Record<PaymentStatus, string> = {
    PENDING:  'text-rose-600 dark:text-rose-300',
    PAID:     'text-emerald-600 dark:text-emerald-400',
    PARTIAL:  'text-blue-600 dark:text-blue-400',
    REFUNDED: 'text-slate-500 dark:text-slate-400',
    FAILED:   'text-rose-600 dark:text-rose-400',
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
    PENDING:   'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300',
    CONFIRMED: 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300',
    PREPARING: 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-300',
    READY:     'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300',
    SHIPPED:   'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300',
    DELIVERED: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300',
    CANCELLED: 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300',
  }
  const normalized = (String(status).toUpperCase()) as OrderStatus
  const meta = ORDER_STATUS_META[normalized]
  if (!meta) return <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">{status}</span>
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
    <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
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
        ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300'
        : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-400'
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
    toast.success('Copiado', { description: order.order_number })
  }

  return (
    <div className={cn(
      'flex overflow-hidden rounded-xl border transition-all duration-150',
      selected ? 'border-blue-400 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/5' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-white/12'
    )}>
      {/* ── Left: main content ── */}
      <div className="flex-1 min-w-0 px-4 py-3.5 space-y-3">

        {/* Top row: checkbox | order# | badges | amount */}
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox
            checked={selected} onCheckedChange={onSelect}
            className="border-slate-300 dark:border-white/20 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500"
          />
          <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 shrink-0">ORD {order.order_number}</span>
          <StatusPill status={order.status} />
          <ChannelBadge />
          <FulfillmentBadge type={order.fulfillment_type} />
          {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <div className="ml-auto text-right shrink-0">
            <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(order.total)}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">{order.order_items.length} {order.order_items.length === 1 ? 'producto' : 'productos'}</p>
          </div>
        </div>

        {/* Date */}
        <p className="text-[11px] text-slate-500 dark:text-slate-600">Creado el {formatDate(order.created_at)}</p>

        {/* Info panels: Cliente | Pago | Entrega */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          {/* Cliente */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/8 dark:bg-white/[0.03]">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Cliente</p>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-[10px] font-bold text-blue-600 dark:text-blue-400">
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
                <span className="font-medium text-slate-600 dark:text-slate-400">{order.customer_phone}</span>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="ml-1 inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-200"
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
              ? 'border-rose-400 bg-rose-50 shadow-inner shadow-rose-100 dark:border-rose-500/45 dark:bg-rose-500/10 dark:shadow-rose-950/20'
              : 'border-slate-200 bg-slate-50 dark:border-white/8 dark:bg-white/[0.03]'
          )}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Pago</p>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              {PayIcon && <PayIcon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />}
              {payLabel}
            </div>
            <PaymentPill status={order.payment_status} />
            {canConfirmPayment && (
              <p className="mt-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-300 leading-snug">
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/8 dark:bg-white/[0.03]">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Entrega</p>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              {order.fulfillment_type === 'DELIVERY'
                ? <Truck className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400 shrink-0" />
                : <Store className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />}
              {order.fulfillment_type === 'DELIVERY' ? 'Delivery' : 'Retiro en local'}
            </div>
            {order.customer_address && (
              <div className="flex items-start gap-1.5 text-xs text-slate-500">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="leading-snug">{order.customer_address}</span>
              </div>
            )}
            {order.notes && <p className="mt-1.5 text-[11px] italic text-slate-500 dark:text-slate-600 truncate">{order.notes}</p>}
          </div>
        </div>

        {/* Product chips */}
        <div className="flex flex-wrap gap-1.5">
          {order.order_items.map((item) => (
            <span key={item.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-white/8 dark:bg-white/[0.04] dark:text-slate-300">
              <Package className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              {item.quantity}x {item.product_name}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right: action column ── */}
      <div className="flex shrink-0 flex-col gap-2 border-l border-slate-200 dark:border-white/8 p-3 min-w-[160px] justify-start">
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
          order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
          )}>
            {ORDER_STATUS_META[order.status].label}
          </span>
        )}

        {/* Detail */}
        <Button size="sm" variant="ghost"
          onClick={onDetailRequest}
          className="w-full h-7 gap-1 rounded-lg text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-slate-200 justify-center">
          <PackageSearch className="h-3 w-3" /> Detalle producto
        </Button>

        {/* Copy order summary */}
        <Button size="sm" variant="ghost"
          onClick={handleCopy}
          className="w-full h-7 gap-1 rounded-lg text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-slate-200 justify-center">
          <Copy className="h-3 w-3" /> Copiar pedido
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
              ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-300'
              : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5'
          )}>
            <CheckCircle2 className="h-3.5 w-3.5" /> {paymentActionLabel}
          </span>
        )}

        <div className="border-t border-slate-200 dark:border-white/8 my-0.5" />

        {/* Status selector — usar value vacío para que el estado actual
            siempre sea seleccionable y dispare onChange */}
        <Select value="" onValueChange={(v) => v && onStatusChange(v as OrderStatus)} disabled={updating || isTerminal}>
          <SelectTrigger className="h-8 rounded-lg border-slate-200 bg-white text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
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
            className="text-[11px] text-rose-600 hover:text-rose-500 dark:text-rose-500 dark:hover:text-rose-400 transition-colors text-center mt-auto pt-1">
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
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/8 dark:bg-white/[0.02]">
          {/* Left: main content */}
          <div className="flex-1 min-w-0 space-y-3 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded bg-slate-200 dark:bg-white/10" />
              <Skeleton className="h-4 w-28 rounded bg-slate-200 dark:bg-white/10" />
              <Skeleton className="h-5 w-20 rounded-full bg-slate-200 dark:bg-white/10" />
              <Skeleton className="h-5 w-16 rounded bg-slate-200 dark:bg-white/10" />
              <div className="ml-auto text-right">
                <Skeleton className="h-5 w-24 rounded bg-slate-200 dark:bg-white/10" />
              </div>
            </div>
            <Skeleton className="h-3 w-40 rounded bg-slate-100 dark:bg-white/[0.07]" />
            <div className="grid gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, j) => (
                <div key={j} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/8 dark:bg-white/[0.02]">
                  <Skeleton className="h-2.5 w-14 rounded bg-slate-200 dark:bg-white/[0.07]" />
                  <Skeleton className="h-4 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
                  <Skeleton className="h-3 w-1/2 rounded bg-slate-100 dark:bg-white/[0.07]" />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-24 rounded-lg bg-slate-100 dark:bg-white/[0.07]" />
              <Skeleton className="h-6 w-20 rounded-lg bg-slate-100 dark:bg-white/[0.07]" />
            </div>
          </div>
          {/* Right: action column */}
          <div className="flex shrink-0 flex-col gap-2 border-l border-slate-200 p-3 min-w-[160px] dark:border-white/8">
            <Skeleton className="h-8 w-full rounded-lg bg-slate-200 dark:bg-white/10" />
            <Skeleton className="h-7 w-full rounded-lg bg-slate-100 dark:bg-white/[0.07]" />
            <Skeleton className="h-9 w-full rounded-lg bg-slate-200 dark:bg-white/10" />
            <Skeleton className="h-8 w-full rounded-lg bg-slate-100 dark:bg-white/[0.07]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Cancel confirm dialog ────────────────────────────────────────────────────
function CancelConfirmBanner({ onConfirm, onDismiss }: { onConfirm: () => void; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
      <span className="flex-1 text-sm font-medium text-rose-800 dark:text-rose-300">¿Cancelar este pedido? Esta acción no se puede deshacer.</span>
      <button type="button" onClick={onConfirm} className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-500">Sí, cancelar</button>
      <button type="button" onClick={onDismiss} className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">No</button>
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
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#0d1117] dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PackageSearch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Detalle del pedido {order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Cliente</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{order.customer_name}</p>
            {order.customer_phone && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{order.customer_phone}</p>}
            {order.customer_email && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{order.customer_email}</p>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Estado</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{ORDER_STATUS_META[order.status]?.label ?? order.status}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Creado {formatDate(order.created_at)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pago</p>
            <p className={cn('mt-1 text-sm font-semibold', order.payment_status === 'PAID' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300')}>
              {PAYMENT_STATUS_META[order.payment_status]?.label ?? order.payment_status}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{PAYMENT_METHOD_META[order.payment_method]?.label ?? order.payment_method}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
          <div className="grid grid-cols-[1fr_70px_110px_110px] gap-2 border-b border-slate-200 dark:border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            <span>Producto</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Subtotal</span>
          </div>
          {order.order_items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_70px_110px_110px] gap-2 border-b border-slate-200 dark:border-white/5 px-3 py-3 text-sm last:border-0">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{item.product_name}</p>
                {item.product_sku && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">SKU {item.product_sku}</p>}
              </div>
              <span className="text-right tabular-nums text-slate-600 dark:text-slate-300">{item.quantity}</span>
              <span className="text-right tabular-nums text-slate-600 dark:text-slate-300">{formatMoney(item.unit_price)}</span>
              <span className="text-right tabular-nums font-semibold text-slate-900 dark:text-white">{formatMoney(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="ml-auto w-full max-w-xs space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Envio</span><span>{formatMoney(order.shipping_cost)}</span></div>
          {order.discount_amount > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-300"><span>Descuento</span><span>-{formatMoney(order.discount_amount)}</span></div>}
          <div className="flex justify-between border-t border-slate-200 dark:border-white/10 pt-2 text-base font-bold text-slate-900 dark:text-white"><span>Total</span><span>{formatMoney(order.total)}</span></div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function OrdersDashboard() {
  const abortRef = useRef<AbortController | null>(null)
  const statsLoadedRef = useRef(false)

  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('PENDING')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [sortField, setSortField] = useState<'created_at' | 'total'>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [todayCount, setTodayCount] = useState(0)
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<CustomerOrder | null>(null)
  const [showGuide, setShowGuide] = useState(true)

  // Derived metrics (org-wide values come from the API `stats`/`meta`, not the page)
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
        sort: buildSortParam(sortField, sortDir),
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
      if (data.meta) { setTodayCount(data.meta.todayCount); setTodayRevenue(data.meta.todayRevenue) }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      toast.error('No se pudieron cargar los pedidos', { description: error instanceof Error ? error.message : 'Intenta nuevamente.' })
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }, [page, search, statusTab, paymentFilter, datePreset, sortField, sortDir])

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
      toast.success('Estado actualizado', { description: `${order.order_number} → ${ORDER_STATUS_META[nextStatus].label}` })
    } catch (error) {
      toast.error('No se pudo actualizar', { description: error instanceof Error ? error.message : 'Intenta nuevamente.' })
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
      // Keep "Cobrado hoy" live: the server attributes revenue to the day the
      // payment was confirmed, so a fresh PAID transition always lands on today.
      if (updated.payment_status === 'PAID' && order.payment_status !== 'PAID') {
        setTodayRevenue((cur) => cur + Number(updated.total || 0))
      }
      toast.success('Pago actualizado', { description: `${order.order_number} → ${PAYMENT_STATUS_META[paymentStatus].label}` })
    } catch (error) {
      toast.error('No se pudo actualizar el pago', { description: error instanceof Error ? error.message : 'Intenta nuevamente.' })
    } finally {
      setUpdatingId(null) 
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const allPageSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.id))

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) orders.forEach((o) => next.delete(o.id))
      else orders.forEach((o) => next.add(o.id))
      return next
    })
  }

  const hasActiveFilters = search !== '' || paymentFilter !== 'ALL' || datePreset !== 'all'

  function resetFilters() {
    setSearch(''); setPaymentFilter('ALL'); setDatePreset('all'); setPage(1)
  }

  // Export the full filtered dataset (paging through the API), not just the
  // current page. Hard-capped at 50 pages (5 000 rows) to avoid runaway loops.
  async function handleExportCSV() {
    setExporting(true)
    try {
      const collected: CustomerOrder[] = []
      let current = 1
      let pages = 1
      do {
        const params = new URLSearchParams({
          page: String(current),
          limit: '100',
          status: statusTab,
          search,
          sort: buildSortParam(sortField, sortDir),
        })
        if (paymentFilter !== 'ALL') params.set('payment_status', paymentFilter)
        const dateFrom = getDateFrom(datePreset)
        if (dateFrom) params.set('date_from', dateFrom)

        const response = await fetch(`/api/orders?${params}`, { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error ?? 'No se pudieron exportar los pedidos.')
        }
        const data = payload.data as OrdersPayload
        collected.push(...data.orders)
        pages = data.pagination.totalPages
        current++
      } while (current <= pages && current <= 50)

      if (collected.length === 0) {
        toast.info('Nada para exportar', { description: 'No hay pedidos que coincidan con los filtros.' })
        return
      }
      exportOrdersCSV(collected)
      toast.success('CSV exportado', { description: `${collected.length} pedido${collected.length !== 1 ? 's' : ''}.` })
    } catch (error) {
      toast.error('No se pudo exportar', { description: error instanceof Error ? error.message : 'Intenta nuevamente.' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0d1117] dark:text-slate-100">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/20 to-blue-600/[0.03] text-blue-600 dark:text-blue-300 shadow-lg shadow-blue-950/10 dark:shadow-blue-950/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Pedidos del canal digital</h1>
              <p className="mt-1 text-sm text-slate-500">Gestiona cumplimiento, cambios de estado y altas manuales desde una sola vista.</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadOrders({ forceStats: true })} disabled={loading}
              className="gap-1.5 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleExportCSV()} disabled={exporting || (total === 0 && orders.length === 0)}
              className="gap-1.5 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Exportar CSV
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}
              className="gap-1.5 rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-500">
              <Plus className="h-3.5 w-3.5" /> Nueva orden
            </Button>
          </div>
        </div>

        {/* Guía de funcionamiento de pedidos */}
        {showGuide && (
          <Card className="relative border border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="absolute right-3 top-3 z-10 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10 transition-colors"
              title="Ocultar guía permanentemente durante esta sesión"
            >
              <X className="h-4 w-4" />
            </button>
            <details className="group">
              <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5 pb-3 pr-10">
                <div className="text-md font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Info className="h-4.5 w-4.5" /> ¿Cómo funciona la Gestión de Pedidos Digitales?
                </div>
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 select-none">
                  <span className="group-open:hidden flex items-center gap-1">Mostrar guía ↓</span>
                  <span className="hidden group-open:flex items-center gap-1">Ocultar guía ↑</span>
                </div>
              </summary>
              <CardContent className="pt-0 pb-5 text-xs text-slate-600 dark:text-slate-300">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/5 backdrop-blur-sm">
                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">1</Badge>
                      Flujo de Estados
                    </h4>
                    <p className="leading-relaxed">
                      Gestiona el ciclo de vida de los pedidos que provienen de tus canales digitales. Puedes transicionar estados desde Pendiente a Listo, Entregado o Cancelado conforme avance el empaque.
                    </p>
                  </div>
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/5 backdrop-blur-sm">
                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">2</Badge>
                      Método y Estado de Pago
                    </h4>
                    <p className="leading-relaxed">
                      Monitorea si las órdenes fueron pre-pagadas mediante pasarela de cobros o si están pendientes de cobro contra entrega. Puedes actualizar el estado del pago a Pagado tras confirmarlo.
                    </p>
                  </div>
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/5 backdrop-blur-sm">
                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">3</Badge>
                      Despacho e Integración
                    </h4>
                    <p className="leading-relaxed">
                      Identifica si el pedido requiere Delivery/Envío o Retiro en Sucursal (Store Pickup). Al preparar los ítems, el inventario de la sucursal seleccionada se descontará automáticamente.
                    </p>
                  </div>
                </div>
              </CardContent>
            </details>
          </Card>
        )}

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Pedidos totales" icon={ShoppingBag} accent="blue"
            value={Object.values(stats).reduce((s, v) => s + v, 0) || total} />
          <MetricCard
            label="Requieren acción" icon={AlertTriangle} accent="amber" alert={needsAction > 0}
            value={needsAction} sub={needsAction > 0 ? 'Pendientes y listos' : 'Todo al día'} />
          <MetricCard
            label="Pedidos hoy" icon={Package} accent="slate"
            value={todayCount} />
          <MetricCard
            label="Cobrado hoy" icon={Coins} accent="emerald"
            value={`Gs. ${todayRevenue.toLocaleString('es-PY')}`} />
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
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/8 dark:bg-white/3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }}
                className="h-9 rounded-lg border-slate-200 bg-slate-50 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500/50 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:placeholder:text-slate-600"
                placeholder="Buscar por número, cliente, email o teléfono…" />
            </div>

            <Select value={datePreset} onValueChange={(v) => { setDatePreset(v as DatePreset); setPage(1) }}>
              <SelectTrigger className="h-9 w-[150px] rounded-lg border-slate-200 bg-slate-50 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
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
              <SelectTrigger className="h-9 w-[150px] rounded-lg border-slate-200 bg-slate-50 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                {ORDER_STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[145px] rounded-lg border-slate-200 bg-slate-50 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <SelectValue placeholder="Todos los pagos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los pagos</SelectItem>
                {PAYMENT_STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={sortField} onValueChange={(v) => { setSortField(v as 'created_at' | 'total'); setPage(1) }}>
              <SelectTrigger className="h-9 w-[110px] rounded-lg border-slate-200 bg-slate-50 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <SelectValue placeholder="Fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Fecha</SelectItem>
                <SelectItem value="total">Monto</SelectItem>
              </SelectContent>
            </Select>

            <button type="button" onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
              <ArrowLeft className={cn('h-3.5 w-3.5 transition-transform', sortDir === 'asc' && 'rotate-90')} />
              {sortDir === 'desc' ? 'Descendente' : 'Ascendente'}
            </button>
          </div>

          {/* Active filter chips + reset */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-white/5 pt-3">
              {statusTab !== 'ALL' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                  Estado activo
                  <button type="button" onClick={() => setStatusTab('ALL')} className="ml-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              )}
              {paymentFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-400">
                  {PAYMENT_STATUS_META[paymentFilter as PaymentStatus]?.label}
                  <button type="button" onClick={() => setPaymentFilter('ALL')} className="ml-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              )}
              <button type="button" onClick={resetFilters}
                className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                Restablecer filtros
              </button>
            </div>
          )}
        </div>

        {/* ── Cancel confirm ── */}
        {cancelConfirmId && (
          <CancelConfirmBanner
            onConfirm={() => {
              const order = orders.find((o) => o.id === cancelConfirmId)
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
                <ShoppingBag className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Pedidos <span className="text-slate-400 dark:text-slate-500">({loading ? '…' : total})</span>
                </span>
              </div>
              {selectedIds.size > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  {selectedIds.size} seleccionados
                </span>
              )}
            </div>
            {orders.length > 0 && (
              <button type="button" onClick={toggleSelectPage}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                {allPageSelected ? 'Quitar selección' : 'Seleccionar página'}
              </button>
            )}
          </div>

          {loading ? <OrderSkeleton /> : orders.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center dark:border-white/12 dark:bg-white/[0.02]">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/8 dark:bg-white/[0.03]">
                <PackageSearch className="h-8 w-8 text-slate-400 dark:text-slate-600" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-300">
                {hasActiveFilters ? 'Sin coincidencias' : 'Aún no hay pedidos'}
              </p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {hasActiveFilters
                  ? 'Ningún pedido coincide con los filtros aplicados. Ajústalos o restablécelos para ver más.'
                  : 'Cuando lleguen pedidos del canal digital aparecerán aquí. También puedes crear uno manualmente.'}
              </p>
              {hasActiveFilters ? (
                <button type="button" onClick={resetFilters}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
                  <X className="h-3.5 w-3.5" /> Restablecer filtros
                </button>
              ) : (
                <button type="button" onClick={() => setCreateOpen(true)}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500">
                  <Plus className="h-3.5 w-3.5" /> Nueva orden
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
                className="gap-1.5 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-slate-500">
                Página <strong className="text-slate-700 dark:text-slate-300">{page}</strong> de <strong className="text-slate-700 dark:text-slate-300">{totalPages}</strong>
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="gap-1.5 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
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
