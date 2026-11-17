import type { CustomerOrder } from '@/lib/orders/types'

/**
 * Comprobante imprimible de un pedido: el mismo HTML para la web (ventana de
 * impresión) y la app (impresión del sistema o PDF). Sin dependencias de
 * servidor ni del navegador para poder probarlo.
 */

export type OrderReceiptPaper = '58mm' | '80mm' | 'A4'

export type OrderReceiptCompany = {
  name: string
  phone?: string | null
  address?: string | null
  email?: string | null
  logo?: string | null
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PREPARING: 'En preparación', READY: 'Listo',
  SHIPPED: 'En camino', DELIVERED: 'Entregado', CANCELLED: 'Cancelado',
}
export const ORDER_PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', PAID: 'Pagado', PARTIAL: 'Pago parcial', REFUNDED: 'Reintegrado', FAILED: 'Fallido',
}
export const ORDER_PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', DIGITAL_WALLET: 'Billetera digital',
}

/** Ancho y alto (en puntos) que usa la impresión del sistema en la app. */
export function orderReceiptPageSize(paper: OrderReceiptPaper) {
  return { width: paper === '58mm' ? 164 : paper === '80mm' ? 227 : 595, ...(paper === 'A4' ? { height: 842 } : {}) }
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string))

export function formatOrderMoney(value: number, currency = 'PYG') {
  const amount = Number.isFinite(value) ? value : 0
  if (currency === 'PYG') return `Gs. ${Math.round(amount).toLocaleString('es-PY')}`
  return `${currency} ${amount.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value: string | null | undefined, timeZone: string) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  try {
    return date.toLocaleString('es-PY', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return date.toLocaleString('es-PY')
  }
}

export function generateOrderReceiptHTML(
  order: CustomerOrder,
  company: OrderReceiptCompany,
  paper: OrderReceiptPaper,
  options: { currency?: string; timeZone?: string } = {},
): string {
  const currency = options.currency || 'PYG'
  const timeZone = options.timeZone || 'America/Asuncion'
  const narrow = paper !== 'A4'
  const money = (value: number) => escapeHtml(formatOrderMoney(value, currency))
  const delivery = order.fulfillment_type === 'DELIVERY'

  const items = order.order_items.map((item) => {
    const name = escapeHtml(item.product_name) + (item.variant_name ? ` <span class="muted">(${escapeHtml(item.variant_name)})</span>` : '')
    const sku = item.product_sku ? `<div class="muted small">SKU ${escapeHtml(item.product_sku)}</div>` : ''
    return narrow
      ? `<tr><td colspan="3">${name}${sku}</td></tr><tr><td class="muted">${escapeHtml(item.quantity)} × ${money(item.unit_price)}</td><td></td><td class="num">${money(item.subtotal)}</td></tr>`
      : `<tr><td>${name}${sku}</td><td class="num">${escapeHtml(item.quantity)}</td><td class="num">${money(item.unit_price)}</td><td class="num">${money(item.subtotal)}</td></tr>`
  }).join('')

  const totals = [
    ['Subtotal', order.subtotal],
    ...(order.discount_amount > 0 ? [['Descuento', -order.discount_amount] as const] : []),
    ...(order.shipping_cost > 0 ? [['Envío', order.shipping_cost] as const] : []),
    ...(order.tax_amount > 0 ? [['Impuestos', order.tax_amount] as const] : []),
  ].map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td class="num">${money(Number(value))}</td></tr>`).join('')

  const pending = order.payment_status !== 'PAID' && order.amount_due > 0
    ? `<tr><td>Saldo pendiente</td><td class="num">${money(order.amount_due)}</td></tr>` : ''

  const companyLines = [company.address, company.phone && `Tel. ${company.phone}`, company.email]
    .filter(Boolean).map((line) => `<div>${escapeHtml(line)}</div>`).join('')

  const customerLines = [
    `<div><strong>${escapeHtml(order.customer_name || 'Cliente')}</strong></div>`,
    order.customer_phone ? `<div>Tel. ${escapeHtml(order.customer_phone)}</div>` : '',
    order.customer_email ? `<div>${escapeHtml(order.customer_email)}</div>` : '',
    delivery && order.customer_address ? `<div>Entrega: ${escapeHtml(order.customer_address)}</div>` : '',
  ].join('')

  const pageCss = narrow
    ? `@page{size:${paper} auto;margin:2mm}body{width:${paper === '58mm' ? '54mm' : '74mm'};font-size:${paper === '58mm' ? 10 : 12}px}`
    : '@page{size:A4;margin:14mm}body{max-width:180mm;font-size:12px}'

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pedido ${escapeHtml(order.order_number)}</title>
<style>${pageCss}
*{box-sizing:border-box}body{margin:0 auto;font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:#000;line-height:1.35}
h1{font-size:1.25em;margin:0}h2{font-size:1em;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.04em}
.center{text-align:center}.muted{color:#555}.small{font-size:.85em}.num{text-align:right;white-space:nowrap}
.hr{border-top:1px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse}td,th{padding:3px 2px;vertical-align:top}
${narrow ? '' : 'th{text-align:left;border-bottom:1.5px solid #000;font-size:11px;text-transform:uppercase}tbody td{border-bottom:1px solid #ddd}.totals{margin-left:auto;width:45%}'}
.total td{font-weight:800;font-size:1.15em;border-top:1.5px solid #000;padding-top:5px}.logo{max-height:48px;max-width:60%;margin-bottom:4px}
.badge{display:inline-block;border:1px solid #000;border-radius:4px;padding:1px 6px;font-size:.85em;font-weight:700}
</style></head><body>
<div class="center">
${company.logo ? `<img class="logo" src="${escapeHtml(company.logo)}" alt="">` : ''}
<h1>${escapeHtml(company.name)}</h1>
<div class="small">${companyLines}</div>
</div>
<div class="hr"></div>
<div class="center"><strong>PEDIDO ${escapeHtml(order.order_number)}</strong><div class="small muted">${escapeHtml(formatDate(order.created_at, timeZone))}</div>
<div class="small">${escapeHtml(delivery ? 'Envío a domicilio' : 'Retiro en el local')} · <span class="badge">${escapeHtml(ORDER_STATUS_LABELS[order.status] ?? order.status)}</span></div></div>
<h2>Cliente</h2>${customerLines}
<h2>Productos</h2>
<table>${narrow ? '' : '<thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead>'}<tbody>${items || '<tr><td class="muted">Sin productos</td></tr>'}</tbody></table>
<div class="hr"></div>
<table class="totals"><tbody>${totals}<tr class="total"><td>Total</td><td class="num">${money(order.total)}</td></tr>${pending}</tbody></table>
<div class="small" style="margin-top:6px">Pago: ${escapeHtml(ORDER_PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method)} · ${escapeHtml(ORDER_PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status)}</div>
${order.notes ? `<h2>Notas</h2><div class="small">${escapeHtml(order.notes)}</div>` : ''}
<div class="hr"></div>
<div class="center small muted">Gracias por tu compra</div>
</body></html>`
}
