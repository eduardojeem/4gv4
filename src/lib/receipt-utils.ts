interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  discount?: number
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
  cashier: string = 'Sistema POS'
): ReceiptData => {
  const { date, time } = formatDateTime()
  
  return {
    receiptNumber: generateReceiptNumber(),
    date,
    time,
    cashier,
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

// Imprimir ticket
export const printReceipt = (receiptData: ReceiptData): void => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Por favor, permita las ventanas emergentes para imprimir')
    return
  }

  const printContent = generatePrintHTML(receiptData)
  
  printWindow.document.write(printContent)
  printWindow.document.close()
  
  // Esperar a que se cargue el contenido antes de imprimir
  printWindow.onload = () => {
    printWindow.print()
    printWindow.close()
  }
}

// Generar HTML para impresión
const generatePrintHTML = (receiptData: ReceiptData): string => {
  

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      credit: 'Crédito'
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
        
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.2;
          max-width: 80mm;
          margin: 0 auto;
          padding: 10px;
        }
        
        .header {
          text-align: center;
          border-bottom: 2px dashed #333;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        
        .header h1 {
          font-size: 16px;
          font-weight: bold;
          margin: 0;
        }
        
        .header p {
          margin: 2px 0;
          font-size: 10px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        
        .separator {
          border-top: 1px dashed #333;
          margin: 10px 0;
        }
        
        .item {
          margin-bottom: 8px;
        }
        
        .item-name {
          font-weight: bold;
        }
        
        .item-details {
          font-size: 10px;
          color: #666;
        }
        
        .total-section {
          border-top: 2px solid #333;
          padding-top: 5px;
          margin-top: 10px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 14px;
        }
        
        .footer {
          text-align: center;
          font-size: 10px;
          margin-top: 15px;
          border-top: 1px dashed #333;
          padding-top: 10px;
        }
        
        .loyalty-points {
          background: #f0f8ff;
          padding: 5px;
          text-align: center;
          margin: 10px 0;
          border: 1px solid #ccc;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>COMERCIAL 4G</h1>
        <p>Sistema de Punto de Venta</p>
        <p>RUC: 80.123.456-7</p>
        <p>Av. Principal 123, Asunción</p>
        <p>Tel: +595-21-123456</p>
      </div>
      
      <div class="info-row">
        <span>Ticket N°:</span>
        <span>${receiptData.receiptNumber}</span>
      </div>
      <div class="info-row">
        <span>Fecha:</span>
        <span>${receiptData.date}</span>
      </div>
      <div class="info-row">
        <span>Hora:</span>
        <span>${receiptData.time}</span>
      </div>
      <div class="info-row">
        <span>Cajero:</span>
        <span>${receiptData.cashier}</span>
      </div>
      
      ${receiptData.customer ? `
        <div class="separator"></div>
        <div class="info-row">
          <span>Cliente:</span>
          <span>${receiptData.customer.name}</span>
        </div>
        <div class="info-row">
          <span>Teléfono:</span>
          <span>${receiptData.customer.phone}</span>
        </div>
      ` : ''}
      
      <div class="separator"></div>
      
      <div style="text-align: center; font-weight: bold; margin-bottom: 10px;">
        DETALLE DE PRODUCTOS
      </div>
      
      ${receiptData.items.map(item => `
        <div class="item">
          <div class="info-row item-name">
            <span>${item.name}</span>
            <span>${formatCurrency(item.price * item.quantity)}</span>
          </div>
          <div class="info-row item-details">
            <span>SKU: ${item.sku}</span>
            <span>${item.quantity} x ${formatCurrency(item.price)}</span>
          </div>
          ${item.discount && item.discount > 0 ? `
            <div class="info-row" style="color: green;">
              <span>Descuento:</span>
              <span>-${formatCurrency(item.discount)}</span>
            </div>
          ` : ''}
        </div>
      `).join('')}
      
      <div class="separator"></div>
      
      <div class="info-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(receiptData.subtotal)}</span>
      </div>
      
      ${receiptData.totalDiscount > 0 ? `
        <div class="info-row" style="color: green;">
          <span>Descuento Total:</span>
          <span>-${formatCurrency(receiptData.totalDiscount)}</span>
        </div>
      ` : ''}
      
      <div class="info-row">
        <span>${getTaxConfig().label} (${getTaxConfig().percentage}%):</span>
        <span>${formatCurrency(receiptData.tax)}</span>
      </div>
      
      ${receiptData.repairCost && receiptData.repairCost > 0 ? `
        <div class="info-row">
          <span>Reparaciones:</span>
          <span>${formatCurrency(receiptData.repairCost)}</span>
        </div>
      ` : ''}
      
      <div class="total-section">
        <div class="total-row">
          <span>TOTAL:</span>
          <span>${formatCurrency(receiptData.total)}</span>
        </div>
      </div>
      
      <div class="separator"></div>
      
      <div style="text-align: center; font-weight: bold; margin-bottom: 5px;">
        FORMA DE PAGO
      </div>
      
      ${receiptData.payments.map(payment => `
        <div class="info-row">
          <span>
            ${getPaymentMethodLabel(payment.method)}
            ${payment.reference ? ` (${payment.reference})` : ''}
            ${payment.cardLast4 ? ` ****${payment.cardLast4}` : ''}
          </span>
          <span>${formatCurrency(payment.amount)}</span>
        </div>
      `).join('')}
      
      ${receiptData.change && receiptData.change > 0 ? `
        <div class="info-row" style="color: green; font-weight: bold;">
          <span>Cambio:</span>
          <span>${formatCurrency(receiptData.change)}</span>
        </div>
      ` : ''}
      
      ${receiptData.loyaltyPoints && receiptData.loyaltyPoints > 0 ? `
        <div class="loyalty-points">
          🎉 Has ganado ${receiptData.loyaltyPoints} puntos de lealtad
        </div>
      ` : ''}
      
      <div class="footer">
        <p>¡Gracias por su compra!</p>
        <p>Conserve este ticket como comprobante</p>
        <p>Para consultas: info@comercial4g.com</p>
        <p style="margin-top: 10px;">
          Generado: ${new Date().toLocaleString()}
        </p>
      </div>
    </body>
    </html>
  `
}

// Descargar ticket como PDF (simulado con HTML)
export const downloadReceipt = (receiptData: ReceiptData): void => {
  const printContent = generatePrintHTML(receiptData)
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

// Compartir ticket
export const shareReceipt = async (receiptData: ReceiptData): Promise<void> => {
  const shareText = `
Ticket: ${receiptData.receiptNumber}
Fecha: ${receiptData.date} ${receiptData.time}
Total: ${formatCurrency(receiptData.total)}

¡Gracias por su compra en Comercial 4G!
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
import { getTaxConfig } from './config'
import { formatCurrency } from '@/lib/currency'
