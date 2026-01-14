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
  customerCode?: string
}

export interface RepairPrintPayload {
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

  // Estilos modernos unificados para ambos tipos de comprobante
  const modernStyles = `
    @media print {
      @page { 
        size: 80mm auto; 
        margin: 2mm; 
      }
      body { 
        margin: 0; 
        width: 76mm; 
      }
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a1a;
      background: #fff;
      line-height: 1.3;
      padding: 4mm;
      font-size: 12px;
      max-width: 300px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .company-name {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 2px;
    }
    
    .company-info {
      font-size: 9px;
      color: #6b7280;
      line-height: 1.2;
    }
    
    .date-time {
      font-size: 10px;
      color: #6b7280;
    }
    
    .ticket-badge {
      background: #1f2937;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 14px;
      margin: 8px 0;
      display: inline-block;
    }
    
    .title {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin: 8px 0;
    }
    
    .section-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px;
      margin: 8px 0;
    }
    
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
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
      font-size: 10px;
    }
    
    .info-label {
      color: #6b7280;
      font-weight: 500;
      min-width: 50px;
    }
    
    .info-value {
      color: #111827;
      font-weight: 600;
      text-align: right;
      flex: 1;
      margin-left: 8px;
    }
    
    .device-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      margin: 8px 0;
      background: #ffffff;
    }
    
    .device-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    
    .device-icon {
      font-size: 14px;
    }
    
    .device-name {
      font-weight: 600;
      font-size: 13px;
      color: #111827;
    }
    
    .device-type {
      font-size: 10px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    
    .problem-section {
      margin: 8px 0;
    }
    
    .problem-label {
      font-size: 10px;
      font-weight: 600;
      color: #dc2626;
      margin-bottom: 2px;
    }
    
    .problem-text {
      font-size: 11px;
      color: #374151;
      line-height: 1.4;
      padding: 4px 0;
    }
    
    .notes-section {
      margin: 6px 0;
      padding-top: 6px;
      border-top: 1px dashed #d1d5db;
    }
    
    .notes-label {
      font-size: 10px;
      font-weight: 600;
      color: #059669;
      margin-bottom: 2px;
    }
    
    .notes-text {
      font-size: 10px;
      color: #4b5563;
      line-height: 1.4;
    }
    
    .tech-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed #d1d5db;
      font-size: 10px;
    }
    
    .tech-item {
      color: #7c3aed;
      font-weight: 500;
    }
    
    .cost-item {
      color: #059669;
      font-weight: 600;
    }
    
    .warranty-box {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 8px;
      margin: 10px 0;
    }
    
    .warranty-title {
      font-size: 10px;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 4px;
    }
    
    .warranty-text {
      font-size: 9px;
      color: #78350f;
      line-height: 1.3;
    }
    
    .footer {
      text-align: center;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      font-size: 9px;
      color: #9ca3af;
    }
    
    .qr-placeholder {
      width: 40px;
      height: 40px;
      background: #f3f4f6;
      border: 1px dashed #d1d5db;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      color: #9ca3af;
      margin: 8px auto;
    }
  `

