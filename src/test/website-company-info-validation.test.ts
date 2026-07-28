import { describe, expect, it } from 'vitest'
import { validateSetting } from '@/lib/validation/website-settings'

describe('company info website setting validation', () => {
  it.each(['#0F8', '#00FF88'])('accepts the supported custom HEX color %s', (customBrandColor) => {
    const result = validateSetting('company_info', {
      name: '4G Celulares',
      brandColor: 'custom',
      customBrandColor,
    })

    expect(result.success).toBe(true)
  })

  it.each(['00FF88', '#GGG', '#12345', 'red'])('rejects the invalid custom color %s', (customBrandColor) => {
    const result = validateSetting('company_info', {
      name: '4G Celulares',
      brandColor: 'custom',
      customBrandColor,
    })

    expect(result.success).toBe(false)
  })

  it('requires a custom color when the custom option is selected', () => {
    const result = validateSetting('company_info', {
      name: '4G Celulares',
      brandColor: 'custom',
      customBrandColor: '',
    })

    expect(result.success).toBe(false)
  })

  it('allows an empty custom color for predefined brand colors', () => {
    const result = validateSetting('company_info', {
      name: '4G Celulares',
      brandColor: 'blue',
      customBrandColor: '',
    })

    expect(result.success).toBe(true)
  })
})
