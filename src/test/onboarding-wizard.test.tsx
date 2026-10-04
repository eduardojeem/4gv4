import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OnboardingClient } from '@/components/dashboard/onboarding/OnboardingClient'
import { STARTER_CHECKOUT_CHOICES } from '@/lib/onboarding/checkout-choices'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ isAdmin: true }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const props = (over: Partial<Parameters<typeof OnboardingClient>[0]> = {}) => ({
  organization: { id: 'org-1', name: 'Barbería Sur', slug: 'barberia-sur', plan: 'BASIC' },
  subscription: { plan: 'BASIC', status: 'trialing', trialEndsAt: '2026-11-01T00:00:00Z' },
  planName: 'Pro',
  entitledModules: ['pos', 'crm', 'services'],
  servicesEnabled: true,
  hasBusinessData: false,
  completedAt: null,
  stepProgress: { hasCompanyInfo: false, hasProducts: false, hasPublicStore: false, hasTeam: false, hasAgenda: false },
  serverIsAdmin: true,
  initialCompanyInfo: {
    displayName: 'Barbería Sur', currency: 'PYG', timezone: 'America/Asuncion', language: 'es',
    phone: '', email: '', address: '', city: '', weekdays: '', saturday: '', logoUrl: '', ruc: '', whatsapp: '',
    businessType: '', brandColor: 'blue', storefrontPublic: false, businessVertical: 'barbershop', operatingModel: 'service',
    instagram: '', facebook: '', tiktok: '', checkout: { ...STARTER_CHECKOUT_CHOICES },
  },
  ...over,
})

describe('configuración inicial paso a paso', () => {
  it('avanza de a un paso y no deja seguir sin los datos de contacto', () => {
    render(<OnboardingClient {...props()} />)
    // Primer paso: rubro.
    expect(screen.getByText('Rubro y modelo de tu negocio')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Siguiente: Datos y contacto/ }))
    expect(screen.getByText('Identidad y datos de contacto')).toBeInTheDocument()

    // Sin teléfono ni dirección, no avanza.
    fireEvent.click(screen.getByRole('button', { name: /Siguiente: Cobro y entrega/ }))
    expect(screen.getByText('Completá los datos marcados para seguir.')).toBeInTheDocument()
    expect(screen.queryByText('Cómo cobrás y entregás')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Teléfono de contacto/), { target: { value: '981 123 456' } })
    fireEvent.change(screen.getByLabelText(/Dirección comercial/), { target: { value: 'Mcal. López 123' } })
    fireEvent.change(screen.getByLabelText(/^Ciudad/), { target: { value: 'Asunción' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente: Cobro y entrega/ }))
    expect(screen.getByText('Cómo cobrás y entregás')).toBeInTheDocument()
  })

  it('muestra el plan por su nombre y lo sugerido según el rubro', () => {
    render(<OnboardingClient {...props()} />)
    expect(screen.getByText(/Plan Pro/)).toBeInTheDocument()
    // Datos, servicios, agenda, tienda y equipo.
    expect(screen.getByText('0 de 5 pasos listos')).toBeInTheDocument()
    // Barbería con agenda: «Servicios y precios» y el paso de la agenda.
    expect(screen.getByText('Servicios y precios')).toBeInTheDocument()
    expect(screen.getByText('Agenda y reservas')).toBeInTheDocument()
  })

  it('al volver a entrar, las secciones son pestañas', () => {
    render(<OnboardingClient {...props({ completedAt: '2026-10-01T00:00:00Z' })} />)
    expect(screen.getByRole('tab', { name: /Cobro y entrega/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Siguiente:/ })).not.toBeInTheDocument()
  })
})
