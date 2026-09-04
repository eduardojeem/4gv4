import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HeroEditor } from '@/components/admin/website/HeroEditor'

const hookState = vi.hoisted(() => ({
  updateSettings: vi.fn(),
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
    },
    isLoading: false,
    error: null,
    isSaving: false,
    updateSettings: hookState.updateSettings,
  }),
}))

describe('HeroEditor visibility control', () => {
  beforeEach(() => {
    global.ResizeObserver = class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    hookState.updateSettings.mockReset()
    hookState.updateSettings.mockResolvedValue({ success: true })
  })

  it('lets an administrator hide the Hero without removing its content', async () => {
    render(<HeroEditor />)

    const visibility = screen.getByRole('switch', { name: 'Alternar visualización de Portada principal' })
    expect(visibility).toBeChecked()

    fireEvent.click(visibility)
    expect(visibility).not.toBeChecked()
    expect(screen.getByText('Oculto en la Web')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar Hero' }))

    await waitFor(() => expect(hookState.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        hero_content: expect.objectContaining({ enabled: false, title: 'Soluciones para tu celular' }),
      })
    ))
  })

  it('organizes editing into three sections with templates closed initially', () => {
    render(<HeroEditor />)
    expect(screen.getByRole('tab', { name: 'Textos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Botones' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Confianza' })).toBeInTheDocument()
    expect(screen.getByText('Usar una plantilla').closest('details')).not.toHaveAttribute('open')
    expect(screen.queryByLabelText(/Botón principal/)).not.toBeInTheDocument()
  })

  it('keeps drafts when navigating and returns to texts for validation', async () => {
    render(<HeroEditor />)
    fireEvent.change(screen.getByLabelText('Título principal'), { target: { value: 'Corto' } })
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Botones' }), { button: 0, ctrlKey: false })
    expect(screen.getByRole('tab', { name: 'Botones' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Hero' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Textos' })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByLabelText('Título principal')).toHaveValue('Corto')
    expect(screen.getByText('El título debe tener al menos 10 caracteres.')).toBeInTheDocument()
    expect(hookState.updateSettings).not.toHaveBeenCalled()
  })

  it('saves edits from all sections together', async () => {
    render(<HeroEditor />)
    fireEvent.change(screen.getByLabelText('Título principal'), { target: { value: 'Tu tienda de confianza' } })
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Botones' }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByLabelText(/Botón principal/), { target: { value: 'Explorar catálogo' } })
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Confianza' }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByLabelText('Insignia 2'), { target: { value: 'Envíos nacionales' } })
    fireEvent.change(screen.getByLabelText(/Métrica 1/), { target: { value: '500+' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Hero' }))
    await waitFor(() => expect(hookState.updateSettings).toHaveBeenCalledWith({
      hero_content: expect.objectContaining({
        title: 'Tu tienda de confianza', ctaPrimaryText: 'Explorar catálogo',
        trustBadges: ['Garantía escrita', 'Envíos nacionales', 'Soporte técnico'],
      }),
      hero_stats: expect.objectContaining({ repairs: '500+', enabled: true }),
    }))
  })

  it('opens preview without saving and discards edits across sections', () => {
    render(<HeroEditor />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    expect(screen.getByRole('button', { name: 'Ocultar vista previa' })).toHaveAttribute('aria-expanded', 'true')
    expect(hookState.updateSettings).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Título principal'), { target: { value: 'Un título nuevo' } })
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Confianza' }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByLabelText(/Métrica 1/), { target: { value: '500+' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.getByLabelText(/Métrica 1/)).toHaveValue('100+')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Textos' }), { button: 0, ctrlKey: false })
    expect(screen.getByLabelText('Título principal')).toHaveValue('Soluciones para tu celular')
    expect(screen.getByRole('button', { name: 'Guardar Hero' })).toBeDisabled()
  })
})
