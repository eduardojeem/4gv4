import { describe, expect, it } from 'vitest'
import { getSaasSection, resolveSaasHref } from '../../mobile/src/lib/saas-navigation'

describe('navegación y enlaces públicos SaaS móvil', () => {
  it('mantiene cada sección como una ruta propia con una única selección', () => {
    expect(getSaasSection('/saas')).toBe('inicio')
    expect(getSaasSection('/saas/soluciones')).toBe('soluciones')
    expect(getSaasSection('/saas/negocios')).toBe('negocios')
    expect(getSaasSection('/saas/planes/')).toBe('planes')
    expect(getSaasSection('/panel')).toBeNull()
  })

  it('preserva el plan y admite contacto https sin permitir esquemas ejecutables', () => {
    const site = 'https://www.mitiendapy.com'
    expect(resolveSaasHref('/register?plan=pro%2B', site)).toBe(`${site}/register?plan=pro%2B`)
    expect(resolveSaasHref('https://wa.me/595123', site)).toBe('https://wa.me/595123')
    expect(resolveSaasHref('http://contact.example', site)).toBe('http://contact.example/')
    for (const href of ['javascript:alert(1)', '//evil.test', 'data:text/html,test', '/\\evil.test']) {
      expect(resolveSaasHref(href, site)).toBeNull()
    }
  })
})
