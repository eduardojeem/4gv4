'use client'

import { useTenantScope } from '@/hooks/use-tenant-scope'
import { useAuth } from '@/contexts/auth-context'
import { useBranch } from '@/contexts/branch-context'
import { useCommercePaymentControls } from '@/hooks/use-commerce-payment-controls'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppImage as Image } from '@/components/ui/app-image'
import {
  AlertTriangle, ArrowLeft, Building2, Calendar, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, Coins, Copy, CreditCard, Download,
  ExternalLink, Globe, Layers, Loader2, Mail, MapPin,
  MessageSquare, Package, PackageSearch, Pencil, Phone, Plus,
  Printer, RefreshCw, Search, ShoppingBag, Store,
  Tag, Truck, User, X
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { isPaymentConfirmable } from '@/lib/orders/payment-flow'
import { getNextOrderStatus } from '@/lib/orders/flow'
import {
  ORDER_FLOW, ORDER_STATUS_META, ORDER_STATUS_OPTIONS,
  PAYMENT_METHOD_META, PAYMENT_STATUS_META, PAYMENT_STATUS_OPTIONS,
} from '@/lib/orders/constants'
import type { CustomerOrder, FulfillmentType, OrderChannel, OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/orders/types'
import { CreateOrderDialog } from './CreateOrderDialog'
import { EditOrderDialog } from './EditOrderDialog'
import { ShippingLabelDialog } from './ShippingLabelDialog'
import { formatDate, formatMoney } from './format'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { ORDERS_GUIDE } from '@/components/dashboard/common/section-guides-data'

// ─── Types ────────────────────────────────────────────────────────────────────
type DatePreset = 'all' | 'today' | 'week' | 'month'
type SortDir = 'desc' | 'asc'
const ORDERS_REFRESH_INTERVAL_MS = 30_000

const ALL_PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'TRANSFER', 'CARD', 'DIGITAL_WALLET']

const CANCEL_REASON_PRESETS = [
  'Sin stock disponible',
  'Solicitado por el cliente',
  'Datos de contacto incompletos',
  'Fuera de zona de cobertura',
]

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

function stripDuplicateVariantSuffix(productName: string, variantName?: string | null): string {
  if (!variantName || !variantName.trim()) return productName
  const escaped = variantName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return productName.replace(new RegExp(`\\s*\\(${escaped}\\)$`), '').trim()
}

function formatOrderItemTitle(productName: string, variantName?: string | null): string {
  const baseName = stripDuplicateVariantSuffix(productName, variantName)
  if (!variantName || !variantName.trim()) return baseName
  return `${baseName} (${variantName.trim()})`
}

function formatWaPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.startsWith('595') ? d : d.startsWith('0') ? `595${d.slice(1)}` : d
}

function buildWhatsAppOrderUrl(order: CustomerOrder, storeSlug?: string | null): string | null {
  if (!order.customer_phone) return null
  const phone = formatWaPhone(order.customer_phone)
  if (!phone) return null
  const statusLabel = ORDER_STATUS_META[order.status]?.label ?? order.status
  const statusLine: Record<OrderStatus, string> = {
    PENDING: `Recibimos tu pedido #${order.order_number} y lo estamos revisando para confirmarlo.`,
    CONFIRMED: `Confirmamos tu pedido #${order.order_number}.`,
    PREPARING: `Estamos preparando tu pedido #${order.order_number}.`,
    READY: order.fulfillment_type === 'PICKUP'
      ? `¡Tu pedido #${order.order_number} ya está listo para retirar!`
      : `¡Tu pedido #${order.order_number} ya está listo para despacho!`,
    SHIPPED: `Tu pedido #${order.order_number} salió en camino.`,
    DELIVERED: `Tu pedido #${order.order_number} fue entregado. ¡Gracias por tu compra!`,
    CANCELLED: `Te informamos que tu pedido #${order.order_number} fue cancelado (${statusLabel}).`,
  }
  const trackUrl = storeSlug && typeof window !== 'undefined'
    ? `${window.location.origin}/${encodeURIComponent(storeSlug)}/track?orderNumber=${encodeURIComponent(order.order_number)}`
    : null
  const parts = [
    `¡Hola ${order.customer_name}! ${statusLine[order.status] ?? `Te escribimos por tu pedido #${order.order_number}.`}`,
    `Total: ${formatMoney(order.total)}${order.amount_due > 0 ? ` · Saldo pendiente: ${formatMoney(order.amount_due)}` : ''}.`,
    trackUrl ? `Seguí tu pedido acá: ${trackUrl}` : null,
  ].filter(Boolean)
  return `https://wa.me/${phone}?text=${encodeURIComponent(parts.join('\n'))}`
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

function exportOrdersCSV(orders: CustomerOrder[], branchNamesById: Record<string, string>) {
  const headers = ['Número','Fecha','Origen','Sucursal','Cliente','Teléfono','Email','Estado','Pago','Entrega','Productos','Total']
  const rows = orders.map((o) => [
    o.order_number,
    formatDate(o.created_at),
    o.channel === 'PANEL' ? 'Panel' : 'Tienda Web',
    o.branch_id ? (branchNamesById[o.branch_id] ?? '') : 'Tienda Web',
    o.customer_name,
    o.customer_phone ?? '',
    o.customer_email ?? '',
    ORDER_STATUS_META[o.status]?.label ?? o.status,
    PAYMENT_STATUS_META[o.payment_status]?.label ?? o.payment_status,
    o.fulfillment_type === 'PICKUP' ? 'Retiro' : 'Delivery',
    String(o.order_items.length),
    String(o.total),
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

const METRIC_ACCENTS: Record<MetricAccent, { ring: string; chip: string; glow: string; textVal: string }> = {
  slate:   { ring: 'border-slate-200/80 dark:border-white/10',         chip: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',            glow: 'from-slate-400/10',   textVal: 'text-slate-900 dark:text-white' },
  blue:    { ring: 'border-blue-200 dark:border-blue-500/20',       chip: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',             glow: 'from-blue-500/15',    textVal: 'text-blue-700 dark:text-blue-400' },
  amber:   { ring: 'border-amber-200 dark:border-amber-500/25',     chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',         glow: 'from-amber-500/15',   textVal: 'text-amber-700 dark:text-amber-300' },
  emerald: { ring: 'border-emerald-200 dark:border-emerald-500/20', chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', glow: 'from-emerald-500/15', textVal: 'text-emerald-700 dark:text-emerald-300' },
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
      'group relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-4.5 transition-all duration-200 shadow-sm hover:shadow-md dark:bg-white/[0.03] dark:hover:bg-white/[0.05]',
      a.ring
    )}>
      <div className={cn('pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent blur-2xl opacity-70', a.glow)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className={cn('mt-2 text-2xl sm:text-[28px] font-black leading-none tabular-nums tracking-tight', a.textVal)}>{value}</p>
          {sub && <p className="mt-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-xs', a.chip)}>
            <Icon className="h-5 w-5" />
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
        'group flex flex-col gap-1 rounded-2xl border px-4 py-2.5 text-left transition-all duration-200 min-w-[136px] shrink-0',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
        active
          ? cn('text-slate-800 dark:text-white shadow-md', a.activeBorder, a.activeBg, a.activeGlow)
          : 'border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-white/15 dark:hover:bg-white/[0.06] dark:hover:text-slate-200'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            'flex h-6 w-6 items-center justify-center rounded-lg transition-colors',
            active ? cn('bg-white/80 dark:bg-white/10 shadow-xs', a.activeIcon) : cn('bg-slate-100 dark:bg-white/5', a.idleIcon, 'group-hover:bg-slate-200 dark:group-hover:bg-white/10')
          )}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-bold leading-none">{tab.label}</span>
        </div>
        <span className={cn(
          'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums transition-colors',
          active ? a.activeBadge : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
        )}>{count}</span>
      </div>
      <p className={cn('text-[10px] font-medium leading-none mt-0.5', active ? 'text-slate-700 dark:text-slate-300/80' : 'text-slate-400 dark:text-slate-500')}>{tab.sublabel}</p>
    </button>
  )
}

// ─── Payment status pill ──────────────────────────────────────────────────────
function PaymentPill({ status }: { status: PaymentStatus }) {
  const colors: Record<PaymentStatus, string> = {
    PENDING:  'border-amber-400/50 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    PAID:     'border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    PARTIAL:  'border-blue-400/50 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
    REFUNDED: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400',
    FAILED:   'border-rose-400/50 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  }
  const normalized = (String(status).toUpperCase()) as PaymentStatus
  const label = PAYMENT_STATUS_META[normalized]?.label ?? status
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', colors[normalized] ?? 'border-slate-200 bg-slate-50 text-slate-500')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', normalized === 'PAID' ? 'bg-emerald-500' : normalized === 'PENDING' ? 'bg-amber-500' : 'bg-blue-500')} />
      {label}
    </span>
  )
}

// ─── Order status pill ────────────────────────────────────────────────────────
function StatusPill({ status }: { status: OrderStatus }) {
  const colors: Record<OrderStatus, string> = {
    PENDING:   'border-amber-400/60 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
    CONFIRMED: 'border-blue-400/60 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
    PREPARING: 'border-cyan-400/60 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-300',
    READY:     'border-emerald-400/60 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
    SHIPPED:   'border-violet-400/60 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300',
    DELIVERED: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600/40 dark:bg-white/5 dark:text-slate-300',
    CANCELLED: 'border-rose-400/60 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300',
  }
  const normalized = (String(status).toUpperCase()) as OrderStatus
  const meta = ORDER_STATUS_META[normalized]
  if (!meta) return <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">{status}</span>
  const Icon = meta.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs', colors[normalized] ?? 'border-white/10 bg-white/5 text-slate-400')}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {meta.label}
    </span>
  )
}

// ─── Source / channel & branch badges ─────────────────────────────────────────
function ChannelBadge({ channel = 'WEB' }: { channel?: OrderChannel | string }) {
  const isPanel = channel === 'PANEL'
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
      isPanel
        ? 'border-indigo-300/70 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
        : 'border-slate-200/80 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
    )}>
      {isPanel ? <Store className="h-3 w-3 text-indigo-500 dark:text-indigo-400" /> : <Globe className="h-3 w-3 text-slate-400" />}
      {isPanel ? 'Panel' : 'Tienda Web'}
    </span>
  )
}

function BranchBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      <Building2 className="h-3 w-3 text-slate-400" />
      <span className="max-w-[140px] truncate">{name}</span>
    </span>
  )
}

// ─── Fulfillment badge ────────────────────────────────────────────────────────
function FulfillmentBadge({ type }: { type: 'PICKUP' | 'DELIVERY' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
      type === 'DELIVERY'
        ? 'border-violet-300/70 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300'
        : 'border-slate-300/80 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-white/5 dark:text-slate-300'
    )}>
      {type === 'DELIVERY' ? <Truck className="h-3 w-3" /> : <Store className="h-3 w-3" />}
      {type === 'DELIVERY' ? 'Delivery' : 'Retiro'}
    </span>
  )
}

// ─── Order row (always-expanded card, actions on right column) ────────────────
function OrderRow({
  order, selected, updating, branchName, storeSlug, onSelect,
  onStatusChange, onPaymentRequest, onAdvanceStatus, onCancelRequest, onDetailRequest, onEditRequest,
}: {
  order: CustomerOrder
  selected: boolean
  updating: boolean
  branchName?: string
  storeSlug?: string | null
  onSelect: (checked: boolean) => void
  onStatusChange: (s: OrderStatus) => void
  onPaymentRequest: () => void
  onAdvanceStatus: (s: OrderStatus) => void
  onCancelRequest: () => void
  onDetailRequest: () => void
  onEditRequest: () => void
}) {
  const currentIdx = ORDER_FLOW.indexOf(order.status)
  const isTerminal = ['DELIVERED', 'CANCELLED'].includes(order.status)
  const nextStatus = !isTerminal && currentIdx < ORDER_FLOW.length - 1
    ? getNextOrderStatus(order.status, order.fulfillment_type)
    : null
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
    const url = buildWhatsAppOrderUrl(order, storeSlug)
    if (url) window.open(url, '_blank')
  }

  const handleCopy = () => {
    const items = order.order_items
      .map((i) => `• ${i.quantity}x ${formatOrderItemTitle(i.product_name, i.variant_name)}`)
      .join('\n')
    const text = `Pedido: ${order.order_number}\nCliente: ${order.customer_name}\nTel: ${order.customer_phone ?? '-'}\nTotal: ${formatMoney(order.total)}\n${items}`
    navigator.clipboard.writeText(text)
    toast.success('Copiado', { description: order.order_number })
  }

  return (
    <div className={cn(
      'flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 sm:flex-row shadow-xs hover:shadow-md',
      selected
        ? 'border-blue-500/60 bg-blue-50/40 ring-1 ring-blue-500/20 dark:border-blue-500/40 dark:bg-blue-500/5'
        : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-[#121722] dark:hover:border-white/15'
    )}>
      {/* ── Left: main content ── */}
      <div className="flex-1 min-w-0 p-4 sm:p-5 space-y-3.5">

        {/* Top row: checkbox | order# | badges | date | amount */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <Checkbox
            checked={selected} onCheckedChange={(v) => onSelect(v === true)}
            className="h-4 w-4 rounded border-slate-300 dark:border-white/20 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
          />
          <button
            type="button"
            onClick={onDetailRequest}
            className="font-mono text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors shrink-0"
          >
            ORD #{order.order_number}
          </button>
          <StatusPill status={order.status} />
          <ChannelBadge channel={order.channel} />
          <FulfillmentBadge type={order.fulfillment_type} />
          {branchName && <BranchBadge name={branchName} />}
          {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}

          <div className="ml-auto text-right shrink-0">
            <p className="text-base sm:text-lg font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
              {formatMoney(order.total)}
            </p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {order.order_items.length} {order.order_items.length === 1 ? 'producto' : 'productos'}
            </p>
          </div>
        </div>

        {/* Date timestamp */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>Creado el {formatDate(order.created_at)}</span>
        </div>

        {/* Info panels: Cliente | Pago | Entrega */}
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Cliente */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/8 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Cliente</span>
              <User className="h-3 w-3 text-slate-400" />
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                {order.customer_name[0]?.toUpperCase() || 'C'}
              </div>
              <span className="truncate">{order.customer_name}</span>
            </div>
            {order.customer_phone && (
              <div className="mt-1 flex items-center justify-between gap-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5 truncate">
                  <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="font-medium truncate">{order.customer_phone}</span>
                </div>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                >
                  <MessageSquare className="h-2.5 w-2.5" />
                  WhatsApp
                </button>
              </div>
            )}
            {order.customer_email && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="truncate">{order.customer_email}</span>
              </div>
            )}
          </div>

          {/* Pago */}
          <div className={cn(
            'rounded-xl border p-3 transition-colors',
            paymentPending
              ? 'border-amber-400/70 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10'
              : 'border-slate-200/80 bg-slate-50/70 dark:border-white/8 dark:bg-white/[0.02]'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Pago</span>
              <CreditCard className="h-3 w-3 text-slate-400" />
            </div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {PayIcon && <PayIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                <span className="truncate">{payLabel}</span>
              </div>
              <PaymentPill status={order.payment_status} />
            </div>
            {canConfirmPayment && (
              <p className="mt-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 leading-snug">
                Pendiente: {formatMoney(order.amount_due)}
              </p>
            )}
            <div className="mt-2 space-y-0.5 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-white/5 pt-1.5">
              <div className="flex justify-between"><span>Subtotal:</span><span className="tabular-nums text-slate-700 dark:text-slate-300">{formatMoney(order.subtotal)}</span></div>
              {order.shipping_cost > 0 && <div className="flex justify-between"><span>Envío:</span><span className="tabular-nums text-slate-700 dark:text-slate-300">{formatMoney(order.shipping_cost)}</span></div>}
              {order.discount_amount > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium"><span>Descuento:</span><span>−{formatMoney(order.discount_amount)}</span></div>}
            </div>
          </div>

          {/* Entrega */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/8 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Entrega</span>
              {order.fulfillment_type === 'DELIVERY' ? <Truck className="h-3 w-3 text-slate-400" /> : <Store className="h-3 w-3 text-slate-400" />}
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
              <span className={cn(
                'inline-block h-2 w-2 rounded-full',
                order.fulfillment_type === 'DELIVERY' ? 'bg-violet-500' : 'bg-slate-400'
              )} />
              <span>{order.fulfillment_type === 'DELIVERY' ? 'Envío a domicilio' : 'Retiro en local'}</span>
            </div>
            {order.customer_address ? (
              <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                <span className="leading-snug line-clamp-2">{order.customer_address}</span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Sin dirección especificada</p>
            )}
            {order.notes && (
              <p className="mt-1.5 rounded bg-white/60 dark:bg-white/5 px-2 py-0.5 text-[11px] italic text-slate-600 dark:text-slate-400 truncate">
                &ldquo;{order.notes}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Product chips */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {order.order_items.map((item) => {
            const baseName = stripDuplicateVariantSuffix(item.product_name, item.variant_name)
            return (
              <span key={item.id}
                className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-100/70 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-white/8 dark:bg-white/[0.04] dark:text-slate-300">
                <Package className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                <strong className="text-slate-900 dark:text-slate-100">{item.quantity}x</strong>
                <span>{baseName}</span>
                {item.variant_name && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                    <Layers className="h-2.5 w-2.5 shrink-0" />
                    {item.variant_name}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Right: action column ── */}
      <div className="flex shrink-0 flex-row flex-wrap gap-2 border-t sm:border-l sm:border-t-0 border-slate-200/80 p-3.5 dark:border-white/8 sm:min-w-[175px] sm:flex-col justify-between bg-slate-50/40 dark:bg-white/[0.01]">
        <div className="w-full space-y-2">
          {/* Advance status */}
          {nextStatus && (
            <Button size="sm" disabled={updating}
              onClick={() => onAdvanceStatus(nextStatus)}
              className="w-full h-8.5 gap-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 shadow-xs disabled:opacity-40 justify-center">
              {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {ORDER_STATUS_META[nextStatus].label}
            </Button>
          )}
          {isTerminal && (
            <div className={cn(
              'rounded-xl px-3 py-1.5 text-center text-xs font-bold border',
              order.status === 'DELIVERED'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300'
            )}>
              {ORDER_STATUS_META[order.status].label}
            </div>
          )}

          {/* Payment action */}
          {canConfirmPayment ? (
            <Button size="sm" disabled={updating}
              onClick={onPaymentRequest}
              className="h-8.5 w-full justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-45 transition-colors">
              <Coins className="h-3.5 w-3.5" /> Registrar cobro
            </Button>
          ) : (
            <span className={cn(
              'flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium',
              order.payment_status === 'PAID'
                ? 'border-emerald-400/60 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5'
            )}>
              <CheckCircle2 className="h-3 w-3" /> {paymentActionLabel}
            </span>
          )}

          {/* Detail, Edit & Copy */}
          <div className="grid grid-cols-2 sm:grid-cols-1 gap-1.5 pt-1">
            <Button size="sm" variant="outline"
              onClick={onDetailRequest}
              className="w-full h-8 gap-1.5 rounded-xl text-xs font-medium border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-200 justify-center">
              <PackageSearch className="h-3.5 w-3.5 text-slate-500" /> Ver detalle
            </Button>

            {order.status !== 'CANCELLED' && (
              <Button size="sm" variant="outline"
                onClick={onEditRequest}
                className="w-full h-8 gap-1.5 rounded-xl text-xs font-medium border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-200 justify-center">
                <Pencil className="h-3.5 w-3.5 text-slate-500" /> Editar
              </Button>
            )}

            <Button size="sm" variant="outline"
              onClick={handleCopy}
              className="w-full h-8 gap-1.5 rounded-xl text-xs font-medium border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-200 justify-center">
              <Copy className="h-3.5 w-3.5 text-slate-500" /> Copiar pedido
            </Button>
          </div>
        </div>

        <div className="w-full space-y-2 pt-1 border-t border-slate-200/60 dark:border-white/5">
          {/* Status selector */}
          <Select value="" onValueChange={(v) => v && onStatusChange(v as OrderStatus)} disabled={updating || isTerminal}>
            <SelectTrigger className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
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
              className="w-full text-[11px] font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors text-center py-0.5">
              Cancelar pedido
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function OrderSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#121722] shadow-xs">
          {/* Left: main content */}
          <div className="flex-1 min-w-0 space-y-3.5 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded bg-slate-200 dark:bg-white/10" />
              <Skeleton className="h-4 w-28 rounded bg-slate-200 dark:bg-white/10" />
              <Skeleton className="h-5 w-24 rounded-full bg-slate-200 dark:bg-white/10" />
              <Skeleton className="h-5 w-16 rounded-full bg-slate-200 dark:bg-white/10" />
              <div className="ml-auto text-right">
                <Skeleton className="h-6 w-24 rounded bg-slate-200 dark:bg-white/10" />
              </div>
            </div>
            <Skeleton className="h-3 w-40 rounded bg-slate-100 dark:bg-white/[0.07]" />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, j) => (
                <div key={j} className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/8 dark:bg-white/[0.02]">
                  <Skeleton className="h-2.5 w-14 rounded bg-slate-200 dark:bg-white/[0.07]" />
                  <Skeleton className="h-4 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
                  <Skeleton className="h-3 w-1/2 rounded bg-slate-100 dark:bg-white/[0.07]" />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-7 w-24 rounded-lg bg-slate-100 dark:bg-white/[0.07]" />
              <Skeleton className="h-7 w-20 rounded-lg bg-slate-100 dark:bg-white/[0.07]" />
            </div>
          </div>
          {/* Right: action column */}
          <div className="flex shrink-0 flex-col gap-2 border-l border-slate-200/80 p-3.5 min-w-[175px] dark:border-white/8 bg-slate-50/40 dark:bg-white/[0.01]">
            <Skeleton className="h-8.5 w-full rounded-xl bg-slate-200 dark:bg-white/10" />
            <Skeleton className="h-8 w-full rounded-xl bg-slate-100 dark:bg-white/[0.07]" />
            <Skeleton className="h-8 w-full rounded-xl bg-slate-200 dark:bg-white/10" />
            <Skeleton className="h-8 w-full rounded-xl bg-slate-100 dark:bg-white/[0.07]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Cancel confirm dialog with reason ────────────────────────────────────────
function CancelOrderDialog(props: {
  open: boolean
  title: string
  description: string
  submitting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (note: string) => void
}) {
  if (!props.open) return null
  return <CancelOrderDialogContent {...props} />
}

function CancelOrderDialogContent({
  open,
  title,
  description,
  submitting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  submitting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (note: string) => void
}) {
  const [note, setNote] = useState('')

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/70 p-3 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            Se liberará automáticamente el stock reservado y cualquier reserva de saldo a favor asociada.
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Motivo rápido <span className="font-normal">(opcional)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {CANCEL_REASON_PRESETS.map((preset) => {
                const active = note === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={submitting}
                    onClick={() => setNote(active ? '' : preset)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      active
                        ? 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold'
                        : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {preset}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="block space-y-1.5 text-sm font-medium">
            <span>Detalle del motivo <span className="font-normal text-muted-foreground">(opcional)</span></span>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              disabled={submitting}
              placeholder="Ej.: Cliente solicitó cambiar el pedido…"
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Volver
          </Button>
          <Button
            variant="destructive"
            disabled={submitting}
            onClick={() => onConfirm(note.trim())}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sí, cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CollectionDialog(props: React.ComponentProps<typeof CollectionDialogContent>) {
  if (!props.open) return null
  return <CollectionDialogContent key={props.order?.id ?? 'new'} {...props} />
}

function CollectionDialogContent({ order, open, submitting, onOpenChange, onConfirm }: {
  order: CustomerOrder | null
  open: boolean
  submitting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (input: { amount: number; method: PaymentMethod; reference: string; note: string; idempotencyKey: string }) => void
}) {
  const paymentControls = useCommercePaymentControls()
  const [amount, setAmount] = useState(() => order ? String(order.amount_due) : '')
  const [method, setMethod] = useState<PaymentMethod>(() => order?.payment_method ?? 'CASH')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const idempotencyRef = useRef(crypto.randomUUID())

  const allowedMethods = useMemo(
    () => (paymentControls.ready ? ALL_PAYMENT_METHODS.filter((m) => paymentControls.allows(m)) : []),
    [paymentControls]
  )
  const resolvedMethod: PaymentMethod | '' = paymentControls.ready
    ? (allowedMethods.includes(method) ? method : (allowedMethods[0] ?? ''))
    : ''

  const numericAmount = Number(amount)
  const referenceRequired = Boolean(resolvedMethod && resolvedMethod !== 'CASH')
  const paymentUnavailable = !paymentControls.ready || Boolean(paymentControls.error) || !resolvedMethod
  const invalid = !order || paymentUnavailable || !Number.isFinite(numericAmount) || numericAmount <= 0
    || numericAmount > order.amount_due || (referenceRequired && !reference.trim())

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
          <DialogDescription>
            Guardá el importe realmente recibido. El estado pasará a parcial o pagado automáticamente.
          </DialogDescription>
        </DialogHeader>
        {order && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Pedido</p><p className="font-semibold">{order.order_number}</p></div>
              <div className="text-right"><p className="text-xs text-muted-foreground">Pendiente</p><p className="font-bold text-rose-600">{formatMoney(order.amount_due)}</p></div>
              <div><p className="text-xs text-muted-foreground">Cobrado hasta ahora</p><p className="font-semibold">{formatMoney(order.collected_amount)}</p></div>
              <div className="text-right"><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">{formatMoney(order.total)}</p></div>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Monto recibido</span>
              <Input inputMode="numeric" type="number" min={1} max={order.amount_due} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
              {numericAmount > order.amount_due && <span className="text-xs text-destructive">No puede superar {formatMoney(order.amount_due)}.</span>}
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Medio de cobro</span>
              <Select
                value={resolvedMethod}
                onValueChange={(value) => setMethod(value as PaymentMethod)}
                disabled={!paymentControls.ready || allowedMethods.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!paymentControls.ready ? 'Cargando medios habilitados…' : 'Sin medios habilitados'} />
                </SelectTrigger>
                <SelectContent>
                  {allowedMethods.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_METHOD_META[m]?.label ?? m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {paymentControls.error && (
                <span className="block text-xs text-destructive">{paymentControls.error}</span>
              )}
              {paymentControls.ready && !paymentControls.error && allowedMethods.length === 0 && (
                <span className="block text-xs text-destructive">No hay medios de cobro habilitados para este comercio.</span>
              )}
            </label>
            {referenceRequired && (
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Referencia o comprobante</span>
                <Input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={160} placeholder="Ej.: operación 45821" />
              </label>
            )}
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Nota interna <span className="font-normal text-muted-foreground">(opcional)</span></span>
              <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button
            disabled={invalid || submitting}
            onClick={() => {
              if (!resolvedMethod) return
              onConfirm({ amount: numericAmount, method: resolvedMethod, reference: reference.trim(), note: note.trim(), idempotencyKey: idempotencyRef.current })
            }}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeliveryConfirmDialog({ order, open, submitting, onOpenChange, onConfirm }: {
  order: CustomerOrder | null
  open: boolean
  submitting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar entrega</DialogTitle>
          <DialogDescription>
            {order ? `El pedido ${order.order_number} quedará cerrado como entregado. Verificá el cobro pendiente antes de continuar.` : ''}
          </DialogDescription>
        </DialogHeader>
        {order && order.amount_due > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Aún quedan {formatMoney(order.amount_due)} por cobrar. La entrega no marcará ese saldo como pagado.
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Volver</Button>
          <Button onClick={onConfirm} disabled={submitting}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar entrega</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Historial del pedido ─────────────────────────────────────────────────────
type OrderHistoryEvent = {
  id: string
  kind: 'STATUS' | 'PAYMENT'
  from: string | null
  to: string
  note: string | null
  amount: number | null
  paymentMethod?: string | null
  paymentReference?: string | null
  actor: string | null
  createdAt: string
}

export function OrderHistory({ orderId }: { orderId: string }) {
  const [events, setEvents] = useState<OrderHistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/history`, { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (!active) return
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error ?? 'No se pudo cargar el historial.')
        }
        setEvents((payload.data?.events ?? []) as OrderHistoryEvent[])
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [orderId])

  const labelFor = (event: OrderHistoryEvent) => event.kind === 'STATUS'
    ? ORDER_STATUS_META[event.to as OrderStatus]?.label ?? event.to
    : PAYMENT_STATUS_META[event.to as PaymentStatus]?.label ?? event.to

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Historial
      </p>

      {loading ? (
        <div className="mt-3 space-y-2" aria-busy="true" aria-label="Cargando historial">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      ) : error ? (
        <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>
      ) : events.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Todavía no hay cambios registrados para este pedido.
        </p>
      ) : (
        <ol className="mt-3 space-y-0">
          {events.map((event, index) => {
            const isLast = index === events.length - 1
            const isPayment = event.kind === 'PAYMENT'
            return (
              <li key={event.id} className="grid grid-cols-[16px_1fr] gap-3">
                {/* Riel vertical: el punto marca el evento y la línea lo une
                    con el siguiente, salvo en el último. */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      isPayment ? 'bg-emerald-500' : 'bg-blue-500',
                    )}
                    aria-hidden="true"
                  />
                  {!isLast && <span className="w-px flex-1 bg-slate-200 dark:bg-white/10" aria-hidden="true" />}
                </div>
                <div className={cn('min-w-0', isLast ? 'pb-0' : 'pb-4')}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {isPayment ? 'Pago: ' : ''}{labelFor(event)}
                    </span>
                    {event.amount !== null && (
                      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {formatMoney(event.amount)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(event.createdAt)}
                    {' · '}
                    {event.actor ?? 'Sistema'}
                  </p>
                  {event.note && (
                    <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">{event.note}</p>
                  )}
                  {isPayment && (event.paymentMethod || event.paymentReference) && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {event.paymentMethod ? (PAYMENT_METHOD_META[event.paymentMethod as PaymentMethod]?.label ?? event.paymentMethod) : ''}
                      {event.paymentReference ? ` · Ref. ${event.paymentReference}` : ''}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function parseVariantChips(variantName: string | null | undefined): string[] {
  if (!variantName || !variantName.trim()) return []
  const text = variantName.trim()
  if (text.includes('/') || text.includes('|') || text.includes('·') || text.includes(',')) {
    return text.split(/[/|·,]/).map((s) => s.trim()).filter(Boolean)
  }
  return [text]
}

function OrderDetailDialog({
  order,
  open,
  onOpenChange,
  onOpenCollection,
  onAdvanceStatus,
  onCancelRequest,
  onEditRequest,
  storeName,
  storeSlug,
  branchNamesById,
}: {
  order: CustomerOrder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenCollection?: (order: CustomerOrder) => void
  onAdvanceStatus?: (order: CustomerOrder, next: OrderStatus) => void
  onCancelRequest?: (order: CustomerOrder) => void
  onEditRequest?: (order: CustomerOrder) => void
  storeName?: string
  storeSlug?: string | null
  branchNamesById: Record<string, string>
}) {
  const [copiedNumber, setCopiedNumber] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [showShippingLabel, setShowShippingLabel] = useState(false)
  const [itemImages, setItemImages] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!order || !order.order_items.length) return
    const productIds = Array.from(
      new Set(order.order_items.map((it) => it.product_id).filter(Boolean) as string[])
    )
    if (!productIds.length) return

    const controller = new AbortController()
    // Con sesión: el endpoint público de favoritos ya no responde productos
    // pausados ni privados, y el pedido tiene que mostrar su foto igual.
    fetch('/api/orders/item-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { images?: Record<string, string | null> }) => {
        if (data?.images) setItemImages((prev) => ({ ...prev, ...data.images }))
      })
      .catch(() => {})

    return () => controller.abort()
  }, [order])

  if (!order) return null

  const statusMeta = ORDER_STATUS_META[order.status] ?? { label: order.status, icon: Package, className: '' }
  const paymentMeta = PAYMENT_STATUS_META[order.payment_status] ?? { label: order.payment_status, className: '' }
  const paymentMethodLabel = PAYMENT_METHOD_META[order.payment_method]?.label ?? order.payment_method
  const isDelivery = order.fulfillment_type === 'DELIVERY'
  const isTerminal = ['DELIVERED', 'CANCELLED'].includes(order.status)
  const nextStatus = !isTerminal ? getNextOrderStatus(order.status, order.fulfillment_type) : null
  const branchName = order.branch_id ? branchNamesById[order.branch_id] : undefined
  const StatusIcon = statusMeta.icon || Package

  const handleCopyOrderNumber = async () => {
    try {
      await navigator.clipboard.writeText(order.order_number)
      setCopiedNumber(true)
      toast.success('Número de pedido copiado')
      setTimeout(() => setCopiedNumber(false), 2000)
    } catch {
      toast.error('No se pudo copiar el número')
    }
  }

  const handleCopySummary = async () => {
    const itemsText = order.order_items
      .map((item) => `  • ${item.quantity}x ${formatOrderItemTitle(item.product_name, item.variant_name)} - ${formatMoney(item.subtotal)}`)
      .join('\n')

    const text = [
      `📦 *Resumen del Pedido #${order.order_number}*`,
      `📅 Fecha: ${formatDate(order.created_at)}`,
      branchName ? `🏢 Sucursal: ${branchName}` : null,
      `👤 Cliente: ${order.customer_name}${order.customer_phone ? ` (${order.customer_phone})` : ''}`,
      `🚚 Tipo de entrega: ${isDelivery ? `Delivery a domicilio (${order.customer_address || 'Dirección a confirmar'})` : 'Retiro en tienda/local'}`,
      `💳 Estado de Pago: ${paymentMeta.label} (${paymentMethodLabel})`,
      ``,
      `🛒 *Productos:*`,
      itemsText,
      ``,
      `💰 *Total:* ${formatMoney(order.total)}`,
      order.amount_due > 0 ? `⚠️ *Saldo pendiente:* ${formatMoney(order.amount_due)}` : `✅ *Pagado en su totalidad*`,
      order.notes ? `\n📝 *Nota:* ${order.notes}` : '',
    ].filter(Boolean).join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopiedSummary(true)
      toast.success('Resumen completo copiado al portapapeles')
      setTimeout(() => setCopiedSummary(false), 2500)
    } catch {
      toast.error('No se pudo copiar el resumen')
    }
  }

  const cleanPhone = order.customer_phone?.replace(/\D/g, '') || ''
  const whatsappUrl = buildWhatsAppOrderUrl(order, storeSlug)

  const googleMapsUrl = isDelivery && order.customer_address
    ? `https://maps.google.com/?q=${encodeURIComponent(order.customer_address)}`
    : null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex flex-col gap-0 p-0 overflow-hidden bg-background text-foreground shadow-2xl border-border/80
          /* mobile: ocupa toda la pantalla */
          inset-0 fixed h-[100dvh] w-screen max-w-none rounded-none
          /* sm+: modal centrado con bordes redondeados */
          sm:inset-auto sm:h-[95vh] sm:max-h-[95vh] sm:w-[95vw] sm:max-w-6xl sm:rounded-3xl sm:translate-x-0 sm:translate-y-0 sm:top-[2.5vh] sm:left-1/2 sm:-translate-x-1/2">
          {/* ── Header ── */}
          <DialogHeader className="shrink-0 px-5 sm:px-6 pt-5 pb-4 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              {/* Título + fecha */}
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1",
                  statusMeta.className ?? "bg-primary/10 text-primary ring-primary/20"
                )}>
                  <StatusIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <DialogTitle className="text-lg font-black tracking-tight font-mono text-foreground">
                      #{order.order_number}
                    </DialogTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyOrderNumber}
                      className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                      title="Copiar número"
                    >
                      {copiedNumber ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <DialogDescription className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(order.created_at)}</span>
                    <span className="text-border">·</span>
                    <span>{order.order_items.length} {order.order_items.length === 1 ? 'ítem' : 'ítems'}</span>
                    {branchName && (
                      <>
                        <span className="text-border">·</span>
                        <span>{branchName}</span>
                      </>
                    )}
                  </DialogDescription>
                </div>
              </div>

              {/* Badges de estado */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <ChannelBadge channel={order.channel} />
                <Badge variant="outline" className={cn("px-2.5 py-1 text-[11px] font-bold border gap-1 rounded-lg", statusMeta.className)}>
                  <StatusIcon className="h-3 w-3" />
                  {statusMeta.label}
                </Badge>
                <Badge variant="outline" className={cn(
                  "px-2.5 py-1 text-[11px] font-bold border rounded-lg",
                  order.payment_status === 'PAID'
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                    : "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25"
                )}>
                  {paymentMeta.label}
                </Badge>
                <Badge variant="secondary" className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold gap-1 rounded-lg",
                  isDelivery ? "bg-blue-500/12 text-blue-700 dark:text-blue-300" : "bg-violet-500/12 text-violet-700 dark:text-violet-300"
                )}>
                  {isDelivery ? <Truck className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                  {isDelivery ? 'Delivery' : 'Retiro'}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {/* ── Cuerpo: layout principal + sidebar ── */}
          {/* ── Estilos de impresión: etiqueta para pegar en el paquete (desactivado mientras ShippingLabelDialog está abierto) ── */}
          {!showShippingLabel && (
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page { margin: 10mm; }
                body > * { visibility: hidden !important; }
                .order-print-zone, .order-print-zone * { visibility: visible !important; }
                .order-print-zone {
                  position: fixed !important;
                  top: 50% !important;
                  left: 50% !important;
                  transform: translate(-50%, -50%) !important;
                  width: 105mm !important;
                  background: white !important;
                  color: black !important;
                  font-family: system-ui, Arial, sans-serif !important;
                  border: 3px solid #000 !important;
                  border-radius: 6px !important;
                  padding: 0 !important;
                  overflow: hidden !important;
                  box-shadow: none !important;
                }
              }
            `}} />
          )}

          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

            {/* Columna principal (scrolleable) */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-5 space-y-4">

              {/* ── Etiqueta de envío para pegar en el paquete (solo visible al imprimir) ── */}
              <div className="order-print-zone hidden print:block" style={{fontFamily:'system-ui,Arial,sans-serif',fontSize:'12px',lineHeight:'1.4',color:'#000'}}>

                {/* Franja superior: número de pedido + fecha */}
                <div style={{background:'#000',color:'#fff',padding:'6px 10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <span style={{fontSize:'8px',letterSpacing:'2px',opacity:0.7}}>ETIQUETA DE ENVÍO</span>
                    <div style={{fontWeight:'900',fontSize:'16px',letterSpacing:'1px',fontFamily:'monospace',lineHeight:1}}>#{order.order_number}</div>
                  </div>
                  <div style={{textAlign:'right',fontSize:'9px',opacity:0.8}}>
                    <div>{formatDate(order.created_at)}</div>
                    <div style={{fontWeight:'700',marginTop:'2px'}}>{isDelivery ? '📦 DELIVERY' : '🏪 RETIRO'}</div>
                  </div>
                </div>

                {/* Alerta de cobro contra entrega (prominente si aplica) */}
                {order.amount_due > 0 && (
                  <div style={{background:'#dc2626',color:'#fff',padding:'5px 10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontWeight:'900',fontSize:'10px',letterSpacing:'1px'}}>⚠ COBRAR EN DESTINO</span>
                    <span style={{fontWeight:'900',fontSize:'15px'}}>{formatMoney(order.amount_due)}</span>
                  </div>
                )}
                {order.amount_due === 0 && (
                  <div style={{background:'#16a34a',color:'#fff',padding:'4px 10px',fontSize:'9px',fontWeight:'700',letterSpacing:'1px',textAlign:'center'}}>
                    ✓ PEDIDO PAGADO — NO COBRAR
                  </div>
                )}

                {/* Destinatario */}
                <div style={{padding:'10px',borderBottom:'2px solid #000'}}>
                  <div style={{fontSize:'8px',textTransform:'uppercase',letterSpacing:'1.5px',color:'#666',marginBottom:'4px'}}>DESTINATARIO</div>
                  <div style={{fontWeight:'900',fontSize:'17px',lineHeight:'1.2',marginBottom:'4px'}}>{order.customer_name}</div>
                  {order.customer_phone && (
                    <div style={{fontSize:'12px',fontWeight:'700',marginBottom:'3px'}}>📞 {order.customer_phone}</div>
                  )}
                  {isDelivery && order.customer_address ? (
                    <div style={{marginTop:'6px',padding:'6px 8px',border:'2px solid #000',borderRadius:'4px',background:'#f5f5f5'}}>
                      <div style={{fontSize:'8px',textTransform:'uppercase',letterSpacing:'1px',color:'#777',marginBottom:'3px'}}>DIRECCIÓN DE ENTREGA</div>
                      <div style={{fontWeight:'700',fontSize:'13px',lineHeight:'1.3'}}>{order.customer_address}</div>
                    </div>
                  ) : !isDelivery ? (
                    <div style={{marginTop:'6px',fontSize:'11px',fontStyle:'italic',color:'#555'}}>{branchName ? `Retira en ${branchName}` : 'Retira en sucursal / local'}</div>
                  ) : (
                    <div style={{marginTop:'6px',fontSize:'11px',fontStyle:'italic',color:'#c00'}}>Dirección a coordinar con el cliente</div>
                  )}
                </div>

                {/* Contenido del paquete */}
                <div style={{padding:'8px 10px'}}>
                  <div style={{fontSize:'8px',textTransform:'uppercase',letterSpacing:'1.5px',color:'#666',marginBottom:'5px'}}>
                    CONTENIDO ({order.order_items.length} {order.order_items.length === 1 ? 'ítem' : 'ítems'})
                  </div>
                  {order.order_items.map((item) => {
                    const baseName = stripDuplicateVariantSuffix(item.product_name, item.variant_name)
                    return (
                      <div key={item.id} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'2px 0',borderBottom:'1px dotted #ccc',fontSize:'11px'}}>
                        <span style={{fontWeight:'600'}}>
                          {baseName}
                          {item.variant_name && <span style={{fontWeight:'400',color:'#555',marginLeft:'4px'}}>({item.variant_name})</span>}
                        </span>
                        <span style={{fontWeight:'900',marginLeft:'8px',whiteSpace:'nowrap'}}>×{item.quantity}</span>
                      </div>
                    )
                  })}
                  {order.notes && (
                    <div style={{marginTop:'6px',padding:'4px 6px',background:'#fef9c3',border:'1px solid #d97706',borderRadius:'3px',fontSize:'10px'}}>
                      <strong>Nota:</strong> {order.notes}
                    </div>
                  )}
                </div>

                {/* Pie: código de tracking */}
                <div style={{padding:'4px 10px',borderTop:'1px solid #ddd',background:'#f9f9f9',display:'flex',justifyContent:'space-between',fontSize:'8px',color:'#888',fontFamily:'monospace'}}>
                  <span>REF: {order.id.slice(0,8).toUpperCase()}</span>
                  <span>COMPROBANTE DE DESPACHO</span>
                </div>
              </div>


              {/* Bloque Cliente + Entrega */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Cliente */}
                <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cliente</span>
                    </div>
                    {whatsappUrl && (
                      <Button asChild size="sm" variant="outline"
                        className="h-6 rounded-lg px-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 gap-1">
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                          <MessageSquare className="h-3 w-3" /><span>WhatsApp</span>
                        </a>
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-foreground">{order.customer_name}</p>
                    {order.customer_phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" />
                        <a href={`tel:${cleanPhone}`} className="hover:text-primary hover:underline font-medium">{order.customer_phone}</a>
                      </div>
                    )}
                    {order.customer_email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" />
                        <a href={`mailto:${order.customer_email}`} className="hover:text-primary hover:underline truncate">{order.customer_email}</a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Entrega */}
                <div className={cn(
                  "rounded-2xl border p-4 space-y-3",
                  isDelivery ? "border-blue-500/25 bg-blue-500/5" : "border-violet-500/25 bg-violet-500/5"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-lg",
                        isDelivery ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                      )}>
                        {isDelivery ? <Truck className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {isDelivery ? 'Envío' : 'Retiro'}
                      </span>
                    </div>
                    {googleMapsUrl && (
                      <Button asChild variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" title="Google Maps">
                        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold text-foreground">
                      {isDelivery ? 'Envío a domicilio' : branchName ? `Retiro en ${branchName}` : 'Retiro en sucursal / local'}
                    </p>
                    {isDelivery && order.customer_address && (
                      <div className="flex items-start gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                        <p className="leading-relaxed break-words">{order.customer_address}</p>
                      </div>
                    )}
                    {order.estimated_delivery_date && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>Estimado: <strong className="text-foreground">{formatDate(order.estimated_delivery_date)}</strong></span>
                      </div>
                    )}
                    <p className="text-muted-foreground">Pago: <strong className="text-foreground">{paymentMethodLabel}</strong></p>
                  </div>
                </div>
              </div>

              {/* Nota del pedido */}
              {order.notes && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <MessageSquare className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Nota del pedido</span>
                    <p className="leading-relaxed whitespace-pre-wrap text-amber-800/90 dark:text-amber-200/90">{order.notes}</p>
                  </div>
                </div>
              )}

              {/* Productos */}
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/50">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
                    Productos incluidos ({order.order_items.length})
                  </span>
                </div>

                {/* Encabezado de columnas (desktop) */}
                <div className="hidden sm:grid grid-cols-[1fr_56px_100px_100px] gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/15 border-b border-border/40">
                  <span>Producto</span>
                  <span className="text-center">Cant.</span>
                  <span className="text-right">Unitario</span>
                  <span className="text-right">Subtotal</span>
                </div>

                <div className="divide-y divide-border/50">
                  {order.order_items.map((item) => {
                    const itemImg = item.product_id ? itemImages[item.product_id] : null
                    const baseName = stripDuplicateVariantSuffix(item.product_name, item.variant_name)
                    const variantChips = parseVariantChips(item.variant_name)
                    return (
                      <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_56px_100px_100px] gap-2 px-4 py-3 items-center hover:bg-muted/15 transition-colors">
                        {/* Imagen + info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-border/50 bg-muted/40 flex items-center justify-center">
                            {itemImg ? (
                              <Image src={resolveProductImageUrl(itemImg)} alt={baseName} fill unoptimized className="object-cover" />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-semibold text-foreground leading-snug truncate">{baseName}</p>
                            <div className="flex flex-wrap items-center gap-1">
                              {variantChips.map((chip, idx) => (
                                <span key={idx} className="inline-flex items-center gap-0.5 rounded-md bg-primary/8 border border-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary/80">
                                  <Layers className="h-2 w-2 shrink-0" />{chip}
                                </span>
                              ))}
                              {item.product_sku && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                  <Tag className="h-2 w-2 shrink-0" />{item.product_sku}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Cantidad */}
                        <div className="flex sm:justify-center items-center gap-1 text-xs">
                          <span className="sm:hidden text-muted-foreground text-[10px]">Cant.:</span>
                          <span className="font-bold bg-muted/70 border border-border/40 rounded-md px-2 py-0.5 tabular-nums text-foreground">×{item.quantity}</span>
                        </div>

                        {/* Precio unitario */}
                        <div className="hidden sm:block text-right text-xs text-muted-foreground tabular-nums">
                          {formatMoney(item.unit_price)}
                        </div>

                        {/* Subtotal */}
                        <div className="flex sm:justify-end items-baseline justify-between pt-1 sm:pt-0 border-t sm:border-t-0 border-border/30">
                          <span className="sm:hidden text-[10px] text-muted-foreground">Subtotal:</span>
                          <span className="text-sm font-black text-foreground tabular-nums">{formatMoney(item.subtotal)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Historial */}
              <OrderHistory key={`${order.id}-${order.updated_at}`} orderId={order.id} />
            </div>

            {/* ── Sidebar: Resumen financiero ── */}
            <div className="lg:w-64 xl:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-border/50 bg-muted/8 flex flex-col">
              <div className="overflow-y-auto flex-1 p-4 space-y-4">

                {/* Total destacado */}
                <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total del pedido</p>
                  <p className="text-3xl font-black text-foreground tabular-nums">{formatMoney(order.total)}</p>
                </div>

                {/* Estado de cobro */}
                {order.amount_due > 0 ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/8 p-4 space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300">Saldo pendiente</span>
                    </div>
                    <p className="text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">{formatMoney(order.amount_due)}</p>
                    <p className="text-[10px] text-rose-700/80 dark:text-rose-300/70 leading-relaxed">Falta registrar el pago completo.</p>
                    {onOpenCollection && order.status !== 'CANCELLED' && (
                      <Button size="sm" onClick={() => onOpenCollection(order)}
                        className="w-full h-8 rounded-xl font-bold text-[11px] bg-rose-600 hover:bg-rose-700 text-white">
                        Registrar cobro
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-3 flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[11px] font-bold">Pagado en su totalidad</p>
                      <p className="text-[10px] text-emerald-700/70 dark:text-emerald-300/60">Sin deudas pendientes.</p>
                    </div>
                  </div>
                )}

                {/* Desglose */}
                <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-1.5 text-xs">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Desglose</p>

                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-medium text-foreground">{formatMoney(order.subtotal)}</span>
                  </div>
                  {order.shipping_cost > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Envío</span>
                      <span className="tabular-nums font-medium text-foreground">{formatMoney(order.shipping_cost)}</span>
                    </div>
                  )}
                  {order.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Descuento</span>
                      <span className="tabular-nums">−{formatMoney(order.discount_amount)}</span>
                    </div>
                  )}
                  {order.store_credit_reserved > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>Saldo reservado</span>
                      <span className="tabular-nums">−{formatMoney(order.store_credit_reserved)}</span>
                    </div>
                  )}
                  {order.store_credit_applied > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Saldo aplicado</span>
                      <span className="tabular-nums">−{formatMoney(order.store_credit_applied)}</span>
                    </div>
                  )}
                  {order.collected_amount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Cobrado</span>
                      <span className="tabular-nums">{formatMoney(order.collected_amount)}</span>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="space-y-2">
                  {!isTerminal && nextStatus && onAdvanceStatus && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onAdvanceStatus(order, nextStatus)}
                      className="w-full h-8.5 rounded-xl text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pasar a {ORDER_STATUS_META[nextStatus].label}
                    </Button>
                  )}
                  {order.status !== 'CANCELLED' && onEditRequest && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEditRequest(order)}
                      className="w-full h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-border/70 hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar pedido
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={handleCopySummary}
                    className="w-full h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-border/70 hover:bg-accent">
                    {copiedSummary ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedSummary ? 'Copiado' : 'Copiar resumen'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowShippingLabel(true)}
                    className="w-full h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-blue-500/30 bg-blue-500/8 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15">
                    <Truck className="h-3.5 w-3.5" />Rótulo de envío
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => window.print()}
                    className="w-full h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-border/70 hover:bg-accent">
                    <Printer className="h-3.5 w-3.5" />Imprimir detalle
                  </Button>
                  {!isTerminal && onCancelRequest && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCancelRequest(order)}
                      className="w-full h-8 rounded-xl text-[11px] font-semibold gap-1.5 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                    >
                      <X className="h-3.5 w-3.5" />Cancelar pedido
                    </Button>
                  )}
                </div>
              </div>

              {/* Botón cerrar fijo al fondo del sidebar */}
              <div className="p-4 border-t border-border/50">
                <Button type="button" onClick={() => onOpenChange(false)}
                  className="w-full h-9 rounded-xl text-xs font-bold">
                  Cerrar detalle
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ShippingLabelDialog
        order={order}
        open={showShippingLabel}
        onOpenChange={setShowShippingLabel}
        storeName={storeName}
        branchNamesById={branchNamesById}
      />
    </>
  )
}

export function OrdersDashboard({ initialCreateOpen = false }: { initialCreateOpen?: boolean } = {}) {
  const { scope, currentScope } = useTenantScope()
  const { user } = useAuth()
  const { branches } = useBranch()
  const abortRef = useRef<AbortController | null>(null)
  const statsLoadedRef = useRef(false)

  const storeName = user?.organization?.name || 'Tienda Online'
  const storeSlug = user?.organization?.slug ?? null
  const branchNamesById = useMemo(
    () => Object.fromEntries(branches.map((branch) => [branch.id, branch.name])),
    [branches]
  )
  const showBranchInfo = branches.length > 1

  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('PENDING')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'ALL' | FulfillmentType>('ALL')
  const [branchFilter, setBranchFilter] = useState('ALL')
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [createOpen, setCreateOpen] = useState(initialCreateOpen)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<{ mode: 'single'; order: CustomerOrder } | { mode: 'bulk'; ids: string[] } | null>(null)
  const [detailOrder, setDetailOrder] = useState<CustomerOrder | null>(null)
  const [editOrder, setEditOrder] = useState<CustomerOrder | null>(null)
  const [collectionOrder, setCollectionOrder] = useState<CustomerOrder | null>(null)
  const [deliveryOrder, setDeliveryOrder] = useState<CustomerOrder | null>(null)
  const [bulkLabelOrders, setBulkLabelOrders] = useState<CustomerOrder[]>([])
  const [_showGuide, _setShowGuide] = useState(true)

  // Derived metrics (org-wide values come from the API `stats`/`meta`, not the page)
  const needsAction = (stats['PENDING'] ?? 0) + (stats['READY'] ?? 0)

  const loadOrders = useCallback(async (opts?: { forceStats?: boolean }) => {
    const requestScope = scope
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setLoadError(null)
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
      if (fulfillmentFilter !== 'ALL') params.set('fulfillment_type', fulfillmentFilter)
      if (branchFilter !== 'ALL') params.set('branch_id', branchFilter)
      if (needStats) params.set('include_stats', 'true')
      const dateFrom = getDateFrom(datePreset)
      if (dateFrom) params.set('date_from', dateFrom)

      const response = await fetch(`/api/orders?${params}`, { signal: controller.signal, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) throw new Error(payload?.error ?? 'No se pudieron cargar los pedidos.')
      if (controller.signal.aborted || abortRef.current !== controller || currentScope.current !== requestScope) return
      const data = payload.data as OrdersPayload
      setOrders(data.orders)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      if (data.stats) { setStats(data.stats); statsLoadedRef.current = true }
      if (data.meta) { setTodayCount(data.meta.todayCount); setTodayRevenue(data.meta.todayRevenue) }
    } catch (error) {
      if (controller.signal.aborted || currentScope.current !== requestScope) return
      const message = error instanceof Error ? error.message : 'Intentá nuevamente.'
      setLoadError(message)
      toast.error('No se pudieron cargar los pedidos', { description: message })
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }, [page, search, statusTab, paymentFilter, fulfillmentFilter, branchFilter, datePreset, sortField, sortDir, scope, currentScope])

  useEffect(() => {
    abortRef.current?.abort()
    statsLoadedRef.current = false
    setOrders([])
    setStats({})
    setTodayCount(0)
    setTodayRevenue(0)
    setTotal(0)
    setTotalPages(1)
    setPage(1)
    setBranchFilter('ALL')
    setFulfillmentFilter('ALL')
    setSelectedIds(new Set())
    setCancelTarget(null)
    setDetailOrder(null)
    setEditOrder(null)
    setCollectionOrder(null)
    setDeliveryOrder(null)
    setBulkLabelOrders([])
    setCreateOpen(false)
    return () => abortRef.current?.abort()
  }, [scope])

  // Mantener detailOrder sincronizado si la lista refresca
  useEffect(() => {
    setDetailOrder((cur) => {
      if (!cur) return null
      const match = orders.find((row) => row.id === cur.id)
      return match ?? cur
    })
  }, [orders])

  useEffect(() => {
    const t = window.setTimeout(() => void loadOrders(), 250)
    return () => window.clearTimeout(t)
  }, [loadOrders])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadOrders({ forceStats: true })
    }, ORDERS_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [loadOrders])

  function applyUpdatedOrder(updated: CustomerOrder, removeIfTabMismatch = false) {
    setOrders((cur) => {
      const mapped = cur.map((r) => (r.id === updated.id ? updated : r))
      if (removeIfTabMismatch && statusTab !== 'ALL' && updated.status !== statusTab) {
        return mapped.filter((r) => r.id !== updated.id)
      }
      return mapped
    })
    setDetailOrder((cur) => (cur?.id === updated.id ? updated : cur))
    setEditOrder((cur) => (cur?.id === updated.id ? updated : cur))
  }

  async function updateStatus(order: CustomerOrder, nextStatus: OrderStatus, confirmed = false, note?: string) {
    if (nextStatus === 'CANCELLED' && !confirmed) {
      setCancelTarget({ mode: 'single', order })
      return
    }
    if (nextStatus === 'DELIVERED' && !confirmed) {
      setDeliveryOrder(order)
      return
    }
    const requestScope = scope
    setUpdatingId(order.id)
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, ...(note ? { note } : {}) }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) throw new Error(payload?.error ?? 'No se pudo actualizar.')
      if (currentScope.current !== requestScope) return
      const updated = payload.data as CustomerOrder
      applyUpdatedOrder(updated, true)
      toast.success('Estado actualizado', { description: `${order.order_number} → ${ORDER_STATUS_META[nextStatus].label}` })
      if (nextStatus === 'DELIVERED') setDeliveryOrder(null)
      if (nextStatus === 'CANCELLED') setCancelTarget(null)
      // Los contadores se recargan del servidor en vez de ajustarse a mano: si
      // otro operador movió pedidos mientras tanto, la aritmética optimista
      // dejaba los números mal hasta la próxima recarga completa.
      void loadOrders({ forceStats: true })
    } catch (error) {
      toast.error('No se pudo actualizar', { description: error instanceof Error ? error.message : 'Intenta nuevamente.' })
    } finally { setUpdatingId(null) }
  }

  async function executeBulkStatus(
    ids: string[],
    targetStatus: Exclude<OrderStatus, 'PENDING'>,
    note?: string
  ) {
    if (ids.length === 0) return
    const requestScope = scope
    setBulkUpdating(true)
    try {
      const response = await fetch('/api/orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: targetStatus, ...(note ? { note } : {}) }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error ?? 'No se pudieron actualizar los pedidos seleccionados.')
      }
      if (currentScope.current !== requestScope) return

      const updatedList = (payload.data?.updated ?? []) as CustomerOrder[]
      const skippedList = (payload.data?.skipped ?? []) as Array<{ id: string; orderNumber: string; reason: string }>
      const updatedMap = new Map(updatedList.map((u) => [u.id, u]))

      if (updatedList.length > 0) {
        setOrders((cur) => {
          const mapped = cur.map((r) => updatedMap.get(r.id) ?? r)
          return statusTab !== 'ALL'
            ? mapped.filter((r) => !(updatedMap.has(r.id) && r.status !== statusTab))
            : mapped
        })
        setDetailOrder((cur) => (cur ? updatedMap.get(cur.id) ?? cur : null))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          updatedMap.forEach((_v, key) => next.delete(key))
          return next
        })
      }

      if (targetStatus === 'CANCELLED') setCancelTarget(null)

      if (updatedList.length > 0 && skippedList.length === 0) {
        toast.success(`${updatedList.length} pedido${updatedList.length === 1 ? '' : 's'} actualizado${updatedList.length === 1 ? '' : 's'}`, {
          description: `Nuevo estado: ${ORDER_STATUS_META[targetStatus].label}`,
        })
      } else if (updatedList.length > 0 && skippedList.length > 0) {
        toast.warning(`${updatedList.length} actualizados · ${skippedList.length} omitidos`, {
          description: skippedList.slice(0, 2).map((s) => `#${s.orderNumber}: ${s.reason}`).join(' | '),
        })
      } else if (skippedList.length > 0) {
        toast.info('Ningún pedido cambió de estado', {
          description: skippedList.slice(0, 2).map((s) => `#${s.orderNumber}: ${s.reason}`).join(' | '),
        })
      }

      void loadOrders({ forceStats: true })
    } catch (error) {
      toast.error('Error en acción masiva', {
        description: error instanceof Error ? error.message : 'Intentá nuevamente.',
      })
    } finally {
      setBulkUpdating(false)
    }
  }

  async function recordCollection(order: CustomerOrder, input: { amount: number; method: PaymentMethod; reference: string; note: string; idempotencyKey: string }) {
    const requestScope = scope
    setUpdatingId(order.id)
    try {
      const response = await fetch(`/api/orders/${order.id}/payment`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionAmount: input.amount,
          paymentMethod: input.method,
          paymentReference: input.reference || null,
          note: input.note || null,
          idempotencyKey: input.idempotencyKey,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error ?? 'No se pudo actualizar.')
      }
      if (currentScope.current !== requestScope) return
      const updated = payload.data as CustomerOrder
      applyUpdatedOrder(updated, false)
      setCollectionOrder(null)
      toast.success('Cobro registrado', { description: `${formatMoney(input.amount)} en ${order.order_number}` })
      void loadOrders({ forceStats: true })
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
  const selectedOrders = useMemo(() => orders.filter((o) => selectedIds.has(o.id)), [orders, selectedIds])

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) orders.forEach((o) => next.delete(o.id))
      else orders.forEach((o) => next.add(o.id))
      return next
    })
  }

  const hasActiveFilters = search !== '' || paymentFilter !== 'ALL' || fulfillmentFilter !== 'ALL' || branchFilter !== 'ALL' || datePreset !== 'all'

  function resetFilters() {
    setSearch('')
    setPaymentFilter('ALL')
    setFulfillmentFilter('ALL')
    setBranchFilter('ALL')
    setDatePreset('all')
    setPage(1)
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
        if (fulfillmentFilter !== 'ALL') params.set('fulfillment_type', fulfillmentFilter)
        if (branchFilter !== 'ALL') params.set('branch_id', branchFilter)
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
      exportOrdersCSV(collected, branchNamesById)
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
            <SectionGuideButton guide={ORDERS_GUIDE} />
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
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/8 dark:bg-[#121722]">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }}
                className="h-10 rounded-xl border-slate-200/90 bg-slate-50/70 pl-10 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-600"
                placeholder="Buscar por número, cliente, email o teléfono…" />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setPage(1) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {showBranchInfo && (
              <Select value={branchFilter} onValueChange={(v) => { setBranchFilter(v); setPage(1) }}>
                <SelectTrigger className="h-10 w-[165px] rounded-xl border-slate-200/90 bg-slate-50/70 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  <SelectValue placeholder="Todas las sucursales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las sucursales</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={fulfillmentFilter} onValueChange={(v) => { setFulfillmentFilter(v as 'ALL' | FulfillmentType); setPage(1) }}>
              <SelectTrigger className="h-10 w-[145px] rounded-xl border-slate-200/90 bg-slate-50/70 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                <SelectItem value="DELIVERY">Delivery</SelectItem>
                <SelectItem value="PICKUP">Retiro en local</SelectItem>
              </SelectContent>
            </Select>

            <Select value={datePreset} onValueChange={(v) => { setDatePreset(v as DatePreset); setPage(1) }}>
              <SelectTrigger className="h-10 w-[140px] rounded-xl border-slate-200/90 bg-slate-50/70 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
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
              <SelectTrigger className="h-10 w-[150px] rounded-xl border-slate-200/90 bg-slate-50/70 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                {ORDER_STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1) }}>
              <SelectTrigger className="h-10 w-[145px] rounded-xl border-slate-200/90 bg-slate-50/70 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <SelectValue placeholder="Todos los pagos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los pagos</SelectItem>
                {PAYMENT_STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={sortField} onValueChange={(v) => { setSortField(v as 'created_at' | 'total'); setPage(1) }}>
              <SelectTrigger className="h-10 w-[110px] rounded-xl border-slate-200/90 bg-slate-50/70 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <SelectValue placeholder="Fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Fecha</SelectItem>
                <SelectItem value="total">Monto</SelectItem>
              </SelectContent>
            </Select>

            <button type="button" onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/70 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
              <ArrowLeft className={cn('h-3.5 w-3.5 transition-transform', sortDir === 'asc' && 'rotate-90')} />
              {sortDir === 'desc' ? 'Descendente' : 'Ascendente'}
            </button>
          </div>

          {/* Active filter chips + reset */}
          {hasActiveFilters && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-200/80 dark:border-white/5 pt-3">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Filtros activos:</span>
              {branchFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-300">
                  Sucursal: {branchNamesById[branchFilter] ?? branchFilter}
                  <button type="button" onClick={() => { setBranchFilter('ALL'); setPage(1) }} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              )}
              {fulfillmentFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/70 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
                  Entrega: {fulfillmentFilter === 'DELIVERY' ? 'Delivery' : 'Retiro'}
                  <button type="button" onClick={() => { setFulfillmentFilter('ALL'); setPage(1) }} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              )}
              {datePreset !== 'all' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-300">
                  Período: {datePreset === 'today' ? 'Hoy' : datePreset === 'week' ? 'Últimos 7 días' : 'Últimos 30 días'}
                  <button type="button" onClick={() => { setDatePreset('all'); setPage(1) }} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              )}
              {statusTab !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                  Estado: {ORDER_STATUS_META[statusTab as OrderStatus]?.label ?? statusTab}
                  <button type="button" onClick={() => { setStatusTab('ALL'); setPage(1) }} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              )}
              {paymentFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-300">
                  Pago: {PAYMENT_STATUS_META[paymentFilter as PaymentStatus]?.label ?? paymentFilter}
                  <button type="button" onClick={() => { setPaymentFilter('ALL'); setPage(1) }} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-300">
                  Búsqueda: &ldquo;{search}&rdquo;
                  <button type="button" onClick={() => { setSearch(''); setPage(1) }} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              )}
              <button type="button" onClick={resetFilters}
                className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                Restablecer todos
              </button>
            </div>
          )}
        </div>

        {/* ── Bulk actions bar ── */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-500/30 bg-blue-50/90 px-4 py-3 shadow-xs dark:border-blue-500/30 dark:bg-blue-500/10">
            <div className="flex items-center gap-2.5">
              <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
                {selectedIds.size}
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                pedido{selectedIds.size === 1 ? '' : 's'} seleccionado{selectedIds.size === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline underline-offset-2"
              >
                Limpiar selección
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value=""
                disabled={bulkUpdating}
                onValueChange={(value) => {
                  const ids = Array.from(selectedIds)
                  if (value === 'CANCELLED') {
                    setCancelTarget({ mode: 'bulk', ids })
                    return
                  }
                  void executeBulkStatus(ids, value as Exclude<OrderStatus, 'PENDING'>)
                }}
              >
                <SelectTrigger className="h-8.5 w-[185px] rounded-xl border-blue-500/30 bg-white text-xs font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  <SelectValue placeholder={bulkUpdating ? 'Aplicando cambios…' : 'Cambiar estado masivo…'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONFIRMED">Confirmar pedidos</SelectItem>
                  <SelectItem value="PREPARING">Pasar a Preparando</SelectItem>
                  <SelectItem value="READY">Marcar Listos</SelectItem>
                  <SelectItem value="SHIPPED">Marcar En camino</SelectItem>
                  <SelectItem value="DELIVERED">Marcar Entregados</SelectItem>
                  <SelectItem value="CANCELLED" className="text-rose-600 dark:text-rose-400 font-semibold">Cancelar seleccionados</SelectItem>
                </SelectContent>
              </Select>

              {selectedOrders.length > 0 && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkUpdating}
                    onClick={() => setBulkLabelOrders(selectedOrders)}
                    className="h-8.5 gap-1.5 rounded-xl bg-white dark:bg-slate-900 text-xs font-semibold"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Rótulos ({selectedOrders.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkUpdating}
                    onClick={() => {
                      exportOrdersCSV(selectedOrders, branchNamesById)
                      toast.success('CSV exportado', { description: `${selectedOrders.length} seleccionados.` })
                    }}
                    className="h-8.5 gap-1.5 rounded-xl bg-white dark:bg-slate-900 text-xs font-semibold"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV ({selectedOrders.length})
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Order list ── */}
        <div className="space-y-3">
          {/* List header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Pedidos <span className="font-normal text-slate-400 dark:text-slate-500">({loading ? '…' : total})</span>
                </span>
              </div>
              {selectedIds.size > 0 && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  {selectedIds.size} seleccionados
                </span>
              )}
            </div>
            {orders.length > 0 && (
              <button type="button" onClick={toggleSelectPage}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                {allPageSelected ? 'Quitar selección' : 'Seleccionar página'}
              </button>
            )}
          </div>

          {loading ? <OrderSkeleton /> : loadError ? (
            <div role="alert" className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-center dark:border-rose-500/20 dark:bg-rose-500/5 shadow-xs">
              <AlertTriangle className="h-7 w-7 text-rose-600" />
              <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">No pudimos cargar los pedidos</p>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
              <Button className="mt-4 rounded-xl" variant="outline" size="sm" onClick={() => void loadOrders({ forceStats: true })}>Reintentar</Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center dark:border-white/12 dark:bg-[#121722] shadow-xs">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/8 dark:bg-white/[0.03]">
                <PackageSearch className="h-8 w-8 text-slate-400 dark:text-slate-600" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-200">
                {hasActiveFilters ? 'Sin coincidencias' : 'Aún no hay pedidos'}
              </p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {hasActiveFilters
                  ? 'Ningún pedido coincide con los filtros aplicados. Ajústalos o restablécelos para ver más.'
                  : 'Cuando lleguen pedidos del canal digital aparecerán aquí. También puedes crear uno manualmente.'}
              </p>
              {hasActiveFilters ? (
                <button type="button" onClick={resetFilters}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
                  <X className="h-3.5 w-3.5" /> Restablecer filtros
                </button>
              ) : (
                <button type="button" onClick={() => setCreateOpen(true)}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500">
                  <Plus className="h-3.5 w-3.5" /> Nueva orden
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  selected={selectedIds.has(order.id)}
                  updating={updatingId === order.id}
                  branchName={showBranchInfo && order.branch_id ? branchNamesById[order.branch_id] : undefined}
                  storeSlug={storeSlug}
                  onSelect={(checked) => toggleSelect(order.id, checked)}
                  onStatusChange={(s) => void updateStatus(order, s)}
                  onPaymentRequest={() => setCollectionOrder(order)}
                  onAdvanceStatus={(s) => void updateStatus(order, s)}
                  onCancelRequest={() => setCancelTarget({ mode: 'single', order })}
                  onDetailRequest={() => setDetailOrder(order)}
                  onEditRequest={() => setEditOrder(order)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1.5 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-slate-500">
                Página <strong className="text-slate-700 dark:text-slate-300">{page}</strong> de <strong className="text-slate-700 dark:text-slate-300">{totalPages}</strong>
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="gap-1.5 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Footer count */}
          {!loading && orders.length > 0 && (
            <p className="pt-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
              {total} pedido{total !== 1 ? 's' : ''} en total
            </p>
          )}
        </div>
      </div>

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen}
        onCreated={() => void loadOrders({ forceStats: true })} />
      <EditOrderDialog
        order={editOrder}
        open={Boolean(editOrder)}
        onOpenChange={(open) => { if (!open) setEditOrder(null) }}
        onUpdated={(updated) => {
          applyUpdatedOrder(updated, false)
          void loadOrders({ forceStats: true })
        }}
      />
      <OrderDetailDialog
        order={detailOrder}
        open={Boolean(detailOrder)}
        onOpenChange={(open) => { if (!open) setDetailOrder(null) }}
        onOpenCollection={(order) => {
          setDetailOrder(null)
          setCollectionOrder(order)
        }}
        onAdvanceStatus={(order, next) => void updateStatus(order, next)}
        onCancelRequest={(order) => setCancelTarget({ mode: 'single', order })}
        onEditRequest={(order) => setEditOrder(order)}
        storeName={storeName}
        storeSlug={storeSlug}
        branchNamesById={branchNamesById}
      />
      <CollectionDialog
        order={collectionOrder}
        open={Boolean(collectionOrder)}
        submitting={Boolean(collectionOrder && updatingId === collectionOrder.id)}
        onOpenChange={(open) => { if (!open) setCollectionOrder(null) }}
        onConfirm={(input) => { if (collectionOrder) void recordCollection(collectionOrder, input) }}
      />
      <DeliveryConfirmDialog
        order={deliveryOrder}
        open={Boolean(deliveryOrder)}
        submitting={Boolean(deliveryOrder && updatingId === deliveryOrder.id)}
        onOpenChange={(open) => { if (!open) setDeliveryOrder(null) }}
        onConfirm={() => { if (deliveryOrder) void updateStatus(deliveryOrder, 'DELIVERED', true) }}
      />
      <CancelOrderDialog
        open={Boolean(cancelTarget)}
        title={
          cancelTarget?.mode === 'bulk'
            ? `Cancelar ${cancelTarget.ids.length} pedido${cancelTarget.ids.length === 1 ? '' : 's'}`
            : cancelTarget?.mode === 'single'
              ? `Cancelar pedido #${cancelTarget.order.order_number}`
              : 'Cancelar pedido'
        }
        description={
          cancelTarget?.mode === 'bulk'
            ? 'Esta acción pasará a cancelado cada pedido válido de la selección. Los que ya estén cerrados serán omitidos.'
            : 'Esta acción no se puede deshacer. Puedes anotar un motivo para dejar registro en el historial.'
        }
        submitting={
          cancelTarget?.mode === 'bulk'
            ? bulkUpdating
            : Boolean(cancelTarget?.mode === 'single' && updatingId === cancelTarget.order.id)
        }
        onOpenChange={(open) => { if (!open) setCancelTarget(null) }}
        onConfirm={(note) => {
          if (!cancelTarget) return
          if (cancelTarget.mode === 'single') {
            void updateStatus(cancelTarget.order, 'CANCELLED', true, note)
          } else {
            void executeBulkStatus(cancelTarget.ids, 'CANCELLED', note)
          }
        }}
      />
      <ShippingLabelDialog
        orders={bulkLabelOrders}
        open={bulkLabelOrders.length > 0}
        onOpenChange={(open) => { if (!open) setBulkLabelOrders([]) }}
        storeName={storeName}
        branchNamesById={branchNamesById}
      />
    </div>
  )
}
