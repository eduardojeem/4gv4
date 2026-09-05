import { config } from '@/lib/config'
import { formatCurrency } from '@/lib/currency'
import { generateRepairHash } from '@/lib/repair-qr'
import {
  DEFAULT_RECEIPT_SETTINGS,
  normalizeRepairReceiptSettings,
  type RepairReceiptSettings,
} from '@/lib/repairs/receipt-settings'

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
}

/**
 * Genera un número de ticket simple basado en fecha y milisegundos.
 * Ejemplo: `R-250921-123456`
 */
export const generateRepairTicketNumber = (): string => {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const time = now.getTime().toString().slice(-6)
  return `R-${year}${month}${day}-${time}`
}

/**
 * Genera un número de ticket persistente por año, basado en localStorage.
 * Formato: `R-YYYY-000001`. Reinicia el contador cada año.
 */
export const generatePersistentRepairTicketNumber = (): string => {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const key = `repairTicketCounter:${year}`
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
    let current = raw ? parseInt(raw, 10) : 0
    if (Number.isNaN(current)) current = 0
    current += 1
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, String(current))
    }
    return `R-${year}-${String(current).padStart(6, '0')}`
  } catch {
    return generateRepairTicketNumber()
  }
}

/**
 * Obtiene la próxima numeración sin incrementarla (solo vista previa).
 */
export const previewPersistentRepairTicketNumber = (): string => {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const key = `repairTicketCounter:${year}`
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
    let current = raw ? parseInt(raw, 10) : 0
    if (Number.isNaN(current)) current = 0
    const next = current + 1
    return `R-${year}-${String(next).padStart(6, '0')}`
  } catch {
    return generateRepairTicketNumber()
  }
}

/**
 * Genera un texto formateado para compartir por WhatsApp o copiar.
 */
