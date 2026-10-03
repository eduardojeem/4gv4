import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ updateSetting: vi.fn(), settings: {} as Record<string, unknown> }))

vi.mock('next/navigation', () => ({ usePathname: () => '/don-pepe/inicio' }))
vi.mock('@/components/public/agenda/PublicBooking', () => ({
  PublicBooking: ({ slug, initialServiceId }: { slug: string; initialServiceId?: string }) => (
    <div data-testid="public-booking">{`${slug}|${initialServiceId ?? ''}`}</div>
  ),
}))
vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({ settings: state.settings, isLoading: false, updateSetting: state.updateSetting }),
}))

import { getSuggestedModules } from '@/lib/organization/business-profile'
import { STARTER_CATEGORIES } from '@/lib/organization/starter-kit'
import { resolveStorefrontStyle, suggestStorefrontAppearance } from '@/lib/website/storefront-style'
import { applyWebsiteSettingsDefaults, getWebsiteDefaultsForVertical } from '@/lib/website/default-settings'
import { validateSetting } from '@/lib/validation/website-settings'
import { missingSuggestedServices, serviceSku, suggestedServicesFor } from '@/lib/agenda/suggested-services'
import { BookingSection, ServiceMenu } from '@/components/public/inicio/ServicesHome'
import { BookingSectionEditor } from '@/components/admin/website/BookingSectionEditor'
import { getVerticalRecommendation } from '@/lib/guide/vertical-recommendations'
import { defaultOperatingModelFor } from '@/lib/organization/business-profile'
import { professionalDoesService, professionalsForService } from '@/lib/agenda/agenda-server'
import { formatNextSlot } from '@/components/public/inicio/ServicesHome'
import { APP_ROUTE_SLUGS } from '@/lib/saas/reserved-slugs'

describe('el rubro barbería adapta el sistema', () => {
  it('sugiere la agenda (servicios), caja, clientes e inventario; nada de taller', () => {
    const modules = getSuggestedModules('barbershop', 'service')
    expect(modules).toEqual(expect.arrayContaining(['services', 'pos', 'crm', 'inventory']))
    expect(modules).not.toContain('repairs')
  })

  it('al registrarse arranca como prestación de servicios', () => {
    expect(defaultOperatingModelFor('barbershop')).toBe('service')
    expect(defaultOperatingModelFor('clothing')).toBe('retail')
  })

  it('arranca con categorías de barbería', () => {
    expect(STARTER_CATEGORIES.barbershop).toEqual(['Cortes', 'Barba', 'Color', 'Tratamientos', 'Productos'])
  })

  it('en Automático la tienda usa la plantilla Servicios, y la sugerencia la propone', () => {
    expect(resolveStorefrontStyle('auto', 'barbershop')).toBe('services')
    expect(suggestStorefrontAppearance({ businessVertical: 'barbershop' })).toMatchObject({
      style: 'services',
      reason: 'Tu rubro es barbería y peluquería.',
    })
  })

  it('la tienda nueva arranca invitando a reservar y con la reserva en el inicio', () => {
    const defaults = getWebsiteDefaultsForVertical('barbershop', 'service')
    expect(defaults.hero_content).toMatchObject({ ctaPrimaryText: 'Reservar turno' })
    expect(defaults.booking_section).toMatchObject({ enabled: true, showTeam: true })
    // Los demás rubros no la muestran si no la activan.
    expect(applyWebsiteSettingsDefaults({}).booking_section?.enabled).toBe(false)
  })

  it('la guía de primeros pasos es de barbería', () => {
    expect(getVerticalRecommendation('barbershop').title).toBe('Barbería y Peluquería')
  })
})

describe('servicios sugeridos para la agenda', () => {
  it('solo los rubros con lista propia tienen sugerencias', () => {
    expect(suggestedServicesFor('barbershop').length).toBeGreaterThan(3)
    expect(suggestedServicesFor('clothing')).toEqual([])
  })

  it('no sugiere los que ya están cargados (sin importar acentos ni mayúsculas)', () => {
    const missing = missingSuggestedServices('barbershop', ['CORTE CLASICO', 'Corte + Barba'])
    expect(missing.map((service) => service.name)).not.toContain('Corte clásico')
    expect(missing.map((service) => service.name)).not.toContain('Corte + barba')
  })

  it('el SKU es válido para la API de productos', () => {
    expect(serviceSku('Color / tintura', () => 0.5)).toMatch(/^SRV-COLOR-TINTURA-[A-Z0-9]{4}$/)
  })
})

