interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  discount?: number
  isService?: boolean
}

interface PaymentSplit {
  id: string
  method: 'cash' | 'card' | 'transfer' | 'credit'
  amount: number
  reference?: string
  cardLast4?: string
}

interface ReceiptData {
  receiptNumber: string
  date: string
  time: string
  cashier: string
  cashRegister?: string
  shift?: string
  customer?: {
    name: string
    phone: string
    email: string
  }
  items: CartItem[]
  subtotal: number
  totalDiscount: number
  tax: number
  repairCost?: number
  total: number
  payments: PaymentSplit[]
  change?: number
  loyaltyPoints?: number
}

// Generar número de ticket único
export const generateReceiptNumber = (): string => {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const time = now.getTime().toString().slice(-6)
  
  return `${year}${month}${day}-${time}`
}

// Formatear fecha y hora
export const formatDateTime = () => {
  const now = new Date()
  const date = now.toLocaleDateString('es-PY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const time = now.toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  
  return { date, time }
}

interface Calculations {
  subtotal: number
  totalDiscount: number
  tax: number
  repairCost?: number
  total: number
  change?: number
  loyaltyPoints?: number
}

interface Customer {
  name: string
  phone: string
  email: string
}

// Crear datos del ticket
export const createReceiptData = (
  cart: CartItem[],
  calculations: Calculations,
  payments: PaymentSplit[],
  customer?: Customer,
  cashier: string = 'Sistema POS',
  cashRegister?: string,
  shift?: string
): ReceiptData => {
  const { date, time } = formatDateTime()
  
  return {
    receiptNumber: generateReceiptNumber(),
    date,
    time,
    cashier,
    cashRegister,
    shift,
    customer: customer ? {
      name: customer.name,
      phone: customer.phone,
      email: customer.email
    } : undefined,
    items: cart,
    subtotal: calculations.subtotal,
    totalDiscount: calculations.totalDiscount || 0,
    tax: calculations.tax,
    repairCost: calculations.repairCost || 0,
    total: calculations.total,
    payments,
    change: (calculations.change || 0) > 0 ? calculations.change : undefined,
    loyaltyPoints: calculations.loyaltyPoints || 0
  }
}

export interface CompanyInfo {
  name: string
  address: string
  phone: string
  email: string
  ruc?: string
}

const sanitizeUnsupportedColorFunctions = (raw: string): string => {
  return raw.replace(/\b(?:oklch|lch|lab)\([^)]+\)/gi, 'rgb(120, 120, 120)')
}

const sanitizeCloneStylesForHtml2Canvas = (clonedDoc: Document): void => {
  clonedDoc.querySelectorAll('style').forEach((styleEl) => {
    const css = styleEl.textContent || ''
    const sanitized = sanitizeUnsupportedColorFunctions(css)
    if (sanitized !== css) styleEl.textContent = sanitized
  })

  clonedDoc.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const inline = el.getAttribute('style') || ''
    const sanitized = sanitizeUnsupportedColorFunctions(inline)
    if (sanitized !== inline) el.setAttribute('style', sanitized)
  })
}

// Imprimir ticket - Captura el contenido del modal directamente
export const printReceipt = (receiptData: ReceiptData, companyInfo?: CompanyInfo): void => {
  // Intentar capturar el contenido del modal primero
  const receiptElement = document.getElementById('receipt-content')
  
  if (receiptElement) {
    // Si existe el elemento del modal, clonar su contenido
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Por favor, permita las ventanas emergentes para imprimir')
      return
    }

    // Obtener todos los estilos de la página
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n')
        } catch (e) {
          return ''
        }
      })
      .join('\n')

    // Crear HTML con el contenido clonado
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket - ${receiptData.receiptNumber}</title>
        <style>
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 5mm;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
          
          * {
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 80mm;
            margin: 0 auto;
            padding: 8px;
            background: white;
            color: black;
          }
          
          ${styles}
          
          /* Asegurar que los colores se impriman */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        </style>
      </head>
      <body>
        ${receiptElement.innerHTML}
      </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()

    setTimeout(() => {
      try {
        printWindow.focus()
        printWindow.print()
      } catch (error) {
        console.error('Error printing:', error)
        printWindow.close()
      }
    }, 500)
  } else {
    // Fallback: usar el HTML generado si no existe el modal
    printReceiptFallback(receiptData, companyInfo)
  }
}

// Fallback: Imprimir usando HTML generado
const printReceiptFallback = (receiptData: ReceiptData, companyInfo?: CompanyInfo): void => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Por favor, permita las ventanas emergentes para imprimir')
    return
  }

  const printContent = generatePrintHTML(receiptData, companyInfo)
  
  printWindow.document.write(printContent)
  printWindow.document.close()
  
  setTimeout(() => {
    try {
      printWindow.focus()
      printWindow.print()
    } catch (error) {
      console.error('Error printing:', error)
      printWindow.close()
    }
  }, 250)
}

