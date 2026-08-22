import { describe, expect, it } from 'vitest'

import { generatePrintHTML, type CompanyInfo } from '@/lib/receipt-utils'
import { buildReprintReceiptData, type StoredSale } from './sale-receipt'

const sale: StoredSale = {
  id: '8f0c631c-06c2-4fb3-b253-06b8eb695752',
  code: 'VTA-000123',
  createdAt: '2026-08-10T14:35:00.000Z',
  subtotal: 100_000,
  tax: 0,
  discount: 0,
  total: 100_000,
  paymentMethod: 'efectivo',
  customer: null,
  items: [{ id: 'i1', name: 'Cargador', sku: 'CAR-01', quantity: 1, unitPrice: 100_000 }],
}

const company: CompanyInfo = {
  name: 'Mi Empresa',
  address: 'Asunción',
  phone: '021',
  email: 'a@b.com',
}

const html = (companyInfo: CompanyInfo) =>
  generatePrintHTML(buildReprintReceiptData(sale), companyInfo)

describe('logo del ticket', () => {
  // El bug reportado: el logo nunca se imprimía. La plantilla solo dibujaba un
  // monograma de dos letras y CompanyInfo ni siquiera declaraba el logo.
  it('draws the organization logo when one is configured', () => {
    const output = html({ ...company, logoUrl: 'https://cdn.example.com/logo.png' })
    expect(output).toContain('<img src="https://cdn.example.com/logo.png"')
    expect(output).toContain('class="logo-img"')
  })

  it('falls back to the two-letter monogram when there is no logo', () => {
    const output = html(company)
    // La clase vive siempre en la hoja de estilos: lo que no debe existir es la
    // etiqueta de imagen.
    expect(output).not.toContain('<img')
    expect(output).toContain('>MI<')
  })

  // La ventana de impresión es about:blank: una ruta relativa no resuelve.
  it('absolutizes a relative logo path', () => {
    const output = html({ ...company, logoUrl: '/uploads/logo.png' })
    expect(output).toContain(`<img src="${window.location.origin}/uploads/logo.png"`)
  })

  it('leaves data and blob urls untouched', () => {
    expect(html({ ...company, logoUrl: 'data:image/png;base64,AAA' }))
      .toContain('<img src="data:image/png;base64,AAA"')
  })

  it('applies the monochrome filter for thermal printers when asked', () => {
    const output = html({ ...company, logoUrl: 'https://cdn.example.com/logo.png', monochromeLogo: true })
    expect(output).toContain('grayscale(100%)')
  })

  // Sin print-color-adjust el navegador descarta fondos e imágenes al imprimir,
  // que es la otra mitad de por qué no salía nada.
  it('keeps backgrounds and images alive in the print stylesheet', () => {
    const output = html(company)
    expect(output).toContain('print-color-adjust: exact')
    expect(output).toContain('-webkit-print-color-adjust: exact')
  })

  it('marks a reprint on the printed ticket', () => {
    expect(html(company)).toContain('REIMPRESIÓN')
  })
})
