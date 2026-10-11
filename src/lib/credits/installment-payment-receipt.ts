import { formatCurrency, getDisplayLocale } from '@/lib/currency'
import { whatsappNumber } from '@/lib/receipt-utils'

/** Lo que se registró al cobrar una cuota desde la caja. */
export interface InstallmentPaymentReceipt {
  storeName: string
  customerName: string
  customerPhone?: string | null
  amount: number
  method: string
  reference?: string | null
  /** Fecha y hora del cobro. */
  paidAt: Date
  /** Lo que queda debiendo después del pago. */
  balanceAfter: number
}

const METHOD_LABELS: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }

// El idioma de la tienda, no uno fijo: una tienda de otro país veía las fechas en español paraguayo.
const when = (date: Date) => date.toLocaleString(getDisplayLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** El comprobante en texto, para mandarlo por WhatsApp. */
export function buildInstallmentPaymentText(receipt: InstallmentPaymentReceipt) {
  return [
    `*${receipt.storeName}*`,
    'Comprobante de pago de crédito',
    '',
    `Cliente: ${receipt.customerName}`,
    `Fecha: ${when(receipt.paidAt)}`,
    `*Pagó: ${formatCurrency(receipt.amount)}*`,
    `Medio: ${METHOD_LABELS[receipt.method] ?? receipt.method}${receipt.reference ? ` (ref. ${receipt.reference})` : ''}`,
    receipt.balanceAfter > 0 ? `Saldo pendiente: ${formatCurrency(receipt.balanceAfter)}` : '¡Crédito al día, sin saldo pendiente!',
    '',
    '¡Gracias!',
  ].join('\n')
}

export function installmentPaymentWhatsAppHref(receipt: InstallmentPaymentReceipt) {
  const number = whatsappNumber(receipt.customerPhone)
  const text = encodeURIComponent(buildInstallmentPaymentText(receipt))
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))

/** Ticket de 80 mm para la impresora de caja. */
export function installmentPaymentHtml(receipt: InstallmentPaymentReceipt) {
  const row = (label: string, value: string, strong = false) =>
    `<div class="row"><span>${escapeHtml(label)}</span><span${strong ? ' class="strong"' : ''}>${escapeHtml(value)}</span></div>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>Comprobante de pago</title>
<style>@page{size:80mm auto;margin:4mm}body{font-family:system-ui,sans-serif;font-size:12px;width:72mm;margin:0 auto;color:#111}
h1{font-size:15px;text-align:center;margin:0 0 2px}p{margin:0;text-align:center;color:#555}.row{display:flex;justify-content:space-between;gap:8px;margin:4px 0}
.strong{font-weight:700;font-size:14px}hr{border:0;border-top:1px dashed #999;margin:8px 0}.foot{margin-top:10px;text-align:center;font-size:11px;color:#555}</style></head>
<body><h1>${escapeHtml(receipt.storeName)}</h1><p>Comprobante de pago de crédito</p><hr>
${row('Cliente', receipt.customerName)}${row('Fecha', when(receipt.paidAt))}<hr>
${row('Pagó', formatCurrency(receipt.amount), true)}${row('Medio', `${METHOD_LABELS[receipt.method] ?? receipt.method}${receipt.reference ? ` · ${receipt.reference}` : ''}`)}
${row('Saldo pendiente', formatCurrency(Math.max(0, receipt.balanceAfter)))}<hr>
<div class="foot">Documento no fiscal · ¡Gracias!</div>
<script>window.onload=function(){window.print()}</script></body></html>`
}

/** Abre el comprobante para imprimir. Devuelve false si el navegador bloqueó la ventana. */
export function printInstallmentPayment(receipt: InstallmentPaymentReceipt): boolean {
  const win = window.open('', '_blank', 'width=420,height=640')
  if (!win) return false
  win.document.write(installmentPaymentHtml(receipt))
  win.document.close()
  return true
}