export const generateRepairShareText = (payload: RepairPrintPayload): string => {
  const company = payload.company || FALLBACK_COMPANY
  const ticketNumber = payload.ticketNumber || 'N/A'
  const dateObj = payload.date || new Date()
  const date = dateObj.toLocaleDateString(config.locale || 'es-PY')
  
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

  const pendingBalance = Math.max(0, totalCost - paidAmount)

  let text = `*${company.name || 'Servicio Técnico'}* - Comprobante de Recepción\n`
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
    if (d.estimatedCost) {
      text += `• *Presupuesto:* ${formatCurrency(d.estimatedCost)}\n`
    }
  })
  
  text += `═══════════════════════════════\n`
  text += `💰 *RESUMEN DE PAGO*\n`
  text += `• *Presupuesto Total:* ${formatCurrency(totalCost)}\n`
  if (paidAmount > 0) {
    text += `• *Anticipo / Seña:* -${formatCurrency(paidAmount)}\n`
    text += `• *Saldo al Retirar:* *${formatCurrency(pendingBalance)}*\n`
  } else {
    text += `• *Saldo al Retirar:* *${formatCurrency(totalCost)}*\n`
  }
  
  if (payload.warrantyMonths && payload.warrantyMonths > 0) {
    text += `\n🛡️ *Garantía:* ${payload.warrantyMonths} meses`
    if (payload.warrantyNotes) {
      text += ` (${payload.warrantyNotes})`
    }
    text += `\n`
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
 * Construye el HTML auto-contenido para impresión.
 */
const generateRepairReceiptHTML = (
  type: RepairReceiptType,
  payload: RepairPrintPayload,
  paperOverride?: '80mm' | '58mm' | 'A4',
  settingsOverride?: RepairReceiptSettings
): string => {
  const company = payload.company || FALLBACK_COMPANY
  const ticketNumber = payload.ticketNumber || generateRepairTicketNumber()
  const dateObj = payload.date || new Date()
  const date = dateObj.toLocaleDateString(config.locale || 'es-PY')
  const time = dateObj.toLocaleTimeString(config.locale || 'es-PY')
  
  const settings = settingsOverride || getReceiptSettings()
  const paperPref = paperOverride || settings.paperFormat || '80mm'
  const isA4 = paperPref === 'A4'
  const pageSizeValue = isA4 ? 'A4' : `${paperPref} auto`
  const bodyWidthValue = isA4 ? 'auto' : (paperPref === '58mm' ? '48mm' : '72mm')
  const baseFontSize = isA4 ? '14px' : (paperPref === '58mm' ? '11px' : '13px')
  const basePadding = isA4 ? '10mm' : '3mm'

  // Cálculo financiero
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

  const pendingBalance = Math.max(0, totalCost - paidAmount)

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
      font-size: 9.5px;
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
  `

  // ==========================================
  // 1. FICHA TÉCNICA SIMPLE (Para pegar al equipo)
  // ==========================================
  if (type === 'technician') {
    const techDevicesHTML = payload.devices.map((d) => `
      <div class="device-card">
        <div class="device-header">📱 ${d.brand} ${d.model} (${d.typeLabel})</div>
        ${(d.imei || d.serialNumber) ? `<div class="device-sub"><strong>IMEI/SN:</strong> ${d.imei || d.serialNumber}</div>` : ''}
        
        <div class="problem-box">
          <strong>🔧 Falla Reportada:</strong><br/>
          ${d.issue || 'Sin falla especificada'}
        </div>

        ${(d.accessories || payload.accessories) ? `
          <div style="font-size: 11px; margin: 4px 0; color: #374151;">
            <strong>🔌 Accesorios:</strong> ${d.accessories || payload.accessories}
          </div>
        ` : ''}

        ${d.description ? `
          <div style="font-size: 11px; margin: 4px 0; color: #4b5563;">
            <strong>📝 Observaciones:</strong> ${d.description}
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #d1d5db;">
          <span>👨‍🔧 ${d.technician || 'Sin asignar'}</span>
          <span>💰 Est: ${formatCurrency(d.estimatedCost || 0)}</span>
        </div>
      </div>
    `).join('')

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ficha Simple - ${ticketNumber}</title>
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
        
        <div style="text-align: center;">
          <span class="ticket-badge">TICKET: ${ticketNumber}</span>
        </div>
        
        <div class="title">📋 FICHA TÉCNICA (INTERNA)</div>
        
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
            <span class="info-value">${payload.priority === 'high' ? '🔴 ALTA' : payload.priority === 'medium' ? '🟡 MEDIA' : '🟢 NORMAL'} ${payload.urgency === 'urgent' ? '• ⚡ URGENTE' : ''}</span>
          </div>
        </div>

        <div>
          ${techDevicesHTML}
        </div>

        <div class="footer">
          <div>Uso Interno de Laboratorio • ${company.name || 'Taller'}</div>
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
        <div class="device-header">📱 ${d.brand} ${d.model} (${d.typeLabel})</div>
        ${(d.imei || d.serialNumber) ? `<div class="device-sub"><strong>IMEI/SN:</strong> ${d.imei || d.serialNumber}</div>` : ''}
        
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 6px; margin: 6px 0; font-size: 11.5px;">
          <strong>🔑 Desbloqueo / Clave:</strong> ${d.accessType ? d.accessType.toUpperCase() : 'PIN/CLAVE'}<br/>
          <span style="font-size: 13px; font-weight: 800; color: #92400e; letter-spacing: 0.5px;">
            ${d.accessPassword ? `[ ${d.accessPassword} ]` : '• Sin clave / No informada'}
          </span>
        </div>

        <div class="problem-box">
          <strong>🔧 Falla Reportada:</strong><br/>
          ${d.issue || 'Sin especificar'}
        </div>

        ${(d.accessories || payload.accessories) ? `
          <div style="font-size: 11px; margin: 4px 0; color: #374151;">
            <strong>🔌 Accesorios Recibidos:</strong> ${d.accessories || payload.accessories}
          </div>
        ` : ''}

        ${d.description ? `
          <div style="font-size: 11px; margin: 4px 0; color: #4b5563;">
            <strong>📝 Estado Físico / Obs:</strong> ${d.description}
          </div>
        ` : ''}

        <!-- Checklist de Banco -->
        <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; margin: 8px 0; background: #fff;">
          <div style="font-size: 11px; font-weight: 800; margin-bottom: 4px; text-transform: uppercase;">✔ Checklist de Banco:</div>
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
          🛠️ Notas de Banco / Repuestos utilizados:
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #d1d5db;">
          <span>👨‍🔧 Técnico: ${d.technician || 'Sin asignar'}</span>
          <span>💰 Presup: ${formatCurrency(d.estimatedCost || 0)}</span>
        </div>
      </div>
    `).join('')

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ficha Completa - ${ticketNumber}</title>
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
        
        <div style="text-align: center;">
          <span class="ticket-badge">TICKET: ${ticketNumber}</span>
        </div>
        
        <div class="title">🔬 FICHA DE LABORATORIO (COMPLETA)</div>
        
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
            <span class="info-value">${payload.priority === 'high' ? '🔴 ALTA' : payload.priority === 'medium' ? '🟡 MEDIA' : '🟢 NORMAL'} ${payload.urgency === 'urgent' ? '• ⚡ URGENTE' : ''}</span>
          </div>
        </div>

        <div>
          ${detailedDevicesHTML}
        </div>

        <div class="footer">
          <div>Uso Interno de Laboratorio • ${company.name || 'Taller'}</div>
          <div style="margin-top: 2px;">Generado automáticamente</div>
        </div>
      </body>
    </html>
    `
  }

  const legalText = settings.legalText || 'Declaro haber leído y aceptado los términos y condiciones del servicio técnico. Autorizo la revisión y/o reparación de los equipos detallados. La empresa no se responsabiliza por pérdida de datos; se recomienda realizar copias de seguridad.'
  const warrantyNotes = payload.warrantyNotes || settings.defaultWarrantyNotes

  // HTML para comprobante del cliente (estructura original fiel y configurable)
  const customerDevicesHTML = payload.devices.map((d) => `
    <div class="device-card">
      <div class="device-title">
        <span class="device-icon">📱</span>
        <span class="device-name">${d.brand} ${d.model}</span>
      </div>
      <div class="device-type">${d.typeLabel}</div>
      ${(settings.showImei && (d.imei || d.serialNumber)) ? `<div style="font-size: 11px; color: #4b5563; margin-bottom: 6px;"><strong>IMEI/SN:</strong> ${d.imei || d.serialNumber}</div>` : ''}
      
      <div class="problem-section">
        <div class="problem-label">🔧 Problema Reportado</div>
        <div class="problem-text">${d.issue || '-'}</div>
      </div>

      ${(settings.showAccessories && (d.accessories || payload.accessories)) ? `
      <div class="notes-section">
        <div class="notes-label">🔌 Accesorios Recibidos</div>
        <div class="notes-text">${d.accessories || payload.accessories}</div>
      </div>` : ''}
      
      ${d.description ? `
      <div class="notes-section">
        <div class="notes-label">📝 Descripción</div>
        <div class="notes-text">${d.description}</div>
      </div>` : ''}
      
      ${typeof d.estimatedCost === 'number' ? `
      <div class="tech-info">
        <div class="cost-item">💰 Presupuesto / Costo Estimado: ${formatCurrency(d.estimatedCost)}</div>
      </div>` : ''}
    </div>
  `).join('')

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Comprobante ${ticketNumber}</title>
      <style>
        ${modernStyles}
        .legal-text {
            font-size: 9px;
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
            ${company.address ? `📍 ${company.address}<br/>` : ''}
            ${company.phone ? `📞 ${company.phone}` : ''} 
            ${company.email ? `• 📧 ${company.email}` : ''}
        </div>
        <div class="date-time" style="margin-top: 4px;">${date} • ${time}</div>
      </div>
      
      <div style="text-align: center;">
        <span class="ticket-badge">Ticket (${ticketNumber})</span>
      </div>
      
      <div class="title" style="text-align: center;">🧾 ORDEN DE SERVICIO</div>
      
      <div class="section-card">
        <div class="section-title">👤 Datos del Cliente</div>
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

      <div class="section-card">
        <div class="section-title">📅 Detalles de Recepción</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Fecha:</span>
            <span class="info-value">${date}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Hora:</span>
            <span class="info-value">${time}</span>
          </div>
        </div>
      </div>

      <div style="margin: 12px 0;">
        <div class="section-title" style="margin-bottom: 8px;">📱 Equipos Recibidos (${payload.devices.length})</div>
        ${customerDevicesHTML}
      </div>

      <!-- Resumen de Pago: Presupuesto, Anticipo/Seña y Saldo al Retirar -->
      ${settings.showFinancialBreakdown ? `
      <div class="section-card" style="border: 1.5px solid #111827;">
        <div class="section-title">💰 Resumen de Pago</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Presupuesto Total:</span>
            <span class="info-value">${formatCurrency(totalCost)}</span>
          </div>
          ${paidAmount > 0 ? `
          <div class="info-row" style="color: #059669;">
            <span class="info-label">Seña / Anticipo Pagado:</span>
            <span class="info-value">-${formatCurrency(paidAmount)}</span>
          </div>
          <div class="info-row" style="font-size: 13px; font-weight: 800; border-top: 1px dashed #111827; padding-top: 4px; margin-top: 4px;">
            <span class="info-label">Saldo al Retirar:</span>
            <span class="info-value">${formatCurrency(pendingBalance)}</span>
          </div>
          ` : `
          <div class="info-row" style="font-size: 13px; font-weight: 800; border-top: 1px dashed #111827; padding-top: 4px; margin-top: 4px;">
            <span class="info-label">Saldo al Retirar:</span>
            <span class="info-value">${formatCurrency(totalCost)}</span>
          </div>
          `}
        </div>
      </div>` : ''}

      <div class="warranty-box">
        <div class="warranty-title">🛡️ Garantía y Términos</div>
        <div class="warranty-text">
          ${(payload.warrantyMonths && payload.warrantyMonths > 0) || settings.defaultWarrantyMonths > 0 ? `
          • <strong>Garantía:</strong> ${payload.warrantyMonths || settings.defaultWarrantyMonths} ${(payload.warrantyMonths || settings.defaultWarrantyMonths) === 1 ? 'mes' : 'meses'} (${payload.warrantyType || settings.defaultWarrantyType === 'labor' ? 'Mano de obra' : payload.warrantyType || settings.defaultWarrantyType === 'parts' ? 'Repuestos' : 'Total y repuestos'}).<br/>
          ${warrantyNotes ? `• ${warrantyNotes}<br/>` : ''}
          ` : `
          • Esta reparación inicial no incluye garantía hasta su finalización.<br/>
          `}
          • Pasados los 90 días de la notificación, el equipo se considerará abandonado.
          • La garantía no cubre daños por humedad, golpes o mal uso posterior a la entrega.
          • Es indispensable presentar este comprobante para el retiro y reclamo de garantía.
        </div>
      </div>

      <div class="legal-text">
        ${legalText}
      </div>

      <!-- 1. Firma del Cliente al Ingreso -->
      ${settings.showCustomerSignature ? `
      <div style="margin-top: 14px;">
        <div style="width: 100%; height: 50px; border: 1px solid #111827; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
          <div style="font-size: 10.5px; font-weight: 600; color: #6b7280;">Firma del Cliente (Ingreso / Aceptación)</div>
        </div>
      </div>` : ''}
      
      <!-- 2. Bloque de Control de Entrega y Activación de Garantía -->
      ${settings.showDeliveryControl ? `
      <div style="margin-top: 12px; border: 1.5px dashed #0f172a; border-radius: 6px; padding: 8px; background: #fafafa; break-inside: avoid;">
        <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 2px;">
          🛡️ Control de Entrega y Activación de Garantía
        </div>
        <div style="font-size: 9.5px; color: #4b5563; margin-bottom: 6px;">
          (A sellar y firmar por el taller al momento del retiro para habilitar la garantía)
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 6px;">
          <span><strong>Fecha de Entrega:</strong> ___ / ___ / 202_</span>
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

        <div style="font-size: 8.5px; color: #6b7280; text-align: center; margin-top: 4px; font-style: italic;">
          📌 Este comprobante sellado y firmado al retirar constituye su Certificado Oficial de Garantía.
        </div>
      </div>` : ''}

      ${settings.showHash ? `
      <div style="margin-top: 10px; padding: 6px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; text-align: center;">
        <div style="font-size: 9.5px; color: #6b7280; line-height: 1.3;">
          <strong>Hash de verificación:</strong><br/>
          <code style="font-size: 8.5px; color: #111827; letter-spacing: 0.5px;">${payload.verificationHash || generateRepairHash(ticketNumber, payload.customer.id || payload.customer.name, dateObj)}</code>
        </div>
      </div>` : ''}

      <div class="footer">
        <div>Gracias por confiar en <strong>${company.name || 'nuestro servicio técnico'}</strong></div>
        ${company.address ? `<div style="margin-top: 2px;">${company.address}</div>` : ''}
        ${company.phone ? `<div style="margin-top: 2px;">${company.phone}</div>` : ''}
      </div>
    </body>
  </html>
  `
}
