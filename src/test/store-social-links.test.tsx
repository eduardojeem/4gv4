import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/tienda-demo/inicio' }))
vi.mock('@/hooks/useWebsiteSettings', () => ({ useWebsiteSettings: () => ({ settings: null, isLoading: false }) }))

import { PublicFooter } from '@/components/public/PublicFooter'
import { ContactCTA } from '@/components/public/inicio/ContactCTA'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { getSocialLinks, socialHandle, socialProfileUrl } from '@/lib/public/social-links'
import type { WebsiteSettings } from '@/types/website-settings'

const ajustes = (redes: { instagram?: string; facebook?: string; tiktok?: string }) => ({
  company_info: {
    name: 'DA Básica',
    phone: '0981000000',
    email: '',
    address: '',
    hours: { weekdays: '', saturday: '', sunday: '' },
    ...redes,
  },
  services: [],
  testimonials: [],
  process_steps: [],
  process_flows: [],
}) as unknown as WebsiteSettings

/**
 * El dueño escribe lo que tiene a mano. El encabezado ya lo normalizaba, pero
 * el modal del marketplace pegaba el valor al dominio: con la URL entera
 * guardada, el enlace quedaba roto.
 */
describe('la dirección de cada red', () => {
  it('acepta el usuario suelto, con arroba, con dominio o con la URL entera', () => {
    for (const escrito of ['da_confecciones', '@da_confecciones', 'instagram.com/da_confecciones', 'https://instagram.com/da_confecciones', 'https://www.instagram.com/da_confecciones/']) {
      expect(socialProfileUrl(escrito, 'instagram')).toBe('https://instagram.com/da_confecciones')
    }
  })

  it('limpia la barra final y lo que venga después', () => {
    expect(socialHandle('da_confeccioness/', 'instagram')).toBe('da_confeccioness')
    expect(socialHandle('https://facebook.com/mi.tienda?ref=bookmarks', 'facebook')).toBe('mi.tienda')
  })

  it('TikTok lleva la arroba en su dirección', () => {
    expect(socialProfileUrl('mitienda', 'tiktok')).toBe('https://tiktok.com/@mitienda')
    expect(socialProfileUrl('https://tiktok.com/@mitienda', 'tiktok')).toBe('https://tiktok.com/@mitienda')
  })

  it('sin nada cargado no hay enlace', () => {
    expect(socialProfileUrl('', 'instagram')).toBe('')
    expect(socialProfileUrl('   ', 'facebook')).toBe('')
    expect(socialProfileUrl(null, 'tiktok')).toBe('')
    expect(getSocialLinks(null)).toEqual([])
    expect(getSocialLinks({ instagram: '', facebook: '', tiktok: '' })).toEqual([])
  })

  it('arma la lista en orden, con lo que se muestra', () => {
    expect(getSocialLinks({ instagram: '@tienda', facebook: 'https://facebook.com/tienda', tiktok: 'tienda' })).toEqual([
      { platform: 'instagram', label: 'Instagram', handle: '@tienda', href: 'https://instagram.com/tienda' },
      { platform: 'facebook', label: 'Facebook', handle: 'tienda', href: 'https://facebook.com/tienda' },
      { platform: 'tiktok', label: 'TikTok', handle: '@tienda', href: 'https://tiktok.com/@tienda' },
    ])
  })
})

describe('el pie de la tienda', () => {
  it('muestra las redes cargadas, con su enlace', () => {
    render(<PublicFooter initialSettings={ajustes({ instagram: 'da_confeccioness/', tiktok: '@da' })} />)

    const instagram = screen.getByRole('link', { name: /Instagram de DA Básica/ })
    expect(instagram).toHaveAttribute('href', 'https://instagram.com/da_confeccioness')
    expect(instagram).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: /TikTok de DA Básica/ })).toHaveAttribute('href', 'https://tiktok.com/@da')
    expect(screen.getByText('Seguinos')).toBeInTheDocument()
  })

  it('sin redes cargadas no muestra la sección', () => {
    render(<PublicFooter initialSettings={ajustes({})} />)
    expect(screen.queryByText('Seguinos')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Instagram/ })).not.toBeInTheDocument()
  })

  it('solo aparecen las que el dueño cargó', () => {
    render(<PublicFooter initialSettings={ajustes({ facebook: 'mi.tienda' })} />)
    expect(screen.getByRole('link', { name: /Facebook de DA Básica/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Instagram de/ })).not.toBeInTheDocument()
  })

  it('van en el cierre, a la misma altura que el copyright', () => {
    render(<PublicFooter initialSettings={ajustes({ instagram: 'da' })} />)

    const cierre = screen.getByText(/Todos los derechos reservados/).closest('div')
    expect(cierre).not.toBeNull()
    expect(cierre!.textContent).toContain('Seguinos')
    expect(cierre!.querySelector('a[aria-label^=\"Instagram de\"]')).not.toBeNull()
  })
})

/**
 * El pie es el final de la pagina. Quien baja hasta «Contacto» ya esta
 * buscando como seguir a la tienda, asi que ahi tienen que estar a la vista.
 */
describe('la seccion de contacto de la tienda', () => {
  const empresa = (redes: { instagram?: string; facebook?: string; tiktok?: string }) => ({
    name: 'DA Básica',
    phone: '0981000000',
    email: 'hola@dabasica.com',
    address: 'Encarnación, Paraguay',
    hours: { weekdays: 'Lunes a Viernes, 08:00 a 18:00', saturday: '', sunday: '' },
    ...redes,
  }) as never

  const dibujar = (redes: { instagram?: string; facebook?: string; tiktok?: string }) =>
    render(
      <ContactCTA
        companyInfo={empresa(redes)}
        brand={getBrandTheme('blue')}
        phoneClean="595981000000"
        contactHref="https://wa.me/595981000000"
      />
    )

  it('muestra cada red con su nombre y el usuario', () => {
    dibujar({ instagram: 'da_confeccioness/', tiktok: '@da' })

    expect(screen.getByText('Seguinos en redes')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Instagram de DA Básica/ })).toHaveAttribute(
      'href',
      'https://instagram.com/da_confeccioness'
    )
    // El usuario se lee, no solo el icono.
    expect(screen.getByText('@da_confeccioness')).toBeInTheDocument()
    expect(screen.getByText('@da')).toBeInTheDocument()
  })

  it('sin redes cargadas no ocupa lugar', () => {
    dibujar({})
    expect(screen.queryByText('Seguinos en redes')).not.toBeInTheDocument()
  })
})

describe('el modal de empresas del marketplace', () => {
  it('usa la misma regla para los enlaces', () => {
    const fuente = readFileSync(resolve(process.cwd(), 'src/components/public/OrganizationDetailModal.tsx'), 'utf8')
    expect(fuente).toContain('getSocialLinks(organization)')
    // Ya no se arma pegando el valor al dominio.
    expect(fuente).not.toContain('`https://instagram.com/${organization.instagram')
    expect(fuente).not.toContain('`https://tiktok.com/@${organization.tiktok')
  })
})

describe('el encabezado de la tienda', () => {
  it('usa la misma regla, sin su copia', () => {
    const fuente = readFileSync(resolve(process.cwd(), 'src/components/public/PublicHeader.tsx'), 'utf8')
    expect(fuente).toContain('socialProfileUrl(')
    // Su version pegaba el dominio dos veces con «instagram.com/tienda».
    expect(fuente).not.toContain('function formatSocialUrl')
  })
})
