import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HeroEditor } from '@/components/admin/website/HeroEditor'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'

const hookState = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  slides: [] as Array<{ active: boolean }>,
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: {
      company_info: { brandColor: 'blue' },
      hero_content: {
        enabled: true,
        badge: 'Servicio especializado',
        title: 'Soluciones para tu celular',
        subtitle: 'Productos y soporte profesional para mantenerte conectado.',
        trustBadges: ['Garantía escrita', 'Atención profesional', 'Soporte técnico'],
        ctaPrimaryText: 'Ver productos',
        ctaSecondaryText: 'Escribinos',
        trackRepairText: 'Rastrear mi reparación',
      },
      hero_stats: { enabled: true, repairs: '100+', satisfaction: '98%', avgTime: '24h' },
      promotional_carousel: { enabled: true, slides: hookState.slides },
    },
    isLoading: false,
    error: null,
    isSaving: false,
    updateSettings: hookState.updateSettings,
  }),
}))

describe('Portada principal', () => {
  beforeEach(() => {
    hookState.updateSettings.mockReset()
    hookState.updateSettings.mockResolvedValue({ success: true })
    hookState.slides = []
  })

  it('se puede ocultar sin perder el contenido', async () => {
    render(<HeroEditor />)

    const visibility = screen.getByRole('switch', { name: 'Alternar visualización de Portada principal' })
    expect(visibility).toBeChecked()
    fireEvent.click(visibility)
    expect(visibility).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar portada' }))
    await waitFor(() => expect(hookState.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        hero_content: expect.objectContaining({ enabled: false, title: 'Soluciones para tu celular' }),
      })
    ))
  })

  it('valida los textos y lleva el foco al campo con error', async () => {
    render(<HeroEditor />)
    fireEvent.change(screen.getByLabelText('Título principal'), { target: { value: 'Corto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar portada' }))
    expect(await screen.findByText('El título debe tener al menos 10 caracteres.')).toBeInTheDocument()
    expect(screen.getByLabelText('Título principal')).toHaveFocus()
    expect(hookState.updateSettings).not.toHaveBeenCalled()
  })

  it('en Clásica guarda textos, botones y números juntos', async () => {
    render(<HeroEditor storefrontStyle="classic" />)
    fireEvent.change(screen.getByLabelText('Título principal'), { target: { value: 'Tu tienda de confianza' } })
    fireEvent.change(screen.getByLabelText(/Botón principal/), { target: { value: 'Explorar catálogo' } })
    fireEvent.change(screen.getByLabelText(/Métrica 1/), { target: { value: '500+' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar portada' }))
    await waitFor(() => expect(hookState.updateSettings).toHaveBeenCalledWith({
      hero_content: expect.objectContaining({ title: 'Tu tienda de confianza', ctaPrimaryText: 'Explorar catálogo' }),
      hero_stats: expect.objectContaining({ repairs: '500+', enabled: true }),
    }))
  })

  it('descarta los cambios', () => {
    render(<HeroEditor />)
    fireEvent.change(screen.getByLabelText('Título principal'), { target: { value: 'Un título nuevo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.getByLabelText('Título principal')).toHaveValue('Soluciones para tu celular')
    expect(screen.getByRole('button', { name: 'Guardar portada' })).toBeDisabled()
  })

  it('pide solo lo que muestra la plantilla: Supermercado no tiene botones ni números', () => {
    render(<HeroEditor storefrontStyle="market" />)
    expect(screen.getByLabelText('Título principal')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Botón principal/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Métrica 1/)).not.toBeInTheDocument()
    expect(screen.getByText(/buscador y el acceso a ofertas/)).toBeInTheDocument()
  })

  it('las insignias que no se muestran en la tienda ya no se editan', () => {
    render(<HeroEditor />)
    expect(screen.queryByText(/Insignias de confianza/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Confianza' })).not.toBeInTheDocument()
  })

  it('avisa cuando los banners ocupan el lugar de la portada', () => {
    hookState.slides = [{ active: true }]
    const { unmount } = render(<HeroEditor storefrontStyle="fashion" />)
    expect(screen.getByText(/se muestran en lugar de esta portada/)).toBeInTheDocument()
    unmount()
    render(<HeroEditor storefrontStyle="classic" />)
    expect(screen.queryByText(/se muestran en lugar de esta portada/)).not.toBeInTheDocument()
  })

  it('una tienda de ropa ve textos de moda y ninguno de reparaciones', () => {
    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'clothing',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce', 'orders'],
    })
    render(<HeroEditor capabilities={capabilities} storefrontStyle="fashion" />)

    expect(screen.getByText(/Moda e indumentaria/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Moda, Calzado & Accesorios' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Servicio Técnico & Reparaciones' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Título principal')).toHaveAttribute('placeholder', 'Estilo, calidad y las mejores marcas para vos')
    expect(screen.getByText('El contenido actual menciona reparaciones o servicio técnico.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Texto del enlace inferior/)).not.toBeInTheDocument()
  })

  it('una barbería empieza con textos de turnos', () => {
    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'barbershop',
      operatingModel: 'service',
      effectiveModules: ['crm', 'services', 'pos'],
    })
    render(<HeroEditor capabilities={capabilities} storefrontStyle="services" />)
    expect(screen.getByRole('button', { name: 'Barbería & Peluquería' })).toHaveTextContent('Recomendado')
    fireEvent.click(screen.getByRole('button', { name: 'Barbería & Peluquería' }))
    expect(screen.getByLabelText(/Botón principal/)).toHaveValue('Reservar turno')
  })

  it('el enlace de reparaciones aparece solo con el módulo activo', () => {
    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'electronics',
      operatingModel: 'repair',
      effectiveModules: ['inventory', 'services', 'repairs'],
    })
    render(<HeroEditor capabilities={capabilities} storefrontStyle="tech" />)
    expect(screen.getByRole('button', { name: 'Servicio Técnico & Reparaciones' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Texto del enlace inferior/)).toBeInTheDocument()
  })
})
