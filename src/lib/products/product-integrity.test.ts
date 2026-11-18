import { describe, expect, it } from 'vitest'
import { productSchema as form } from '@/lib/validations/product-schema'
import { productSchema as api } from '@/lib/validation/schemas'
import { BUSINESS_VERTICALS } from '@/lib/organization/business-profile'
import { postSaleDefaultsFor } from './vertical-product-form'
const base = { name: 'Crema facial', sku: 'COS-001', category_id: '11111111-1111-4111-8111-111111111111', purchase_price: 10, sale_price: 100, stock_quantity: 5, min_stock: 0 }
describe('integridad del alta por rubro', () => {
  it.each(BUSINESS_VERTICALS)('permite los valores predeterminados de %s', vertical => {
    expect(form.safeParse({ ...base, ...postSaleDefaultsFor(vertical) }).success).toBe(true)
  })
  it('rechaza fechas inexistentes en formulario y API', () => {
    expect(form.safeParse({ ...base, initial_expires_on: '2026-02-31' }).success).toBe(false)
    expect(api.safeParse({ ...base, initial_batch: { expires_on: '2026-02-31' } }).success).toBe(false)
  })
  it('no permite enviar un lote sin fecha', () => {
    expect(form.safeParse({ ...base, initial_lot_code: 'LOTE-1' }).success).toBe(false)
  })
  it('un servicio no conserva stock, variantes ni lotes de un producto físico', () => {
    const parsed = form.parse({ ...base, unit_measure: 'servicio', initial_expires_on: '2026-12-31' })
    expect(parsed.stock_quantity).toBe(0)
    expect(parsed.initial_expires_on).toBeFalsy()
    expect(api.parse({ ...base, unit_measure: 'servicio' }).stock_quantity).toBe(0)
  })
  it('belleza y cuidado personal no hereda condiciones de electrónica', () => {
    expect(postSaleDefaultsFor('beauty_services')).toMatchObject({ warranty_months: 0, return_window_days: 0, exchange_window_days: 0 })
  })
})
