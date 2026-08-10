import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PromotionalCarouselEditor } from '@/components/admin/website/PromotionalCarouselEditor'

const hookState = vi.hoisted(() => ({
  updateSetting: vi.fn(),
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: {
      promotional_carousel: {
        enabled: true,
        autoplay: true,
        intervalSeconds: 6,
        slides: [],
      },
    },
    isLoading: false,
    error: null,
    isSaving: false,
    updateSetting: hookState.updateSetting,
    refetch: vi.fn(),
  }),
}))

describe('PromotionalCarouselEditor', () => {
  beforeEach(() => {
    hookState.updateSetting.mockReset()
    hookState.updateSetting.mockResolvedValue({ success: true })
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal('crypto', { randomUUID: () => 'slide-new' })
  })

  it('shows field errors before adding an invalid slide', () => {
    render(<PromotionalCarouselEditor />)

    fireEvent.click(screen.getByRole('button', { name: 'Nueva diapositiva' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Plantillas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Accesorios' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Botón' }))
    fireEvent.change(screen.getByLabelText('Enlace del botón'), {
      target: { value: 'javascript:alert(1)' },
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Texto y mensaje' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar diapositiva' }))

    expect(screen.getByText('El enlace debe ser una ruta interna o una URL http(s)')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Botón' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('exposes the selected alignment and preview mode accessibly', () => {
    render(<PromotionalCarouselEditor />)

    fireEvent.click(screen.getByRole('button', { name: 'Nueva diapositiva' }))

    expect(screen.getAllByRole('tab')).toHaveLength(5)
    expect(screen.getByRole('tab', { name: 'Texto y mensaje' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))
    expect(screen.getByRole('button', { name: 'Izquierda' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vista previa en computadora' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Vista previa en celular' }))
    expect(screen.getByRole('button', { name: 'Vista previa en celular' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('overrides the base dialog width on desktop', () => {
    render(<PromotionalCarouselEditor />)

    fireEvent.click(screen.getByRole('button', { name: 'Nueva diapositiva' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('sm:max-w-[1700px]')
    expect(dialog).not.toHaveClass('sm:max-w-lg')
  })
})
