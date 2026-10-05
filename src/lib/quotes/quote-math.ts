/**
 * Presupuestos: cuentas, estados, el mensaje de WhatsApp y el puente con el POS.
 * Funciones puras: las usan la API, el editor, la página pública y el POS.
 */

import { formatCurrency, getCurrencyFractionDigits } from '@/lib/currency'

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'converted', 'cancelled'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  converted: 'Vendido',
  cancelled: 'Anulado',
}

/** Se pueden editar mientras no tengan respuesta del cliente. */
export const EDITABLE_STATUSES: QuoteStatus[] = ['draft', 'sent']
/** Se pueden pasar al POS. */
export const CONVERTIBLE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted']

export type QuoteLineInput = {
  product_id?: string | null
  variant_id?: string | null
  description: string
  sku?: string | null
  quantity: number
  unit_price: number
  discount_rate?: number
}

export type QuoteLine = QuoteLineInput & { discount_rate: number; line_total: number }

function roundTo(value: number, currency: string) {
  const factor = 10 ** getCurrencyFractionDigits(currency)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function computeLine(line: QuoteLineInput, currency = 'PYG'): QuoteLine {
  const quantity = Math.max(0, Math.trunc(Number(line.quantity) || 0))
  const unitPrice = Math.max(0, Number(line.unit_price) || 0)
  const discountRate = Math.min(100, Math.max(0, Number(line.discount_rate) || 0))
  const gross = unitPrice * quantity
  return {
    ...line,
    quantity,
    unit_price: roundTo(unitPrice, currency),
    discount_rate: discountRate,
    line_total: roundTo(gross * (1 - discountRate / 100), currency),
  }
}

export function computeTotals(lines: QuoteLineInput[], currency = 'PYG') {
  const computed = lines.map((line) => computeLine(line, currency))
  const subtotal = roundTo(computed.reduce((sum, line) => sum + line.unit_price * line.quantity, 0), currency)
  const total = roundTo(computed.reduce((sum, line) => sum + line.line_total, 0), currency)
  return { lines: computed, subtotal, discount_total: roundTo(subtotal - total, currency), total }
}

/** Fecha local YYYY-MM-DD de hoy (sin corrimientos por zona horaria). */
export function todayIso(now = new Date()) {
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function isQuoteExpired(validUntil: string | null | undefined, now = new Date()) {
  return Boolean(validUntil) && String(validUntil) < todayIso(now)
}

export function defaultValidUntil(days = 7, now = new Date()) {
  return todayIso(new Date(now.getTime() + days * 86_400_000))
}

export function quoteCode(number: number) {
  return `P-${String(number).padStart(5, '0')}`
}

/** Número para wa.me: solo dígitos, con 595 delante si viene en formato local. */
export function whatsappNumber(phone: string | null | undefined, countryCode = '595'): string | null {
  let digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 6) return null
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (!digits.startsWith(countryCode)) digits = `${countryCode}${digits}`
  else if (digits.startsWith(`${countryCode}0`)) digits = `${countryCode}${digits.slice(countryCode.length + 1)}`
  return digits
}

export function buildQuoteWhatsAppMessage(params: {
  storeName: string
  customerName: string
  number: number
  lines: Array<Pick<QuoteLine, 'description' | 'quantity' | 'line_total'>>
  total: number
  currency: string
  validUntil: string | null
  url: string
  customIntro?: string
}) {
  const money = (amount: number) => formatCurrency(amount, { currency: params.currency })
  const shown = params.lines.slice(0, 8)
  const rows = shown.map((line) => `• ${line.quantity} × ${line.description} — ${money(line.line_total)}`)
  if (params.lines.length > shown.length) rows.push(`• … y ${params.lines.length - shown.length} ítems más`)
  const valid = params.validUntil
    ? `Válido hasta el ${params.validUntil.split('-').reverse().join('/')}.`
    : null
  const greeting = params.customIntro
    ? params.customIntro
        .replace('{cliente}', params.customerName)
        .replace('{numero}', quoteCode(params.number))
        .replace('{empresa}', params.storeName)
    : `Hola ${params.customerName}! Te paso el presupuesto ${quoteCode(params.number)} de ${params.storeName}:`
  return [
    greeting,
    '',
    ...rows,
    '',
    `*Total: ${money(params.total)}*`,
    valid,
    '',
    `Podés verlo completo e imprimirlo acá: ${params.url}`,
  ].filter((line) => line !== null).join('\n')
}

/**
 * El POS cobra el precio de catálogo y acepta descuentos por línea. Para
 * respetar lo presupuestado se calcula el % que lleva el precio actual al
 * precio acordado. Si el producto bajó, se cobra el precio nuevo (0%): el
 * presupuesto nunca hace pagar de más.
 */
export function discountToHonorQuote(currentUnitPrice: number, quotedNetUnitPrice: number): number {
  if (!(currentUnitPrice > 0) || quotedNetUnitPrice >= currentUnitPrice) return 0
  const rate = (1 - quotedNetUnitPrice / currentUnitPrice) * 100
  return Math.min(100, Math.max(0, Math.round(rate * 10_000) / 10_000))
}

/** Precio aplicado por el POS para un producto, igual que process_pos_sale. */
export function posUnitPrice(product: { sale_price: number; wholesale_price?: number | null }, mode: 'retail' | 'wholesale') {
  if (mode === 'wholesale') {
    return Number(product.wholesale_price) > 0 ? Number(product.wholesale_price) : Math.round(product.sale_price * 0.9 * 100) / 100
  }
  return Number(product.sale_price)
}
