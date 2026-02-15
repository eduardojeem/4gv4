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

export interface CompanyInfo {
  name: string
  phone?: string
  address?: string
  email?: string
  logo?: string
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
  company?: CompanyInfo
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
  const company = payload.company || config.company
  const ticketNumber = payload.ticketNumber || 'N/A'
  const dateObj = payload.date || new Date()
  const date = dateObj.toLocaleDateString(config.locale || 'es-PY')
  
  let text = `*${company.name}* - Orden de Servicio\n`
  text += `--------------------------------\n`
  text += `📄 *Ticket:* ${ticketNumber}\n`
  text += `📅 *Fecha:* ${date}\n`
  text += `👤 *Cliente:* ${payload.customer.name}\n`
  text += `--------------------------------\n`
  text += `*DETALLES DEL EQUIPO*\n`
  
  payload.devices.forEach((d, i) => {
    if (i > 0) text += `\n- - - - - - - - - - - -\n`
    text += `📱 *Equipo:* ${d.brand} ${d.model}\n`
    text += `🔧 *Problema:* ${d.issue}\n`
    if (d.estimatedCost) {
       text += `💰 *Costo Est:* ${formatCurrency(d.estimatedCost)}\n`
    }
  })
  
  text += `--------------------------------\n`
  
  if (payload.ticketNumber) {
    // Si tienes una URL pública para consultar el estado
    // text += `🔍 *Consulta tu estado aquí:*\n`
    // text += `https://tu-dominio.com/estado/${payload.ticketNumber}\n`
  }
  
  text += `📍 ${company.address}\n`
  text += `📞 ${company.phone}\n`
  text += `\n_Gracias por su preferencia_`

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

  if (printWindow && !printWindow.closed) {
    try {
      printWindow.focus()
    } catch {}
  }
}



/**
 * Construye el HTML auto-contenido para impresión en formato A4.
 * Incluye encabezado de empresa, meta de recepción, datos del cliente y equipos.
 */
