import { config } from '@/lib/config'
import { formatCurrency } from '@/lib/currency'

/**
 * Utilidades de impresión de comprobantes de reparación.
 *
 * Provee generación de número de ticket, formateo de HTML imprimible
 * y la acción de abrir ventana de impresión para dos tipos de recibos:
 * - `customer`: Comprobante de recepción para el cliente.
 * - `technician`: Ficha de trabajo con detalles técnicos y datos del cliente.
 */

export type RepairReceiptType = 'customer' | 'technician'

interface RepairDevicePrintItem {
  typeLabel: string
  brand: string
  model: string
  issue: string
  description?: string
  technician?: string
  estimatedCost?: number
  ticketNumber?: string
}

interface RepairCustomerInfo {
  name: string
  phone?: string
  email?: string
  address?: string
  document?: string
  city?: string
  country?: string
}

interface RepairPrintPayload {
  ticketNumber?: string
  date?: Date
  customer: RepairCustomerInfo
  devices: RepairDevicePrintItem[]
  priority?: string
  urgency?: string
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
    // Fallback en caso de error/SSR
    return generateRepairTicketNumber()
  }
}

/**
 * Obtiene la próxima numeración sin incrementarla (solo vista previa).
 * Formato: `R-YYYY-000001`. Si falla, usa el generador temporal.
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
  const company = config.company
  const ticketNumber = payload.ticketNumber || 'N/A'
  const dateObj = payload.date || new Date()
  const date = dateObj.toLocaleDateString(config.locale || 'es-PY')
  
  let text = `*${company.name}* - Comprobante de Recepción\n`
  text += `--------------------------------\n`
  text += `*Ticket N°:* ${ticketNumber}\n`
  text += `*Fecha:* ${date}\n`
  text += `*Cliente:* ${payload.customer.name}\n`
  
  if (payload.customer.customerCode) {
    text += `*Cód. Cliente:* ${payload.customer.customerCode}\n`
  }

  text += `\n*Equipos:*\n`
  payload.devices.forEach((d, i) => {
    text += `${i + 1}. ${d.typeLabel} ${d.brand} ${d.model}\n`
    text += `   Problema: ${d.issue}\n`
    if (typeof d.estimatedCost === 'number') {
      text += `   Costo Est.: ${formatCurrency(d.estimatedCost)}\n`
    }
  })
  
  text += `\n--------------------------------\n`
  text += `Para consultas: ${company.phone || company.email}\n`
  text += `Gracias por confiar en nosotros!`
  
  return text
}

/**
 * Abre una nueva ventana con el HTML del comprobante y dispara la impresión.
 * Si el navegador bloquea popups, muestra un `alert` solicitando permiso.
 */
export const printRepairReceipt = (type: RepairReceiptType, payload: RepairPrintPayload): void => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Por favor, permita las ventanas emergentes para imprimir')
    return
  }

  const html = generateRepairReceiptHTML(type, payload)
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.print()
    printWindow.close()
  }
}



/**
 * Construye el HTML auto-contenido para impresión en formato A4.
 * Incluye encabezado de empresa, meta de recepción, datos del cliente y equipos.
 */
