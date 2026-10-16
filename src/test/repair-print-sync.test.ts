import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RECEIPT_SETTINGS, generateRepairShareText, printRepairReceipt } from '@/lib/repair-receipt'
import {
  buildRepairPrintPayload,
  fetchRepairVerificationHash,
  repairPrintTicketNumber,
} from '@/lib/repairs/print-payload'
import type { Repair } from '@/types/repairs'

const reparacion = (extra: Partial<Repair> = {}) => ({
  id: 'abcdef12-3456-7890-abcd-ef1234567890',
  ticketNumber: 'R-2026-000010',
  customer: { id: 'c-1', name: 'Ana Pérez', phone: '0981000000' },
  deviceType: 'smartphone',
  brand: 'Samsung',
  model: 'A54',
  serialNumber: 'SN-1',
  imei: '3589',
  issue: 'Pantalla',
  description: '',
  priority: 'medium',
  urgency: 'normal',
  estimatedCost: 300_000,
  finalCost: null,
  paidAmount: 100_000,
  technician: null,
  warranty: null,
  warrantyMonths: 0,
  warrantyType: 'full',
  createdAt: '2026-10-15T12:00:00.000Z',
  ...extra,
}) as unknown as Repair

afterEach(() => vi.unstubAllGlobals())

describe('lo que se imprime de una reparación guardada', () => {
  it('lleva la garantía de la orden, lo pagado y el IMEI', () => {
    const payload = buildRepairPrintPayload(reparacion(), { name: 'Taller' }, 'hash-1')
    expect(payload.warrantyMonths).toBe(0)
    expect(payload.paidAmount).toBe(100_000)
    expect(payload.devices[0].imei).toBe('3589')
    expect(payload.verificationHash).toBe('hash-1')
  })

  it('firma el QR con el mismo número que imprime', async () => {
    const fetchMock = vi.fn(async () => ({ json: async () => ({ success: true, hash: 'h' }) }))
    vi.stubGlobal('fetch', fetchMock)
    const sinNumero = reparacion({ ticketNumber: undefined })

    await expect(fetchRepairVerificationHash(sinNumero)).resolves.toBe('h')
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.ticketNumber).toBe(repairPrintTicketNumber(sinNumero))
    expect(buildRepairPrintPayload(sinNumero, { name: 'T' }).ticketNumber).toBe(body.ticketNumber)
  })

  it('sin firma el comprobante sale igual', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red') }))
    await expect(fetchRepairVerificationHash(reparacion())).resolves.toBeUndefined()
  })
})

describe('la garantía en WhatsApp coincide con el papel', () => {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, defaultWarrantyMonths: 3, defaultWarrantyType: 'labor' as const }

  it('una orden sin datos de garantía usa la del taller', () => {
    const payload = buildRepairPrintPayload(reparacion({ warrantyMonths: undefined, warrantyType: undefined }), { name: 'T' })
    expect(generateRepairShareText(payload, settings)).toContain('*Garantía:* 3 meses, solo mano de obra')
  })

  it('una orden sin garantía lo dice', () => {
    const payload = buildRepairPrintPayload(reparacion({ warrantyMonths: 0 }), { name: 'T' })
    const texto = generateRepairShareText(payload, settings)
    expect(texto).toContain('no incluye garantía')
    expect(texto).not.toContain('3 meses')
  })
})

function imprimir(repair: Repair) {
  let html = ''
  vi.spyOn(window, 'open').mockReturnValue({
    document: { write: (h: string) => { html = h }, close: () => {} },
    closed: false,
    focus: () => {},
  } as unknown as Window)
  printRepairReceipt('customer', buildRepairPrintPayload(repair, { name: 'Taller' }), '80mm', DEFAULT_RECEIPT_SETTINGS)
  return html
}

describe('el comprobante desde una orden guardada', () => {
  afterEach(() => vi.restoreAllMocks())

  it('una orden sin reparar no cobra el presupuesto', () => {
    const html = imprimir(reparacion({ status: 'entregado', deliveryOutcome: 'unrepairable', paidAmount: 0 } as Partial<Repair>))
    expect(html).toContain('Sin reparar · sin costo')
    expect(html).not.toContain('Saldo pendiente')
  })

  it('ya entregada imprime el comprobante de entrega con la garantía vigente', () => {
    const html = imprimir(reparacion({
      status: 'entregado',
      deliveryOutcome: 'repaired',
      finalCost: 300_000,
      paidAmount: 300_000,
      warrantyMonths: 3,
      pickedUpAt: '2026-10-15T15:00:00.000Z',
      warrantyExpiresAt: '2027-01-15T15:00:00.000Z',
    } as Partial<Repair>))
    expect(html).toContain('COMPROBANTE DE ENTREGA')
    expect(html).toContain('Recibí conforme')
    expect(html).toContain('vigente hasta el')
    expect(html).not.toContain('ORDEN DE SERVICIO')
    expect(html).not.toContain('abandonado')
  })

  it('una copia lo dice', () => {
    expect(imprimir(reparacion({ status: 'reparacion' } as Partial<Repair>))).toContain('Copia impresa el')
  })
})