const generateRepairReceiptHTML = (type: RepairReceiptType, payload: RepairPrintPayload): string => {
  const company = payload.company || config.company
  const ticketNumber = payload.ticketNumber || generateRepairTicketNumber()
  const dateObj = payload.date || new Date()
  const date = dateObj.toLocaleDateString(config.locale || 'es-PY')
  const time = dateObj.toLocaleTimeString(config.locale || 'es-PY')
  
  const getPaperPreference = (): '80mm' | '58mm' | 'A4' => {
    try {
      if (typeof window !== 'undefined') {
        const v = window.localStorage.getItem('repairReceiptPaper')
        if (v === '58mm') return '58mm'
        if (v === 'A4') return 'A4'
      }
    } catch {}
    return '80mm'
  }
  const paperPref = getPaperPreference()
  const isA4 = paperPref === 'A4'
  const pageSizeValue = isA4 ? 'A4' : `${paperPref} auto`
  const bodyWidthValue = isA4 ? 'auto' : (paperPref === '58mm' ? '46mm' : '70mm')
  const baseFontSize = isA4 ? '14px' : (paperPref === '58mm' ? '12px' : '13px')
  const basePadding = isA4 ? '10mm' : '3mm'

  // Estilos modernos unificados para ambos tipos de comprobante
  const modernStyles = `
    @media print {
      @page { 
        size: ${pageSizeValue}; 
        margin: ${isA4 ? '12mm' : '0'}; 
      }
      body { 
        margin: 0; 
        width: ${bodyWidthValue}; 
      }
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111827;
      background: #fff;
      line-height: 1.4;
      padding: ${basePadding};
      font-size: ${baseFontSize};
      max-width: ${isA4 ? '800px' : '290px'};
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 2px solid #d1d5db;
    }
    
    .company-name {
      font-size: 19px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2px;
    }
    
    .company-info {
      font-size: 11px;
      color: #1f2937;
      line-height: 1.3;
    }
    
    .date-time {
      font-size: 12px;
      color: #1f2937;
    }
    
    .ticket-badge {
      background: #ffffff;
      color: #111827;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #111827;
      font-weight: 800;
      font-size: 17px;
      margin: 10px 0;
      display: inline-block;
      letter-spacing: 0.2px;
    }
    
    .title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 10px 0;
    }
    
    .section-card {
      background: #ffffff;
      border: 1px solid #111827;
      border-radius: 8px;
      padding: 10px;
      margin: 10px 0;
      box-shadow: none;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
      border-bottom: 1px solid #111827;
      padding-bottom: 6px;
    }
    
    .info-grid {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      font-size: 12px;
      padding: 2px 0;
    }
    
    .info-label {
      color: #1f2937;
      font-weight: 600;
      min-width: 60px;
    }
    
    .info-value {
      color: #111827;
      font-weight: 700;
      text-align: right;
      flex: 1 1 60%;
      margin-left: 8px;
      line-height: 1.35;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    
    .device-card {
      border: 1px solid #111827;
      border-radius: 8px;
      padding: 12px;
      margin: 10px 0;
      background: #ffffff;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .device-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    
    .device-icon {
      font-size: 16px;
    }
    
    .device-name {
      font-weight: 700;
      font-size: 14px;
      color: #111827;
    }
    
    .device-type {
      font-size: 11px;
      color: #4b5563;
      margin-bottom: 10px;
    }
    
    .problem-section {
      margin: 10px 0;
    }
    
    .problem-label {
      font-size: 11px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 4px;
    }
    
    .problem-text {
      font-size: 13px;
      color: #1f2937;
      line-height: 1.4;
      padding: 6px 0;
      white-space: pre-wrap;
    }
    
    .notes-section {
      margin: 8px 0;
      padding-top: 8px;
      border-top: 1px dashed #d1d5db;
    }
    
    .notes-label {
      font-size: 11px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 3px;
    }
    
    .notes-text {
      font-size: 12px;
      color: #1f2937;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    
    .tech-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #d1d5db;
      font-size: 12px;
    }
    
    .tech-item {
      color: #1f2937;
      font-weight: 600;
    }
    
    .cost-item {
      color: #1f2937;
      font-weight: 700;
    }
    
    .warranty-box {
      background: #ffffff;
      border: 1.5px solid #1f2937;
      border-radius: 8px;
      padding: 10px;
      margin: 12px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .warranty-title {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 6px;
    }
    
    .warranty-text {
      font-size: 11px;
      color: #1f2937;
      line-height: 1.45;
    }
    
    .legal-text {
      font-size: 11px;
      color: #1f2937;
      line-height: 1.5;
      margin-top: 8px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .footer {
      text-align: center;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #111827;
      font-size: 11px;
      color: #1f2937;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .qr-placeholder {
      width: 80%;
      height: 48px;
      background: #f9fafb;
      border: 1px dashed #111827;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: #111827;
      margin: 10px auto 0;
      break-inside: avoid;
      page-break-inside: avoid;
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
          ${d.technician ? `<div class="tech-item" style="flex:1 1 48%;">👨‍🔧 ${d.technician}</div>` : ''}
          ${typeof d.estimatedCost === 'number' ? `<div class="cost-item" style="flex:1 1 48%; text-align:right;">💰 ${formatCurrency(d.estimatedCost)}</div>` : ''}
        </div>
      </div>
    `).join('')

    // Estilos modernos y optimizados para móvil
    const modernStyles = `
      @media print {
        @page { 
          size: ${pageSizeValue}; 
          margin: ${isA4 ? '12mm' : '3mm'}; 
        }
        body { 
          margin: 0; 
          width: ${bodyWidthValue}; 
        }
      }
      
      * {
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #111827;
        background: #fff;
        line-height: 1.4;
        padding: ${basePadding};
        font-size: ${baseFontSize};
        max-width: ${isA4 ? '800px' : '290px'};
        margin: 0 auto;
      }
      
      .header {
        text-align: center;
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 2px solid #d1d5db;
      }
      
      .company-name {
        font-size: 19px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 2px;
      }
      
      .date-time {
        font-size: 12px;
        color: #1f2937;
      }
      
      .ticket-badge {
        background: #ffffff;
        color: #111827;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #111827;
        font-weight: 800;
        font-size: 17px;
        margin: 10px 0;
        display: inline-block;
        letter-spacing: 0.2px;
      }
      
      .title {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin: 10px 0;
      }
      
      .customer-card {
        background: #ffffff;
        border: 1px solid #111827;
        border-radius: 8px;
        padding: 10px;
        margin: 10px 0;
        box-shadow: none;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      
      .customer-name {
        font-weight: 700;
        font-size: 14px;
        color: #111827;
        margin-bottom: 2px;
      }
      
      .customer-phone {
        font-size: 12px;
        color: #1f2937;
      }
      
      .priority-badge {
        display: inline-block;
        padding: 3px 7px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        background: #ffffff;
        color: #1f2937;
        border: 1px solid #1f2937;
        margin: 6px 0;
      }
      
      .device-card {
        border: 1px solid #111827;
        border-radius: 8px;
        padding: 12px;
        margin: 10px 0;
        background: #ffffff;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      
      .device-title {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }
      
      .device-icon {
        font-size: 16px;
      }
      
      .device-name {
        font-weight: 700;
        font-size: 14px;
        color: #111827;
      }
      
      .device-type {
        font-size: 11px;
        color: #4b5563;
        margin-bottom: 10px;
      }
      
      .problem-section {
        margin: 10px 0;
      }
      
      .problem-label {
        font-size: 11px;
        font-weight: 700;
        color: #1f2937;
        margin-bottom: 4px;
      }
      
      .problem-text {
        font-size: 13px;
        color: #1f2937;
        line-height: 1.4;
        padding: 6px 0;
      }
      
      .notes-section {
        margin: 8px 0;
        padding-top: 8px;
        border-top: 1px dashed #d1d5db;
      }
      
      .notes-label {
        font-size: 11px;
        font-weight: 700;
        color: #1f2937;
        margin-bottom: 3px;
      }
      
      .notes-text {
        font-size: 12px;
        color: #1f2937;
        line-height: 1.4;
      }
      
      .tech-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed #d1d5db;
        font-size: 12px;
      }
      
      .tech-item {
        color: #1f2937;
        font-weight: 600;
      }
      
      .cost-item {
        color: #1f2937;
        font-weight: 700;
      }
      
      .footer {
        text-align: center;
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px solid #111827;
        font-size: 11px;
        color: #1f2937;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      
      .qr-placeholder {
        width: 80%;
        height: 48px;
        background: #f9fafb;
        border: 1px dashed #111827;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: #111827;
        margin: 10px auto 0;
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
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() { window.print(); }, 300);
          });
          window.addEventListener('afterprint', function() {
            window.close();
          });
        </script>
        <div class="header">
          <div class="company-name">${company.name}</div>
          <div class="date-time">${date} • ${time}</div>
        </div>
        
        <div style="text-align: center;">
          <span class="ticket-badge">Ticket (${ticketNumber})</span>
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
          <img 
            alt="QR Ticket" 
            width="120" 
            height="120" 
            style="display:block;"
            src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(`TICKET:${ticketNumber}|CLIENTE:${payload.customer.name}`)}&size=120x120&margin=0" 
          />
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
      <style>
        ${modernStyles}
        .legal-text {
            font-size: 9px;
            color: #6b7280;
            text-align: justify;
            margin-top: 12px;
            line-height: 1.35;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
        }
      </style>
    </head>
    <body>
      <script>
        window.addEventListener('load', function() {
          setTimeout(function() { window.print(); }, 300);
        });
        window.addEventListener('afterprint', function() {
          window.close();
        });
      </script>
      <div class="header">
        ${company.logo ? `<img src="${company.logo}" style="max-height: 50px; margin-bottom: 8px;" alt="Logo" />` : ''}
        <div class="company-name">${company.name}</div>
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
        <div class="warranty-title">🛡️ Garantía y Términos</div>
        <div class="warranty-text">
          ${payload.warrantyMonths && payload.warrantyMonths > 0 ? `
          • <strong>Garantía:</strong> ${payload.warrantyMonths} ${payload.warrantyMonths === 1 ? 'mes' : 'meses'} (${payload.warrantyType === 'labor' ? 'Mano de obra' : payload.warrantyType === 'parts' ? 'Repuestos' : 'Total'}).<br/>
          ${payload.warrantyNotes ? `• ${payload.warrantyNotes}<br/>` : ''}
          ` : `
          • Esta reparación inicial no incluye garantía hasta su finalización.<br/>
          `}
          • Pasados los 90 días de la notificación, el equipo se considerará abandonado.
          • La garantía no cubre daños por humedad, golpes o mal uso posterior a la entrega.
          • Es indispensable presentar este comprobante para el retiro.
        </div>
      </div>

      <div class="legal-text">
        Declaro haber leído y aceptado los términos y condiciones del servicio técnico. 
        Autorizo la revisión y/o reparación de los equipos detallados. 
        La empresa no se responsabiliza por pérdida de datos; se recomienda realizar copias de seguridad.
      </div>

      <div class="qr-placeholder">
        <div style="font-size: 12px; font-weight: bold; color: #111827;">Firma Cliente</div>
      </div>

      <div class="footer">
        <div>Gracias por confiar en <strong>${company.name}</strong></div>
        <div style="margin-top: 2px;">${company.address}</div>
        <div style="margin-top: 2px;">${company.phone}</div>
      </div>
    </body>
  </html>
  `
}
