import { describe, expect, it } from 'vitest'
import { validateSetting } from '@/lib/validation/website-settings'

describe('offers website setting validation', () => {
  it('accepts the complete offers section payload persisted by the editor', () => {
    const result = validateSetting('offers_section', {
      enabled: true,
      eyebrow: 'Ofertas especiales',
      title: 'Precios para aprovechar',
      subtitle: 'Productos seleccionados con descuentos vigentes.',
      accentColor: 'emerald',
    })

    expect(result.success).toBe(true)
  })

  it('rejects an incomplete offers section payload', () => {
    const result = validateSetting('offers_section', {
      enabled: true,
      title: 'Oferta',
    })

    expect(result.success).toBe(false)
  })
})
