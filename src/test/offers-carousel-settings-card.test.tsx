/**
 * Panel de /dashboard/promotions que activa o desactiva el carrusel público.
 *
 * Lo importante acá es que el on/off esté accesible sin abrir el colapsable y
 * que persista solo, pero sin guardar a medias una edición en curso.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { WebsiteSettings } from '@/types/website-settings'

const updateSetting = vi.fn()

type HookState = {
  settings: WebsiteSettings | null
  isLoading: boolean
  error: string | null
  isSaving: boolean
}

let hookState: HookState

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    ...hookState,
    updateSetting,
    refetch: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={typeof href === 'string' ? href : '#'}>{children}</a>
  ),
}))

import { OffersCarouselSettingsCard } from '@/components/dashboard/promotions/OffersCarouselSettingsCard'

const TOGGLE_LABEL = 'Activar o desactivar el carrusel de ofertas'

function buildSettings(): WebsiteSettings {
  return getWebsiteSettingsDefaults()
}

describe('OffersCarouselSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateSetting.mockResolvedValue({ success: true })
    hookState = {
      settings: buildSettings(),
      isLoading: false,
      error: null,
      isSaving: false,
    }
  })

  it('muestra el switch sin necesidad de abrir el colapsable', () => {
    render(<OffersCarouselSettingsCard />)

    const toggle = screen.getByLabelText(TOGGLE_LABEL)
    expect(toggle).toBeInTheDocument()
    // El estado se lee de un vistazo, con el panel cerrado.
    expect(screen.getByText('Visible')).toBeInTheDocument()
    expect(screen.getByText('Activado')).toBeInTheDocument()
  })

  it('desactiva el carrusel y lo persiste con un solo clic', async () => {
    render(<OffersCarouselSettingsCard />)

    fireEvent.click(screen.getByLabelText(TOGGLE_LABEL))

    await waitFor(() => expect(updateSetting).toHaveBeenCalledTimes(1))

    const [key, value] = updateSetting.mock.calls[0]
    expect(key).toBe('offers_section')
    expect(value.carousel.enabled).toBe(false)
    // El resto de la sección viaja intacto: no se pisa lo de /admin/website.
    expect(value.title).toBe(buildSettings().offers_section.title)
    expect(value.carousel.maxItems).toBe(buildSettings().offers_section.carousel.maxItems)
  })

  it('vuelve a activarlo cuando está apagado', async () => {
    const settings = buildSettings()
    settings.offers_section.carousel.enabled = false
    hookState.settings = settings

    render(<OffersCarouselSettingsCard />)
    expect(screen.getByText('Oculto')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(TOGGLE_LABEL))

    await waitFor(() => expect(updateSetting).toHaveBeenCalledTimes(1))
    expect(updateSetting.mock.calls[0][1].carousel.enabled).toBe(true)
  })

  it('con cambios sin guardar el switch no autoguarda: espera al botón Guardar', async () => {
    render(<OffersCarouselSettingsCard />)

    // Ensuciar el formulario primero.
    fireEvent.change(screen.getByLabelText('Título de la banda'), {
      target: { value: 'Nuevo titulo' },
    })
    expect(screen.getByText('Sin guardar')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(TOGGLE_LABEL))
    expect(updateSetting).not.toHaveBeenCalled()

    // Al guardar viajan las dos cosas juntas.
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }))

    await waitFor(() => expect(updateSetting).toHaveBeenCalledTimes(1))
    const value = updateSetting.mock.calls[0][1]
    expect(value.carousel.title).toBe('Nuevo titulo')
    expect(value.carousel.enabled).toBe(false)
  })

  it('avisa en vez de romper cuando el usuario no es administrador', () => {
    hookState = { settings: null, isLoading: false, error: '403 Forbidden', isSaving: false }

    render(<OffersCarouselSettingsCard />)

    expect(screen.getByText(/Necesitás rol de administrador/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(TOGGLE_LABEL)).not.toBeInTheDocument()
  })
})
