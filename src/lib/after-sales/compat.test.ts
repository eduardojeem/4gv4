import { describe, expect, it } from 'vitest'
import {
  isLegacyAfterSalesStatus,
  normalizeAfterSalesCase,
  normalizeAfterSalesRequestType,
  normalizeAfterSalesSourceType,
  normalizeAfterSalesStatus,
  serializeAfterSalesStatus,
} from './compat'

describe('after-sales legacy compatibility', () => {
  it('normalizes statuses stored in Spanish', () => {
    expect(normalizeAfterSalesStatus('abierto')).toBe('open')
    expect(normalizeAfterSalesStatus('APROBADO')).toBe('approved')
    expect(normalizeAfterSalesStatus('rechazado')).toBe('rejected')
  })

  it('normalizes request and source types stored in Spanish', () => {
    expect(normalizeAfterSalesRequestType('garantia_reparacion')).toBe('repair_warranty')
    expect(normalizeAfterSalesRequestType('garantia_producto')).toBe('product_warranty')
    expect(normalizeAfterSalesSourceType('reparacion')).toBe('repair')
    expect(normalizeAfterSalesSourceType('venta')).toBe('sale')
  })

  it('normalizes a complete API row without dropping its fields', () => {
    expect(normalizeAfterSalesCase({ id: 'case-1', status: 'abierto', request_type: 'cambio', source_type: 'venta' }))
      .toEqual({ id: 'case-1', status: 'open', request_type: 'exchange', source_type: 'sale' })
  })

  it('serializes transitions using the current storage dialect', () => {
    expect(isLegacyAfterSalesStatus('abierto')).toBe(true)
    expect(serializeAfterSalesStatus('approved', true)).toBe('aprobado')
    expect(serializeAfterSalesStatus('approved', false)).toBe('approved')
  })
})
