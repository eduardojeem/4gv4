import { config } from '@/lib/config'
import { formatCurrency } from '@/lib/currency'
import { HIGH_CONTRAST_PRINT_CSS } from '@/lib/print-contrast'
import QRCode from 'qrcode'
import {
  abandonmentClause,
  CLAUSE_TOPICS,
  DAMAGE_EXCLUSION_CLAUSE,
  DEFAULT_RECEIPT_SETTINGS,
  normalizeRepairReceiptSettings,
  PICKUP_CLAUSE,
  type RepairReceiptSettings,
  type RepairReceiptSettingsPatch,
} from '@/lib/repairs/receipt-settings'
import { escapeHtmlDeep } from '@/lib/html-escape'
import {
  formatWarrantyMonths,
  resolveWarranty,
  WARRANTY_TYPE_PRINT_LABELS,
} from '@/lib/repairs/warranty'

export { DEFAULT_RECEIPT_SETTINGS, type RepairReceiptSettings } from '@/lib/repairs/receipt-settings'

export const REPAIR_RECEIPT_SETTINGS_EVENT = 'repair-receipt-settings-updated'
const RECEIPT_SETTINGS_KEY = '4g_repair_receipt_settings'
const ACTIVE_RECEIPT_ORGANIZATION_KEY = '4g_repair_receipt_settings_active_org'

function receiptSettingsKey(organizationId?: string | null) {
  return organizationId ? `${RECEIPT_SETTINGS_KEY}:${organizationId}` : RECEIPT_SETTINGS_KEY
}

/**
 * Utilidades de impresión de comprobantes de reparación.
 *
 * Provee generación de número de ticket, formateo de HTML imprimible
 * y la acción de abrir ventana de impresión para tres tipos de recibos:
 * - `customer`: Comprobante de recepción para el cliente (con desglose de anticipo/seña y accesorios).
 * - `technician`: Ficha de trabajo simple y compacta para pegar en el equipo.
 * - `technician_detailed`: Ficha técnica de laboratorio completa (PIN/Patrón, checklist, accesorios y diagnóstico).
 */

export type RepairReceiptType = 'customer' | 'technician' | 'technician_detailed'

export const getReceiptSettings = (organizationId?: string | null): RepairReceiptSettings => {
  try {
    if (typeof window !== 'undefined') {
      const storedActiveOrganizationId = window.localStorage.getItem(ACTIVE_RECEIPT_ORGANIZATION_KEY)
      const activeOrganizationId = organizationId || storedActiveOrganizationId
      const scoped = window.localStorage.getItem(receiptSettingsKey(activeOrganizationId))
      const mayUseLegacy = !organizationId || !storedActiveOrganizationId || storedActiveOrganizationId === organizationId
      const raw = scoped || (mayUseLegacy ? window.localStorage.getItem(RECEIPT_SETTINGS_KEY) : null)
      if (raw) {
        return normalizeRepairReceiptSettings(JSON.parse(raw))
      }
      const legacyPaper = window.localStorage.getItem('repairReceiptPaper') as '80mm' | '58mm' | 'A4'
      if (legacyPaper) {
        return { ...DEFAULT_RECEIPT_SETTINGS, paperFormat: legacyPaper }
      }
    }
  } catch {}
  return DEFAULT_RECEIPT_SETTINGS
}

export const saveReceiptSettings = (
  settings: Partial<RepairReceiptSettings>,
  organizationId?: string | null
): RepairReceiptSettings => {
  try {
    if (typeof window !== 'undefined') {
      const current = getReceiptSettings(organizationId)
      const updated: RepairReceiptSettings = { ...current, ...settings }
      if (organizationId) window.localStorage.setItem(ACTIVE_RECEIPT_ORGANIZATION_KEY, organizationId)
      window.localStorage.setItem(receiptSettingsKey(organizationId), JSON.stringify(updated))
      if (updated.paperFormat) {
        window.localStorage.setItem('repairReceiptPaper', updated.paperFormat)
      }
      window.dispatchEvent(new CustomEvent(REPAIR_RECEIPT_SETTINGS_EVENT, { detail: updated }))
      return updated
    }
  } catch {}
  return { ...DEFAULT_RECEIPT_SETTINGS, ...settings }
}

/**
 * La copia del navegador, al día con el servidor.
 *
 * El detalle de la reparación y la fila del listado imprimen con
 * `getReceiptSettings()`, que lee lo guardado en este navegador. Esa copia solo
 * se actualizaba al abrir el diálogo del comprobante: en una computadora donde
 * nadie lo abría se imprimía con la configuración de fábrica o con una vieja.
 * Se refresca al abrir las pantallas de reparaciones, como mucho una vez por
 * minuto.
 */
const RECEIPT_SETTINGS_FRESH_MS = 60_000
let lastReceiptSync = 0
let receiptSyncInFlight: Promise<ReceiptSettingsSnapshot | null> | null = null

export type ReceiptSettingsSnapshot = {
  settings: RepairReceiptSettings
  organizationId: string | null
  persisted: boolean
  canEdit: boolean
}

export function refreshReceiptSettings(options: { force?: boolean } = {}): Promise<ReceiptSettingsSnapshot | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (receiptSyncInFlight) return receiptSyncInFlight
  if (!options.force && Date.now() - lastReceiptSync < RECEIPT_SETTINGS_FRESH_MS) return Promise.resolve(null)

  receiptSyncInFlight = (async () => {
    try {
      const response = await fetch('/api/repairs/receipt-settings', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success || !payload.data) return null

      const organizationId = typeof payload.organizationId === 'string' ? payload.organizationId : null
      const settings = saveReceiptSettings(normalizeRepairReceiptSettings(payload.data), organizationId)
      lastReceiptSync = Date.now()
      return {
        settings,
        organizationId,
        persisted: Boolean(payload.persisted),
        canEdit: payload.canEdit !== false,
      }
    } catch {
      return null
    } finally {
      receiptSyncInFlight = null
    }
  })()

  return receiptSyncInFlight
}

