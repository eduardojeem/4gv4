import { describe, expect, it } from 'vitest'
import { commerceControlCatalog, controlFlags, controlUpdateSchema, validateCommercePayments } from '@/lib/payments/control-contract'

describe('payment control contract', () => {
  it('preserves defaults for missing settings and rejects corrupt policy', () => {
    expect(Object.values(controlFlags({}, 'commerce')).every(Boolean)).toBe(true)
    expect(() => controlFlags({ payment_controls: { cash: 'false' } }, 'commerce')).toThrow()
    expect(() => controlFlags({ payment_controls: [] }, 'commerce')).toThrow()
  })
  it('checks all parts of mixed payments, aliases and QR transfer dependency', () => {
    const flags = controlFlags({ payment_controls: { card: false, qr: false } }, 'commerce')
    expect(() => validateCommercePayments(flags, [{ method: 'EFECTIVO', amount: 100 }])).not.toThrow()
    expect(() => validateCommercePayments(flags, [{ method: 'cash' }, { method: 'tarjeta' }])).toThrow('deshabilitado')
    expect(() => validateCommercePayments(flags, [{ method: 'transfer', channel: 'qr' }])).toThrow('deshabilitado')
    expect(() => validateCommercePayments(flags, [{ method: 'unrecognized' }])).toThrow('no es válido')
  })
  it('turning off financing does not prevent receiving existing installments', () => {
    const flags = controlFlags({ payment_controls: { credit: false } }, 'commerce')
    expect(() => validateCommercePayments(flags, [{ method: 'cash' }])).not.toThrow()
    expect(() => validateCommercePayments(flags, [{ method: 'credit' }])).toThrow()
    expect(commerceControlCatalog(flags).find(method => method.id === 'credit')?.available).toBe(false)
  })
  it('requires explicit booleans, revision and no client organization override', () => {
    expect(controlUpdateSchema.safeParse({ id: 'cash', enabled: 'false', revision: null }).success).toBe(false)
    expect(controlUpdateSchema.safeParse({ id: 'cash', enabled: false, revision: null, organizationId: 'other' }).success).toBe(false)
  })
})
