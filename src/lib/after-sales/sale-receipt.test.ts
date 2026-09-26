import { describe, expect, it } from 'vitest'

import { buildReprintReceiptData, normalizeReceiptPaymentMethod, type StoredSale } from './sale-receipt'

const sale: StoredSale = {
  id: '8f0c631c-06c2-4fb3-b253-06b8eb695752',
  code: 'VTA-000123',
  createdAt: '2026-08-10T14:35:00.000Z',
  subtotal: 500_000,
  tax: 0,
  discount: 50_000,
  total: 450_000,
  paymentMethod: 'efectivo',
  cashierName: 'Ana Duarte',
  customer: { name: 'Cliente Uno', phone: '0981000000', email: null },
  items: [
    { id: 'item-1', name: 'Cargador', sku: 'CAR-01', quantity: 2, unitPrice: 250_000 },
  ],
}

describe('buildReprintReceiptData', () => {
  // El bug que evita: createReceiptData() emite un numero nuevo, así que una
  // reimpresión quedaría como un segundo documento de la misma venta.
  it('keeps the original sale code as the receipt number', () => {
    expect(buildReprintReceiptData(sale).receiptNumber).toBe('VTA-000123')
  })

  it('keeps the original sale date, not today', () => {
    const receipt = buildReprintReceiptData(sale)
    expect(receipt.date).toBe(new Date('2026-08-10T14:35:00.000Z').toLocaleDateString('es-PY'))
    expect(receipt.date).not.toBe(new Date().toLocaleDateString('es-PY'))
  })

  it('flags the receipt as a reprint', () => {
    expect(buildReprintReceiptData(sale).isReprint).toBe(true)
  })

  it('falls back to a short id when the sale has no code', () => {
    expect(buildReprintReceiptData({ ...sale, code: null }).receiptNumber).toBe('8F0C631C')
  })

  it('carries items, totals and customer through', () => {
    const receipt = buildReprintReceiptData(sale)
    expect(receipt.items).toHaveLength(1)
    expect(receipt.items[0]).toMatchObject({ name: 'Cargador', quantity: 2, price: 250_000 })
    expect(receipt.subtotal).toBe(500_000)
    expect(receipt.totalDiscount).toBe(50_000)
    expect(receipt.total).toBe(450_000)
    expect(receipt.customer?.name).toBe('Cliente Uno')
  })

  it('rebuilds a single payment from the declared method when no split was stored', () => {
    const receipt = buildReprintReceiptData(sale)
    expect(receipt.payments).toEqual([{ id: 'payment-0', method: 'cash', amount: 450_000 }])
  })

  it('preserves a stored split payment breakdown', () => {
    const receipt = buildReprintReceiptData({
      ...sale,
      payments: [
        { id: 'p1', method: 'cash', amount: 200_000 },
        { id: 'p2', method: 'transferencia', amount: 250_000, reference: 'REF-9' },
      ],
    })
    expect(receipt.payments).toHaveLength(2)
    expect(receipt.payments[1]).toMatchObject({ method: 'transfer', amount: 250_000, reference: 'REF-9' })
  })

  it('omits the customer block for a walk-in sale', () => {
    expect(buildReprintReceiptData({ ...sale, customer: null }).customer).toBeUndefined()
  })
})

describe('normalizeReceiptPaymentMethod', () => {
  it('maps the Spanish labels the POS stores', () => {
    expect(normalizeReceiptPaymentMethod('efectivo')).toBe('cash')
    expect(normalizeReceiptPaymentMethod('tarjeta')).toBe('card')
    expect(normalizeReceiptPaymentMethod('transferencia')).toBe('transfer')
    expect(normalizeReceiptPaymentMethod('credito')).toBe('credit')
  })

  it('falls back to cash for anything unrecognized', () => {
    expect(normalizeReceiptPaymentMethod(null)).toBe('cash')
    expect(normalizeReceiptPaymentMethod('qr')).toBe('cash')
  })
})