/**
 * Guarda solo los campos que cambiaron. El servidor los fusiona con lo que ya
 * está guardado, así dos pantallas que editan cosas distintas no se pisan.
 */
export async function patchReceiptSettings(
  patch: RepairReceiptSettingsPatch
): Promise<{ ok: true; settings: RepairReceiptSettings; organizationId: string | null } | { ok: false; status: number; error: string }> {
  try {
    const response = await fetch('/api/repairs/receipt-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: patch }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) {
      return {
        ok: false,
        status: response.status,
        error: payload?.error
          || (response.status === 403
            ? 'Solo un administrador puede cambiar esta configuración.'
            : 'No se pudo guardar la configuración.'),
      }
    }
    const organizationId = typeof payload.organizationId === 'string' ? payload.organizationId : null
    const settings = saveReceiptSettings(normalizeRepairReceiptSettings(payload.data), organizationId)
    lastReceiptSync = Date.now()
    return { ok: true, settings, organizationId }
  } catch {
    return { ok: false, status: 0, error: 'No se pudo conectar para guardar la configuración.' }
  }
}

/**
 * Avisa cuando cambia la configuración: en esta pestaña (el evento que ya
 * existía) y en las otras abiertas del mismo navegador (el evento `storage`).
 */
export function subscribeReceiptSettings(listener: (settings: RepairReceiptSettings) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const onLocal = (event: Event) => {
    const detail = (event as CustomEvent<RepairReceiptSettings>).detail
    listener(detail ? normalizeRepairReceiptSettings(detail) : getReceiptSettings())
  }
  const onStorage = (event: StorageEvent) => {
    if (!event.key || !event.key.startsWith(RECEIPT_SETTINGS_KEY) || event.key === ACTIVE_RECEIPT_ORGANIZATION_KEY) return
    listener(getReceiptSettings())
  }

  window.addEventListener(REPAIR_RECEIPT_SETTINGS_EVENT, onLocal)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(REPAIR_RECEIPT_SETTINGS_EVENT, onLocal)
    window.removeEventListener('storage', onStorage)
  }
}

/** Solo para pruebas: olvida cuándo fue la última sincronización. */
export function resetReceiptSettingsSyncForTests() {
  lastReceiptSync = 0
  receiptSyncInFlight = null
}

export interface RepairDevicePrintItem {
  typeLabel: string
  brand: string
  model: string
  issue: string
  description?: string
  technician?: string
  estimatedCost?: number
  finalCost?: number | null
  paidAmount?: number
  deposit?: number
  serialNumber?: string
  imei?: string
  accessType?: string
  accessPassword?: string
  accessories?: string
  ticketNumber?: string
}

export interface RepairCustomerInfo {
  id?: string
  name: string
  phone?: string
  alternate_phone?: string | null
  alternate_phone_label?: string | null
  email?: string
  address?: string
  document?: string
  city?: string
  country?: string
  customerCode?: string
}

export interface CompanyInfo {
  name: string
  phone?: string
  address?: string
  email?: string
  logo?: string
}

const FALLBACK_COMPANY: CompanyInfo = {
  name: '',
  phone: '',
  address: '',
  email: '',
}

export interface RepairPrintPayload {
  ticketNumber?: string
  date?: Date
  customer: RepairCustomerInfo
  devices: RepairDevicePrintItem[]
  priority?: string
  urgency?: string
  warrantyMonths?: number
  warrantyType?: 'labor' | 'parts' | 'full'
  warrantyNotes?: string
  deposit?: number
  paidAmount?: number
  finalCost?: number
  estimatedCost?: number
  accessories?: string
  company?: CompanyInfo
  verificationHash?: string
  /**
   * Lo que cobra la orden tal como lo muestra la pantalla (resultado de
   * getRepairFinancialPresentation). Si viene, manda sobre los costos sueltos:
   * antes una orden «sin reparar · sin costo» se imprimía con el presupuesto
   * entero como saldo.
   */
  financial?: {
    total: number | null
    paid: number
    balance: number | null
    label?: string
    isUnrepaired?: boolean
  }
  /** «intake» al dejar el equipo; «delivery» cuando ya se entregó. */
  stage?: 'intake' | 'delivery'
  deliveredAt?: Date
  deliveryOutcome?: 'repaired' | 'withdrawn' | 'unrepairable'
  warrantyExpiresAt?: Date
  /** Si es una copia de una orden guardada: cuándo se imprimió. */
  copyPrintedAt?: Date
}

const DELIVERY_OUTCOME_LABELS: Record<NonNullable<RepairPrintPayload['deliveryOutcome']>, string> = {
  repaired: 'Reparado',
  withdrawn: 'Retirado sin reparar',
  unrepairable: 'Sin reparación posible',
}

/**
 * Totales de la orden, iguales en el papel y en WhatsApp. Si la orden trae el
 * resumen de la pantalla, se usa ese; si no (la orden recién creada), se suman
 * los costos como antes.
 */
function printableTotals(payload: RepairPrintPayload) {
  if (payload.financial) {
    const { total, paid, balance, label, isUnrepaired } = payload.financial
    return {
      totalCost: total ?? 0,
      paidAmount: paid,
      pendingBalance: balance ?? 0,
      hasBudget: total !== null && total > 0,
      // Sin reparar o sin costo: la pantalla ya dice cómo quedó.
      outcomeLabel: isUnrepaired || (total === 0 && label) ? label : undefined,
    }
  }
  let totalCost = payload.finalCost ?? payload.estimatedCost ?? 0
  let paidAmount = payload.paidAmount ?? payload.deposit ?? 0
  if (payload.devices.length > 0) {
    if (totalCost === 0) {
      totalCost = payload.devices.reduce((sum, d) => sum + (d.finalCost ?? d.estimatedCost ?? 0), 0)
    }
    if (paidAmount === 0) {
      paidAmount = payload.devices.reduce((sum, d) => sum + (d.paidAmount ?? d.deposit ?? 0), 0)
    }
  }
  return {
    totalCost,
    paidAmount,
    pendingBalance: Math.max(0, totalCost - paidAmount),
    hasBudget: totalCost > 0,
    outcomeLabel: undefined as string | undefined,
  }
}

