import { describe, expect, it } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { validateSetting } from '@/lib/validation/website-settings'

const validCarousel = {
  enabled: true,
  autoplay: true,
  intervalSeconds: 6,
  slides: [
    {
      id: 'slide-1',
      title: 'Promocion de accesorios',
      message: 'Precios especiales por tiempo limitado.',
      imageUrl: 'https://example.com/promotion.webp',
      imageAlt: 'Accesorios incluidos en la promocion',
      ctaText: 'Ver productos',
      ctaHref: '/productos',
      active: true,
      textTone: 'light',
      contentAlign: 'left',
    },
  ],
}

describe('promotional carousel website setting', () => {
  it('provides a disabled, empty default', () => {
    expect(getWebsiteSettingsDefaults().promotional_carousel).toEqual({
      enabled: false,
      autoplay: true,
      intervalSeconds: 6,
      layoutMode: 'contained',
      slides: [],
    })
  })

  it('accepts a complete promotional carousel', () => {
    expect(validateSetting('promotional_carousel', validCarousel).success).toBe(true)
    expect(validateSetting('promotional_carousel', {
      ...validCarousel,
      slides: [{ ...validCarousel.slides[0], imageUrl: '/images/promotional-carousel/accesorios.webp' }],
    }).success).toBe(true)
  })

  it('rejects unsafe links and incomplete slides', () => {
    const unsafe = {
      ...validCarousel,
      slides: [{ ...validCarousel.slides[0], ctaHref: 'javascript:alert(1)', imageAlt: '' }],
    }

    expect(validateSetting('promotional_carousel', unsafe).success).toBe(false)
    expect(validateSetting('promotional_carousel', {
      ...validCarousel,
      slides: [{ ...validCarousel.slides[0], imageUrl: 'javascript:alert(1)' }],
    }).success).toBe(false)
  })

  it('limits autoplay timing and slide count', () => {
    expect(validateSetting('promotional_carousel', { ...validCarousel, intervalSeconds: 2 }).success).toBe(false)
    expect(validateSetting('promotional_carousel', {
      ...validCarousel,
      slides: Array.from({ length: 7 }, (_, index) => ({
        ...validCarousel.slides[0],
        id: `slide-${index}`,
      })),
    }).success).toBe(false)
  })

  it('accepts graphic banners without text overlay and with custom background/text options', () => {
    const graphicSlide = {
      id: 'slide-graphic',
      title: '',
      message: '',
      imageUrl: 'https://example.com/banner-graphic.webp',
      imageAlt: 'Banner publicitario de temporada',
      ctaHref: '/productos?categoria=remeras',
      active: true,
      textTone: 'light' as const,
      contentAlign: 'center' as const,
      hideText: true,
      badge: '🔥 30% OFF',
      titleSize: 'large' as const,
      overlayIntensity: 'none' as const,
      overlayColor: 'brand' as const,
      backgroundColor: '#09090b',
      titleColor: '#facc15',
      fontFamily: 'display' as const,
    }

    const result = validateSetting('promotional_carousel', {
      ...validCarousel,
      slides: [graphicSlide],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.slides[0].titleColor).toBe('#facc15')
      expect(result.data.slides[0].fontFamily).toBe('display')
    }
  })
})
