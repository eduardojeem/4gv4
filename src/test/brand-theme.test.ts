import { describe, expect, it } from 'vitest'
import { getBrandTheme } from '@/lib/constants/brand-theme'

describe('getBrandTheme', () => {
  it('uses primary theme tokens for a custom organization color', () => {
    const theme = getBrandTheme('custom')

    expect(theme.hero).toContain('from-primary')
    expect(theme.cta).toContain('from-primary')
    expect(theme.stepText).toBe('text-primary')
  })

  it('keeps blue as the fallback for unknown values', () => {
    expect(getBrandTheme('unknown')).toEqual(getBrandTheme('blue'))
  })
})
