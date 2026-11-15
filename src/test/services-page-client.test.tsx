import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'
import { ServicesPageClient } from '@/app/(public)/servicios/ServicesPageClient'
import { inventoryServicesForWebsite } from '@/lib/website/inventory-services'
import type { Service } from '@/types/website-settings'

vi.mock('@/lib/public/tenant-client', () => ({
  usePublicTenantPrefix: () => ({ tenantPrefix: '/juanbarber' }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const services: Service[] = [
  {
    id: 'srv-1',
    title: 'Corte de Autor & Visagismo',
    description: 'Asesoramiento de estilo, degradado y terminación a navaja.',
    price: 50000,
    icon: 'scissors',
    color: 'amber',
    benefits: ['Incluye lavado', 'Terminación a navaja'],
    category: 'Cortes',
    featured: true,
    active: true,
    imageUrl: 'https://cdn.test/corte-autor.jpg',
    source: 'inventory',
  },
  {
    id: 'srv-2',
    title: 'Ritual de Barba a Navaja',
    description: 'Toalla caliente, aceites esenciales y perfilado.',
    price: 45000,
    icon: 'scissors',
    color: 'blue',
    benefits: [],
    category: 'Barba',
    featured: false,
    active: true,
    source: 'inventory',
  },
  {
    id: 'srv-3',
    title: 'Diagnóstico Capilar',
    description: 'Evaluación gratuita presencial.',
    price: 0,
    icon: 'sparkles',
    color: 'green',
    benefits: [],
    category: 'Tratamientos',
    featured: false,
    active: true,
    source: 'catalog',
  },
]

describe('ServicesPageClient integrado con agenda y especial-para-barbero', () => {
  it('muestra duración real, profesionales, enlace directo ?servicio= y filtros funcionales', () => {
    render(
      <StorefrontStyleProvider style="especial-para-barbero">
        <ServicesPageClient
          services={services}
          companyName="JuanBarber"
          whatsapp="595981111222"
          businessVertical="barbershop"
          onlineBookingEnabled={true}
          bookingHref="/juanbarber/turnos"
          currency="PYG"
          agendaServices={[
            {
              productId: 'srv-1',
              name: 'Corte de Autor & Visagismo',
              price: 50000,
              hidePrice: false,
              durationMinutes: 45,
              online: true,
              catalogVisible: true,
            },
            {
              productId: 'srv-2',
              name: 'Ritual de Barba a Navaja',
              price: 45000,
              hidePrice: false,
              durationMinutes: 30,
              online: false,
              catalogVisible: true,
            },
          ]}
          professionals={[
            {
              id: 'pro-1',
              name: 'Juan Pérez',
              specialty: 'Master Barber',
              color: '#b45309',
              serviceIds: ['srv-1'],
            },
            {
              id: 'pro-2',
              name: 'Carlos Gómez',
              specialty: 'Estilista',
              color: '#1e293b',
              serviceIds: [],
            },
          ]}
        />
      </StorefrontStyleProvider>
    )

    // Placeholder adaptado al rubro barbería (sin textos genéricos de reparación/costura)
    expect(screen.getByPlaceholderText(/cort.*barba/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reservar turno ahora/i })).toHaveAttribute('href', '/juanbarber/turnos')

    // Tarjeta 1: reserva online habilitada con ?servicio=srv-1 y duración de agenda
    const bookLinks = screen.getAllByRole('link', { name: 'Reservar turno' })
    expect(bookLinks).toHaveLength(1)
    expect(bookLinks[0]).toHaveAttribute('href', '/juanbarber/turnos?servicio=srv-1')
    expect(screen.getByText('45 min')).toBeInTheDocument()
    expect(screen.getByText('Gratuito')).toBeInTheDocument()

    // Equipo de profesionales visible al pie
    expect(screen.getByText('Nuestro equipo de atención')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()

    // Filtro por "Reserva online" oculta los servicios solo de consulta
    fireEvent.click(screen.getByRole('button', { name: /Reserva online/i }))
    expect(screen.getByRole('heading', { name: 'Corte de Autor & Visagismo' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ritual de Barba a Navaja' })).not.toBeInTheDocument()

    // Limpia filtro con búsqueda
    fireEvent.change(screen.getByLabelText('Buscar servicio'), { target: { value: 'inexistente' } })
    expect(screen.getByText('No se encontraron servicios')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todos los servicios' }))
    expect(screen.getByRole('heading', { name: 'Ritual de Barba a Navaja' })).toBeInTheDocument()
  })

  it('inventoryServicesForWebsite adapta categoría e ícono para barbería sin textos de reparación', () => {
    const mapped = inventoryServicesForWebsite(
      [{ id: 's1', name: 'Fade Clásico', sale_price: 50000, visibility: 'public', is_active: true }],
      { businessVertical: 'barbershop' },
    )
    expect(mapped[0].category).toBe('Barbería y Salón')
    expect(mapped[0].icon).toBe('scissors')
    expect(mapped[0].benefits).toEqual([])
  })
})
