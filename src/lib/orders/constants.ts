import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Package,
  PackageCheck,
  Truck,
  WalletCards,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { OrderStatus, PaymentMethod, PaymentStatus } from './types'
export { ORDER_FLOW, TERMINAL_ORDER_STATUSES } from './flow'

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; description: string; icon: LucideIcon; className: string }> = {
  PENDING: {
    label: 'Pendiente',
    description: 'Pedido recibido, pendiente de confirmacion.',
    icon: Clock,
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  },
  CONFIRMED: {
    label: 'Confirmado',
    description: 'El negocio ya confirmo el pedido.',
    icon: CheckCircle2,
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
  },
  PREPARING: {
    label: 'Preparando',
    description: 'El equipo esta armando el pedido.',
    icon: Package,
    className: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300',
  },
  READY: {
    label: 'Listo',
    description: 'Listo para retirar o despachar.',
    icon: PackageCheck,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
  },
  SHIPPED: {
    label: 'En camino',
    description: 'El pedido fue despachado.',
    icon: Truck,
    className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300',
  },
  DELIVERED: {
    label: 'Entregado',
    description: 'Pedido completado y entregado.',
    icon: CheckCircle2,
    className: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  CANCELLED: {
    label: 'Cancelado',
    description: 'Pedido cancelado.',
    icon: XCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
  },
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300' },
  PAID: { label: 'Pagado', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300' },
  PARTIAL: { label: 'Parcial', className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300' },
  REFUNDED: { label: 'Reembolsado', className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300' },
  FAILED: { label: 'Fallido', className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300' },
}

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; icon: LucideIcon }> = {
  CASH: { label: 'Efectivo', icon: WalletCards },
  CARD: { label: 'Tarjeta', icon: CreditCard },
  TRANSFER: { label: 'Transferencia', icon: CreditCard },
  DIGITAL_WALLET: { label: 'Billetera digital', icon: WalletCards },
}

export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_META).map(([value, meta]) => ({
  value: value as OrderStatus,
  label: meta.label,
}))

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => ({
  value: value as PaymentStatus,
  label: meta.label,
}))

export const UNKNOWN_STATUS_META = {
  label: 'Desconocido',
  description: 'Estado no reconocido.',
  icon: AlertCircle,
  className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
}
