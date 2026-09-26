import { describe, expect, it } from 'vitest'
import {
  canPublishRepairs,
  canPublishServices,
  getCompatibleHeroPresetIds,
  resolvePublishedHeroActions,
  resolveStorefrontCapabilities,
} from './storefront-capabilities'

describe('resolveStorefrontCapabilities', () => {
  it('adapta una tienda de ropa a catálogo y seguimiento de pedidos', () => {
    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'clothing',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce', 'orders', 'delivery'],
    })

    expect(capabilities.businessLabel).toBe('Moda e indumentaria')
    expect(capabilities.hasServices).toBe(false)
    expect(capabilities.hasRepairs).toBe(false)
    expect(capabilities.primaryAction).toEqual({ kind: 'products', href: '/productos' })
    expect(capabilities.tracking).toEqual({ kind: 'orders', href: '/track' })
    expect(capabilities.metricLabels).toEqual(['Clientes', 'Valoración', 'Entrega'])
    expect(getCompatibleHeroPresetIds(capabilities)).toEqual(['fashion', 'general'])
  })

  it('recomienda contenido de cosmética sin prometer reparaciones', () => {
    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'cosmetics',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce', 'orders'],
    })

    expect(capabilities.businessLabel).toBe('Cosmética y belleza')
    expect(getCompatibleHeroPresetIds(capabilities)).toEqual(['cosmetics', 'general'])
    expect(capabilities.metricLabels).toEqual(['Clientes', 'Valoración', 'Entrega'])
  })

  it('dirige una organización de servicios a su catálogo de servicios', () => {
    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'general',
      operatingModel: 'service',
      effectiveModules: ['crm', 'services'],
    })

    expect(capabilities.hasCatalog).toBe(false)
    expect(capabilities.hasServices).toBe(true)
    expect(capabilities.primaryAction).toEqual({ kind: 'services', href: '/servicios' })
    expect(capabilities.tracking).toEqual({ kind: 'none', href: null })
    expect(capabilities.metricLabels).toEqual(['Servicios', 'Satisfacción', 'Respuesta'])
    expect(getCompatibleHeroPresetIds(capabilities)).toEqual(['services', 'general'])
  })

  it('solo habilita información de reparaciones cuando el módulo es efectivo', () => {
    const withoutModule = resolveStorefrontCapabilities({
      businessVertical: 'electronics',
      operatingModel: 'repair',
      effectiveModules: ['inventory', 'services'],
    })
    const withModule = resolveStorefrontCapabilities({
      businessVertical: 'electronics',
      operatingModel: 'repair',
      effectiveModules: ['inventory', 'services', 'repairs'],
    })

    expect(withoutModule.hasRepairs).toBe(false)
    expect(withoutModule.tracking.kind).toBe('none')
    expect(getCompatibleHeroPresetIds(withoutModule)).not.toContain('repairs')

    expect(withModule.hasRepairs).toBe(true)
    expect(withModule.tracking).toEqual({ kind: 'repairs', href: '/mis-reparaciones' })
    expect(withModule.metricLabels).toEqual(['Reparaciones', 'Satisfacción', 'Tiempo prom.'])
    expect(getCompatibleHeroPresetIds(withModule)).toEqual(['repairs', 'tech', 'services', 'general'])
  })

  it('oculta funciones configuradas si el módulo correspondiente está deshabilitado', () => {
    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'electronics',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce'],
    })

    expect(canPublishServices(capabilities, true, [{ active: true }])).toBe(false)
    expect(canPublishRepairs(capabilities, true, [{ active: true, title: 'Reparación de pantalla' }])).toBe(false)
  })

  it('no enlaza a una sección de servicios oculta y omite rastreo inexistente', () => {
    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'general',
      operatingModel: 'service',
      effectiveModules: ['crm', 'services'],
    })

    expect(resolvePublishedHeroActions(capabilities, {
      servicesVisible: false,
      repairsVisible: false,
    })).toEqual({
      primary: { kind: 'contact', href: null },
      tracking: { kind: 'none', href: null },
    })
  })
})
