import { NOTIFICATION_METADATA, type NotificationType } from './types'

export const NOTIFICATION_GROUPS = {
  sales: { label: 'Ventas', icon: 'cash-outline', color: '#166534', example: 'Ej.: Venta registrada · Gs. 150.000' },
  orders: { label: 'Pedidos', icon: 'cart-outline', color: '#1D4ED8', example: 'Ej.: Pedido #A12 de Ana · Gs. 150.000' },
  repairs: { label: 'Reparaciones', icon: 'build-outline', color: '#7E22CE', example: 'Ej.: Reparación #R12 lista para entregar' },
  services: { label: 'Agenda', icon: 'calendar-outline', color: '#0E7490', example: 'Ej.: Nuevo turno para mañana' },
  inventory: { label: 'Stock', icon: 'cube-outline', color: '#92400E', example: 'Ej.: Un producto alcanzó el stock mínimo' },
  cash: { label: 'Caja', icon: 'wallet-outline', color: '#9F1239', example: 'Ej.: Revisá una diferencia en el cierre' },
  credits: { label: 'Cobros', icon: 'card-outline', color: '#9F1239', example: 'Ej.: Tenés una cuota vencida' },
  suppliers: { label: 'Proveedores', icon: 'business-outline', color: '#475569', example: 'Ej.: Llegó mercadería de una compra' },
  employees: { label: 'Equipo', icon: 'people-outline', color: '#475569', example: 'Ej.: Se actualizaron tus permisos' },
  security: { label: 'Seguridad', icon: 'shield-checkmark-outline', color: '#475569', example: 'Ej.: Nuevo acceso a tu cuenta' },
  system: { label: 'Cuenta', icon: 'information-circle-outline', color: '#475569', example: 'Ej.: Tu plan está por vencer' },
} as const
export type NotificationGroup = keyof typeof NOTIFICATION_GROUPS
export function notificationGroup(type: string): NotificationGroup {
  return NOTIFICATION_METADATA[type as NotificationType]?.category ?? 'system'
}
export function isUrgentNotification(type: string) {
  return ['NEW_ONLINE_ORDER', 'REPAIR_READY', 'CASH_DIFFERENCE', 'PAYMENT_FAILED', 'SUBSCRIPTION_PAYMENT_FAILED', 'REPAIR_OVERDUE', 'ORDER_OVERDUE'].includes(type)
}
export function notificationDateSection(createdAt: string, now = new Date()) {
  const date = new Date(createdAt)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  if (date >= today) return 'Hoy'
  if (date >= yesterday) return 'Ayer'
  if (date >= monday) return 'Esta semana'
  return 'Anteriores'
}
export function relativeNotificationTime(createdAt: string, now = new Date()) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000))
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `hace ${minutes} min`
  if (minutes < 1440) return `hace ${Math.floor(minutes / 60)} h`
  return new Date(createdAt).toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })
}
export function notificationChannel(type: string) { return `business-${notificationGroup(type)}` }
export const CATEGORY_CHANNEL_VERSION = '1.1.0'
export function supportsCategoryChannels(version: string | null | undefined) {
  return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version) && (Number(version.split('.')[0]) > 1 || (Number(version.split('.')[0]) === 1 && Number(version.split('.')[1]) >= 1))
}