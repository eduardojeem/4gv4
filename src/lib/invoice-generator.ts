/**
 * Invoice Generator
 * Generación de facturas y recibos digitales
 */

import { formatCurrency } from '@/lib/currency'

export interface InvoiceData {
    invoiceNumber: string
    date: string
    dueDate?: string

    // Seller info
    sellerName: string
    sellerAddress?: string
    sellerTaxId?: string
    sellerPhone?: string
    sellerEmail?: string

    // Customer info
    customerName?: string
    customerAddress?: string
    customerTaxId?: string
    customerEmail?: string
    customerPhone?: string

    // Items
    items: Array<{
        description: string
        quantity: number
        unitPrice: number
        discount: number
        subtotal: number
    }>

    // Totals
    subtotal: number
    discount: number
    tax: number
    total: number

    // Payment
    paymentMethod: string
    amountPaid: number
    change?: number

    // Notes
    notes?: string
    terms?: string
}

/**
 * Generate invoice number with custom format
 */
export function generateInvoiceNumber(prefix: string = 'INV'): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const timestamp = Date.now().toString().slice(-6)

    return `${prefix}-${year}${month}${day}-${timestamp}`
}

/**
 * Generate receipt number
 */
export function generateReceiptNumber(): string {
    return `REC-${Date.now()}`
}

/**
 * Generate QR code data for invoice with more information
 */
export function generateQRCodeData(invoice: InvoiceData): string {
    // Formato mejorado: Empresa|Ticket|Fecha|Total|RUC|Hash
    const data = {
        empresa: invoice.sellerName,
        ticket: invoice.invoiceNumber,
        fecha: formatDate(new Date(invoice.date)),
        total: invoice.total,
        ruc: invoice.sellerTaxId || 'N/A',
        hash: generateSimpleHash(invoice)
    }
    
    return JSON.stringify(data)
}

/**
 * Generate simple hash for invoice verification
 */
function generateSimpleHash(invoice: InvoiceData): string {
    const data = `${invoice.invoiceNumber}${invoice.date}${invoice.total}${invoice.sellerTaxId}`
    let hash = 0
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).toUpperCase().substring(0, 8)
}

/**
 * Generate receipt with QR code placeholder for 48mm thermal printers
 */
export function formatReceiptWithQR(invoice: InvoiceData): string {
    const basicReceipt = formatReceiptText(invoice)
    const qrData = generateQRCodeData(invoice)
    const width = 32
    const line = '='.repeat(width)
    
    // Agregar información del QR al final del ticket
    const qrSection = `
${line}
${centerText('CODIGO QR PARA VERIFICACION', width)}
${centerText('[QR CODE AQUI]', width)}
${centerText('Escanea para verificar', width)}
${centerText('la autenticidad', width)}
${line}
Hash: ${generateSimpleHash(invoice)}
${line}


`
    
    return basicReceipt + qrSection
}

/**
 * Format invoice data as HTML for printing/PDF
 */