// Generar HTML para impresión con diseño mejorado
const generatePrintHTML = (receiptData: ReceiptData, companyInfo?: CompanyInfo): string => {
  
  const company = companyInfo || config.company

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: '💵 Efectivo',
      card: '💳 Tarjeta',
      transfer: '🏦 Transferencia',
      credit: '📝 Crédito'
    }
    return labels[method as keyof typeof labels] || method
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ticket - ${receiptData.receiptNumber}</title>
      <style>
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 5mm;
          }
        }
        
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          max-width: 80mm;
          margin: 0 auto;
          padding: 8px;
          color: #000;
        }
        
        .header {
          text-align: center;
          border-bottom: 2px dashed #333;
          padding-bottom: 12px;
          margin-bottom: 12px;
          background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);
          padding-top: 12px;
        }
        
        .logo {
          width: 50px;
          height: 50px;
          background: #000;
          color: #fff;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        
        .header h1 {
          font-size: 18px;
          font-weight: bold;
          margin: 5px 0 2px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .header .subtitle {
          font-size: 11px;
          font-weight: 600;
          color: #666;
          margin: 2px 0;
        }
        
        .header p {
          margin: 2px 0;
          font-size: 9px;
          color: #666;
        }
        
        .ticket-number {
          background: #f0f0f0;
          border-left: 4px solid #000;
          padding: 8px 10px;
          margin: 10px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .ticket-number .label {
          font-size: 10px;
          color: #666;
        }
        
        .ticket-number .number {
          font-size: 14px;
          font-weight: bold;
          font-family: 'Courier New', monospace;
        }
        
        .info-section {
          margin: 10px 0;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 10px;
        }
        
        .info-row .label {
          color: #666;
        }
        
        .info-row .value {
          font-weight: 600;
        }
        
        .separator {
          border-top: 1px dashed #999;
          margin: 12px 0;
        }
        
        .section-title {
          text-align: center;
          font-weight: bold;
          font-size: 11px;
          background: #f5f5f5;
          padding: 6px;
          margin: 10px 0 8px 0;
          border-radius: 3px;
        }
        
        .item {
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px dotted #ddd;
        }
        
        .item:last-child {
          border-bottom: none;
        }
        
        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          font-weight: 600;
          margin-bottom: 3px;
        }
        
        .item-name {
          flex: 1;
          line-height: 1.3;
        }
        
        .item-price {
          font-weight: bold;
          white-space: nowrap;
          margin-left: 8px;
        }
        
        .tag-service {
          display: inline-block;
          font-size: 8px;
          font-weight: bold;
          color: #0066cc;
          background: #e6f2ff;
          border: 1px solid #b3d9ff;
          padding: 2px 6px;
          border-radius: 10px;
          margin-left: 6px;
        }
        
        .item-details {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #666;
          margin-top: 2px;
        }
        
        .item-discount {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #28a745;
          font-weight: 600;
          margin-top: 2px;
        }
        
        .totals {
          margin: 12px 0;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-size: 11px;
        }
        
        .total-row.discount {
          color: #28a745;
          font-weight: 600;
        }
        
        .total-row.final {
          background: #f0f0f0;
          padding: 10px;
          margin-top: 8px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
        }
        
        .payment-section {
          margin: 12px 0;
        }
        
        .payment-item {
          background: #f8f8f8;
          padding: 8px 10px;
          margin: 4px 0;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .payment-item.change {
          background: #e8f5e9;
          color: #2e7d32;
          font-weight: bold;
        }
        
        .payment-status {
          text-align: center;
          background: #e8f5e9;
          color: #2e7d32;
          padding: 8px;
          margin: 8px 0;
          border-radius: 4px;
          font-weight: bold;
          font-size: 12px;
        }
        
        .loyalty-box {
          background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%);
          border: 1px solid #ffc107;
          padding: 10px;
          text-align: center;
          margin: 12px 0;
          border-radius: 4px;
        }
        
        .loyalty-box .text {
          font-weight: bold;
          color: #856404;
          font-size: 11px;
        }
        
        .warranty-box {
          background: #e3f2fd;
          border: 1px solid #2196f3;
          padding: 10px;
          text-align: center;
          margin: 12px 0;
          border-radius: 4px;
        }
        
        .warranty-box .title {
          font-weight: bold;
          color: #1565c0;
          font-size: 11px;
          margin-bottom: 3px;
        }
        
        .warranty-box .subtitle {
          font-size: 9px;
          color: #1976d2;
        }
        
        .footer {
          text-align: center;
          font-size: 9px;
          margin-top: 15px;
          border-top: 1px dashed #999;
          padding-top: 12px;
          color: #666;
        }
        
        .footer .thanks {
          font-weight: bold;
          font-size: 11px;
          color: #000;
          margin-bottom: 5px;
        }
        
        .footer .contact {
          margin: 3px 0;
        }
        
        .footer .id {
          font-family: 'Courier New', monospace;
          font-size: 8px;
          margin-top: 8px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <!-- Encabezado -->
      <div class="header">
        <div class="logo">4G</div>
        <h1>${company.name}</h1>
        <div class="subtitle">Reparación y Service</div>
        ${'ruc' in company && company.ruc ? `<p>RUC: ${company.ruc}</p>` : ''}
        <p>${company.address}</p>
        <p>☎ ${company.phone}</p>
        <p>📧 ${company.email}</p>
      </div>
      
      <!-- Número de ticket -->
      <div class="ticket-number">
        <span class="label">Ticket N°</span>
        <span class="number">${receiptData.receiptNumber}</span>
      </div>
      
      <!-- Información de la venta -->
      <div class="info-section">
        <div class="info-row">
          <span class="label">📅 Fecha:</span>
          <span class="value">${receiptData.date}</span>
        </div>
        <div class="info-row">
          <span class="label">⏰ Hora:</span>
          <span class="value">${receiptData.time}</span>
        </div>
        ${receiptData.cashRegister ? `
          <div class="info-row">
            <span class="label">🏪 Caja:</span>
            <span class="value">${receiptData.cashRegister}</span>
          </div>
        ` : ''}
        ${receiptData.shift ? `
          <div class="info-row">
            <span class="label">🕐 Turno:</span>
            <span class="value">${receiptData.shift}</span>
          </div>
        ` : ''}
        <div class="info-row">
          <span class="label">👤 Cajero:</span>
          <span class="value">${receiptData.cashier}</span>
        </div>
        ${receiptData.customer ? `
          <div class="separator"></div>
          <div class="info-row">
            <span class="label">👥 Cliente:</span>
            <span class="value">${receiptData.customer.name}</span>
          </div>
          <div class="info-row">
            <span class="label">📱 Teléfono:</span>
            <span class="value">${receiptData.customer.phone}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="separator"></div>
      
      <!-- Productos -->
      <div class="section-title">DETALLE DE PRODUCTOS</div>
      
      ${receiptData.items.map(item => `
        <div class="item">
          <div class="item-header">
            <span class="item-name">
              ${item.name}
              ${item.isService ? `<span class="tag-service">🔧 SERVICIO</span>` : ''}
            </span>
            <span class="item-price">${formatCurrency(item.price * item.quantity)}</span>
          </div>
          <div class="item-details">
            <span>SKU: ${item.sku}</span>
            <span>${item.quantity} × ${formatCurrency(item.price)}</span>
          </div>
          ${item.discount && item.discount > 0 ? `
            <div class="item-discount">
              <span>✨ Descuento:</span>
              <span>-${formatCurrency(item.discount)}</span>
            </div>
          ` : ''}
        </div>
      `).join('')}
      
      <div class="separator"></div>
      
      <!-- Totales -->
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(receiptData.subtotal)}</span>
        </div>
        ${receiptData.totalDiscount > 0 ? `
          <div class="total-row discount">
            <span>✨ Descuento Total:</span>
            <span>-${formatCurrency(receiptData.totalDiscount)}</span>
          </div>
        ` : ''}
        <div class="total-row">
          <span>${getTaxConfig().label} (${getTaxConfig().percentage}%):</span>
          <span>${formatCurrency(receiptData.tax)}</span>
        </div>
        <div class="total-row final">
          <span>TOTAL:</span>
          <span>${formatCurrency(receiptData.total)}</span>
        </div>
      </div>
      
      <div class="separator"></div>
      
      <!-- Métodos de pago -->
      <div class="section-title">FORMA DE PAGO</div>
      <div class="payment-section">
        ${receiptData.payments.map(payment => `
          <div class="payment-item">
            <span>
              ${getPaymentMethodLabel(payment.method)}
              ${payment.reference ? ` (${payment.reference})` : ''}
              ${payment.cardLast4 ? ` ****${payment.cardLast4}` : ''}
            </span>
            <span style="font-weight: bold;">${formatCurrency(payment.amount)}</span>
          </div>
        `).join('')}
        ${receiptData.change && receiptData.change > 0 ? `
          <div class="payment-item change">
            <span>💰 Cambio:</span>
            <span>${formatCurrency(receiptData.change)}</span>
          </div>
        ` : ''}
        <div class="payment-status">✅ PAGADO</div>
      </div>
      
      ${receiptData.loyaltyPoints && receiptData.loyaltyPoints > 0 ? `
        <div class="separator"></div>
        <div class="loyalty-box">
          <div class="text">🎉 ¡Ganaste ${receiptData.loyaltyPoints} puntos de lealtad! 🎉</div>
        </div>
      ` : ''}
      
      <div class="separator"></div>
      
      <!-- Garantía -->
      <div class="warranty-box">
        <div class="title">🛡️ GARANTÍA: 30 días</div>
        <div class="subtitle">Válido para cambios y reparaciones</div>
      </div>
      
      <!-- Pie del ticket -->
      <div class="footer">
        <div class="thanks">¡Gracias por su compra!</div>
        <div>Conserve este ticket como comprobante</div>
        <div class="contact">📱 Consultas: ${company.phone}</div>
        <div class="contact">📧 ${company.email}</div>
        <div class="separator"></div>
        <div class="id">ID: ${receiptData.receiptNumber}</div>
        <div class="id">Generado: ${new Date().toLocaleString('es-PY')}</div>
      </div>
    </body>
    </html>
  `
}

// Descargar ticket como PDF real
export const downloadReceipt = async (receiptData: ReceiptData, companyInfo?: CompanyInfo): Promise<void> => {
  try {
    // Importar dinámicamente para evitar problemas de SSR
    const html2canvas = (await import('html2canvas')).default
    const jsPDF = (await import('jspdf')).default
    
    const element = document.getElementById('receipt-content')
    if (!element) {
      console.error('Receipt element not found')
      return
    }

    // Generar canvas del ticket
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      onclone: (clonedDoc: Document) => {
        sanitizeCloneStylesForHtml2Canvas(clonedDoc)
      }
    })

    // Crear PDF
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 297] // 80mm width, altura automática
    })

    const imgWidth = 80
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save(`ticket-${receiptData.receiptNumber}.pdf`)
  } catch (error) {
    console.error('Error generating PDF:', error)
    // Fallback al método anterior
    downloadReceiptHTML(receiptData, companyInfo)
  }
}