describe('sección «Reservá tu turno»', () => {
  const agenda = {
    currency: 'PYG',
    services: [{ id: 's1', name: 'Corte', duration: 30, price: 50000 }],
    professionals: [{ id: 'p1', name: 'Pepe', color: '#0f766e' }, { id: 'p2', name: 'Lucas', color: '#b45309' }],
  }

  it('se valida como una sección más del sitio', () => {
    expect(validateSetting('booking_section', { enabled: true, title: 'Reservá', subtitle: '', showTeam: false }).success).toBe(true)
    expect(validateSetting('booking_section', { enabled: true }).success).toBe(false)
  })

  it('muestra el título, el equipo y la reserva con el servicio elegido en la carta', () => {
    render(
      <BookingSection
        settings={{ enabled: true, title: 'Reservá tu corte', subtitle: 'Sin llamadas', showTeam: true }}
        agenda={agenda}
        slug="don-pepe"
        serviceId="s1"
      />
    )
    expect(screen.getByRole('heading', { name: 'Reservá tu corte' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Nuestro equipo' })).toHaveTextContent('Lucas')
    expect(screen.getByTestId('public-booking')).toHaveTextContent('don-pepe|s1')
  })

  it('sin «mostrar equipo», no aparece', () => {
    render(<BookingSection settings={{ enabled: true, title: 'Reservá', subtitle: '', showTeam: false }} agenda={agenda} slug="don-pepe" />)
    expect(screen.queryByRole('list', { name: 'Nuestro equipo' })).not.toBeInTheDocument()
  })

  it('con la reserva en la página, «Reservar» de la carta elige el servicio en vez de navegar', () => {
    const onBook = vi.fn()
    render(
      <ServiceMenu
        menu={[{ id: 's1', name: 'Corte', bookingHref: '/don-pepe/turnos?servicio=s1' }]}
        bookingHref="#reservar"
        onBook={onBook}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reservar Corte' }))
    expect(onBook).toHaveBeenCalledWith('s1')
  })

  it('el editor avisa si la agenda no toma reservas online y guarda la sección', async () => {
    state.settings = { booking_section: { enabled: true, title: 'Reservá tu turno', subtitle: '', showTeam: true } }
    state.updateSetting.mockResolvedValue({ success: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, settings: { online_booking: false }, services: [{ online: true }], professionals: [] }),
    }))

    render(<BookingSectionEditor orgSlug="don-pepe" />)
    expect(await screen.findByText('Reservas online apagadas')).toBeInTheDocument()
    expect(screen.getByText(/no se va a ver hasta que actives las reservas online/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Reservá tu corte' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() =>
      expect(state.updateSetting).toHaveBeenCalledWith('booking_section', expect.objectContaining({ title: 'Reservá tu corte', enabled: true }))
    )
    vi.unstubAllGlobals()
  })
})

describe('qué servicios hace cada profesional', () => {
  const ana = { service_ids: ['color'] }
  const pepe = { service_ids: [] as string[] }

  it('sin servicios asignados hace todos (agendas de antes); con asignados, solo esos', () => {
    expect(professionalDoesService(pepe, 'barba')).toBe(true)
    expect(professionalDoesService(ana, 'color')).toBe(true)
    expect(professionalDoesService(ana, 'barba')).toBe(false)
    expect(professionalsForService([ana, pepe], 'barba')).toEqual([pepe])
  })
})

describe('próximo turno libre', () => {
  it('se lee como hoy, mañana o el día de la semana', () => {
    expect(formatNextSlot({ date: '2026-10-02', time: '15:30', isToday: true, isTomorrow: false })).toBe('Hoy 15:30')
    expect(formatNextSlot({ date: '2026-10-03', time: '10:00', isToday: false, isTomorrow: true })).toBe('Mañana 10:00')
    // 8 de octubre de 2026 es jueves.
    expect(formatNextSlot({ date: '2026-10-08', time: '09:00', isToday: false, isTomorrow: false })).toBe('jue 8 · 09:00')
  })
})

describe('reservas en el subdominio propio', () => {
  it('«turnos» queda reservado: ninguna tienda puede tapar la página de reservas', () => {
    expect(APP_ROUTE_SLUGS).toContain('turnos')
  })
})
