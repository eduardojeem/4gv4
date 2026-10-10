import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HeroEditor, heroFromBusiness, heroPartsForStyle } from '@/components/admin/website/HeroEditor'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { heroFieldsForStyle } from '@/lib/website/vertical-guidance'

const state = vi.hoisted(() => ({ company: {} as Record<string, unknown> }))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: {
      company_info: state.company,
      hero_content: { enabled: true, badge: 'Barbería', title: 'Tu estilo, en buenas manos', subtitle: 'Cortes, barba y color con profesionales.', trustBadges: [], ctaPrimaryText: '', ctaSecondaryText: '' },
      hero_stats: { enabled: true, repairs: '', satisfaction: '', avgTime: '' },
      promotional_carousel: { enabled: true, slides: [] },
    },
    isLoading: false,
    error: null,
    isSaving: false,
    updateSettings: vi.fn().mockResolvedValue({ success: true }),
  }),
}))

const barbershop = resolveStorefrontCapabilities({ businessVertical: 'barbershop', operatingModel: 'service', effectiveModules: ['crm', 'services', 'pos'] })

beforeEach(() => {
  state.company = { brandColor: 'blue', name: 'JE Sentrix', slogan: 'Cortes clásicos y degradés', description: 'Barbería de barrio con turnos online y atención personalizada.', whatsapp: '595981000000', hours: { weekdays: '09:00 a 20:00' }, address: 'Lomas Valentina' }
})

describe('Portada según la plantilla y el rubro', () => {
  it('en Servicios el botón principal abre la reserva y lo que se completa solo dice de dónde sale', () => {
    const onNavigate = vi.fn()
    render(<HeroEditor capabilities={barbershop} storefrontStyle="services" onNavigate={onNavigate} />)
    expect(screen.getByLabelText(/Botón principal/)).toHaveAccessibleName(/abre la reserva de turnos/)
    expect(screen.getByLabelText(/Botón principal/)).toHaveAttribute('placeholder', 'Reservar turno')
    // En la vista previa y en «Se completa solo».
    expect(screen.getByText('Se completa solo')).toBeInTheDocument()
    expect(screen.getAllByText('09:00 a 20:00')).toHaveLength(2)
    expect(screen.getAllByText('Lomas Valentina')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Ir a la agenda' })).toHaveAttribute('href', '/dashboard/agenda/configuracion#servicios')
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar plantilla' }))
    expect(onNavigate).toHaveBeenCalledWith('company')
  })

  it('una tienda de ropa ve botones de productos, sin el bloque de agenda', () => {
    const clothing = resolveStorefrontCapabilities({ businessVertical: 'clothing', operatingModel: 'retail', effectiveModules: ['inventory', 'ecommerce'] })
    render(<HeroEditor capabilities={clothing} storefrontStyle="fashion" />)
    expect(screen.getByLabelText(/Botón principal/)).toHaveAccessibleName(/lleva a tus productos/)
    expect(screen.queryByText('Se completa solo')).not.toBeInTheDocument()
  })

  it('«Usar los datos de mi negocio» completa con el nombre, el eslogan y la descripción', () => {
    render(<HeroEditor capabilities={barbershop} storefrontStyle="services" />)
    fireEvent.click(screen.getByRole('button', { name: /Usar los datos de mi negocio/ }))
    expect(screen.getByLabelText('Título principal')).toHaveValue('JE Sentrix')
    expect(screen.getByLabelText(/Etiqueta/)).toHaveValue('Cortes clásicos y degradés')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Barbería de barrio con turnos online y atención personalizada.')
  })

  it('sin WhatsApp avisa que el botón de contacto no puede abrir una conversación', () => {
    state.company = { brandColor: 'blue', name: 'JE Sentrix' }
    const onNavigate = vi.fn()
    render(<HeroEditor capabilities={barbershop} storefrontStyle="services" onNavigate={onNavigate} />)
    expect(screen.getByText(/Falta tu WhatsApp o teléfono/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar WhatsApp' }))
    expect(onNavigate).toHaveBeenCalledWith('company')
  })

  it('cada plantilla lista solo las partes que muestra', () => {
    const tech = resolveStorefrontCapabilities({ businessVertical: 'electronics', operatingModel: 'repair', effectiveModules: ['inventory', 'repairs'] })
    expect(heroPartsForStyle('market', heroFieldsForStyle('market', tech))).toEqual(['Frase corta', 'Título', 'Descripción', 'Buscador de productos'])
    expect(heroPartsForStyle('classic', heroFieldsForStyle('classic', tech))).toEqual(['Frase corta', 'Título', 'Descripción', 'Dos botones', 'Seguimiento de reparaciones', 'Tres cifras'])
    expect(heroPartsForStyle('services', heroFieldsForStyle('services', barbershop))).toContain('Horario y dirección')
  })

  it('los datos del negocio solo se usan si alcanzan', () => {
    expect(heroFromBusiness(undefined)).toBeNull()
    expect(heroFromBusiness({ name: 'JE', slogan: '', description: 'corta' })).toEqual({})
  })
})