const generateRepairReceiptHTML = (type: RepairReceiptType, payload: RepairPrintPayload): string => {
  const company = config.company
  const ticketNumber = payload.ticketNumber || generateRepairTicketNumber()
  const dateObj = payload.date || new Date()
  const date = dateObj.toLocaleDateString(config.locale || 'es-PY')
  const time = dateObj.toLocaleTimeString(config.locale || 'es-PY')

  const title = type === 'customer' ? 'Comprobante de Recepción - Cliente' : 'Ficha de Trabajo - Técnico'
  const subtitle = type === 'customer'
    ? 'Detalles de recepción y contacto'
    : 'Información técnica y datos del cliente'

  const devicesHTML = payload.devices.map((d, idx) => `
    <div class="device">
      <div class="device-header">
        <span class="device-index">Equipo ${idx + 1}</span>
        <span class="device-type">${d.typeLabel}</span>
      </div>
      <div class="grid">
        <div><strong>Marca:</strong> ${d.brand || '-'}</div>
        <div><strong>Modelo:</strong> ${d.model || '-'}</div>
        ${d.technician ? `<div><strong>Técnico:</strong> ${d.technician}</div>` : ''}
        ${typeof d.estimatedCost === 'number' ? `<div><strong>Costo estimado:</strong> ${formatCurrency(d.estimatedCost)}</div>` : ''}
      </div>
      <div class="issue">
        <div class="label">Problema reportado</div>
        <div class="value">${d.issue || '-'}</div>
      </div>
      ${d.description ? `
      <div class="issue">
        <div class="label">Descripción adicional</div>
        <div class="value">${d.description}</div>
      </div>` : ''}
    </div>
  `).join('')

  const customerHTML = `
    <div class="section">
      <h3>Datos del Cliente</h3>
      <div class="grid">
        <div><strong>Nombre:</strong> ${payload.customer.name || '-'}</div>
        ${payload.customer.customerCode ? `<div><strong>Código Cliente:</strong> ${payload.customer.customerCode}</div>` : ''}
        ${payload.customer.document ? `<div><strong>Documento:</strong> ${payload.customer.document}</div>` : ''}
        ${payload.customer.phone ? `<div><strong>Teléfono:</strong> ${payload.customer.phone}</div>` : ''}
        ${payload.customer.email ? `<div><strong>Email:</strong> ${payload.customer.email}</div>` : ''}
        ${payload.customer.address ? `<div><strong>Dirección:</strong> ${payload.customer.address}</div>` : ''}
        ${payload.customer.city ? `<div><strong>Ciudad:</strong> ${payload.customer.city}</div>` : ''}
        ${payload.customer.country ? `<div><strong>País:</strong> ${payload.customer.country}</div>` : ''}
      </div>
    </div>
  `

  const metaHTML = `
    <div class="section">
      <h3>Datos de la Recepción</h3>
      <div class="grid">
        <div><strong>Ticket N°:</strong> ${ticketNumber}</div>
        <div><strong>Fecha:</strong> ${date}</div>
        <div><strong>Hora:</strong> ${time}</div>
        ${payload.priority ? `<div><strong>Prioridad:</strong> ${payload.priority}</div>` : ''}
        ${payload.urgency ? `<div><strong>Urgencia:</strong> ${payload.urgency}</div>` : ''}
      </div>
    </div>
  `

  const footerNote = type === 'customer'
    ? `<p>Este comprobante confirma la recepción del/los equipo(s) para diagnóstico y reparación.</p>
       <p><strong>Garantía:</strong> 30 días sobre el trabajo realizado (no cubre repuestos salvo defecto de fábrica).</p>
       <p><strong>Retiro:</strong> Los equipos reparados deben ser retirados en un plazo máximo de 90 días. Pasado este tiempo, la empresa no se responsabiliza por abandono.</p>
       <p>Los costos estimados pueden variar según diagnóstico final.</p>
       <p>Para consultas: ${company.email}</p>`
    : `<p>Esta ficha resume la información técnica para el proceso de diagnóstico y reparación.</p>
       <p>Contactar al cliente en caso de requerir información adicional.</p>`

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title} - ${ticketNumber}</title>
      <style>
        @media print {
          @page { size: A4; margin: 12mm; }
          body { margin: 0; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif;
          color: #0f172a;
          background: #ffffff;
          line-height: 1.5;
          padding: 16px;
        }
        .doc {
          max-width: 860px;
          margin: 0 auto;
        }
        .header {
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .header .company {
          font-weight: 700;
          font-size: 20px;
        }
        .header .company-sub {
          font-size: 12px;
          color: #64748b;
        }
        .title {
          margin: 8px 0 4px 0;
          font-size: 18px;
          font-weight: 600;
        }
        .subtitle {
          font-size: 12px;
          color: #64748b;
        }
        .section { margin: 14px 0; }
        .section h3 { font-size: 14px; margin: 0 0 8px 0; font-weight: 600; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; font-size: 12px; }
        .devices { margin-top: 8px; }
        .device { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
        .device-header { display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 6px; }
        .device-index { color: #334155; }
        .device-type { color: #0f172a; }
        .issue .label { font-size: 11px; color: #64748b; }
        .issue .value { font-size: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; }
        .footer { border-top: 1px dashed #cbd5e1; margin-top: 16px; padding-top: 12px; text-align: center; font-size: 11px; color: #475569; }
      </style>
    </head>
    <body>
      <div class="doc">
        <div class="header">
          <div class="company">${company.name}</div>
          <div class="company-sub">${company.address} · Tel: ${company.phone} · ${company.email}</div>
          <div class="title">${title}</div>
          <div class="subtitle">${subtitle}</div>
        </div>
        ${metaHTML}
        ${customerHTML}
        <div class="section devices">
          <h3>Equipos y detalles</h3>
          ${devicesHTML}
        </div>
        <div class="footer">
          ${footerNote}
          <p class="mt-2">Generado: ${date} ${time}</p>
        </div>
      </div>
    </body>
  </html>
  `
}
