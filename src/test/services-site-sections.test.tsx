import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('next/navigation', () => ({ usePathname: () => '/don-pepe/inicio' }))
vi.mock('@/components/public/agenda/PublicBooking', () => ({ PublicBooking: () => <div>reserva</div> }))
vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({
    settings: {
      company_info: { name: 'Barbería Don Pepe' },
      services: [],
      gallery_section: { enabled: true, title: 'Trabajos', subtitle: '', images: [{ id: 'a', url: 'https://x/a.webp' }] },
    },
  }),
}))

import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'
import { BookingSection, ServiceGallery, ServiceTeam, ServicesLocation } from '@/components/public/inicio/ServicesHome'
import { PublicFooter } from '@/components/public/PublicFooter'
import { validateSetting } from '@/lib/validation/website-settings'
import { applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'
import type { CompanyInfo } from '@/types/website-settings'

const enServicios = (ui: React.ReactNode) => render(<StorefrontStyleProvider style="services">{ui}</StorefrontStyleProvider>)

describe('galería de trabajos', () => {
  const images = [
    { id: 'a', url: 'https://cdn/a.webp', caption: 'Fade bajo' },
    { id: 'b', url: 'https://cdn/b.webp' },
  ]

  it('se valida y arranca vacía', () => {
    expect(validateSetting('gallery_section', { enabled: true, title: 'T', subtitle: '', images }).success).toBe(true)
    const doce = Array.from({ length: 13 }, (_, index) => ({ id: String(index), url: 'https://cdn/x.webp' }))
    expect(validateSetting('gallery_section', { enabled: true, title: 'T', subtitle: '', images: doce }).success).toBe(false)
    expect(applyWebsiteSettingsDefaults({}).gallery_section).toMatchObject({ enabled: true, images: [] })
  })

  it('muestra las fotos y amplía la que se toca', () => {
    enServicios(<ServiceGallery settings={{ enabled: true, title: 'Nuestros trabajos', subtitle: '', images }} />)
    expect(screen.getByRole('heading', { name: 'Nuestros trabajos' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver foto: Fade bajo' }))
    expect(within(screen.getByRole('dialog')).getByRole('img', { name: 'Fade bajo' })).toHaveAttribute('src', 'https://cdn/a.webp')
  })

  it('apagada o sin fotos, no aparece', () => {
    const { container } = enServicios(<ServiceGallery settings={{ enabled: false, title: 'X', subtitle: '', images }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('el equipo con foto y especialidad', () => {
  const agenda = {
    currency: 'PYG',
    services: [],
    professionals: [
      { id: '1', name: 'Pepe', color: '#000000', photoUrl: 'https://cdn/pepe.webp', specialty: 'Barbero · fades' },
      { id: '2', name: 'Ana', color: '#7c3aed', photoUrl: null, specialty: null },
    ],
  }

  it('en la sección de equipo', () => {
    const { container } = enServicios(<ServiceTeam agenda={agenda} />)
    expect(screen.getByText('Barbero · fades')).toBeInTheDocument()
    expect(container.querySelector('img[src="https://cdn/pepe.webp"]')).not.toBeNull()
    // Sin foto, su inicial.
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('y dentro de la reserva', () => {
    enServicios(<BookingSection settings={{ enabled: true, title: 'Reservá', subtitle: '', showTeam: true }} agenda={agenda} slug="don-pepe" />)
    expect(within(screen.getByRole('list', { name: 'Nuestro equipo' })).getByText('Barbero · fades')).toBeInTheDocument()
  })
})

describe('cómo llegar', () => {
  const company = {
    name: 'Don Pepe',
    address: 'Av. España 1234',
    whatsapp: '595981123456',
    phone: '021 555 000',
    hours: { weekdays: '9 a 20', saturday: '9 a 14', sunday: '' },
  } as CompanyInfo

  it('dirección, mapa, WhatsApp, llamada y los horarios cargados', () => {
    enServicios(<ServicesLocation companyInfo={company} bookingHref="#reservar" />)
    expect(screen.getByRole('link', { name: /Abrir en Google Maps/ })).toHaveAttribute('href', expect.stringContaining('Av.%20Espa%C3%B1a%201234'))
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/595981123456')
    expect(screen.getByRole('link', { name: /Llamar/ })).toHaveAttribute('href', 'tel:021555000')
    expect(screen.getByText('Sábados')).toBeInTheDocument()
    // El domingo vacío no se inventa.
    expect(screen.queryByText('Domingos')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reservar turno/ })).toHaveAttribute('href', '#reservar')
  })
})

describe('el pie de página de la plantilla Servicios', () => {
  it('lleva a las secciones del negocio, no a productos ni seguimiento de pedidos', () => {
    enServicios(<PublicFooter />)
    expect(screen.getByRole('link', { name: 'Servicios y precios' })).toHaveAttribute('href', '/don-pepe/inicio#servicios')
    expect(screen.getByRole('link', { name: 'Galería de trabajos' })).toHaveAttribute('href', '/don-pepe/inicio#galeria')
    expect(screen.queryByRole('link', { name: 'Productos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Rastrear Pedidos' })).not.toBeInTheDocument()
  })
})

describe('la agenda sin la migración de fotos', () => {
  it('lee a los profesionales sin foto en vez de desaparecer', async () => {
    const calls: string[] = []
    const result = (data: unknown, error: { message: string } | null = null) => ({ data, error })
    const chain = (table: string) => {
      let columns = ''
      const builder: Record<string, unknown> = {}
      builder.select = (cols: string) => { columns = cols; calls.push(`${table}:${cols}`); return builder }
      builder.eq = () => builder
      builder.order = () => builder
      builder.limit = () => builder
      builder.maybeSingle = () => Promise.resolve(result(null))
      builder.then = (resolve: (value: unknown) => void) => {
        if (table === 'agenda_professionals' && columns.includes('photo_url')) return resolve(result(null, { message: 'column agenda_professionals.photo_url does not exist' }))
        if (table === 'agenda_professionals') return resolve(result([{ id: 'p1', name: 'Pepe', color: '#000000', phone: null, is_active: true, sort_order: 0 }]))
        return resolve(result([]))
      }
      return builder
    }
    const client = { from: (table: string) => chain(table) } as unknown as SupabaseClient

    const config = await loadAgendaConfig(client, 'org')
    expect(config?.professionals.map((professional) => professional.name)).toEqual(['Pepe'])
    expect(calls.filter((call) => call.startsWith('agenda_professionals'))).toHaveLength(2)
  })
})
