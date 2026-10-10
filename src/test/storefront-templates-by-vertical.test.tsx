import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isStorefrontStyleAvailable, resolveStorefrontStyle, STOREFRONT_STYLE_OPTIONS, suggestStorefrontAppearance } from '@/lib/website/storefront-style'

const offered = (businessVertical: string, context: { servicesAvailable?: boolean; catalogAvailable?: boolean }) =>
  STOREFRONT_STYLE_OPTIONS.map((option) => option.value).filter((style) => style !== 'auto' && isStorefrontStyleAvailable(style, { ...context, businessVertical }))

describe('plantillas según el rubro, sin mezclar servicios y tienda', () => {
  it('una barbería con agenda y sin productos solo ve Servicios', () => {
    expect(offered('barbershop', { servicesAvailable: true, catalogAvailable: false })).toEqual(['services'])
  })

  it('una barbería que también vende productos suma Clásico y Moderno, no Supermercado ni Tecnología', () => {
    expect(offered('barbershop', { servicesAvailable: true, catalogAvailable: true }).sort()).toEqual(['classic', 'modern', 'services'])
  })

  it('un salón de belleza con productos puede usar Belleza', () => {
    expect(offered('beauty_services', { servicesAvailable: true, catalogAvailable: true })).toContain('beauty')
  })

  it('una tienda de productos no ve Servicios aunque tenga la agenda', () => {
    for (const vertical of ['clothing', 'electronics', 'food', 'hardware']) {
      expect(offered(vertical, { servicesAvailable: true, catalogAvailable: true })).not.toContain('services')
    }
  })

  it('comercio general u otro rubro con agenda conserva todas las opciones', () => {
    expect(offered('general', { servicesAvailable: true, catalogAvailable: true })).toHaveLength(8)
    expect(offered('other', { servicesAvailable: false, catalogAvailable: true })).not.toContain('services')
  })

  it('una plantilla guardada que ya no corresponde vuelve a la del rubro', () => {
    expect(resolveStorefrontStyle('market', 'barbershop', { servicesAvailable: true, catalogAvailable: false })).toBe('services')
    expect(resolveStorefrontStyle('tech', 'barbershop', { servicesAvailable: true, catalogAvailable: true })).toBe('services')
    expect(resolveStorefrontStyle('services', 'hardware', { servicesAvailable: true })).toBe('classic')
    expect(resolveStorefrontStyle('services', 'clothing', { servicesAvailable: true })).toBe('fashion')
    // Sin agenda y sin productos: algo neutro, nunca una portada de otro negocio.
    expect(resolveStorefrontStyle('auto', 'barbershop', { servicesAvailable: false, catalogAvailable: false })).toBe('modern')
  })

  it('lo que ya usan las tiendas sigue igual', () => {
    expect(resolveStorefrontStyle('auto', 'barbershop', { servicesAvailable: true, catalogAvailable: true })).toBe('services')
    expect(resolveStorefrontStyle('fashion', 'clothing', { servicesAvailable: false, catalogAvailable: true })).toBe('fashion')
    expect(resolveStorefrontStyle('classic', 'electronics', { servicesAvailable: false, catalogAvailable: true })).toBe('classic')
    expect(resolveStorefrontStyle('auto', 'general', {})).toBe('classic')
  })

  it('la sugerencia explica por qué una tienda de productos no usa Servicios', () => {
    const suggestion = suggestStorefrontAppearance({ businessVertical: 'general', name: 'Ferretería y peluquería Don Pepe', servicesAvailable: true, catalogAvailable: true })
    expect(suggestion.style).toBe('services')
    const hardware = suggestStorefrontAppearance({ businessVertical: 'barbershop', servicesAvailable: false, catalogAvailable: false })
    expect(hardware.style).toBe('modern')
  })
})

describe('el banner de vitrina no inventa productos', () => {
  const banner = readFileSync(resolve(process.cwd(), 'src/components/public/inicio/FashionCampaignBanner.tsx'), 'utf8')
  it('sin productos no se muestra, y no usa textos ni fotos de ropa de relleno', () => {
    expect(banner).toContain('if (!currentProduct) return null')
    expect(banner).not.toContain('Prendas básicas con calce y confort perfecto')
    expect(banner).not.toContain('Confeccionadas con materiales premium')
    expect(banner).not.toContain('images.unsplash.com')
  })
})