/** Números de orden reales: los de la orden y los de cada equipo, sin repetir. */
function orderNumbers(payload: RepairPrintPayload): string[] {
  const numbers = [payload.ticketNumber, ...payload.devices.map((device) => device.ticketNumber)]
    .filter((value): value is string => Boolean(value && value.trim()))
  return [...new Set(numbers)]
}

/**
 * QR de seguimiento en SVG, armado en el momento y sin pedir nada afuera.
 *
 * Reemplaza al hash de 64 caracteres impreso como texto, que nadie podía usar:
 * el cliente lo escanea y abre el estado de su reparación, y el taller valida
 * que el comprobante es auténtico.
 */
function trackingQrSvg(ticketNumber: string, hash: string, sizePx: number): string {
  try {
    // La misma URL que arma generateRepairTrackingURL; no se importa de
    // repair-qr para que el comprobante no dependa de ese modulo (ver
    // repair-qr-server-only.test).
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/mis-reparaciones/${encodeURIComponent(ticketNumber)}?verify=${encodeURIComponent(hash)}`
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
    const count = qr.modules.size
    const margin = 2
    const total = count + margin * 2
    let path = ''
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.modules.get(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" role="img" aria-label="QR de seguimiento"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
  } catch {
    return ''
  }
}

/**
 * Genera un texto formateado para compartir por WhatsApp o copiar.
 */
export const generateRepairShareText = (
  payload: RepairPrintPayload,
  settings: RepairReceiptSettings = getReceiptSettings()
): string => {
  const company = payload.company || FALLBACK_COMPANY
  const ticketNumber = orderNumbers(payload).join(', ') || 'Sin número'
  const dateObj = payload.date || new Date()
  const date = dateObj.toLocaleDateString(config.locale || 'es-PY')
  
  const { totalCost, paidAmount, pendingBalance, outcomeLabel } = printableTotals(payload)
  const isDelivery = payload.stage === 'delivery'

  let text = `*${company.name || 'Servicio Técnico'}* - ${isDelivery ? 'Comprobante de Entrega' : 'Comprobante de Recepción'}\n`
  text += `═══════════════════════════════\n`
  text += `📄 *N° de Orden / Ticket:* ${ticketNumber}\n`
  text += `📅 *Fecha:* ${date}\n`
  text += `👤 *Cliente:* ${payload.customer.name}\n`
  if (payload.customer.phone) {
    text += `📞 *Teléfono:* ${payload.customer.phone}\n`
  }
  if (payload.customer.alternate_phone) {
    text += `📞 *Tel. Alternativo:* ${payload.customer.alternate_phone}${payload.customer.alternate_phone_label ? ` (${payload.customer.alternate_phone_label})` : ''}\n`
  }
  text += `═══════════════════════════════\n`
  text += `📱 *EQUIPOS INGRESADOS*\n`
  
  payload.devices.forEach((d, i) => {
    if (i > 0) text += `───────────────────────────────\n`
    text += `• *Equipo:* ${d.brand} ${d.model}\n`
    if (d.imei || d.serialNumber) {
      text += `• *IMEI/SN:* ${d.imei || d.serialNumber}\n`
    }
    text += `• *Problema:* ${d.issue}\n`
    if (d.accessories || payload.accessories) {
      text += `• *Accesorios:* ${d.accessories || payload.accessories}\n`
    }
    if (d.estimatedCost && payload.devices.length > 1) {
      text += `• *Presupuesto:* ${formatCurrency(d.estimatedCost)}\n`
    }
  })
  
  text += `═══════════════════════════════\n`
  text += `💰 *RESUMEN DE PAGO*\n`
  if (outcomeLabel) {
    text += `• *Resultado:* ${outcomeLabel}\n`
    if (paidAmount > 0) text += `• *Pagado:* ${formatCurrency(paidAmount)}\n`
  } else if (totalCost <= 0) {
    // Sin presupuesto todavía: «Gs. 0» se leía como «no hay nada que pagar».
    text += `• *Presupuesto:* a definir tras el diagnóstico\n`
    if (paidAmount > 0) text += `• *Seña pagada:* ${formatCurrency(paidAmount)}\n`
  } else {
    text += `• *Presupuesto Total:* ${formatCurrency(totalCost)}\n`
    if (paidAmount > 0) text += `• *Anticipo / Seña:* -${formatCurrency(paidAmount)}\n`
    text += `• *Saldo al Retirar:* *${formatCurrency(pendingBalance)}*\n`
  }
  
  // La misma regla que el papel: si la orden no dice nada, la del taller. Antes
  // el comprobante imprimía «3 meses» y el WhatsApp no mencionaba la garantía.
  const warranty = resolveWarranty(payload, settings)
  if (warranty.months > 0) {
    text += `\n🛡️ *Garantía:* ${formatWarrantyMonths(warranty.months)}, ${WARRANTY_TYPE_PRINT_LABELS[warranty.type]}`
    if (warranty.notes) {
      text += ` (${warranty.notes})`
    }
    text += `\n`
  } else {
    text += `\n🛡️ *Garantía:* esta reparación no incluye garantía\n`
  }

  if (company.address) text += `\n📍 *Ubicación:* ${company.address}\n`
  if (company.phone) text += `📞 *Contacto:* ${company.phone}\n`
  text += `\n_¡Muchas gracias por confiar en nuestro servicio técnico!_`

  return text
}

/**
 * Abre WhatsApp directamente con el mensaje preformateado.
 */
export const openRepairWhatsApp = (payload: RepairPrintPayload, directPhone?: string): void => {
  const phone = directPhone || payload.customer.phone
  const text = generateRepairShareText(payload)
  const encodedText = encodeURIComponent(text)

  let cleanPhone = phone ? phone.replace(/[^\d+]/g, '') : ''
  if (cleanPhone.startsWith('+')) {
    cleanPhone = cleanPhone.slice(1)
  }

  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`

  if (typeof window !== 'undefined') {
    window.open(url, '_blank')
  }
}

/**
 * Abre una nueva ventana con el HTML del comprobante y dispara la impresión.
 */
export const printRepairReceipt = (
  type: RepairReceiptType,
  payload: RepairPrintPayload,
  paperOverride?: '80mm' | '58mm' | 'A4',
  settingsOverride?: RepairReceiptSettings
): void => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Por favor, permita las ventanas emergentes para imprimir los comprobantes.')
    return
  }

  const html = generateRepairReceiptHTML(type, payload, paperOverride, settingsOverride)
  printWindow.document.write(html)
  printWindow.document.close()

  if (printWindow && !printWindow.closed) {
    try {
      printWindow.focus()
    } catch {}
  }
}