  // HTML específico para el ticket técnico (más compacto y moderno)
  if (type === 'technician') {
    const techDevicesHTML = payload.devices.map((d, idx) => `
      <div class="device-card">
        <div class="device-title">
          <span class="device-icon">📱</span>
          <span class="device-name">${d.brand} ${d.model}</span>
        </div>
        <div class="device-type">${d.typeLabel}</div>
        
        <div class="problem-section">
          <div class="problem-label">🔧 Problema</div>
          <div class="problem-text">${d.issue || '-'}</div>
        </div>
        
        ${d.description ? `
        <div class="notes-section">
          <div class="notes-label">📝 Notas</div>
          <div class="notes-text">${d.description}</div>
        </div>` : ''}
        
        <div class="tech-info">
          ${d.technician ? `<div class="tech-item">👨‍🔧 ${d.technician}</div>` : ''}
          ${typeof d.estimatedCost === 'number' ? `<div class="cost-item">💰 ${formatCurrency(d.estimatedCost)}</div>` : ''}
        </div>
      </div>
    `).join('')

    // Estilos modernos y optimizados para móvil
    const modernStyles = `
      @media print {
        @page { 
          size: 80mm auto; 
          margin: 2mm; 
        }
        body { 
          margin: 0; 
          width: 76mm; 
        }
      }
      
      * {
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #1a1a1a;
        background: #fff;
        line-height: 1.3;
        padding: 4mm;
        font-size: 12px;
        max-width: 300px;
        margin: 0 auto;
      }
      
      .header {
        text-align: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 2px solid #e5e7eb;
      }
      
      .company-name {
        font-size: 16px;
        font-weight: 700;
        color: #111827;
        margin-bottom: 2px;
      }
      
      .date-time {
        font-size: 10px;
        color: #6b7280;
      }
      
      .ticket-badge {
        background: #1f2937;
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 14px;
        margin: 8px 0;
        display: inline-block;
      }
      
      .title {
        font-size: 14px;
        font-weight: 600;
        color: #374151;
        margin: 8px 0;
      }
      
      .customer-card {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 8px;
        margin: 8px 0;
      }
      
      .customer-name {
        font-weight: 600;
        font-size: 13px;
        color: #111827;
        margin-bottom: 2px;
      }
      
      .customer-phone {
        font-size: 11px;
        color: #6b7280;
      }
      
      .priority-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
        background: #dbeafe;
        color: #1e40af;
        margin: 4px 0;
      }
      
      .device-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 10px;
        margin: 8px 0;
        background: #ffffff;
      }
      
      .device-title {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }
      
      .device-icon {
        font-size: 14px;
      }
      
      .device-name {
        font-weight: 600;
        font-size: 13px;
        color: #111827;
      }
      
      .device-type {
        font-size: 10px;
        color: #6b7280;
        margin-bottom: 8px;
      }
      
      .problem-section {
        margin: 8px 0;
      }
      
      .problem-label {
        font-size: 10px;
        font-weight: 600;
        color: #dc2626;
        margin-bottom: 2px;
      }
      
      .problem-text {
        font-size: 11px;
        color: #374151;
        line-height: 1.4;
        padding: 4px 0;
      }
      
      .notes-section {
        margin: 6px 0;
        padding-top: 6px;
        border-top: 1px dashed #d1d5db;
      }
      
      .notes-label {
        font-size: 10px;
        font-weight: 600;
        color: #059669;
        margin-bottom: 2px;
      }
      
      .notes-text {
        font-size: 10px;
        color: #4b5563;
        line-height: 1.4;
      }
      
      .tech-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px dashed #d1d5db;
        font-size: 10px;
      }
      
      .tech-item {
        color: #7c3aed;
        font-weight: 500;
      }
      
      .cost-item {
        color: #059669;
        font-weight: 600;
      }
      
      .footer {
        text-align: center;
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px solid #e5e7eb;
        font-size: 9px;
        color: #9ca3af;
      }
      
      .qr-placeholder {
        width: 40px;
        height: 40px;
        background: #f3f4f6;
        border: 1px dashed #d1d5db;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        color: #9ca3af;
        margin: 8px auto;
      }
    `

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ficha ${ticketNumber}</title>
        <style>${modernStyles}</style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${company.name}</div>
          <div class="date-time">${date} • ${time}</div>
        </div>
        
        <div style="text-align: center;">
          <span class="ticket-badge">${ticketNumber}</span>
        </div>
        
        <div class="title">📋 FICHA TÉCNICA</div>
        
        <div class="customer-card">
          <div class="customer-name">👤 ${payload.customer.name}</div>
          ${payload.customer.phone ? `<div class="customer-phone">📞 ${payload.customer.phone}</div>` : ''}
          <div class="priority-badge">
            ${payload.priority === 'high' ? '🔴 Alta' : payload.priority === 'medium' ? '🟡 Media' : '🟢 Normal'} 
            ${payload.urgency === 'urgent' ? '• ⚡ Urgente' : ''}
          </div>
        </div>

        <div style="margin: 12px 0;">
          ${techDevicesHTML}
        </div>

        <div class="qr-placeholder">
          QR
        </div>

        <div class="footer">
          <div>Uso Interno • ${company.name}</div>
          <div style="margin-top: 2px;">Generado automáticamente</div>
        </div>
      </body>
    </html>
    `
  }

  // HTML para comprobante del cliente (moderno y optimizado)
  const customerDevicesHTML = payload.devices.map((d, idx) => `
    <div class="device-card">
      <div class="device-title">
        <span class="device-icon">📱</span>
        <span class="device-name">${d.brand} ${d.model}</span>
      </div>
      <div class="device-type">${d.typeLabel}</div>
      
      <div class="problem-section">
        <div class="problem-label">🔧 Problema Reportado</div>
        <div class="problem-text">${d.issue || '-'}</div>
      </div>
      
      ${d.description ? `
      <div class="notes-section">
        <div class="notes-label">📝 Descripción</div>
        <div class="notes-text">${d.description}</div>
      </div>` : ''}
      
      ${typeof d.estimatedCost === 'number' ? `
      <div class="tech-info">
        <div class="cost-item">💰 Costo Estimado: ${formatCurrency(d.estimatedCost)}</div>
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
      <style>${modernStyles}</style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${company.name}</div>
        <div class="company-info">${company.address}<br/>📞 ${company.phone} • 📧 ${company.email}</div>
        <div class="date-time">${date} • ${time}</div>
      </div>
      
      <div style="text-align: center;">
        <span class="ticket-badge">${ticketNumber}</span>
      </div>
      
      <div class="title">🧾 COMPROBANTE DE RECEPCIÓN</div>
      
      <div class="section-card">
        <div class="section-title">👤 Cliente</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Nombre:</span>
            <span class="info-value">${payload.customer.name}</span>
          </div>
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
          ${payload.customer.email ? `
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${payload.customer.email}</span>
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
          <div class="info-row">
            <span class="info-label">Prioridad:</span>
            <span class="info-value">${payload.priority === 'high' ? '🔴 Alta' : payload.priority === 'medium' ? '🟡 Media' : '🟢 Normal'}</span>
          </div>
          ${payload.urgency === 'urgent' ? `
          <div class="info-row">
            <span class="info-label">Urgencia:</span>
            <span class="info-value">⚡ Urgente</span>
          </div>` : ''}
        </div>
      </div>

      <div style="margin: 12px 0;">
        <div class="section-title" style="margin-bottom: 8px;">📱 Equipos Recibidos (${payload.devices.length})</div>
        ${customerDevicesHTML}
      </div>

      <div class="warranty-box">
        <div class="warranty-title">⚠️ Términos y Condiciones</div>
        <div class="warranty-text">
          • Garantía: 30 días sobre trabajo realizado<br/>
          • Retiro máximo: 90 días calendario<br/>
          • Repuestos no incluyen garantía salvo defecto<br/>
          • Conserve este comprobante para el retiro
        </div>
      </div>

      <div class="qr-placeholder">
        QR
      </div>

      <div class="footer">
        <div>Gracias por confiar en ${company.name}</div>
        <div style="margin-top: 2px;">Para consultas: ${company.phone}</div>
      </div>
    </body>
  </html>
  `
}
