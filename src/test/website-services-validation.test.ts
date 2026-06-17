import { describe, expect, it } from 'vitest'
import { validateSetting } from '@/lib/validation/website-settings'

describe('website services validation', () => {
  it('preserves public service fields used by the admin editor', () => {
    const result = validateSetting('services', [
      {
        id: 'service-payments',
        title: 'Pago de facturas',
        description: 'Cobro de facturas y servicios con comprobante.',
        icon: 'receipt',
        color: 'emerald',
        benefits: ['Tigo', 'Personal', 'ANDE'],
        active: true,
        price: 'Consultar comision',
        priceNote: 'segun operacion',
        duration: 'En el momento',
        ctaUrl: '/inicio#contacto',
        featured: true,
        category: 'Pagos y servicios',
      },
    ])

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data[0]).toMatchObject({
      icon: 'receipt',
      price: 'Consultar comision',
      priceNote: 'segun operacion',
      duration: 'En el momento',
      ctaUrl: '/inicio#contacto',
      featured: true,
      category: 'Pagos y servicios',
    })
  })

  it('rejects unsafe public service CTA URLs', () => {
    const result = validateSetting('services', [
      {
        id: 'service-payments',
        title: 'Pago de facturas',
        description: 'Cobro de facturas y servicios con comprobante.',
        icon: 'receipt',
        color: 'emerald',
        benefits: ['Tigo'],
        active: true,
        ctaUrl: 'javascript:alert(1)',
      },
    ])

    expect(result.success).toBe(false)
  })
})
