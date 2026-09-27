import { describe, expect, it } from 'vitest'
import { getActivePublicServices, isPublicServicesPageAvailable } from '@/lib/website/services'
import type { Service } from '@/types/website-settings'

const services: Service[] = [
  {
    id: 'active',
    title: 'Cambio de pantalla',
    description: 'Reemplazo profesional de pantalla.',
    icon: 'smartphone',
    color: 'blue',
    benefits: ['Diagnóstico incluido'],
    active: true,
  },
  {
    id: 'hidden',
    title: 'Servicio oculto',
    description: 'Este servicio no debe publicarse.',
    icon: 'wrench',
    color: 'gray',
    benefits: ['No visible'],
    active: false,
  },
]

describe('public services state', () => {
  it('returns only active services', () => {
    expect(getActivePublicServices(services).map((service) => service.id)).toEqual(['active'])
  })

  it('keeps the page available by default when an active service exists', () => {
    expect(isPublicServicesPageAvailable(undefined, services)).toBe(true)
  })

  it('disables the page when the organization turns it off', () => {
    expect(isPublicServicesPageAvailable(false, services)).toBe(false)
  })

  it('enables the page when explicitly enabled by organization', () => {
    expect(isPublicServicesPageAvailable(true, [])).toBe(true)
  })

  it('hides the page when every service is inactive and not explicitly enabled', () => {
    expect(isPublicServicesPageAvailable(undefined, services.map((service) => ({ ...service, active: false })))).toBe(false)
  })
})
