import { describe, expect, it } from 'vitest'

import { getOfferCardWidthClass } from '../OffersCarouselDeck'

describe('getOfferCardWidthClass', () => {
  it('keeps offer cards compact enough to reveal the next card', () => {
    expect(getOfferCardWidthClass()).toContain('min-w-[72%]')
    expect(getOfferCardWidthClass()).toContain('sm:min-w-[40%]')
    expect(getOfferCardWidthClass()).toContain('lg:min-w-[24%]')
  })
})
