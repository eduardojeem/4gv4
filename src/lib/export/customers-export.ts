import { Customer } from '@/hooks/use-customer-state'

/**
 * Customer Export Utilities
 * 
 * Functions for exporting customer data to various formats
 */

/**
 * Convert customers array to CSV format
 */
export function customersToCSV(customers: Customer[]): string {
  if (customers.length === 0) {
    return ''
  }

  // Define CSV headers
  const headers = [
    'ID',
    'Código',
    'Nombre',
    'Email',
    'Teléfono',
    'RUC',
    'Tipo',
    'Estado',
    'Segmento',
    'Dirección',
    'Ciudad',
    'Compras Totales',
    'Reparaciones Totales',
    'Valor de Vida',
    'Valor Promedio Orden',
    'Puntuación Crédito',
    'Puntuación Satisfacción',
    'Puntos Lealtad',
    'Límite Crédito',
    'Balance Actual',
    'Monto Pendiente',
    'Descuento %',
    'Términos Pago',
    'Frecuencia Compra',
    'Contacto Preferido',
    'Fecha Registro',
    'Última Visita',
    'Última Actividad',
    'Cumpleaños',
    'Vendedor Asignado',
    'Fuente Referencia',
    'Última Compra',
    'Total Gastado Este Año',
    'WhatsApp',
    'Redes Sociales',
    'Empresa',
    'Cargo',
    'Etiquetas',
    'Notas'
  ]

  // Convert customers to CSV rows
  const rows = customers.map(customer => [
    escapeCSV(customer.id),
    escapeCSV(customer.customerCode),
    escapeCSV(customer.name),
    escapeCSV(customer.email),
    escapeCSV(customer.phone),
    escapeCSV(customer.ruc || ''),
    escapeCSV(customer.customer_type),
    escapeCSV(customer.status),
    escapeCSV(customer.segment),
    escapeCSV(customer.address),
    escapeCSV(customer.city),
    customer.total_purchases,
    customer.total_repairs,
    customer.lifetime_value,
    customer.avg_order_value,
    customer.credit_score,
    customer.satisfaction_score,
    customer.loyalty_points,
    customer.credit_limit,
    customer.current_balance,
    customer.pending_amount,
    customer.discount_percentage,
    escapeCSV(customer.payment_terms),
    escapeCSV(customer.purchase_frequency),
    escapeCSV(customer.preferred_contact),
    escapeCSV(customer.registration_date),
    escapeCSV(customer.last_visit),
    escapeCSV(customer.last_activity),
    escapeCSV(customer.birthday || ''),
    escapeCSV(customer.assigned_salesperson),
    escapeCSV(customer.referral_source),
    customer.last_purchase_amount,
    customer.total_spent_this_year,
    escapeCSV(customer.whatsapp || ''),
    escapeCSV(customer.social_media || ''),
    escapeCSV(customer.company || ''),
    escapeCSV(customer.position || ''),
    escapeCSV(customer.tags.join('; ')),
    escapeCSV(customer.notes)
  ])

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  return csvContent
}

/**
 * Escape special characters in CSV fields
 */
function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)

  // If the value contains comma, quote, or newline, wrap it in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string = 'customers.csv'): void {
  // Add BOM for Excel UTF-8 support
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Clean up the URL object
  URL.revokeObjectURL(url)
}

/**
 * Export customers to CSV and download
 */
export function exportCustomersToCSV(
  customers: Customer[],
  filename?: string
): { success: boolean; error?: string } {
  try {
    if (customers.length === 0) {
      return {
        success: false,
        error: 'No hay clientes para exportar'
      }
    }

    const csvContent = customersToCSV(customers)
    const timestamp = new Date().toISOString().split('T')[0]
    const defaultFilename = `clientes_${timestamp}.csv`
    
    downloadCSV(csvContent, filename || defaultFilename)

    return { success: true }
  } catch (error: any) {
    console.error('Error exporting customers to CSV:', error)
    return {
      success: false,
      error: error.message || 'Error al exportar clientes'
    }
  }
}

/**
 * Convert customers to Excel-compatible format (TSV)
 * Excel can open TSV files directly
 */
export function customersToTSV(customers: Customer[]): string {
  const csvContent = customersToCSV(customers)
  // Replace commas with tabs
  return csvContent.replace(/,/g, '\t')
}

/**
 * Export customers to Excel format (TSV) and download
 */
export function exportCustomersToExcel(
  customers: Customer[],
  filename?: string
): { success: boolean; error?: string } {
  try {
    if (customers.length === 0) {
      return {
        success: false,
        error: 'No hay clientes para exportar'
      }
    }

    const tsvContent = customersToTSV(customers)
    const timestamp = new Date().toISOString().split('T')[0]
    const defaultFilename = `clientes_${timestamp}.xls`
    
    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename || defaultFilename)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)

    return { success: true }
  } catch (error: any) {
    console.error('Error exporting customers to Excel:', error)
    return {
      success: false,
      error: error.message || 'Error al exportar clientes'
    }
  }
}

/**
 * Export customers to JSON and download
 */
export function exportCustomersToJSON(
  customers: Customer[],
  filename?: string
): { success: boolean; error?: string } {
  try {
    if (customers.length === 0) {
      return {
        success: false,
        error: 'No hay clientes para exportar'
      }
    }

    const jsonContent = JSON.stringify(customers, null, 2)
    const timestamp = new Date().toISOString().split('T')[0]
    const defaultFilename = `clientes_${timestamp}.json`
    
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
    
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename || defaultFilename)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)

    return { success: true }
  } catch (error: any) {
    console.error('Error exporting customers to JSON:', error)
    return {
      success: false,
      error: error.message || 'Error al exportar clientes'
    }
  }
}

/**
 * Get export statistics
 */
export function getExportStats(customers: Customer[]): {
  total: number
  active: number
  inactive: number
  premium: number
  regular: number
  totalValue: number
} {
  return {
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    inactive: customers.filter(c => c.status === 'inactive').length,
    premium: customers.filter(c => c.customer_type === 'premium').length,
    regular: customers.filter(c => c.customer_type === 'regular').length,
    totalValue: customers.reduce((sum, c) => sum + c.lifetime_value, 0)
  }
}
