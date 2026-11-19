import { describe, expect, it } from 'vitest'
import {
  canPublishRepairs,
  resolveStorefrontCapabilities,
  verticalOffersRepairs,
} from '@/lib/website/storefront-capabilities'
import type { BusinessVertical, OrganizationModule } from '@/lib/organization/business-profile'

/**
 * El taller («Servicio Técnico & Taller Especializado», «Mis reparaciones») se
 * mostraba en rubros que no reparan y, en la plantilla de electrónica, aunque
 * el dueño hubiera apagado las reparaciones públicas en Sitio Web.
 */
const caps = (businessVertical: BusinessVertical, modules: OrganizationModule[]) =>
  resolveStorefrontCapabilities({ businessVertical, operatingModel: 'mixed', effectiveModules: modules })

describe('taller en la tienda pública', () => {
  it('solo en rubros con taller', () => {
    expect(verticalOffersRepairs('electronics')).toBe(true)
    expect(verticalOffersRepairs('general')).toBe(true)
    expect(verticalOffersRepairs('other')).toBe(true)
    expect(verticalOffersRepairs(null)).toBe(true)
    for (const vertical of ['clothing', 'cosmetics', 'food', 'hardware', 'barbershop', 'beauty_services'] as const) {
      expect(verticalOffersRepairs(vertical)).toBe(false)
      expect(caps(vertical, ['inventory', 'repairs']).hasRepairs).toBe(false)
    }
  })

  it('necesita el módulo de reparaciones', () => {
    expect(caps('electronics', ['inventory']).hasRepairs).toBe(false)
    expect(caps('electronics', ['inventory', 'repairs']).hasRepairs).toBe(true)
  })

  it('y además la opción pública de Sitio Web', () => {
    const conTaller = caps('electronics', ['inventory', 'repairs'])
    expect(canPublishRepairs(conTaller, true, [])).toBe(true)
    expect(canPublishRepairs(conTaller, false, [])).toBe(false)
    expect(canPublishRepairs(caps('clothing', ['inventory', 'repairs']), true, [])).toBe(false)
  })
})
