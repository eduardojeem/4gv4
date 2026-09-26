import { describe, expect, it } from 'vitest'

import { POS_GUIDE } from '@/components/dashboard/common/section-guides-data'

describe('POS credit products guide', () => {
  it('documents how product plans apply to a POS ticket', () => {
    const guideText = JSON.stringify(POS_GUIDE)

    expect(guideText).toContain('Con cuotas')
    expect(guideText).toContain('ticket completo')
    expect(guideText).toContain('línea de crédito')
    expect(guideText).toContain('Usar este plan')
  })
})