export function formatInvoiceHTML(invoice: InvoiceData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Factura ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
    .company-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
    .invoice-number { font-size: 16px; color: #666; }
    .info-section { display: flex; justify-  content: space-between; margin-bottom: 20px; }
    .info-block { flex: 1; }
    .info-title { font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #ddd; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; font-weight: bold; }
    .text-right { text-align: right; }
    .totals { margin-top: 20px; text-align: right; }
    .totals table { width: 300px; margin-left: auto; }
    .total-row { font-size: 14px; font-weight: bold; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">${invoice.sellerName}</div>
    ${invoice.sellerAddress ? `<div>${invoice.sellerAddress}</div>` : ''}
    ${invoice.sellerTaxId ? `<div>RUC: ${invoice.sellerTaxId}</div>` : ''}
    ${invoice.sellerPhone ? `<div>Tel: ${invoice.sellerPhone}</div>` : ''}
    <div class="invoice-number">FACTURA N° ${invoice.invoiceNumber}</div>
    <div>Fecha: ${new Date(invoice.date).toLocaleDateString('es')}</div>
  </div>

  <div class="info-section">
    <div class="info-block">
      <div class="info-title">Cliente</div>
      <div>${invoice.customerName || 'Cliente General'}</div>
      ${invoice.customerTaxId ? `<div>RUC: ${invoice.customerTaxId}</div>` : ''}
      ${invoice.customerAddress ? `<div>${invoice.customerAddress}</div>` : ''}
      ${invoice.customerPhone ? `<div>Tel: ${invoice.customerPhone}</div>` : ''}
    </div>
    <div class="info-block">
      <div class="info-title">Forma de Pago</div>
      <div>${invoice.paymentMethod}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th class="text-right">Cant.</th>
        <th class="text-right">Precio Unit.</th>
        <th class="text-right">Desc.</th>
        <th class="text-right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.items.map(item => `
        <tr>
          <td>${item.description}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.unitPrice)}</td>
          <td class="text-right">${formatCurrency(item.discount)}</td>
          <td class="text-right">${formatCurrency(item.subtotal)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr>
        <td>Subtotal:</td>
        <td class="text-right">${formatCurrency(invoice.subtotal)}</td>
      </tr>
      ${invoice.discount > 0 ? `
        <tr>
          <td>Descuento:</td>
          <td class="text-right">-${formatCurrency(invoice.discount)}</td>
        </tr>
      ` : ''}
      ${invoice.tax > 0 ? `
        <tr>
          <td>IVA:</td>
          <td class="text-right">${formatCurrency(invoice.tax)}</td>
        </tr>
      ` : ''}
      <tr class="total-row">
        <td>TOTAL:</td>
        <td class="text-right">${formatCurrency(invoice.total)}</td>
      </tr>
      ${invoice.change && invoice.change > 0 ? `
        <tr>
          <td>Pagado:</td>
          <td class="text-right">${formatCurrency(invoice.amountPaid)}</td>
        </tr>
        <tr>
          <td>Cambio:</td>
          <td class="text-right">${formatCurrency(invoice.change)}</td>
        </tr>
      ` : ''}
    </table>
  </div>

  ${invoice.notes ? `<div style="margin-top: 20px;"><strong>Notas:</strong> ${invoice.notes}</div>` : ''}
  
  <div class="footer">
    ${invoice.terms || 'Gracias por su compra'}
    <br>
    Documento generado el ${new Date().toLocaleString('es')}
  </div>

  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">
      Imprimir
    </button>
  </div>
</body>
</html>
  `
}



/**
 * Generate simple receipt (ticket térmico) - Optimizado para impresora 48mm con letras grandes
 */
export function formatReceiptText(invoice: InvoiceData): string {
    // Ancho reducido para letras más grandes (24 caracteres para mejor legibilidad)
    const width = 24
    const line = '='.repeat(width)
    const divider = '-'.repeat(width)
    const doubleLine = '█'.repeat(width)

    let receipt = `${doubleLine}
${centerText(invoice.sellerName.toUpperCase(), width)}
${invoice.sellerAddress ? centerText(truncateText(invoice.sellerAddress, width), width) : ''}
${invoice.sellerTaxId ? centerText(`RUC: ${invoice.sellerTaxId}`, width) : ''}
${invoice.sellerPhone ? centerText(`Tel: ${invoice.sellerPhone}`, width) : ''}
${line}
${centerText(`TICKET N° ${invoice.invoiceNumber}`, width)}
${centerText(formatDate(new Date(invoice.date)), width)}
${centerText(formatTime(new Date(invoice.date)), width)}
${line}`

    // Cliente (si existe)
    if (invoice.customerName && invoice.customerName !== 'Cliente General') {
        receipt += `
CLIENTE: ${truncateText(invoice.customerName, width - 9)}
${invoice.customerTaxId ? `RUC: ${invoice.customerTaxId}` : ''}
${divider}`
    }

    // Items con mejor formato
    receipt += `
PRODUCTOS:`
    
    invoice.items.forEach(item => {
        const itemName = truncateText(item.description, width)
        const qty = item.quantity.toString()
        const price = formatCurrency(item.unitPrice)
        const subtotal = formatCurrency(item.subtotal)
        
        receipt += `
${itemName}
${qty} x ${price}${subtotal.padStart(width - qty.length - price.length - 3)}`
        
        // Mostrar descuento si existe
        if (item.discount > 0) {
            receipt += `
  Desc: -${formatCurrency(item.discount)}`
        }
    })

    receipt += `
${divider}`

    // Totales con mejor alineación
    const subtotalLabel = 'SUBTOTAL:'
    const subtotalValue = formatCurrency(invoice.subtotal)
    receipt += `
${subtotalLabel}${subtotalValue.padStart(width - subtotalLabel.length)}`

    if (invoice.discount > 0) {
        const discountLabel = 'DESCUENTO:'
        const discountValue = `-${formatCurrency(invoice.discount)}`
        receipt += `
${discountLabel}${discountValue.padStart(width - discountLabel.length)}`
    }

    if (invoice.tax > 0) {
        const taxLabel = 'IVA:'
        const taxValue = formatCurrency(invoice.tax)
        receipt += `
${taxLabel}${taxValue.padStart(width - taxLabel.length)}`
    }

    receipt += `
${line}`

    // Total destacado
    const totalLabel = 'TOTAL:'
    const totalValue = formatCurrency(invoice.total)
    receipt += `
${totalLabel}${totalValue.padStart(width - totalLabel.length)}
${line}`

    // Información de pago
    receipt += `
PAGO: ${truncateText(invoice.paymentMethod, width - 6)}`

    if (invoice.amountPaid > 0) {
        const paidLabel = 'PAGADO:'
        const paidValue = formatCurrency(invoice.amountPaid)
        receipt += `
${paidLabel}${paidValue.padStart(width - paidLabel.length)}`
    }

    if (invoice.change && invoice.change > 0) {
        const changeLabel = 'CAMBIO:'
        const changeValue = formatCurrency(invoice.change)
        receipt += `
${changeLabel}${changeValue.padStart(width - changeLabel.length)}`
    }

    // Footer mejorado
    receipt += `
${line}
${centerText('¡GRACIAS POR SU COMPRA!', width)}
${centerText('Vuelva pronto', width)}
${line}
${centerText('www.miempresa.com', width)}
${centerText('Soporte: 123-456-7890', width)}
${doubleLine}


`

    return receipt
}

function centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2))
    return ' '.repeat(padding) + text
}

/**
 * Truncate text to fit within specified width
 */
function truncateText(text: string, maxWidth: number): string {
    if (text.length <= maxWidth) return text
    return text.substring(0, maxWidth - 3) + '...'
}

/**
 * Format date for receipt (DD/MM/YYYY)
 */
function formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    })
}

/**
 * Format time for receipt (HH:MM:SS)
 */
function formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

/**
 * Generate thermal receipt with ESC/POS commands for 48mm printers - LETRAS GRANDES
 */
export function formatThermalReceipt(invoice: InvoiceData): string {
    // Comandos ESC/POS para impresoras térmicas
    const ESC = '\x1B'
    const GS = '\x1D'
    
    // Comandos de formato - MEJORADOS PARA LETRAS MÁS GRANDES
    const INIT = ESC + '@'                    // Inicializar impresora
    const BOLD_ON = ESC + 'E' + '\x01'        // Negrita ON
    const BOLD_OFF = ESC + 'E' + '\x00'       // Negrita OFF
    const CENTER = ESC + 'a' + '\x01'         // Centrar texto
    const LEFT = ESC + 'a' + '\x00'           // Alinear izquierda
    const RIGHT = ESC + 'a' + '\x02'          // Alinear derecha
    const DOUBLE_HEIGHT = GS + '!' + '\x01'   // Doble altura
    const DOUBLE_WIDTH = GS + '!' + '\x10'    // Doble ancho
    const DOUBLE_SIZE = GS + '!' + '\x11'     // Doble altura + ancho
    const TRIPLE_SIZE = GS + '!' + '\x22'     // Triple tamaño
    const NORMAL_SIZE = GS + '!' + '\x00'     // Tamaño normal
    const LARGE_TEXT = GS + '!' + '\x01'      // Texto grande
    const CUT = GS + 'V' + '\x00'             // Cortar papel
    const FEED = '\n'                         // Salto de línea

    // Ancho reducido para acomodar letras más grandes
    const width = 24
    const line = '='.repeat(width)
    const divider = '-'.repeat(width)

    let receipt = INIT + CENTER + BOLD_ON + TRIPLE_SIZE

    // Header con formato MUY destacado
    receipt += `${invoice.sellerName.toUpperCase()}${FEED}`
    receipt += DOUBLE_HEIGHT + BOLD_OFF
    
    if (invoice.sellerAddress) {
        receipt += `${truncateText(invoice.sellerAddress, width)}${FEED}`
    }
    if (invoice.sellerTaxId) {
        receipt += `RUC: ${invoice.sellerTaxId}${FEED}`
    }
    if (invoice.sellerPhone) {
        receipt += `Tel: ${invoice.sellerPhone}${FEED}`
    }

    receipt += NORMAL_SIZE + `${line}${FEED}`
    receipt += BOLD_ON + DOUBLE_SIZE + `TICKET N°${FEED}${invoice.invoiceNumber}${FEED}` + NORMAL_SIZE + BOLD_OFF
    receipt += LARGE_TEXT + `${formatDate(new Date(invoice.date))}${FEED}`
    receipt += `${formatTime(new Date(invoice.date))}${FEED}` + NORMAL_SIZE
    receipt += `${line}${FEED}`

    // Cliente con texto grande
    if (invoice.customerName && invoice.customerName !== 'Cliente General') {
        receipt += LEFT + BOLD_ON + LARGE_TEXT + `CLIENTE:${FEED}` + NORMAL_SIZE + BOLD_OFF
        receipt += LARGE_TEXT + `${truncateText(invoice.customerName, width)}${FEED}` + NORMAL_SIZE
        if (invoice.customerTaxId) {
            receipt += LARGE_TEXT + `RUC: ${invoice.customerTaxId}${FEED}` + NORMAL_SIZE
        }
        receipt += `${divider}${FEED}`
    }

    // Items con texto más grande
    receipt += LEFT + BOLD_ON + LARGE_TEXT + `PRODUCTOS:${FEED}` + NORMAL_SIZE + BOLD_OFF
    
    invoice.items.forEach(item => {
        const itemName = truncateText(item.description, width)
        receipt += LARGE_TEXT + `${itemName}${FEED}` + NORMAL_SIZE
        
        const qty = item.quantity.toString()
        const price = formatCurrency(item.unitPrice)
        const subtotal = formatCurrency(item.subtotal)
        
        // Línea de cantidad x precio = subtotal con texto grande
        const qtyPriceLine = `${qty} x ${price}`
        const spaces = width - qtyPriceLine.length - subtotal.length
        receipt += LARGE_TEXT + `${qtyPriceLine}${' '.repeat(Math.max(0, spaces))}${subtotal}${FEED}` + NORMAL_SIZE
        
        if (item.discount > 0) {
            receipt += LARGE_TEXT + `  Desc: -${formatCurrency(item.discount)}${FEED}` + NORMAL_SIZE
        }
    })

    receipt += `${divider}${FEED}`

    // Totales con texto MUY grande
    receipt += RIGHT + LARGE_TEXT
    receipt += `SUBTOTAL:${FEED}${formatCurrency(invoice.subtotal)}${FEED}`

    if (invoice.discount > 0) {
        receipt += `DESCUENTO:${FEED}-${formatCurrency(invoice.discount)}${FEED}`
    }

    if (invoice.tax > 0) {
        receipt += `IVA:${FEED}${formatCurrency(invoice.tax)}${FEED}`
    }

    receipt += NORMAL_SIZE + CENTER + `${line}${FEED}`
    receipt += BOLD_ON + TRIPLE_SIZE + `TOTAL:${FEED}${formatCurrency(invoice.total)}${FEED}`
    receipt += NORMAL_SIZE + BOLD_OFF + `${line}${FEED}`

    // Información de pago con texto grande
    receipt += LEFT + LARGE_TEXT
    receipt += `PAGO:${FEED}${truncateText(invoice.paymentMethod, width - 6)}${FEED}`

    if (invoice.amountPaid > 0) {
        receipt += RIGHT + `PAGADO:${FEED}${formatCurrency(invoice.amountPaid)}${FEED}`
    }

    if (invoice.change && invoice.change > 0) {
        receipt += BOLD_ON + DOUBLE_SIZE + `CAMBIO:${FEED}${formatCurrency(invoice.change)}${FEED}` + NORMAL_SIZE + BOLD_OFF
    }

    // Footer con texto grande
    receipt += CENTER + NORMAL_SIZE + `${line}${FEED}`
    receipt += BOLD_ON + DOUBLE_HEIGHT + `¡GRACIAS POR${FEED}SU COMPRA!${FEED}` + NORMAL_SIZE + BOLD_OFF
    receipt += LARGE_TEXT + `Vuelva pronto${FEED}` + NORMAL_SIZE
    receipt += `${line}${FEED}`
    
    if (invoice.sellerEmail) {
        receipt += LARGE_TEXT + `${truncateText(invoice.sellerEmail, width)}${FEED}` + NORMAL_SIZE
    }
    
    receipt += LARGE_TEXT + `Soporte:${FEED}${invoice.sellerPhone || '123-456-7890'}${FEED}` + NORMAL_SIZE
    receipt += `${formatDate(new Date())} ${formatTime(new Date())}${FEED}`
    receipt += `${line}${FEED}${FEED}${FEED}`

    // Cortar papel
    receipt += CUT

    return receipt
}
export async function downloadInvoicePDF(invoice: InvoiceData): Promise<Blob | null> {
    try {
        // This would call a server endpoint to generate PDF
        // For now, we'll create an HTML blob
        const html = formatInvoiceHTML(invoice)
        const blob = new Blob([html], { type: 'text/html' })
        return blob
    } catch (error) {
        console.error('Error generating PDF:', error)
        return null
    }
}

/**
 * Send invoice via email (placeholder - requires server-side implementation)
 */
export async function sendInvoiceEmail(email: string, invoice: InvoiceData): Promise<boolean> {
    try {
        // This would call a server endpoint to send email
        console.log(`Sending invoice ${invoice.invoiceNumber} to ${email}`)
        return true
    } catch (error) {
        console.error('Error sending email:', error)
        return false
    }
}
/**
 * Thermal printer configuration for different paper sizes
 */
export interface ThermalPrinterConfig {
    width: number           // Characters per line
    paperSize: string      // Paper size description
    escCommands: boolean   // Use ESC/POS commands
    qrCode: boolean       // Include QR code
    logo: boolean         // Include logo space
}

export const THERMAL_CONFIGS: Record<string, ThermalPrinterConfig> = {
    '48mm': {
        width: 24,         // Reducido para letras más grandes
        paperSize: '48mm',
        escCommands: true,
        qrCode: true,
        logo: true
    },
    '48mm-small': {
        width: 32,         // Versión con letras más pequeñas
        paperSize: '48mm',
        escCommands: true,
        qrCode: true,
        logo: true
    },
    '58mm': {
        width: 32,         // Letras grandes para 58mm
        paperSize: '58mm', 
        escCommands: true,
        qrCode: true,
        logo: true
    },
    '80mm': {
        width: 40,         // Letras grandes para 80mm
        paperSize: '80mm',
        escCommands: true,
        qrCode: true,
        logo: true
    }
}

/**
 * Generate receipt for specific thermal printer configuration
 */
export function formatReceiptForPrinter(invoice: InvoiceData, printerSize: string = '48mm'): string {
    const config = THERMAL_CONFIGS[printerSize] || THERMAL_CONFIGS['48mm']
    
    if (config.escCommands) {
        return formatThermalReceiptWithConfig(invoice, config)
    } else {
        return formatReceiptTextWithConfig(invoice, config)
    }
}

/**
 * Generate thermal receipt with custom configuration - CON LETRAS GRANDES
 */
function formatThermalReceiptWithConfig(invoice: InvoiceData, config: ThermalPrinterConfig): string {
    const ESC = '\x1B'
    const GS = '\x1D'
    
    // Comandos mejorados para letras más grandes
    const INIT = ESC + '@'
    const BOLD_ON = ESC + 'E' + '\x01'
    const BOLD_OFF = ESC + 'E' + '\x00'
    const CENTER = ESC + 'a' + '\x01'
    const LEFT = ESC + 'a' + '\x00'
    const RIGHT = ESC + 'a' + '\x02'
    const DOUBLE_HEIGHT = GS + '!' + '\x01'
    const DOUBLE_WIDTH = GS + '!' + '\x10'
    const DOUBLE_SIZE = GS + '!' + '\x11'     // Doble altura + ancho
    const TRIPLE_SIZE = GS + '!' + '\x22'     // Triple tamaño
    const LARGE_TEXT = GS + '!' + '\x01'      // Texto grande
    const NORMAL_SIZE = GS + '!' + '\x00'
    const CUT = GS + 'V' + '\x00'
    const FEED = '\n'

    const width = config.width
    const line = '='.repeat(width)
    const divider = '-'.repeat(width)

    let receipt = INIT + CENTER + BOLD_ON + TRIPLE_SIZE

    // Logo space (if enabled)
    if (config.logo) {
        receipt += `${FEED}[LOGO AQUI]${FEED}${FEED}`
    }

    // Header con letras MUY grandes
    receipt += `${invoice.sellerName.toUpperCase()}${FEED}`
    receipt += DOUBLE_HEIGHT + BOLD_OFF
    
    if (invoice.sellerAddress) {
        receipt += `${truncateText(invoice.sellerAddress, width)}${FEED}`
    }
    if (invoice.sellerTaxId) {
        receipt += `RUC: ${invoice.sellerTaxId}${FEED}`
    }
    if (invoice.sellerPhone) {
        receipt += `Tel: ${invoice.sellerPhone}${FEED}`
    }

    receipt += NORMAL_SIZE + `${line}${FEED}`
    receipt += BOLD_ON + DOUBLE_SIZE + `TICKET N°${FEED}${invoice.invoiceNumber}${FEED}` + NORMAL_SIZE + BOLD_OFF
    receipt += LARGE_TEXT + `${formatDate(new Date(invoice.date))}${FEED}`
    receipt += `${formatTime(new Date(invoice.date))}${FEED}` + NORMAL_SIZE
    receipt += `${line}${FEED}`

    // Cliente con texto grande
    if (invoice.customerName && invoice.customerName !== 'Cliente General') {
        receipt += LEFT + BOLD_ON + LARGE_TEXT + `CLIENTE:${FEED}` + NORMAL_SIZE + BOLD_OFF
        receipt += LARGE_TEXT + `${truncateText(invoice.customerName, width)}${FEED}` + NORMAL_SIZE
        if (invoice.customerTaxId) {
            receipt += LARGE_TEXT + `RUC: ${invoice.customerTaxId}${FEED}` + NORMAL_SIZE
        }
        receipt += `${divider}${FEED}`
    }

    // Items con texto grande
    receipt += LEFT + BOLD_ON + LARGE_TEXT + `PRODUCTOS:${FEED}` + NORMAL_SIZE + BOLD_OFF
    
    invoice.items.forEach(item => {
        const itemName = truncateText(item.description, width)
        receipt += LARGE_TEXT + `${itemName}${FEED}` + NORMAL_SIZE
        
        const qty = item.quantity.toString()
        const price = formatCurrency(item.unitPrice)
        const subtotal = formatCurrency(item.subtotal)
        
        const qtyPriceLine = `${qty} x ${price}`
        const spaces = width - qtyPriceLine.length - subtotal.length
        receipt += LARGE_TEXT + `${qtyPriceLine}${' '.repeat(Math.max(0, spaces))}${subtotal}${FEED}` + NORMAL_SIZE
        
        if (item.discount > 0) {
            receipt += LARGE_TEXT + `  Desc: -${formatCurrency(item.discount)}${FEED}` + NORMAL_SIZE
        }
    })

    receipt += `${divider}${FEED}`

    // Totales con texto grande
    receipt += RIGHT + LARGE_TEXT
    receipt += `SUBTOTAL:${FEED}${formatCurrency(invoice.subtotal)}${FEED}`

    if (invoice.discount > 0) {
        receipt += `DESCUENTO:${FEED}-${formatCurrency(invoice.discount)}${FEED}`
    }

    if (invoice.tax > 0) {
        receipt += `IVA:${FEED}${formatCurrency(invoice.tax)}${FEED}`
    }

    receipt += NORMAL_SIZE + CENTER + `${line}${FEED}`
    receipt += BOLD_ON + TRIPLE_SIZE + `TOTAL:${FEED}${formatCurrency(invoice.total)}${FEED}`
    receipt += NORMAL_SIZE + BOLD_OFF + `${line}${FEED}`

    // Información de pago con texto grande
    receipt += LEFT + LARGE_TEXT
    receipt += `PAGO:${FEED}${truncateText(invoice.paymentMethod, width - 6)}${FEED}`

    if (invoice.amountPaid > 0) {
        receipt += RIGHT + `PAGADO:${FEED}${formatCurrency(invoice.amountPaid)}${FEED}`
    }

    if (invoice.change && invoice.change > 0) {
        receipt += BOLD_ON + DOUBLE_SIZE + `CAMBIO:${FEED}${formatCurrency(invoice.change)}${FEED}` + NORMAL_SIZE + BOLD_OFF
    }

    // QR Code (if enabled)
    if (config.qrCode) {
        receipt += CENTER + NORMAL_SIZE + `${divider}${FEED}`
        receipt += LARGE_TEXT + `CODIGO QR${FEED}` + NORMAL_SIZE
        receipt += `[QR CODE AQUI]${FEED}`
        receipt += LARGE_TEXT + `Hash: ${generateSimpleHash(invoice)}${FEED}` + NORMAL_SIZE
        receipt += `${divider}${FEED}`
    }

    // Footer con texto grande
    receipt += CENTER + `${line}${FEED}`
    receipt += BOLD_ON + DOUBLE_HEIGHT + `¡GRACIAS POR${FEED}SU COMPRA!${FEED}` + NORMAL_SIZE + BOLD_OFF
    receipt += LARGE_TEXT + `Vuelva pronto${FEED}` + NORMAL_SIZE
    receipt += `${line}${FEED}`
    
    if (invoice.sellerEmail) {
        receipt += LARGE_TEXT + `${truncateText(invoice.sellerEmail, width)}${FEED}` + NORMAL_SIZE
    }
    
    receipt += LARGE_TEXT + `Soporte:${FEED}${invoice.sellerPhone || '123-456-7890'}${FEED}` + NORMAL_SIZE
    receipt += `Papel: ${config.paperSize} | ${formatDate(new Date())}${FEED}`
    receipt += `${line}${FEED}${FEED}${FEED}`

    receipt += CUT

    return receipt
}

/**
 * Generate text receipt with custom configuration (no ESC/POS commands)
 */
function formatReceiptTextWithConfig(invoice: InvoiceData, config: ThermalPrinterConfig): string {
    const width = config.width
    const line = '='.repeat(width)
    const divider = '-'.repeat(width)
    const doubleLine = '█'.repeat(width)

    let receipt = `${doubleLine}
${centerText(invoice.sellerName.toUpperCase(), width)}
${invoice.sellerAddress ? centerText(truncateText(invoice.sellerAddress, width), width) : ''}
${invoice.sellerTaxId ? centerText(`RUC: ${invoice.sellerTaxId}`, width) : ''}
${invoice.sellerPhone ? centerText(`Tel: ${invoice.sellerPhone}`, width) : ''}
${line}
${centerText(`TICKET N° ${invoice.invoiceNumber}`, width)}
${centerText(formatDate(new Date(invoice.date)), width)}
${centerText(formatTime(new Date(invoice.date)), width)}
${line}`

    // Cliente
    if (invoice.customerName && invoice.customerName !== 'Cliente General') {
        receipt += `
CLIENTE: ${truncateText(invoice.customerName, width - 9)}
${invoice.customerTaxId ? `RUC: ${invoice.customerTaxId}` : ''}
${divider}`
    }

    // Items
    receipt += `
PRODUCTOS:`
    
    invoice.items.forEach(item => {
        const itemName = truncateText(item.description, width)
        const qty = item.quantity.toString()
        const price = formatCurrency(item.unitPrice)
        const subtotal = formatCurrency(item.subtotal)
        
        receipt += `
${itemName}
${qty} x ${price}${subtotal.padStart(width - qty.length - price.length - 3)}`
        
        if (item.discount > 0) {
            receipt += `
  Desc: -${formatCurrency(item.discount)}`
        }
    })

    receipt += `
${divider}`

    // Totales
    const subtotalLabel = 'SUBTOTAL:'
    const subtotalValue = formatCurrency(invoice.subtotal)
    receipt += `
${subtotalLabel}${subtotalValue.padStart(width - subtotalLabel.length)}`

    if (invoice.discount > 0) {
        const discountLabel = 'DESCUENTO:'
        const discountValue = `-${formatCurrency(invoice.discount)}`
        receipt += `
${discountLabel}${discountValue.padStart(width - discountLabel.length)}`
    }

    if (invoice.tax > 0) {
        const taxLabel = 'IVA:'
        const taxValue = formatCurrency(invoice.tax)
        receipt += `
${taxLabel}${taxValue.padStart(width - taxLabel.length)}`
    }

    receipt += `
${line}`

    // Total
    const totalLabel = 'TOTAL:'
    const totalValue = formatCurrency(invoice.total)
    receipt += `
${totalLabel}${totalValue.padStart(width - totalLabel.length)}
${line}`

    // Pago
    receipt += `
PAGO: ${truncateText(invoice.paymentMethod, width - 6)}`

    if (invoice.amountPaid > 0) {
        const paidLabel = 'PAGADO:'
        const paidValue = formatCurrency(invoice.amountPaid)
        receipt += `
${paidLabel}${paidValue.padStart(width - paidLabel.length)}`
    }

    if (invoice.change && invoice.change > 0) {
        const changeLabel = 'CAMBIO:'
        const changeValue = formatCurrency(invoice.change)
        receipt += `
${changeLabel}${changeValue.padStart(width - changeLabel.length)}`
    }

    // QR Code
    if (config.qrCode) {
        receipt += `
${divider}
${centerText('CODIGO QR VERIFICACION', width)}
${centerText('[QR CODE AQUI]', width)}
${centerText('Hash: ' + generateSimpleHash(invoice), width)}
${divider}`
    }

    // Footer
    receipt += `
${line}
${centerText('¡GRACIAS POR SU COMPRA!', width)}
${centerText('Vuelva pronto', width)}
${line}
${centerText('www.miempresa.com', width)}
${centerText('Papel: ' + config.paperSize, width)}
${doubleLine}


`

    return receipt
}

/**
 * Generate receipt with QR code placeholder for 48mm thermal printers
 */
export function formatReceiptWithQR(invoice: InvoiceData): string {
    const basicReceipt = formatReceiptText(invoice)
    const qrData = generateQRCodeData(invoice)
    const width = 32
    const line = '='.repeat(width)
    
    // Agregar información del QR al final del ticket
    const qrSection = `
${line}
${centerText('CODIGO QR PARA VERIFICACION', width)}
${centerText('[QR CODE AQUI]', width)}
${centerText('Escanea para verificar', width)}
${centerText('la autenticidad', width)}
${line}
Hash: ${generateSimpleHash(invoice)}
${line}


`
    
    return basicReceipt + qrSection
}

/**
 * Generate simple hash for invoice verification
 */
function generateSimpleHash(invoice: InvoiceData): string {
    const data = `${invoice.invoiceNumber}${invoice.date}${invoice.total}${invoice.sellerTaxId}`
    let hash = 0
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).toUpperCase().substring(0, 8)
}
/**
 * Generate receipt with EXTRA LARGE text for better readability
 */
export function formatReceiptLargeText(invoice: InvoiceData): string {
    // Ancho muy reducido para letras extra grandes (20 caracteres)
    const width = 20
    const line = '='.repeat(width)
    const divider = '-'.repeat(width)
    const doubleLine = '█'.repeat(width)

    let receipt = `${doubleLine}
${centerText(invoice.sellerName.toUpperCase(), width)}
${invoice.sellerAddress ? centerText(truncateText(invoice.sellerAddress, width), width) : ''}
${invoice.sellerTaxId ? centerText(`RUC: ${invoice.sellerTaxId}`, width) : ''}
${invoice.sellerPhone ? centerText(`Tel: ${invoice.sellerPhone}`, width) : ''}
${line}
${centerText(`TICKET N°`, width)}
${centerText(invoice.invoiceNumber, width)}
${centerText(formatDate(new Date(invoice.date)), width)}
${centerText(formatTime(new Date(invoice.date)), width)}
${line}`

    // Cliente (si existe)
    if (invoice.customerName && invoice.customerName !== 'Cliente General') {
        receipt += `
CLIENTE:
${truncateText(invoice.customerName, width)}
${invoice.customerTaxId ? `RUC: ${invoice.customerTaxId}` : ''}
${divider}`
    }

    // Items con formato extra grande
    receipt += `
PRODUCTOS:`
    
    invoice.items.forEach(item => {
        const itemName = truncateText(item.description, width)
        const qty = item.quantity.toString()
        const price = formatCurrency(item.unitPrice)
        const subtotal = formatCurrency(item.subtotal)
        
        receipt += `
${itemName}
${qty} x ${price}
${subtotal}`
        
        // Mostrar descuento si existe
        if (item.discount > 0) {
            receipt += `
Desc: -${formatCurrency(item.discount)}`
        }
        receipt += `
${divider}`
    })

    // Totales con formato extra grande
    receipt += `
SUBTOTAL:
${formatCurrency(invoice.subtotal)}`

    if (invoice.discount > 0) {
        receipt += `
DESCUENTO:
-${formatCurrency(invoice.discount)}`
    }

    if (invoice.tax > 0) {
        receipt += `
IVA:
${formatCurrency(invoice.tax)}`
    }

    receipt += `
${line}
TOTAL:
${formatCurrency(invoice.total)}
${line}`

    // Información de pago
    receipt += `
PAGO:
${truncateText(invoice.paymentMethod, width)}`

    if (invoice.amountPaid > 0) {
        receipt += `
PAGADO:
${formatCurrency(invoice.amountPaid)}`
    }

    if (invoice.change && invoice.change > 0) {
        receipt += `
CAMBIO:
${formatCurrency(invoice.change)}`
    }

    // Footer mejorado
    receipt += `
${line}
${centerText('¡GRACIAS POR', width)}
${centerText('SU COMPRA!', width)}
${centerText('Vuelva pronto', width)}
${line}
${centerText('Soporte:', width)}
${centerText('123-456-7890', width)}
${doubleLine}


`

    return receipt
}

/**
 * Generate thermal receipt with MAXIMUM text size
 */
export function formatThermalReceiptXL(invoice: InvoiceData): string {
    const ESC = '\x1B'
    const GS = '\x1D'
    
    // Comandos para texto EXTRA GRANDE
    const INIT = ESC + '@'
    const BOLD_ON = ESC + 'E' + '\x01'
    const BOLD_OFF = ESC + 'E' + '\x00'
    const CENTER = ESC + 'a' + '\x01'
    const LEFT = ESC + 'a' + '\x00'
    const RIGHT = ESC + 'a' + '\x02'
    const MEGA_SIZE = GS + '!' + '\x33'      // Tamaño máximo
    const TRIPLE_SIZE = GS + '!' + '\x22'    // Triple tamaño
    const DOUBLE_SIZE = GS + '!' + '\x11'    // Doble tamaño
    const LARGE_TEXT = GS + '!' + '\x01'     // Texto grande
    const NORMAL_SIZE = GS + '!' + '\x00'    // Tamaño normal
    const CUT = GS + 'V' + '\x00'
    const FEED = '\n'

    const width = 16  // Ancho muy reducido para texto extra grande
    const line = '='.repeat(width)

    let receipt = INIT + CENTER + BOLD_ON + MEGA_SIZE

    // Header con tamaño máximo
    receipt += `${truncateText(invoice.sellerName.toUpperCase(), width)}${FEED}`
    receipt += TRIPLE_SIZE
    
    if (invoice.sellerTaxId) {
        receipt += `RUC:${FEED}${invoice.sellerTaxId}${FEED}`
    }
    if (invoice.sellerPhone) {
        receipt += `Tel:${FEED}${invoice.sellerPhone}${FEED}`
    }

    receipt += DOUBLE_SIZE + `${line}${FEED}`
    receipt += `TICKET N°${FEED}`
    receipt += `${invoice.invoiceNumber}${FEED}`
    receipt += LARGE_TEXT + `${formatDate(new Date(invoice.date))}${FEED}`
    receipt += `${formatTime(new Date(invoice.date))}${FEED}`
    receipt += DOUBLE_SIZE + `${line}${FEED}`

    // Cliente
    if (invoice.customerName && invoice.customerName !== 'Cliente General') {
        receipt += LEFT + TRIPLE_SIZE + `CLIENTE:${FEED}`
        receipt += `${truncateText(invoice.customerName, width)}${FEED}`
        if (invoice.customerTaxId) {
            receipt += `RUC:${FEED}${invoice.customerTaxId}${FEED}`
        }
    }

    // Items con texto extra grande
    receipt += TRIPLE_SIZE + `PRODUCTOS:${FEED}`
    
    invoice.items.forEach(item => {
        const itemName = truncateText(item.description, width)
        receipt += `${itemName}${FEED}`
        
        const qty = item.quantity.toString()
        const price = formatCurrency(item.unitPrice)
        const subtotal = formatCurrency(item.subtotal)
        
        receipt += `${qty} x ${price}${FEED}`
        receipt += BOLD_ON + `${subtotal}${FEED}` + BOLD_OFF
        
        if (item.discount > 0) {
            receipt += `Desc:${FEED}-${formatCurrency(item.discount)}${FEED}`
        }
    })

    // Totales con tamaño máximo
    receipt += CENTER + TRIPLE_SIZE + `${line}${FEED}`
    receipt += `SUBTOTAL:${FEED}`
    receipt += BOLD_ON + `${formatCurrency(invoice.subtotal)}${FEED}` + BOLD_OFF

    if (invoice.discount > 0) {
        receipt += `DESCUENTO:${FEED}`
        receipt += BOLD_ON + `-${formatCurrency(invoice.discount)}${FEED}` + BOLD_OFF
    }

    if (invoice.tax > 0) {
        receipt += `IVA:${FEED}`
        receipt += BOLD_ON + `${formatCurrency(invoice.tax)}${FEED}` + BOLD_OFF
    }

    receipt += MEGA_SIZE + `${line}${FEED}`
    receipt += `TOTAL:${FEED}`
    receipt += `${formatCurrency(invoice.total)}${FEED}`
    receipt += TRIPLE_SIZE + `${line}${FEED}`

    // Pago
    receipt += `PAGO:${FEED}`
    receipt += `${truncateText(invoice.paymentMethod, width)}${FEED}`

    if (invoice.amountPaid > 0) {
        receipt += `PAGADO:${FEED}`
        receipt += BOLD_ON + `${formatCurrency(invoice.amountPaid)}${FEED}` + BOLD_OFF
    }

    if (invoice.change && invoice.change > 0) {
        receipt += `CAMBIO:${FEED}`
        receipt += BOLD_ON + MEGA_SIZE + `${formatCurrency(invoice.change)}${FEED}` + TRIPLE_SIZE + BOLD_OFF
    }

    // Footer
    receipt += `${line}${FEED}`
    receipt += `¡GRACIAS${FEED}POR SU${FEED}COMPRA!${FEED}`
    receipt += DOUBLE_SIZE + `Vuelva${FEED}pronto${FEED}`
    receipt += LARGE_TEXT + `${line}${FEED}`
    receipt += `Soporte:${FEED}`
    receipt += `${invoice.sellerPhone || '123-456-7890'}${FEED}`
    receipt += NORMAL_SIZE + `${line}${FEED}${FEED}${FEED}`

    receipt += CUT

    return receipt
}

/**
 * Generate receipt with LARGE TEXT for better visibility (48mm printer)
 */
export function formatReceiptLargeText(invoice: InvoiceData): string {
    const width = 32
    const line = '='.repeat(width)
    const divider = '-'.repeat(width)
    const doubleLine = '█'.repeat(width)
    const thickLine = '▓'.repeat(width)

    let receipt = `${doubleLine}
${centerText('╔' + '═'.repeat(width - 2) + '╗', width)}
${centerText('║ ' + invoice.sellerName.toUpperCase().substring(0, width - 4) + ' ║', width)}
${centerText('╚' + '═'.repeat(width - 2) + '╝', width)}
${invoice.sellerAddress ? centerText(truncateText(invoice.sellerAddress, width), width) : ''}
${invoice.sellerTaxId ? centerText(`RUC: ${invoice.sellerTaxId}`, width) : ''}
${thickLine}
${centerText('TICKET', width)}
${centerText(invoice.invoiceNumber, width)}
${thickLine}
${centerText(formatDate(new Date(invoice.date)), width)}
${centerText(formatTime(new Date(invoice.date)), width)}
${line}`

    // Cliente
    if (invoice.customerName && invoice.customerName !== 'Cliente General') {
        receipt += `
${divider}
CLIENTE:
${truncateText(invoice.customerName, width)}
${invoice.customerTaxId ? `RUC: ${invoice.customerTaxId}` : ''}
${divider}`
    }

    // Items con formato grande
    receipt += `
${thickLine}
PRODUCTOS:`
    
    invoice.items.forEach((item, index) => {
        receipt += `
${divider}
${index + 1}. ${truncateText(item.description, width - 3)}`
        
        const qty = `${item.quantity} x ${formatCurrency(item.unitPrice)}`
        const subtotal = formatCurrency(item.subtotal)
        const spaces = width - qty.length - subtotal.length
        
        receipt += `
${qty}${' '.repeat(Math.max(1, spaces))}${subtotal}`
        
        if (item.discount > 0) {
            receipt += `
   DESCUENTO: -${formatCurrency(item.discount)}`
        }
    })

    receipt += `
${thickLine}`

    // Totales con texto grande
    const subtotalLabel = 'SUBTOTAL:'
    const subtotalValue = formatCurrency(invoice.subtotal)
    receipt += `
${subtotalLabel}${subtotalValue.padStart(width - subtotalLabel.length)}`

    if (invoice.discount > 0) {
        const discountLabel = 'DESCUENTO TOTAL:'
        const discountValue = `-${formatCurrency(invoice.discount)}`
        receipt += `
${discountLabel}${discountValue.padStart(width - discountLabel.length)}`
    }

    if (invoice.tax > 0) {
        const taxLabel = 'IVA:'
        const taxValue = formatCurrency(invoice.tax)
        receipt += `
${taxLabel}${taxValue.padStart(width - taxLabel.length)}`
    }

    receipt += `
${thickLine}`

    // Total EXTRA GRANDE
    receipt += `
${centerText('╔' + '═'.repeat(width - 2) + '╗', width)}
${centerText('║  T O T A L  ║', width)}
${centerText('║ ' + formatCurrency(invoice.total).padStart(width - 4) + ' ║', width)}
${centerText('╚' + '═'.repeat(width - 2) + '╝', width)}
${thickLine}`

    // Información de pago
    receipt += `
PAGO: ${truncateText(invoice.paymentMethod, width - 6)}`

    if (invoice.amountPaid > 0) {
        const paidLabel = 'PAGADO:'
        const paidValue = formatCurrency(invoice.amountPaid)
        receipt += `
${paidLabel}${paidValue.padStart(width - paidLabel.length)}`
    }

    if (invoice.change && invoice.change > 0) {
        receipt += `
${divider}`
        const changeLabel = 'CAMBIO:'
        const changeValue = formatCurrency(invoice.change)
        receipt += `
${changeLabel}${changeValue.padStart(width - changeLabel.length)}
${divider}`
    }

    // Footer
    receipt += `
${thickLine}
${centerText('¡GRACIAS POR SU COMPRA!', width)}
${centerText('═'.repeat(width), width)}
${centerText('Vuelva Pronto', width)}
${thickLine}
${centerText(invoice.sellerPhone || '123-456-7890', width)}
${centerText('www.miempresa.com', width)}
${doubleLine}


`

    return receipt
}

/**
 * Generate thermal receipt with EXTRA LARGE text using ESC/POS commands
 */
export function formatThermalReceiptXL(invoice: InvoiceData): string {
    const ESC = '\x1B'
    const GS = '\x1D'
    
    const INIT = ESC + '@'
    const BOLD_ON = ESC + 'E' + '\x01'
    const BOLD_OFF = ESC + 'E' + '\x00'
    const CENTER = ESC + 'a' + '\x01'
    const LEFT = ESC + 'a' + '\x00'
    const RIGHT = ESC + 'a' + '\x02'
    const DOUBLE_HEIGHT = GS + '!' + '\x01'
    const DOUBLE_WIDTH = GS + '!' + '\x10'
    const DOUBLE_BOTH = GS + '!' + '\x11'      // Doble ancho y alto
    const TRIPLE_SIZE = GS + '!' + '\x22'      // Triple tamaño
    const NORMAL_SIZE = GS + '!' + '\x00'
    const CUT = GS + 'V' + '\x00'
    const FEED = '\n'

    const width = 32
    const line = '='.repeat(width)
    const divider = '-'.repeat(width)

    let receipt = INIT + CENTER + BOLD_ON + TRIPLE_SIZE

    // Header EXTRA GRANDE
    receipt += `${invoice.sellerName.toUpperCase().substring(0, 16)}${FEED}`
    receipt += NORMAL_SIZE + BOLD_OFF
    
    if (invoice.sellerAddress) {
        receipt += `${truncateText(invoice.sellerAddress, width)}${FEED}`
    }
    if (invoice.sellerTaxId) {
        receipt += `RUC: ${invoice.sellerTaxId}${FEED}`
    }

    receipt += `${line}${FEED}`
    receipt += BOLD_ON + DOUBLE_BOTH + `TICKET${FEED}`
    receipt += `${invoice.invoiceNumber}${FEED}`
    receipt += NORMAL_SIZE + BOLD_OFF
    receipt += `${formatDate(new Date(invoice.date))}${FEED}`
    receipt += `${formatTime(new Date(invoice.date))}${FEED}`
    receipt += `${line}${FEED}`

    // Cliente
    if (invoice.customerName && invoice.customerName !== 'Cliente General') {
        receipt += LEFT + BOLD_ON + DOUBLE_HEIGHT + `CLIENTE:${FEED}` + NORMAL_SIZE + BOLD_OFF
        receipt += `${truncateText(invoice.customerName, width)}${FEED}`
        if (invoice.customerTaxId) {
            receipt += `RUC: ${invoice.customerTaxId}${FEED}`
        }
        receipt += `${divider}${FEED}`
    }

    // Items
    receipt += LEFT + BOLD_ON + DOUBLE_HEIGHT + `PRODUCTOS:${FEED}` + NORMAL_SIZE + BOLD_OFF
    
    invoice.items.forEach((item, index) => {
        receipt += `${divider}${FEED}`
        receipt += BOLD_ON + `${index + 1}. ${truncateText(item.description, width - 3)}${FEED}` + BOLD_OFF
        
        const qty = item.quantity.toString()
        const price = formatCurrency(item.unitPrice)
        const subtotal = formatCurrency(item.subtotal)
        
        const qtyPriceLine = `${qty} x ${price}`
        const spaces = width - qtyPriceLine.length - subtotal.length
        receipt += `${qtyPriceLine}${' '.repeat(Math.max(1, spaces))}${subtotal}${FEED}`
        
        if (item.discount > 0) {
            receipt += `  Desc: -${formatCurrency(item.discount)}${FEED}`
        }
    })

    receipt += `${line}${FEED}`

    // Totales
    receipt += RIGHT + BOLD_ON
    receipt += `SUBTOTAL: ${formatCurrency(invoice.subtotal)}${FEED}`

    if (invoice.discount > 0) {
        receipt += `DESCUENTO: -${formatCurrency(invoice.discount)}${FEED}`
    }

    if (invoice.tax > 0) {
        receipt += `IVA: ${formatCurrency(invoice.tax)}${FEED}`
    }

    receipt += BOLD_OFF + CENTER + `${line}${FEED}`

    // Total EXTRA GRANDE
    receipt += BOLD_ON + TRIPLE_SIZE
    receipt += `TOTAL${FEED}`
    receipt += `${formatCurrency(invoice.total)}${FEED}`
    receipt += NORMAL_SIZE + BOLD_OFF
    receipt += `${line}${FEED}`

    // Información de pago
    receipt += LEFT + DOUBLE_HEIGHT + BOLD_ON
    receipt += `PAGO:${FEED}`
    receipt += NORMAL_SIZE + BOLD_OFF
    receipt += `${truncateText(invoice.paymentMethod, width)}${FEED}`

    if (invoice.amountPaid > 0) {
        receipt += RIGHT + BOLD_ON
        receipt += `PAGADO: ${formatCurrency(invoice.amountPaid)}${FEED}`
        receipt += BOLD_OFF
    }

    if (invoice.change && invoice.change > 0) {
        receipt += `${divider}${FEED}`
        receipt += DOUBLE_HEIGHT + BOLD_ON
        receipt += `CAMBIO: ${formatCurrency(invoice.change)}${FEED}`
        receipt += NORMAL_SIZE + BOLD_OFF
        receipt += `${divider}${FEED}`
    }

    // Footer
    receipt += CENTER + `${line}${FEED}`
    receipt += BOLD_ON + DOUBLE_BOTH
    receipt += `¡GRACIAS!${FEED}`
    receipt += NORMAL_SIZE + BOLD_OFF
    receipt += `Vuelva Pronto${FEED}`
    receipt += `${line}${FEED}`
    
    if (invoice.sellerPhone) {
        receipt += `Tel: ${invoice.sellerPhone}${FEED}`
    }
    
    receipt += `www.miempresa.com${FEED}`
    receipt += `${formatDate(new Date())} ${formatTime(new Date())}${FEED}`
    receipt += `${line}${FEED}${FEED}${FEED}`

    receipt += CUT

    return receipt
}
