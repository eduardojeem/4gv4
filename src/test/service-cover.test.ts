import { describe, expect, it } from 'vitest'
import { imagesWithCover, imagesWithoutCover, serviceCoverProblem, serviceWebsitePayload } from '@/lib/agenda/service-cover'
import { inventoryServicesForWebsite, mergeInventoryServices } from '@/lib/website/inventory-services'
import type { Service } from '@/types/website-settings'

describe('portada del servicio', () => {
  it('acepta fotos comunes y rechaza otros formatos, vacías o de más de 5 MB', () => {
    expect(serviceCoverProblem(new File(['x'], 'cover.webp', { type: 'image/webp' }))).toBeNull()
    expect(serviceCoverProblem(new File(['x'], 'script.svg', { type: 'image/svg+xml' }))).toContain('JPG')
    expect(serviceCoverProblem({ type: 'image/png', size: 0 })).toContain('vacía')
    expect(serviceCoverProblem({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toContain('5 MB')
  })

  it('la portada nueva va primera sin duplicar las demás fotos y respeta el máximo de 10', () => {
    expect(imagesWithCover(['a', 'b'], 'nueva')).toEqual(['nueva', 'a', 'b'])
    expect(imagesWithCover(['a', 'b'], 'b')).toEqual(['b', 'a'])
    expect(imagesWithCover(null, 'nueva')).toEqual(['nueva'])
    expect(imagesWithCover(Array.from({ length: 10 }, (_, i) => `f${i}`), 'nueva')).toHaveLength(10)
  })

  it('quitar la portada deja la siguiente foto como portada', () => {
    expect(imagesWithoutCover(['a', 'b'], 'a')).toEqual(['b'])
    expect(imagesWithoutCover(['a'], 'a')).toEqual([])
  })

  it('guarda visibilidad y fotos juntas, con image_url espejando la primera', () => {
    expect(serviceWebsitePayload({ visible: true })).toEqual({ visibility: 'public' })
    expect(serviceWebsitePayload({ visible: false, images: ['x', 'y'] })).toEqual({ visibility: 'hidden', images: ['x', 'y'], image_url: 'x' })
    expect(serviceWebsitePayload({ visible: true, images: [] })).toEqual({ visibility: 'public', images: [], image_url: null })
  })
})

describe('servicios del catálogo en la página web', () => {
  const row = { id: 's1', name: 'Corte', sale_price: 50000, visibility: 'public', is_active: true, images: ['https://x/c.webp'], image_url: 'https://x/viejo.webp' }

  it('muestra solo los activos marcados para la web, con su portada', () => {
    const services = inventoryServicesForWebsite([
      row,
      { ...row, id: 's2', name: 'Oculto', visibility: 'hidden' },
      { ...row, id: 's3', name: 'Inactivo', is_active: false },
      { ...row, id: 's4', name: 'Sin foto', images: [], image_url: null },
    ])
    expect(services.map((service) => service.id)).toEqual(['s1', 's4'])
    expect(services[0].imageUrl).toBe('https://x/c.webp')
    expect(services[1]).not.toHaveProperty('imageUrl')
  })

  it('respeta «precio a consultar»', () => {
    expect(inventoryServicesForWebsite([{ ...row, hide_price: true }])[0].price).toBeNull()
  })

  it('no duplica un servicio del sitio con el mismo nombre, pero le presta la portada', () => {
    const website: Service[] = [{ id: 'w1', title: 'corte ', description: '', icon: 'scissors', color: 'blue', benefits: [] }]
    const merged = mergeInventoryServices(website, inventoryServicesForWebsite([row, { ...row, id: 's5', name: 'Barba' }]))
    expect(merged.map((service) => service.id)).toEqual(['w1', 's5'])
    expect(merged[0].imageUrl).toBe('https://x/c.webp')
  })
})
