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
 * Generate QR code data for invoice
 */
export function generateQRCodeData(invoice: InvoiceData): string {
    // Format: Invoice Number|Date|Total|Tax ID
    return `${invoice.invoiceNumber}|${invoice.date}|${invoice.total}|${invoice.sellerTaxId || 'N/A'}`
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
 * Generate simple receipt (ticket térmico)
 */
export function formatReceiptText(invoice: InvoiceData): string {
    const width = 40
    const line = '='.repeat(width)
    const divider = '-'.repeat(width)

    let receipt = `
${line}
${centerText(invoice.sellerName, width)}
${invoice.sellerAddress ? centerText(invoice.sellerAddress, width) : ''}
${invoice.sellerTaxId ? centerText(`RUC: ${invoice.sellerTaxId}`, width) : ''}
${line}
${centerText(`TICKET N° ${invoice.invoiceNumber}`, width)}
${centerText(new Date(invoice.date).toLocaleString('es'), width)}
${line}
`

    // Items
    invoice.items.forEach(item => {
        receipt += `${item.description}\n`
        receipt += `${item.quantity} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.subtotal).padStart(12)}\n`
    })

    receipt += `${divider}
SUBTOTAL:${formatCurrency(invoice.subtotal).padStart(width - 9)}
`

    if (invoice.discount > 0) {
        receipt += `DESCUENTO:${formatCurrency(invoice.discount).padStart(width - 10)}\n`
    }

    if (invoice.tax > 0) {
        receipt += `IVA:${formatCurrency(invoice.tax).padStart(width - 4)}\n`
    }

    receipt += `${line}
TOTAL:${formatCurrency(invoice.total).padStart(width - 6)}
${line}
PAGO: ${invoice.paymentMethod}
`

    if (invoice.change && invoice.change > 0) {
        receipt += `CAMBIO:${formatCurrency(invoice.change).padStart(width - 7)}\n`
    }

    receipt += `${line}
${centerText('¡Gracias por su compra!', width)}
${line}
`

    return receipt
}

function centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2))
    return ' '.repeat(padding) + text
}

/**
 * Download invoice as PDF (placeholder - requires server-side implementation)
 */
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
