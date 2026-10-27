import { describe, expect, it } from 'vitest'
import { buildReprintReceiptData } from '@/lib/after-sales/sale-receipt'
import { saleReference, saleSubtotal, toStoredSale, type SaleDetailRecord } from '../SaleDetailsModal'

// Fila tal como la devuelve useSales().getSale para una venta del POS.
const sale: SaleDetailRecord = {
  id: '6f1c2c1e-1111-4222-8333-944444444444',
  code: 'POS-1761500000000-AB12CD34',
  created_at: '2026-10-26T15:30:00.000Z',
  subtotal_amount: 300000,
  total_amount: 260000,
  tax_amount: 23636,
  discount_amount: 40000,
  payment_method: 'mixed',
  customer: { name: 'Ana Benítez', phone: '0981 000 000', email: '' },
  sale_items: [
    { id: 'i1', product_id: 'p1', quantity: 2, unit_price: 100000, discount_amount: 40000, subtotal: 160000, products: { name: 'Zapatilla', sku: 'ZP-1' } },
    { id: 'i2', product_id: 'p2', quantity: 1, unit_price: 100000, discount_amount: 0, subtotal: 100000, products: { name: 'Remera', sku: 'RM-1' } },
  ],
  sale_payments: [
    { id: 'sp2', payment_index: 1, payment_method: 'card', amount: 60000 },
    { id: 'sp1', payment_index: 0, payment_method: 'cash', amount: 200000 },
  ],
  payments: [],
}

describe('reimpresión desde el detalle de venta del POS', () => {
  it('usa el código guardado, no un recorte del id', () => {
    expect(saleReference(sale)).toBe('POS-1761500000000-AB12CD34')
    expect(buildReprintReceiptData(toStoredSale(sale)).receiptNumber).toBe('POS-1761500000000-AB12CD34')
  })

  it('lleva el descuento de cada línea (sale_items.discount_amount)', () => {
    const receipt = buildReprintReceiptData(toStoredSale(sale))
    expect(receipt.items.map(item => item.discount)).toEqual([40000, 0])
  })

  it('subtotal bruto: subtotal − descuento = total', () => {
    expect(saleSubtotal(sale)).toBe(300000)
    const receipt = buildReprintReceiptData(toStoredSale(sale))
    expect(receipt.subtotal - receipt.totalDiscount).toBe(receipt.total)
  })

  it('toma los pagos de sale_payments en orden, no un único efectivo por el total', () => {
    const receipt = buildReprintReceiptData(toStoredSale(sale))
    expect(receipt.payments.map(payment => [payment.method, payment.amount])).toEqual([['cash', 200000], ['card', 60000]])
  })

  it('imprime el cliente real en lugar de «Cliente General»', () => {
    expect(buildReprintReceiptData(toStoredSale(sale)).customer?.name).toBe('Ana Benítez')
  })

  it('una venta vieja sin subtotal guardado lo reconstruye como total + descuento', () => {
    expect(saleSubtotal({ id: 'x', created_at: '', total_amount: 90000, discount_amount: 10000 })).toBe(100000)
  })
})
