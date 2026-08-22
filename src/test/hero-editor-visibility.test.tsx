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

    const visibility = screen.getByRole('switch', { name: 'Mostrar Hero en la página de inicio' })
    expect(visibility).toBeChecked()

    fireEvent.click(visibility)
    expect(visibility).not.toBeChecked()
    expect(screen.getByText('Hero oculto')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar Hero' }))

    await waitFor(() => expect(hookState.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        hero_content: expect.objectContaining({ enabled: false, title: 'Soluciones para tu celular' }),
      })
    ))
  })
})
