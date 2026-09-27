import { describe, expect, it } from 'vitest'

import { getMarketplaceSupportPhone } from '@/lib/support-contact'

describe('getMarketplaceSupportPhone', () => {
  it('usa solamente el numero central configurado para soporte', () => {
    expect(getMarketplaceSupportPhone(' +595 981 123 456 ')).toBe('+595 981 123 456')
  })

  it('no inventa ni reutiliza otro telefono cuando soporte no esta configurado', () => {
    expect(getMarketplaceSupportPhone(undefined)).toBeNull()
    expect(getMarketplaceSupportPhone('   ')).toBeNull()
  })
})
