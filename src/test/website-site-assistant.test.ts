import { describe, expect, it } from 'vitest'
import { HeroContentSchema, TrustBarSchema } from '@/lib/validation/website-settings'
import {
  extractOfferings,
  extractPlace,
  generateWebsiteSuggestion,
  type WebsiteAssistantInput,
} from '@/lib/website/site-assistant'

const barbershop: WebsiteAssistantInput = {
  about: 'Barbería en Luque. Hacemos cortes clásicos, fades y perfilado de barba. Atendemos con turno.',
  tone: 'cercano',
  variant: 0,
  name: 'Barber Club',
  vertical: 'barbershop',
  focus: 'services',
  services: [],
  bookingAvailable: false,
  commerceMode: 'cart',
  pending: [
    { section: 'booking', title: 'Reservas online' },
    { section: 'gallery', title: 'Galería de trabajos' },
    { section: 'booking', title: 'Repetido' },
    { section: 'company', title: 'Publicar la tienda' },
    { section: 'hero', title: 'Portada' },
  ],
}

describe('site assistant (internal, no external service)', () => {
  it('reads the place and what the business offers from the owner words', () => {
    expect(extractPlace(barbershop.about)).toBe('Luque')
    expect(extractPlace('Tienda en Ciudad del Este con envíos')).toBe('Ciudad del Este')
    expect(extractOfferings(barbershop.about)).toEqual(['cortes clásicos', 'fades', 'perfilado de barba'])
  })

  it('writes a barbershop site around bookings and what they actually do', () => {
    const suggestion = generateWebsiteSuggestion(barbershop)
    expect(suggestion.hero.ctaPrimaryText).toBe('Reservar turno')
    expect(suggestion.hero.subtitle).toContain('Cortes clásicos, fades y perfilado de barba en Luque')
    expect(suggestion.description).toMatch(/^Barber Club es una barbería en Luque\./)
    // Mencionó turnos: el primer beneficio sale de lo que dijo.
    expect(suggestion.trustBar[0]).toMatchObject({ icon: 'clock', title: 'Reservá online' })
  })

  it('only promises deliveries when the owner mentions them', () => {
    const quiet = generateWebsiteSuggestion({ ...barbershop, vertical: 'clothing', focus: 'retail', about: 'Ropa de mujer, remeras y vestidos' })
    expect(quiet.trustBar.some((item) => item.icon === 'truck')).toBe(false)
    const withDelivery = generateWebsiteSuggestion({ ...barbershop, vertical: 'clothing', focus: 'retail', about: 'Ropa de mujer con envío a domicilio' })
    expect(withDelivery.trustBar[0].icon).toBe('truck')
  })

  it('fits every text into what the site settings accept', () => {
    const suggestion = generateWebsiteSuggestion({ ...barbershop, about: `${barbershop.about} ${'muy '.repeat(200)}` })
    expect(HeroContentSchema.safeParse({ ...suggestion.hero, enabled: true }).success).toBe(true)
    expect(TrustBarSchema.safeParse({
      enabled: true,
      position: 'below_carousel',
      items: suggestion.trustBar.map((item, index) => ({ id: `t${index}`, ...item, active: true })),
    }).success).toBe(true)
    expect(suggestion.trustBar.length).toBeLessThanOrEqual(4)
  })

  it('gives one tip per pending section, at most three', () => {
    const { tips } = generateWebsiteSuggestion(barbershop)
    expect(tips.map((tip) => tip.section)).toEqual(['booking', 'gallery', 'company'])
  })

  it('offers another version on demand without changing the facts', () => {
    const first = generateWebsiteSuggestion(barbershop)
    const second = generateWebsiteSuggestion({ ...barbershop, variant: 1 })
    expect(second.hero.title).not.toBe(first.hero.title)
    expect(second.hero.ctaPrimaryText).toBe(first.hero.ctaPrimaryText)
  })
})
