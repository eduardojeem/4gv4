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
       <p><strong>Retiro:</strong> Los equipos reparados deben ser retirados en un plazo máximo de 90 días.</p>
       <p>Para consultas: ${company.email}</p>`
    : `<p>Ficha de uso interno.</p>`

  // Estilos unificados para formato ticket (80mm)
  const styles = `
      @media print {
        @page { size: 80mm auto; margin: 0mm; }
        body { margin: 0.2cm; width: 76mm; }
      }
      body {
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #000;
        background: #fff;
        line-height: 1.2;
        padding: 0;
        font-size: 11px;
        max-width: 300px;
        margin: 0 auto;
      }
      .doc { width: 100%; }
      .header {
        text-align: center;
        border-bottom: 1px dashed #000;
        padding-bottom: 8px;
        margin-bottom: 8px;
      }
      .header .company {
        font-weight: bold;
        font-size: 14px;
        text-transform: uppercase;
      }
      .header .company-sub {
        font-size: 10px;
        margin-top: 2px;
      }
      .title {
        font-size: 13px;
        font-weight: bold;
        margin: 6px 0;
        text-align: center;
      }
      .subtitle {
        font-size: 10px;
        text-align: center;
        color: #444;
        margin-bottom: 4px;
      }
      .ticket-number {
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        margin: 8px 0;
        border: 2px solid #000;
        padding: 4px;
      }
      .section { margin: 10px 0; border-bottom: 1px dashed #ccc; padding-bottom: 8px; }
      .section h3 { font-size: 11px; margin: 0 0 4px 0; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 2px; }
      
      .grid { display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
      .grid div { display: flex; justify-content: space-between; }
      .grid div strong { margin-right: 4px; }
      
      .device { margin-bottom: 12px; }
      .device-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #eee; font-size: 12px; }
      .issue { margin-top: 6px; }
      .issue .label { font-weight: bold; font-size: 10px; color: #444; }
      .issue .value { font-size: 11px; padding: 2px 0; font-weight: 600; }
      
      .footer { margin-top: 12px; text-align: center; font-size: 9px; color: #444; }
      .footer p { margin: 4px 0; }
  `

  // HTML específico para el ticket técnico (más compacto)
  if (type === 'technician') {
    const techDevicesHTML = payload.devices.map((d, idx) => `
      <div class="device">
        <div class="device-header">
          ${d.typeLabel} - ${d.brand} ${d.model}
        </div>
        <div class="grid">
          ${d.technician ? `<div><strong>Técnico:</strong> <span>${d.technician}</span></div>` : ''}
          ${typeof d.estimatedCost === 'number' ? `<div><strong>Costo:</strong> <span>${formatCurrency(d.estimatedCost)}</span></div>` : ''}
        </div>
        <div class="issue">
          <div class="label">Problema:</div>
          <div class="value">${d.issue || '-'}</div>
        </div>
        ${d.description ? `
        <div class="issue" style="margin-top: 4px;">
          <div class="label">Notas:</div>
          <div class="value" style="font-weight: normal;">${d.description}</div>
        </div>` : ''}
      </div>
    `).join('<hr style="border: 0; border-top: 1px dashed #000; margin: 8px 0;" />')

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ficha ${ticketNumber}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="header">
          <div class="company">${company.name}</div>
          <div class="company-sub">${date} ${time}</div>
        </div>
        
        <div class="ticket-number">${ticketNumber}</div>
        <div class="title">FICHA TÉCNICA</div>
        
        <div class="section">
          <h3>Cliente</h3>
          <div class="grid">
            <div><strong>Nombre:</strong> <span style="font-weight:bold">${payload.customer.name}</span></div>
            ${payload.customer.phone ? `<div><strong>Tel:</strong> <span>${payload.customer.phone}</span></div>` : ''}
          </div>
        </div>

        <div class="section">
          <h3>Detalles</h3>
          <div class="grid">
            <div><strong>Prioridad:</strong> <span>${payload.priority || 'Normal'}</span></div>
            <div><strong>Urgencia:</strong> <span>${payload.urgency || 'Normal'}</span></div>
          </div>
        </div>

        <div class="section" style="border-bottom: none;">
          <h3>Equipos (${payload.devices.length})</h3>
          ${techDevicesHTML}
        </div>

        <div class="footer">
          <p>Uso Interno - ${company.name}</p>
        </div>
      </body>
    </html>
    `
  }

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title} - ${ticketNumber}</title>
      <style>${styles}</style>
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
