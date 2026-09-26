import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('reports customers tab functionality & design', () => {
  const reportsSource = readFileSync(resolve(process.cwd(), 'src/components/admin/reports/operational-reports.tsx'), 'utf8')
  const tabSource = readFileSync(resolve(process.cwd(), 'src/components/reports/ReportsCustomersTab.tsx'), 'utf8')

  it('connects ReportsCustomersTab with customersReportData in operational-reports', () => {
    expect(reportsSource).toContain('ReportsCustomersTab')
    expect(reportsSource).toContain('customersReportData={customersReportData}')
    expect(reportsSource).toContain('setCustomersReportData')
  })

  it('queries both POS sales and Web customer_orders to track omnichannel behavior', () => {
    expect(reportsSource).toContain(".from('sales')")
    expect(reportsSource).toContain(".from('customer_orders')")
    expect(reportsSource).toContain('posSpent')
    expect(reportsSource).toContain('webSpent')
    expect(reportsSource).toContain('posOrdersCount')
    expect(reportsSource).toContain('webOrdersCount')
    expect(reportsSource).toContain("channel: 'pos' | 'web' | 'both'")
  })

  it('provides comprehensive search, filters, channel distinction and exports in ReportsCustomersTab', () => {
    expect(tabSource).toContain('searchQuery')
    expect(tabSource).toContain('channelFilter')
    expect(tabSource).toContain('channelStats')
    expect(tabSource).toContain('handleExportCsv')
    expect(tabSource).toContain('handleExportPdf')
    expect(tabSource).toContain('Descargar CSV')
    expect(tabSource).toContain('Descargar PDF')
    expect(tabSource).toContain('Ranking de Compradores')
    expect(tabSource).toContain('recurrent')
  })

  it('renders channel breakdown cards for Local, Web and Omnicanal', () => {
    expect(tabSource).toContain('Canal Local / POS')
    expect(tabSource).toContain('Canal Tienda Web')
    expect(tabSource).toContain('Clientes Omnicanal')
    expect(tabSource).toContain('Omnicanal (Ambos)')
  })

  it('computes top buyer ranking and relative progress', () => {
    expect(tabSource).toContain('topCustomer')
    expect(tabSource).toContain('Cliente #1 del Período')
    expect(tabSource).toContain('maxCustomerSales')
    expect(tabSource).toContain('widthPct')
  })

  it('provides WhatsApp contact link when customer phone is available', () => {
    expect(tabSource).toContain('https://wa.me/')
    expect(tabSource).toContain('cleanPhone')
  })

  it('has dedicated customer PDF exporter module', () => {
    const pdfExporterPath = resolve(process.cwd(), 'src/lib/reports/customer-pdf-exporter.ts')
    expect(existsSync(pdfExporterPath)).toBe(true)
    const exporterSource = readFileSync(pdfExporterPath, 'utf8')
    expect(exporterSource).toContain('exportCustomersSectionPDF')
    expect(exporterSource).toContain('Reporte de Comportamiento de Clientes y Canales de Venta')
    expect(exporterSource).toContain('Canal Local (POS)')
    expect(exporterSource).toContain('Canal Web (Online)')
  })
})