/**
 * Igual que printRepairReceipt, pero con datos que todavía hay que pedir (la
 * firma del QR). La ventana se abre en el mismo clic —después de esperar, el
 * navegador la bloquea como emergente— y el comprobante se escribe al llegar.
 */
export const printRepairReceiptWhenReady = async (
  type: RepairReceiptType,
  payload: Promise<RepairPrintPayload>,
  paperOverride?: '80mm' | '58mm' | 'A4',
  settingsOverride?: RepairReceiptSettings
): Promise<void> => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Por favor, permita las ventanas emergentes para imprimir los comprobantes.')
    return
  }
  try {
    printWindow.document.title = 'Preparando comprobante…'
  } catch {}

  const ready = await payload
  if (printWindow.closed) return
  printWindow.document.write(generateRepairReceiptHTML(type, ready, paperOverride, settingsOverride))
  printWindow.document.close()
  try {
    printWindow.focus()
  } catch {}
}

/**
 * Construye el HTML auto-contenido para impresión.
 */
export const generateRepairReceiptHTML = (
  type: RepairReceiptType,
  rawPayload: RepairPrintPayload,
  paperOverride?: '80mm' | '58mm' | 'A4',
  settingsOverride?: RepairReceiptSettings
): string => {
  // El QR se arma con los datos crudos (no es HTML); todo lo demas, escapado.
  const rawNumbers = orderNumbers(rawPayload)
  const qrTicket = rawPayload.ticketNumber || (rawNumbers.length === 1 ? rawNumbers[0] : '')
  const payload = escapeHtmlDeep(rawPayload)
  const company = payload.company || FALLBACK_COMPANY
  // Nunca un numero inventado: antes, con varios equipos, se imprimia uno al
  // azar que no existia en el sistema.
  const numbers = orderNumbers(payload)
  const ticketNumber = numbers.join(', ')
  const orderLabel = numbers.length === 0 ? '' : numbers.length === 1 ? `Orden N° ${numbers[0]}` : `Órdenes N° ${ticketNumber}`
  const showDeviceNumbers = numbers.length > 1
  const deviceNumber = (d: RepairDevicePrintItem) => (showDeviceNumbers && d.ticketNumber ? ` · N° ${d.ticketNumber}` : '')
  const dateObj = payload.date || new Date()
  const date = dateObj.toLocaleDateString(config.locale || 'es-PY')
  const time = dateObj.toLocaleTimeString(config.locale || 'es-PY')
  
  const settings = escapeHtmlDeep(settingsOverride || getReceiptSettings())
  const paperPref = paperOverride || settings.paperFormat || '80mm'
  const isA4 = paperPref === 'A4'
  const pageSizeValue = isA4 ? 'A4' : `${paperPref} auto`
  const bodyWidthValue = isA4 ? 'auto' : (paperPref === '58mm' ? '48mm' : '72mm')
  const baseFontSize = isA4 ? '14px' : (paperPref === '58mm' ? '11px' : '13px')
  const basePadding = isA4 ? '10mm' : '3mm'

  // Cálculo financiero
  const { totalCost, paidAmount, pendingBalance, hasBudget, outcomeLabel } = printableTotals(payload)
  const isDelivery = payload.stage === 'delivery'
  const shortDate = (value?: Date) => (value ? value.toLocaleDateString(config.locale || 'es-PY') : '')
  const copyNote = payload.copyPrintedAt
    ? `Copia impresa el ${payload.copyPrintedAt.toLocaleString(config.locale || 'es-PY')}`
    : ''
  const costLabel = (amount?: number) => (amount && amount > 0 ? formatCurrency(amount) : 'A presupuestar')
  const priorityLabel = `${payload.priority === 'high' ? 'ALTA' : payload.priority === 'medium' ? 'MEDIA' : 'NORMAL'}${payload.urgency === 'urgent' ? ' · URGENTE' : ''}`
  const orderBadge = orderLabel ? `<div style="text-align: center;"><span class="ticket-badge">${orderLabel}</span></div>` : ''

  // Estilos modernos unificados
  const modernStyles = `
    @media print {
      @page { 
        size: ${pageSizeValue}; 
        margin: 0; 
      }
      body { 
        padding: ${basePadding}; 
        width: ${bodyWidthValue}; 
      }
      img.company-logo {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        ${(!isA4 && settings.monochromeLogo) ? 'filter: grayscale(100%) contrast(260%) brightness(90%) !important;' : ''}
      }
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #fff;
      line-height: 1.35;
      padding: ${basePadding};
      font-size: ${baseFontSize};
      max-width: ${isA4 ? '800px' : '295px'};
      margin: 0 auto;
    }
    
    .company-logo {
      display: block;
      margin: 0 auto 6px auto;
      max-height: ${settings.logoHeight || (isA4 ? 65 : 46)}px;
      max-width: ${isA4 ? '220px' : (paperPref === '58mm' ? '140px' : '180px')};
      object-fit: contain;
      background: transparent;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      ${(!isA4 && settings.monochromeLogo) ? 'filter: grayscale(100%) contrast(240%) brightness(92%); mix-blend-mode: multiply;' : ''}
    }

    .header {
      text-align: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px dashed #9ca3af;
    }
    
    .company-name {
      font-size: ${settings.showLogo ? '18px' : '21px'};
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: ${settings.showLogo ? '0.5px' : '1px'};
      margin: 2px 0;
    }
    
    .company-info {
      font-size: 11px;
      color: #374151;
      line-height: 1.3;
      margin-top: 3px;
    }
    
    .date-time {
      font-size: 11px;
      color: #4b5563;
      margin-top: 4px;
    }
    
    .ticket-badge {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 16px;
      margin: 8px 0;
      display: inline-block;
      letter-spacing: 0.5px;
    }
    
    .title {
      font-size: 14px;
      font-weight: 800;
      text-align: center;
      color: #0f172a;
      margin: 6px 0;
      text-transform: uppercase;
    }
    
    .section-card {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 8px;
      margin: 8px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: #111827;
      margin-bottom: 6px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
      text-transform: uppercase;
    }
    
    .info-grid {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-size: 12px;
      padding: 1px 0;
    }
    
    .info-label {
      color: #4b5563;
      font-weight: 600;
    }
    
    .info-value {
      color: #111827;
      font-weight: 700;
      text-align: right;
      flex: 1;
      margin-left: 6px;
      word-break: break-word;
    }
    
    .device-card {
      border: 1.5px solid #1f2937;
      border-radius: 6px;
      padding: 8px;
      margin: 8px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .device-header {
      font-size: 13px;
      font-weight: 800;
      color: #111827;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }

    .device-sub {
      font-size: 11px;
      color: #4b5563;
      margin-bottom: 6px;
    }

    .problem-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 6px;
      margin: 6px 0;
      font-size: 12px;
      color: #111827;
    }

    .financial-box {
      border: 1.5px solid #0f172a;
      background: #fafafa;
      border-radius: 6px;
      padding: 8px;
      margin: 8px 0;
      break-inside: avoid;
    }

    .warranty-box {
      border: 1px solid #9ca3af;
      border-radius: 6px;
      padding: 8px;
      margin: 8px 0;
      font-size: 11px;
      color: #374151;
      break-inside: avoid;
    }

    .legal-text {
      font-size: 10.5px;
      color: #6b7280;
      text-align: justify;
      margin-top: 8px;
      line-height: 1.35;
      padding-top: 6px;
      border-top: 1px dashed #d1d5db;
    }

    .footer {
      text-align: center;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #9ca3af;
      font-size: 11px;
      color: #4b5563;
    }

    .signature-line {
      margin-top: 24px;
      border-top: 1px solid #111827;
      text-align: center;
      padding-top: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #374151;
    }

    ${HIGH_CONTRAST_PRINT_CSS}
    body .ticket-badge { background: #000 !important; color: #fff !important; border-radius: 0 !important; }
    body .company-name { font-weight: 900 !important; }
  `

  // ==========================================
  // 1. FICHA TÉCNICA SIMPLE (Para pegar al equipo)
  // ==========================================
  if (type === 'technician') {
    const techDevicesHTML = payload.devices.map((d) => `
      <div class="device-card">
        <div class="device-header">${d.brand} ${d.model} (${d.typeLabel})${deviceNumber(d)}</div>
        ${(d.imei || d.serialNumber) ? `<div class="device-sub"><strong>IMEI/SN:</strong> ${d.imei || d.serialNumber}</div>` : ''}

        <div class="problem-box">
          <strong>Falla reportada:</strong><br/>
          ${d.issue || 'Sin falla especificada'}
        </div>

        ${(d.accessories || payload.accessories) ? `
          <div style="font-size: 11px; margin: 4px 0; color: #374151;">
            <strong>Accesorios:</strong> ${d.accessories || payload.accessories}
          </div>
        ` : ''}

        ${d.description ? `
          <div style="font-size: 11px; margin: 4px 0; color: #4b5563;">
            <strong>Observaciones:</strong> ${d.description}
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #d1d5db;">
          <span>Técnico: ${d.technician || 'Sin asignar'}</span>
          <span>Presup.: ${costLabel(d.estimatedCost)}</span>
        </div>
      </div>
    `).join('')

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ficha simple${ticketNumber ? ` - ${ticketNumber}` : ''}</title>
        <style>${modernStyles}</style>
      </head>
      <body>
        <script>
          window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 250); });
          window.addEventListener('afterprint', function() { window.close(); });
        </script>
        <div class="header">
          <div class="company-name">${company.name || 'Servicio Técnico'}</div>
          <div class="date-time">${date} • ${time}</div>
        </div>
        
        ${orderBadge}

        <div class="title">FICHA TÉCNICA (INTERNA)</div>
        
        <div class="section-card">
          <div class="info-row">
            <span class="info-label">Cliente:</span>
            <span class="info-value">${payload.customer.name}</span>
          </div>
          ${payload.customer.phone ? `
          <div class="info-row">
            <span class="info-label">Teléfono:</span>
            <span class="info-value">${payload.customer.phone}</span>
          </div>` : ''}
          ${payload.customer.alternate_phone ? `
          <div class="info-row">
            <span class="info-label">Tel. Alt:</span>
            <span class="info-value">${payload.customer.alternate_phone}${payload.customer.alternate_phone_label ? ` (${payload.customer.alternate_phone_label})` : ''}</span>
          </div>` : ''}
          <div class="info-row">
            <span class="info-label">Prioridad:</span>
            <span class="info-value">${priorityLabel}</span>
          </div>
        </div>

        <div>
          ${techDevicesHTML}
        </div>

        <div class="footer">
          <div>Uso interno del laboratorio · ${company.name || 'Taller'}</div>
        </div>
      </body>
    </html>
    `
  }

  // ==========================================
  // 2. FICHA TÉCNICA COMPLETA / LABORATORIO
  // ==========================================
  if (type === 'technician_detailed') {
    const detailedDevicesHTML = payload.devices.map((d) => `
      <div class="device-card">
        <div class="device-header">${d.brand} ${d.model} (${d.typeLabel})${deviceNumber(d)}</div>
        ${(d.imei || d.serialNumber) ? `<div class="device-sub"><strong>IMEI/SN:</strong> ${d.imei || d.serialNumber}</div>` : ''}

        <div style="border: 1px solid #000; border-radius: 4px; padding: 6px; margin: 6px 0; font-size: 11.5px;">
          <strong>Desbloqueo:</strong> ${d.accessType ? d.accessType.toUpperCase() : 'PIN/CLAVE'}
          · ${d.accessPassword ? 'ver talón al pie (cortar y no dejar pegado al equipo)' : 'sin clave / no informada'}
        </div>

        <div class="problem-box">
          <strong>Falla reportada:</strong><br/>
          ${d.issue || 'Sin especificar'}
        </div>

        ${(d.accessories || payload.accessories) ? `
          <div style="font-size: 11px; margin: 4px 0; color: #374151;">
            <strong>Accesorios recibidos:</strong> ${d.accessories || payload.accessories}
          </div>
        ` : ''}

        ${d.description ? `
          <div style="font-size: 11px; margin: 4px 0; color: #4b5563;">
            <strong>Estado físico / obs.:</strong> ${d.description}
          </div>
        ` : ''}

        <!-- Checklist de Banco -->
        <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; margin: 8px 0; background: #fff;">
          <div style="font-size: 11px; font-weight: 800; margin-bottom: 4px; text-transform: uppercase;">Checklist de banco:</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3px; font-size: 10.5px; color: #334155;">
            <div>[ ] Enciende</div>
            <div>[ ] Touch / Display</div>
            <div>[ ] Carga / Pin</div>
            <div>[ ] WiFi / Red</div>
            <div>[ ] Cámaras</div>
            <div>[ ] Mic / Parlante</div>
          </div>
        </div>

        <!-- Área de Notas Manuales del Técnico -->
        <div style="border: 1px dashed #9ca3af; border-radius: 4px; padding: 6px; margin: 8px 0; height: 50px; font-size: 10px; color: #9ca3af;">
          Notas de banco / repuestos utilizados:
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #d1d5db;">
          <span>Técnico: ${d.technician || 'Sin asignar'}</span>
          <span>Presup.: ${costLabel(d.estimatedCost)}</span>
        </div>
      </div>
    `).join('')

    // La clave impresa en la hoja que queda pegada al equipo la podía leer
    // cualquiera. Va en un talón al final, para cortarlo y que lo guarde el técnico.
    const devicesWithPassword = payload.devices.filter((d) => d.accessPassword)
    const passwordStub = devicesWithPassword.length > 0 ? `
        <div style="margin-top: 14px; border-top: 2px dashed #000; padding-top: 2px; text-align: center; font-size: 10px; font-weight: 800; letter-spacing: 1px;">
          - - - CORTAR ACÁ · TALÓN PARA EL TÉCNICO · NO DEJAR PEGADO AL EQUIPO - - -
        </div>
        <div class="section-card">
          <div class="section-title">Claves de desbloqueo</div>
          ${devicesWithPassword.map((d) => `
          <div class="info-row">
            <span class="info-label">${d.brand} ${d.model}${d.ticketNumber ? ` (${d.ticketNumber})` : ''} · ${d.accessType ? d.accessType.toUpperCase() : 'PIN/CLAVE'}</span>
            <span class="info-value" style="font-size: 14px; letter-spacing: 0.5px;">${d.accessPassword}</span>
          </div>`).join('')}
        </div>` : ''

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ficha completa${ticketNumber ? ` - ${ticketNumber}` : ''}</title>
        <style>${modernStyles}</style>
      </head>
      <body>
        <script>
          window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 250); });
          window.addEventListener('afterprint', function() { window.close(); });
        </script>
        <div class="header">
          <div class="company-name">${company.name || 'Servicio Técnico'}</div>
          <div class="date-time">${date} • ${time}</div>
        </div>
        
        ${orderBadge}

        <div class="title">FICHA DE LABORATORIO (COMPLETA)</div>
        
        <div class="section-card">
          <div class="info-row">
            <span class="info-label">Cliente:</span>
            <span class="info-value">${payload.customer.name}</span>
          </div>
          ${payload.customer.phone ? `
          <div class="info-row">
            <span class="info-label">Teléfono:</span>
            <span class="info-value">${payload.customer.phone}</span>
          </div>` : ''}
          ${payload.customer.alternate_phone ? `
          <div class="info-row">
            <span class="info-label">Tel. Alt:</span>
            <span class="info-value">${payload.customer.alternate_phone}${payload.customer.alternate_phone_label ? ` (${payload.customer.alternate_phone_label})` : ''}</span>
          </div>` : ''}
          ${payload.customer.document ? `
          <div class="info-row">
            <span class="info-label">Doc/RUC:</span>
            <span class="info-value">${payload.customer.document}</span>
          </div>` : ''}
          <div class="info-row">
            <span class="info-label">Prioridad:</span>
            <span class="info-value">${priorityLabel}</span>
          </div>
        </div>

        <div>
          ${detailedDevicesHTML}
        </div>

        <div class="footer">
          <div>Uso interno del laboratorio · ${company.name || 'Taller'}</div>
        </div>
        ${passwordStub}
      </body>
    </html>
    `
  }

  // Vacío es una decisión: antes se volvía a imprimir el texto de fábrica.
  const legalText = settings.legalText.trim()
  // Una orden con garantía propia manda aunque sea 0; la del taller solo cubre
  // a las que no dicen nada. Ver resolveWarranty.
  const warranty = resolveWarranty(payload, settings)
  const warrantyNotes = warranty.notes
  // Las cláusulas fijas se saltean si el texto legal o las notas ya tratan el
  // tema, aunque con otras palabras: antes «humedad» y «líquidos» salían las dos.
  const alreadyPrinted = `${legalText}\n${warrantyNotes}`
  const standardClauses = [
    // Abandono y presentar el comprobante son de la recepción: al entregar ya no aplican.
    ...(!isDelivery && settings.abandonmentDays > 0 && !CLAUSE_TOPICS.abandonment.test(alreadyPrinted) ? [abandonmentClause(settings.abandonmentDays)] : []),
    ...(warranty.months > 0 && !CLAUSE_TOPICS.damage.test(alreadyPrinted) ? [DAMAGE_EXCLUSION_CLAUSE] : []),
    ...(!isDelivery && !CLAUSE_TOPICS.pickup.test(alreadyPrinted) ? [PICKUP_CLAUSE] : []),
  ]
  const qrSvg = settings.showHash && rawPayload.verificationHash && qrTicket
    ? trackingQrSvg(qrTicket, rawPayload.verificationHash, isA4 ? 120 : 96)
    : ''

  // HTML para comprobante del cliente (estructura original fiel y configurable)
  const customerDevicesHTML = payload.devices.map((d) => `
    <div class="device-card">
      <div class="device-title">
        <span class="device-name">${d.brand} ${d.model}${deviceNumber(d)}</span>
      </div>
      <div class="device-type">${d.typeLabel}</div>
      ${(settings.showImei && (d.imei || d.serialNumber)) ? `<div style="font-size: 11px; color: #4b5563; margin-bottom: 6px;"><strong>IMEI/SN:</strong> ${d.imei || d.serialNumber}</div>` : ''}
      
      <div class="problem-section">
        <div class="problem-label">Problema reportado</div>
        <div class="problem-text">${d.issue || '-'}</div>
      </div>

      ${(settings.showAccessories && (d.accessories || payload.accessories)) ? `
      <div class="notes-section">
        <div class="notes-label">Accesorios recibidos</div>
        <div class="notes-text">${d.accessories || payload.accessories}</div>
      </div>` : ''}
      
      ${d.description ? `
      <div class="notes-section">
        <div class="notes-label">Descripción</div>
        <div class="notes-text">${d.description}</div>
      </div>` : ''}
      
      ${payload.devices.length > 1 || !settings.showFinancialBreakdown ? `
      <div class="tech-info">
        <div class="cost-item">Presupuesto: ${costLabel(d.estimatedCost)}</div>
      </div>` : ''}
    </div>
  `).join('')

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Comprobante${ticketNumber ? ` ${ticketNumber}` : ''}</title>
      <style>
        ${modernStyles}
        .legal-text {
            font-size: 10.5px;
            color: #6b7280;
            text-align: justify;
            margin-top: 10px;
            line-height: 1.35;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
        }
      </style>
    </head>
    <body>
      <script>
        window.addEventListener('load', function() {
          setTimeout(function() { window.print(); }, 250);
        });
        window.addEventListener('afterprint', function() {
          window.close();
        });
      </script>
      <div class="header">
        ${(company.logo && settings.showLogo) ? `<img src="${company.logo}" class="company-logo" alt="Logo" />` : ''}
        <div class="company-name">${company.name || 'Servicio Técnico'}</div>
        <div class="company-info">
            ${company.address ? `${company.address}<br/>` : ''}
            ${[company.phone ? `Tel: ${company.phone}` : '', company.email || ''].filter(Boolean).join(' · ')}
        </div>
        <div class="date-time" style="margin-top: 4px;">Ingreso: ${date} • ${time}</div>
      </div>
      
      ${orderBadge}

      <div class="title" style="text-align: center;">${isDelivery ? 'COMPROBANTE DE ENTREGA' : 'ORDEN DE SERVICIO'}</div>
      ${isDelivery ? `
      <div class="section-card">
        <div class="section-title">Entrega</div>
        <div class="info-grid">
          ${payload.deliveredAt ? `
          <div class="info-row">
            <span class="info-label">Fecha de entrega:</span>
            <span class="info-value">${shortDate(payload.deliveredAt)}</span>
          </div>` : ''}
          ${payload.deliveryOutcome ? `
          <div class="info-row">
            <span class="info-label">Resultado:</span>
            <span class="info-value">${DELIVERY_OUTCOME_LABELS[payload.deliveryOutcome]}</span>
          </div>` : ''}
        </div>
      </div>` : ''}
      
      <div class="section-card">
        <div class="section-title">Datos del cliente</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Cliente:</span>
            <span class="info-value" style="font-size: 12px;">${payload.customer.name}</span>
          </div>
          ${payload.customer.document ? `
          <div class="info-row">
            <span class="info-label">Doc/RUC:</span>
            <span class="info-value">${payload.customer.document}</span>
          </div>` : ''}
          ${payload.customer.customerCode ? `
          <div class="info-row">
            <span class="info-label">Código:</span>
            <span class="info-value">${payload.customer.customerCode}</span>
          </div>` : ''}
          ${payload.customer.phone ? `
          <div class="info-row">
            <span class="info-label">Teléfono:</span>
            <span class="info-value">${payload.customer.phone}</span>
          </div>` : ''}
          ${payload.customer.alternate_phone ? `
          <div class="info-row">
            <span class="info-label">Tel. Alternativo:</span>
            <span class="info-value">${payload.customer.alternate_phone}${payload.customer.alternate_phone_label ? ` (${payload.customer.alternate_phone_label})` : ''}</span>
          </div>` : ''}
          ${payload.customer.email ? `
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${payload.customer.email}</span>
          </div>` : ''}
          ${payload.customer.address ? `
          <div class="info-row">
            <span class="info-label">Dirección:</span>
            <span class="info-value">${payload.customer.address}</span>
          </div>` : ''}
        </div>
      </div>

      <div style="margin: 12px 0;">
        <div class="section-title" style="margin-bottom: 8px;">Equipos recibidos (${payload.devices.length})</div>
        ${customerDevicesHTML}
      </div>

      <!-- Resumen de Pago: Presupuesto, Anticipo/Seña y Saldo al Retirar -->
      ${settings.showFinancialBreakdown ? `
      <div class="section-card" style="border: 1.5px solid #111827;">
        <div class="section-title">Resumen de pago</div>
        <div class="info-grid">
          ${outcomeLabel ? `
          <div class="info-row pc-total" style="font-size: 13px; font-weight: 800; padding: 4px; margin-top: 4px;">
            <span class="info-label">Resultado:</span>
            <span class="info-value">${outcomeLabel}</span>
          </div>
          ${paidAmount > 0 ? `
          <div class="info-row">
            <span class="info-label">Pagado:</span>
            <span class="info-value">${formatCurrency(paidAmount)}</span>
          </div>` : ''}
          ` : hasBudget ? `
          <div class="info-row">
            <span class="info-label">${isDelivery ? 'Costo final:' : 'Presupuesto total:'}</span>
            <span class="info-value">${formatCurrency(totalCost)}</span>
          </div>
          ${paidAmount > 0 ? `
          <div class="info-row">
            <span class="info-label">${isDelivery ? 'Pagado:' : 'Seña / anticipo pagado:'}</span>
            <span class="info-value">-${formatCurrency(paidAmount)}</span>
          </div>` : ''}
          <div class="info-row pc-total" style="font-size: 13px; font-weight: 800; padding: 4px; margin-top: 4px;">
            <span class="info-label">${isDelivery ? 'Saldo pendiente:' : 'Saldo al retirar:'}</span>
            <span class="info-value">${formatCurrency(pendingBalance)}</span>
          </div>
          ` : `
          <div class="info-row pc-total" style="font-size: 13px; font-weight: 800; padding: 4px; margin-top: 4px;">
            <span class="info-label">Presupuesto:</span>
            <span class="info-value">A definir tras el diagnóstico</span>
          </div>
          ${paidAmount > 0 ? `
          <div class="info-row">
            <span class="info-label">Seña pagada:</span>
            <span class="info-value">${formatCurrency(paidAmount)}</span>
          </div>` : ''}
          `}
        </div>
      </div>` : ''}

      <div class="warranty-box">
        <div class="warranty-title">Garantía y condiciones</div>
        <div class="warranty-text">
          ${warranty.months > 0 ? `
          • <strong>Garantía:</strong> ${formatWarrantyMonths(warranty.months)} (${WARRANTY_TYPE_PRINT_LABELS[warranty.type]})${isDelivery && payload.warrantyExpiresAt ? `, vigente hasta el ${shortDate(payload.warrantyExpiresAt)}` : ''}.<br/>
          ${warrantyNotes ? `• ${warrantyNotes.replace(/\n/g, '<br/>')}<br/>` : ''}
          ` : `
          • Esta reparación no incluye garantía.<br/>
          `}
          ${standardClauses.map((clause) => `• ${clause}<br/>`).join('')}
        </div>
      </div>

      ${legalText && !isDelivery ? `<div class="legal-text">${legalText.replace(/\n/g, '<br/>')}</div>` : ''}

      ${isDelivery && (settings.showCustomerSignature || settings.showDeliveryControl) ? `
      <div style="margin-top: 14px; display: flex; gap: 6px; break-inside: avoid;">
        <div style="flex: 1; height: 50px; border: 1px solid #111827; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px; text-align: center;">
          <span style="font-size: 10px; font-weight: 700;">Firma y sello del taller</span>
        </div>
        <div style="flex: 1; height: 50px; border: 1px solid #111827; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px; text-align: center;">
          <span style="font-size: 10px; font-weight: 700;">Recibí conforme (cliente)</span>
        </div>
      </div>
      <div style="display: flex; gap: 8px; font-size: 10.5px; margin-top: 6px;">
        <span style="flex: 1;">Aclaración: ____________________</span>
        <span style="flex: 1;">C.I.: ______________</span>
      </div>` : ''}

      <!-- 1. Firma del Cliente al Ingreso -->
      ${!isDelivery && settings.showCustomerSignature ? `
      <div style="margin-top: 14px;">
        <div style="width: 100%; height: 50px; border: 1px solid #111827; border-radius: 6px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px;">
          <div style="font-size: 10.5px; font-weight: 600; color: #6b7280;">Firma del cliente (ingreso y aceptación)</div>
        </div>
        <div style="display: flex; gap: 8px; font-size: 10.5px; margin-top: 6px;">
          <span style="flex: 1;">Aclaración: ____________________</span>
          <span style="flex: 1;">C.I.: ______________</span>
        </div>
      </div>` : ''}
      
      <!-- 2. Bloque de Control de Entrega y Activación de Garantía -->
      ${!isDelivery && settings.showDeliveryControl ? `
      <div style="margin-top: 12px; border: 1.5px dashed #0f172a; border-radius: 6px; padding: 8px; background: #fafafa; break-inside: avoid;">
        <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 2px;">
          Control de entrega y activación de garantía
        </div>
        <div style="font-size: 10px; color: #4b5563; margin-bottom: 6px;">
          (A sellar y firmar por el taller al momento del retiro para habilitar la garantía)
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 6px;">
          <span><strong>Fecha de entrega:</strong> ___ / ___ / _____</span>
          <span><strong>Entregado por:</strong> _______________</span>
        </div>

        <div style="display: flex; gap: 6px; margin-top: 4px;">
          <div style="flex: 1; height: 46px; border: 1px solid #111827; border-radius: 4px; display: flex; align-items: center; justify-content: center; text-align: center;">
            <span style="font-size: 9px; font-weight: 700; color: #4b5563;">Firma / Sello Taller<br/>(Garantía Habilitada)</span>
          </div>
          <div style="flex: 1; height: 46px; border: 1px solid #111827; border-radius: 4px; display: flex; align-items: center; justify-content: center; text-align: center;">
            <span style="font-size: 9px; font-weight: 700; color: #4b5563;">Firma Cliente Conforme<br/>(Equipo Probado)</span>
          </div>
        </div>

        <div style="font-size: 10px; color: #6b7280; text-align: center; margin-top: 4px;">
          Este comprobante sellado y firmado al retirar es su certificado de garantía.
        </div>
      </div>` : ''}

      ${qrSvg ? `
      <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px; break-inside: avoid;">
        ${qrSvg}
        <div style="font-size: 10.5px; line-height: 1.35;">
          <strong>Seguí tu reparación</strong><br/>
          Escaneá el código para ver el estado del equipo. También sirve para validar este comprobante.
        </div>
      </div>` : ''}

      <div class="footer">
        <div>Gracias por confiar en <strong>${company.name || 'nuestro servicio técnico'}</strong></div>
        ${copyNote ? `<div style="margin-top: 2px;">${copyNote}</div>` : ''}
      </div>
    </body>
  </html>
  `
}