// Fallback: Descargar como HTML
const downloadReceiptHTML = (receiptData: ReceiptData, companyInfo?: CompanyInfo): void => {
  const printContent = generatePrintHTML(receiptData, companyInfo)
  const blob = new Blob([printContent], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `ticket-${receiptData.receiptNumber}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

// Compartir ticket como imagen
export const shareReceipt = async (receiptData: ReceiptData, companyInfo?: CompanyInfo): Promise<void> => {
  const companyName = companyInfo?.name || config.company.name
  
  try {
    // Intentar compartir como imagen
    const html2canvas = (await import('html2canvas')).default
    const element = document.getElementById('receipt-content')
    
    if (element && navigator.share) {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        onclone: (clonedDoc: Document) => {
          sanitizeCloneStylesForHtml2Canvas(clonedDoc)
        }
      })

      // Convertir canvas a blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png')
      })

      const file = new File([blob], `ticket-${receiptData.receiptNumber}.png`, { type: 'image/png' })

      await navigator.share({
        title: `Ticket ${receiptData.receiptNumber}`,
        text: `Ticket de venta - ${companyName}\nTotal: ${formatCurrency(receiptData.total)}`,
        files: [file]
      })
      return
    }
  } catch (error) {
    console.log('Error sharing as image:', error)
  }

  // Fallback: compartir como texto
  const shareText = `
Ticket: ${receiptData.receiptNumber}
Fecha: ${receiptData.date} ${receiptData.time}
Total: ${formatCurrency(receiptData.total)}

¡Gracias por su compra en ${companyName}!
  `.trim()

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Ticket ${receiptData.receiptNumber}`,
        text: shareText
      })
    } catch (error) {
      console.log('Error sharing:', error)
      fallbackShare(shareText)
    }
  } else {
    fallbackShare(shareText)
  }
}

// Compartir alternativo (copiar al portapapeles)
const fallbackShare = (text: string): void => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Información del ticket copiada al portapapeles')
    }).catch(() => {
      showShareModal(text)
    })
  } else {
    showShareModal(text)
  }
}

// Mostrar modal con información para compartir
const showShareModal = (text: string): void => {
  const modal = document.createElement('div')
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `
  
  const content = document.createElement('div')
  content.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 400px;
    width: 90%;
  `
  
  content.innerHTML = `
    <h3 style="margin-top: 0;">Compartir Ticket</h3>
    <textarea readonly style="width: 100%; height: 150px; margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">${text}</textarea>
    <div style="text-align: right;">
      <button onclick="this.closest('[style*=fixed]').remove()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Cerrar</button>
    </div>
  `
  
  modal.appendChild(content)
  document.body.appendChild(modal)
  
  // Cerrar al hacer clic fuera
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove()
    }
  })
}
import { getTaxConfig, config } from './config'
import { formatCurrency } from '@/lib/currency'
