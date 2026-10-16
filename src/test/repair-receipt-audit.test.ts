import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_RECEIPT_SETTINGS,
  generateRepairShareText,
  printRepairReceipt,
  type RepairPrintPayload,
  type RepairReceiptSettings,
  type RepairReceiptType,
} from '@/lib/repair-receipt'
import { generatePrintHTML } from '@/lib/receipt-utils'

const orden = (extra: Partial<RepairPrintPayload> = {}): RepairPrintPayload => ({
  ticketNumber: 'R-1',
  date: new Date('2026-10-15T15:00:00.000Z'),
  customer: { name: 'Ana' },
  devices: [{ typeLabel: 'Celular', brand: 'Samsung', model: 'A54', issue: 'Pantalla', estimatedCost: 300_000 }],
  ...extra,
})

function imprimir(
  payload: RepairPrintPayload,
  settings: Partial<RepairReceiptSettings> = {},
  type: RepairReceiptType = 'customer',
) {
  let html = ''
  vi.spyOn(window, 'open').mockReturnValue({
    document: { write: (h: string) => { html = h }, close: () => {} },
    closed: false,
    focus: () => {},
  } as unknown as Window)
  printRepairReceipt(type, payload, '80mm', { ...DEFAULT_RECEIPT_SETTINGS, ...settings })
  return html
}

afterEach(() => vi.restoreAllMocks())

describe('comprobante de reparación', () => {
  it('escapa los datos que carga la gente', () => {
    const html = imprimir(orden({ customer: { name: '<img src=x onerror=alert(1)>' } }))
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('con varios equipos muestra sus números reales y no inventa uno', () => {
    const html = imprimir(orden({
      ticketNumber: undefined,
      devices: [
        { typeLabel: 'Celular', brand: 'Samsung', model: 'A54', issue: 'Pantalla', ticketNumber: 'R-10' },
        { typeLabel: 'Tablet', brand: 'Apple', model: 'iPad', issue: 'Batería', ticketNumber: 'R-11' },
      ],
    }))
    expect(html).toContain('Órdenes N° R-10, R-11')
    expect(html).not.toMatch(/R-\d{6}-\d{6}/)
  })

  it('sin presupuesto no dice «saldo Gs. 0»', () => {
    const html = imprimir(orden({ devices: [{ typeLabel: 'Celular', brand: 'Samsung', model: 'A54', issue: 'No enciende' }] }))
    expect(html).toContain('A definir tras el diagnóstico')
    expect(html).not.toContain('Saldo al retirar')
    expect(generateRepairShareText(orden({ devices: [{ typeLabel: 'Celular', brand: 'X', model: 'Y', issue: 'Z' }] })))
      .toContain('a definir tras el diagnóstico')
  })

  it('no repite cláusulas que el texto ya trata con otras palabras', () => {
    const html = imprimir(orden({ warrantyMonths: 3, warrantyType: 'labor', warrantyNotes: 'No cubre daños por humedad.' }), {
      legalText: 'Pasados 60 días el equipo se considera en abandono legal.',
    })
    expect(html).not.toContain('golpes, caídas ni daños por líquidos')
    expect(html).not.toContain('Pasados 90 días')
    expect(html).toContain('Es indispensable presentar este comprobante')
  })

  it('el plazo de abandono se configura y con 0 no se imprime', () => {
    expect(imprimir(orden(), { abandonmentDays: 45 })).toContain('Pasados 45 días')
    expect(imprimir(orden(), { abandonmentDays: 0 })).not.toContain('abandonado')
  })

  it('un texto legal vacío no vuelve al de fábrica', () => {
    const html = imprimir(orden(), { legalText: '' })
    expect(html).not.toContain('class="legal-text"')
    expect(html).not.toContain('Autorizo la revisión')
  })

  it('la ficha completa lleva la clave en un talón para cortar', () => {
    const html = imprimir(orden({
      devices: [{ typeLabel: 'Celular', brand: 'Samsung', model: 'A54', issue: 'Pantalla', accessType: 'pin', accessPassword: '4321' }],
    }), {}, 'technician_detailed')
    const talon = html.indexOf('CORTAR ACÁ')
    expect(talon).toBeGreaterThan(-1)
    expect(html.indexOf('4321')).toBeGreaterThan(talon)
  })
})

describe('ticket de venta del POS', () => {
  it('escapa los nombres de productos', () => {
    const html = generatePrintHTML({
      receiptNumber: 'V-1', date: '15/10/2026', time: '10:00', cashier: 'Ana',
      items: [{ id: '1', name: '<script>alert(1)</script>', sku: '', price: 1000, quantity: 1 }],
      subtotal: 1000, totalDiscount: 0, tax: 0, total: 1000,
      payments: [{ id: 'p', method: 'cash', amount: 1000 }],
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
