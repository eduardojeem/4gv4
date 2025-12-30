import { Customer } from '@/hooks/use-customer-state'

// Utility functions for exporting customer data

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf'
  fields?: string[]
  filename?: string
  includeHeaders?: boolean
}

export const exportFields = {
  basic: ['name', 'email', 'phone', 'status', 'customer_type'],
  contact: ['name', 'email', 'phone', 'address', 'city', 'whatsapp'],
  financial: ['name', 'lifetime_value', 'avg_order_value', 'total_purchases', 'credit_limit', 'current_balance'],
  complete: [
    'customerCode', 'name', 'email', 'phone', 'ruc', 'customer_type', 'status',
    'total_purchases', 'total_repairs', 'registration_date', 'last_visit',
    'address', 'city', 'credit_score', 'segment', 'satisfaction_score',
    'lifetime_value', 'avg_order_value', 'purchase_frequency', 'preferred_contact',
    'birthday', 'loyalty_points', 'credit_limit', 'current_balance', 'pending_amount',
    'assigned_salesperson', 'last_purchase_amount', 'total_spent_this_year'
  ]
}

export const fieldLabels: Record<string, string> = {
  customerCode: 'Código Cliente',
  name: 'Nombre',
  email: 'Email',
  phone: 'Teléfono',
  ruc: 'RUC',
  customer_type: 'Tipo Cliente',
  status: 'Estado',
  total_purchases: 'Total Compras',
  total_repairs: 'Total Reparaciones',
  registration_date: 'Fecha Registro',
  last_visit: 'Última Visita',
  last_activity: 'Última Actividad',
  address: 'Dirección',
  city: 'Ciudad',
  credit_score: 'Puntuación Crédito',
  segment: 'Segmento',
  satisfaction_score: 'Satisfacción',
  lifetime_value: 'Valor de Vida',
  avg_order_value: 'Valor Promedio Pedido',
  purchase_frequency: 'Frecuencia Compra',
  preferred_contact: 'Contacto Preferido',
  birthday: 'Cumpleaños',
  loyalty_points: 'Puntos Lealtad',
  credit_limit: 'Límite Crédito',
  current_balance: 'Balance Actual',
  pending_amount: 'Monto Pendiente',
  notes: 'Notas',
  whatsapp: 'WhatsApp',
  social_media: 'Redes Sociales',
  company: 'Empresa',
  position: 'Cargo',
  referral_source: 'Fuente Referencia',
  discount_percentage: 'Descuento %',
  payment_terms: 'Términos Pago',
  assigned_salesperson: 'Vendedor Asignado',
  last_purchase_amount: 'Último Monto Compra',
  total_spent_this_year: 'Total Gastado Este Año'
}

// CSV Export
export function exportToCSV(customers: Customer[], options: ExportOptions = { format: 'csv' }): void {
  const fields = options.fields || exportFields.complete
  const includeHeaders = options.includeHeaders !== false
  
  let csvContent = ''
  
  // Add headers
  if (includeHeaders) {
    const headers = fields.map(field => fieldLabels[field] || field)
    csvContent += headers.join(',') + '\n'
  }
  
  // Add data rows
  customers.forEach(customer => {
    const row = fields.map(field => {
      const value = customer[field as keyof Customer]
      if (value === null || value === undefined) return ''
      
      // Handle arrays (like tags)
      if (Array.isArray(value)) {
        return `"${value.join('; ')}"`
      }
      
      // Handle strings with commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      
      return String(value)
    })
    csvContent += row.join(',') + '\n'
  })
  
  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', options.filename || `clientes_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Excel Export (using a simple approach with CSV format but .xlsx extension)
export function exportToExcel(customers: Customer[], options: ExportOptions = { format: 'excel' }): void {
  // For a more robust Excel export, you would use libraries like xlsx or exceljs
  // For now, we'll use CSV format with Excel-compatible formatting
  
  const fields = options.fields || exportFields.complete
  const includeHeaders = options.includeHeaders !== false
  
  let content = ''
  
  // Add headers
  if (includeHeaders) {
    const headers = fields.map(field => fieldLabels[field] || field)
    content += headers.join('\t') + '\n'
  }
  
  // Add data rows (using tabs for Excel compatibility)
  customers.forEach(customer => {
    const row = fields.map(field => {
      const value = customer[field as keyof Customer]
      if (value === null || value === undefined) return ''
      
      // Handle arrays
      if (Array.isArray(value)) {
        return value.join('; ')
      }
      
      return String(value)
    })
    content += row.join('\t') + '\n'
  })
  
  // Download file
  const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', options.filename || `clientes_${new Date().toISOString().split('T')[0]}.xlsx`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// PDF Export (basic implementation)
export function exportToPDF(customers: Customer[], options: ExportOptions = { format: 'pdf' }): void {
  const fields = options.fields || exportFields.basic
  
  // Create HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Lista de Clientes</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .header { text-align: center; margin-bottom: 20px; }
        .date { color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Lista de Clientes</h1>
        <p class="date">Generado el: ${new Date().toLocaleDateString('es-ES')}</p>
      </div>
      <table>
        <thead>
          <tr>
            ${fields.map(field => `<th>${fieldLabels[field] || field}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${customers.map(customer => `
            <tr>
              ${fields.map(field => {
                const value = customer[field as keyof Customer]
                if (value === null || value === undefined) return '<td></td>'
                if (Array.isArray(value)) return `<td>${value.join(', ')}</td>`
                return `<td>${String(value)}</td>`
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `
  
  // Open in new window for printing/saving as PDF
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()
    
    // Auto-trigger print dialog
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
}

// Main export function
export function exportCustomers(customers: Customer[], options: ExportOptions): void {
  switch (options.format) {
    case 'csv':
      exportToCSV(customers, options)
      break
    case 'excel':
      exportToExcel(customers, options)
      break
    case 'pdf':
      exportToPDF(customers, options)
      break
    default:
      throw new Error(`Formato de exportación no soportado: ${options.format}`)
  }
}

// Utility to get export statistics
export function getExportStats(customers: Customer[], selectedFields?: string[]): {
  totalRecords: number
  selectedFields: number
  estimatedSize: string
  active: number
  inactive: number
  premium: number
  empresa: number
  regular: number
} {
  const fieldCount = selectedFields ? selectedFields.length : exportFields.complete.length
  const estimatedSizeKB = Math.round((customers.length * fieldCount * 20) / 1024) // Rough estimate
  
  return {
    totalRecords: customers.length,
    selectedFields: fieldCount,
    estimatedSize: estimatedSizeKB > 1024 ? `${(estimatedSizeKB / 1024).toFixed(1)} MB` : `${estimatedSizeKB} KB`,
    active: customers.filter(c => c.status === 'active').length,
    inactive: customers.filter(c => c.status === 'inactive').length,
    premium: customers.filter(c => c.customer_type === 'premium').length,
    empresa: customers.filter(c => c.customer_type === 'empresa').length,
    regular: customers.filter(c => c.customer_type === 'regular').length
  }
}