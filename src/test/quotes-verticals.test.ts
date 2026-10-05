import { describe, expect, it } from 'vitest'
import {
  QUOTE_VERTICALS_CONFIG,
  getQuoteVerticalConfig,
} from '@/lib/quotes/quote-verticals'
import {
  buildQuoteWhatsAppMessage,
  quoteCode,
} from '@/lib/quotes/quote-math'

describe('Configuración de rubros en presupuestos (quote-verticals)', () => {
  it('contiene los 8 rubros principales con metadatos completos', () => {
    const verticals = [
      'electronics',
      'clothing',
      'hardware',
      'food',
      'cosmetics',
      'barbershop',
      'general',
      'other',
    ] as const

    for (const v of verticals) {
      const config = QUOTE_VERTICALS_CONFIG[v]
      expect(config).toBeDefined()
      expect(config.vertical).toBe(v)
      expect(config.name).toBeTruthy()
      expect(config.badgeText).toBeTruthy()
      expect(config.tagline).toBeTruthy()
      expect(config.defaultValidityDays).toBeGreaterThan(0)
      expect(config.quickLines.length).toBeGreaterThan(0)
      expect(config.notePresets.length).toBeGreaterThan(0)
      expect(config.whatsappIntro).toContain('{cliente}')
      expect(config.whatsappIntro).toContain('{numero}')
      expect(config.whatsappIntro).toContain('{empresa}')
    }
  })

  it('getQuoteVerticalConfig devuelve el rubro correcto y hace fallback a general si no existe', () => {
    const elec = getQuoteVerticalConfig('electronics')
    expect(elec.vertical).toBe('electronics')
    expect(elec.name).toContain('Tecnología')

    const cloth = getQuoteVerticalConfig('clothing')
    expect(cloth.vertical).toBe('clothing')
    expect(cloth.name).toContain('Moda')

    const hard = getQuoteVerticalConfig('hardware')
    expect(hard.vertical).toBe('hardware')
    expect(hard.name).toContain('Ferretería')

    // Fallbacks
    const fallbackNull = getQuoteVerticalConfig(null)
    expect(fallbackNull.vertical).toBe('general')

    const fallbackUndefined = getQuoteVerticalConfig(undefined)
    expect(fallbackUndefined.vertical).toBe('general')

    const fallbackUnknown = getQuoteVerticalConfig('rubro_inexistente')
    expect(fallbackUnknown.vertical).toBe('general')
  })

  it('permite personalizar el mensaje de WhatsApp con customIntro según el rubro', () => {
    const config = getQuoteVerticalConfig('electronics')
    const customIntro = config.whatsappIntro
      .replace('{cliente}', 'Carlos')
      .replace('{numero}', quoteCode(42))
      .replace('{empresa}', 'TechRepair Py')

    const msg = buildQuoteWhatsAppMessage({
      storeName: 'TechRepair Py',
      customerName: 'Carlos',
      number: 42,
      lines: [
        {
          product_id: null,
          variant_id: null,
          description: 'Mano de obra técnica',
          sku: null,
          quantity: 1,
          unit_price: 80000,
          discount_rate: 0,
          line_subtotal: 80000,
          discount_amount: 0,
          line_total: 80000,
        },
      ],
      total: 80000,
      currency: 'PYG',
      validUntil: '2026-10-15',
      url: 'https://ejemplo.com/presupuesto/xyz',
      customIntro,
    })

    expect(msg).toContain('Hola Carlos! Te paso el presupuesto técnico P-00042 de TechRepair Py')
    expect(msg).toContain('Mano de obra técnica')
    expect(msg).toContain('https://ejemplo.com/presupuesto/xyz')
  })

  it('mantiene la compatibilidad si no se pasa customIntro', () => {
    const msg = buildQuoteWhatsAppMessage({
      storeName: 'Mi Tienda',
      customerName: 'Lucía',
      number: 10,
      lines: [],
      total: 50000,
      currency: 'PYG',
      validUntil: '2026-10-20',
      url: 'https://ejemplo.com/presupuesto/abc',
    })

    expect(msg).toContain(`Hola Lucía! Te paso el presupuesto ${quoteCode(10)} de Mi Tienda:`)
  })
})
