import { describe, expect, it } from 'vitest'
import { getCommercialFeatureValue } from '@/lib/saas/commercial-plan-features'

describe('getCommercialFeatureValue', () => {
  it('resolves legacy CRM labels', () => {
    expect(getCommercialFeatureValue([{ label: 'Gestión de clientes', value: true }], 'crm')).toBe(true)
    expect(getCommercialFeatureValue([{ label: 'CRM / Clientes', value: true }], 'crm')).toBe(true)
    expect(getCommercialFeatureValue([{ label: 'Gestión de clientes', value: true }], 'CRM / Clientes')).toBe(true)
  })

  it('resolves historical ecommerce and repair labels', () => {
    expect(getCommercialFeatureValue([{ label: 'Ecommerce / Marketplace', value: true }], 'ecommerce')).toBe(true)
    expect(getCommercialFeatureValue([{ label: 'Reparaciones', value: '100/mes' }], 'repairs')).toBe('100/mes')
  })

  it('resolves credits labels with and without accents', () => {
    expect(getCommercialFeatureValue([{ label: 'Créditos y cuotas', value: true }], 'credits')).toBe(true)
    expect(getCommercialFeatureValue([{ label: 'Creditos y cuotas', value: true }], 'credits')).toBe(true)
  })
})
