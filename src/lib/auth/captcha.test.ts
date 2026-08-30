import { describe, expect, it } from 'vitest'
import { captchaTokenSchema } from './captcha'

describe('captchaTokenSchema', () => {
  it('accepts a non-empty Turnstile token within the boundary limit', () => {
    expect(captchaTokenSchema.safeParse('turnstile-token').success).toBe(true)
  })

  it.each([undefined, null, '', '   ', 'x'.repeat(4097)])(
    'rejects missing, blank, or oversized token %s',
    (token) => {
      expect(captchaTokenSchema.safeParse(token).success).toBe(false)
    },
  )
})
