import { describe, expect, it } from 'vitest'
import { carouselExamplesFor, carouselLinkShortcuts, carouselPlacement, carouselSuggestions, defaultSlideCta, slideLinkProblem, type CarouselContext } from './carousel-guidance'

const barbershop: CarouselContext = { businessVertical: 'barbershop', hasCatalog: false, hasServices: true, hasRepairs: false }
const clothing: CarouselContext = { businessVertical: 'clothing', hasCatalog: true, hasServices: false, hasRepairs: false }
const phoneShop: CarouselContext = { businessVertical: 'electronics', hasCatalog: true, hasServices: false, hasRepairs: true }

describe('carrusel según la tienda', () => {
  it('una barbería sin productos solo ve plantillas de turnos', () => {
    const examples = carouselExamplesFor(barbershop)
    expect(examples.map((example) => example.category)).toEqual(['Servicios', 'Servicios'])
    expect(examples.every((example) => example.slide.ctaHref === '/turnos')).toBe(true)
    expect(examples[0].recommended).toBe(true)
  })

  it('una tienda de ropa ve primero las de moda y nunca servicio técnico', () => {
    const examples = carouselExamplesFor(clothing)
    expect(examples[0].category).toBe('Moda & Ropa')
    expect(examples.some((example) => example.needs !== 'catalog')).toBe(false)
  })

  it('servicio técnico solo con el módulo de reparaciones, y lleva al seguimiento', () => {
    expect(carouselExamplesFor(clothing).some((example) => example.name === 'Servicio Técnico Especializado')).toBe(false)
    expect(carouselExamplesFor(phoneShop).find((example) => example.name === 'Servicio Técnico Especializado')?.slide.ctaHref).toBe('/mis-reparaciones')
  })

  it('ninguna plantilla usa una foto de otro rubro', () => {
    const all = carouselExamplesFor({ businessVertical: 'general', hasCatalog: true, hasServices: true, hasRepairs: true })
    const photoOf = (name: string) => all.find((example) => example.name === name)?.slide.imageUrl
    expect(photoOf('Cuidado Facial & Belleza')).toBe('')
    expect(photoOf('Herramientas Profesionales')).toBe('')
    expect(photoOf('Envíos Gratis a Todo el País')).toBe('')
  })

  it('los atajos y el botón de una diapositiva nueva van a secciones que existen', () => {
    expect(carouselLinkShortcuts(barbershop).map((link) => link.href)).toEqual(['/turnos', '/servicios'])
    expect(carouselLinkShortcuts(clothing).map((link) => link.href)).toEqual(['/productos', '/productos?ofertas=true'])
    expect(defaultSlideCta(barbershop)).toEqual({ ctaText: 'Reservar turno', ctaHref: '/turnos' })
    expect(defaultSlideCta(clothing)).toEqual({ ctaText: 'Ver productos', ctaHref: '/productos' })
  })

  it('avisa si un botón lleva a una sección que la tienda no tiene', () => {
    expect(slideLinkProblem('/productos?ofertas=true', barbershop)).toMatch(/no vende productos/)
    expect(slideLinkProblem('/servicios', clothing)).toMatch(/agenda/)
    expect(slideLinkProblem('/mis-reparaciones', clothing)).toMatch(/reparaciones/)
    expect(slideLinkProblem('/turnos', barbershop)).toBeNull()
    expect(slideLinkProblem('https://instagram.com/x', barbershop)).toBeNull()
  })

  it('las ideas son del rubro: una barbería no ve celulares ni envíos', () => {
    const ideas = carouselSuggestions(barbershop)
    expect(ideas.titles.join(' ')).not.toMatch(/Equipos|Envíos|Colección/)
    expect(ideas.buttons).toContain('Reservar turno')
  })

  it('dice si los banners reemplazan la portada', () => {
    expect(carouselPlacement('classic').replacesHero).toBe(false)
    expect(carouselPlacement('services').text).toMatch(/reemplazan la portada/)
  })
})

describe('la portada no desaparece con el carrusel apagado', () => {
  it('los banners reemplazan la portada solo si el carrusel está encendido', async () => {
    const { readFileSync } = await import('node:fs')
    const home = readFileSync('src/app/(public)/inicio/HomePageClient.tsx', 'utf8')
    expect(home).toContain('const configuredSlidesLead = settings.promotional_carousel?.enabled !== false &&')
  })
})
