import { logger } from '@/lib/logger'
import { sendEmail } from '@/lib/email/resend'
import { storeEmailLogoUrl } from '@/lib/email/store-logo'
import { renderOrderStatusUpdateEmail } from '@/lib/email/templates'
import { afterResponse, notifyOrderStatusChanged } from '@/lib/notifications/server/business-events'

const EMAIL_STATUS_LABELS: Record<'CONFIRMED' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED', string> = {
  CONFIRMED: 'Confirmado',
  READY: 'Listo',
  SHIPPED: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export function emitOrderStatusSideEffects(params: {
  organization: { id: string; name: string; slug: string; logoUrl?: string | null }
  actorUserId: string
  previousStatus: string
  order: {
    id: string
    order_number?: string | null
    status?: string | null
    fulfillment_type?: string | null
    branch_id?: string | null
    customer_name?: string | null
    customer_email?: string | null
    total?: unknown
  }
  targetStatus: string
  note?: string | null
}) {
  const { organization, actorUserId, previousStatus, order, targetStatus, note } = params
  if (targetStatus === previousStatus) return

  const orderNumber = String(order.order_number || '')
  const customerName = String(order.customer_name || 'Cliente')
  const total = Number(order.total || 0)

  afterResponse(() =>
    notifyOrderStatusChanged({
      organizationId: organization.id,
      branchId: typeof order.branch_id === 'string' ? order.branch_id : null,
      orderId: order.id,
      status: targetStatus,
      actorUserId,
      orderNumber,
      customerName,
      total,
    })
  )

  if (
    order.customer_email
    && (targetStatus === 'CONFIRMED'
      || targetStatus === 'READY'
      || targetStatus === 'SHIPPED'
      || targetStatus === 'DELIVERED'
      || targetStatus === 'CANCELLED')
  ) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const trackUrl = `${appUrl}/${organization.slug}/track?orderNumber=${encodeURIComponent(orderNumber)}`
    const label = EMAIL_STATUS_LABELS[targetStatus]

    sendEmail({
      to: String(order.customer_email),
      subject: `Pedido #${orderNumber} · ${label}`,
      html: renderOrderStatusUpdateEmail({
        customerName,
        orderCode: orderNumber,
        status: targetStatus,
        deliveryMethod: order.fulfillment_type === 'PICKUP' ? 'pickup' : 'delivery',
        total,
        note: note ?? null,
        trackUrl,
        brand: { name: organization.name, logoUrl: storeEmailLogoUrl(organization.logoUrl) },
      }),
      log: {
        organizationId: organization.id,
        customerName,
      },
    }).catch((err) => logger.error('Failed to send order status email', { error: err, orderId: order.id, status: targetStatus }))
  }
}
