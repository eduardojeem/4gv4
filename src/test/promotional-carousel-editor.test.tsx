import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PromotionalCarouselEditor } from '@/components/admin/website/PromotionalCarouselEditor'

const hookState = vi.hoisted(() => ({
  updateSetting: vi.fn(),
  brandColor: 'amber' as string,
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: {
      company_info: {
        brandColor: hookState.brandColor,
      },
      promotional_carousel: {
        enabled: true,
        autoplay: true,
        intervalSeconds: 6,
        layoutMode: 'contained',
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

/**
 * Hay dos botones «Nueva diapositiva» —uno en el encabezado y otro sobre la
 * lista— y los dos abren el mismo formulario: alcanza con el primero.
 */
const abrirNuevaDiapositiva = () =>
  fireEvent.click(screen.getAllByRole('button', { name: 'Nueva diapositiva' })[0])

describe('PromotionalCarouselEditor', () => {
  beforeEach(() => {
    hookState.updateSetting.mockReset()
    hookState.updateSetting.mockResolvedValue({ success: true })
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal('crypto', { randomUUID: () => 'slide-new' })
  })

  it('shows field errors before adding an invalid slide', () => {
    render(<PromotionalCarouselEditor />)

    abrirNuevaDiapositiva()
    fireEvent.click(screen.getByRole('tab', { name: 'Plantillas' }))
    fireEvent.click(screen.getByRole('button', { name: /Accesorios/i }))
    fireEvent.click(screen.getByRole('tab', { name: 'Botón' }))
    fireEvent.change(screen.getByLabelText('Enlace o destino'), {
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

    abrirNuevaDiapositiva()

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

    abrirNuevaDiapositiva()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('sm:max-w-[1700px]')
    expect(dialog).not.toHaveClass('sm:max-w-lg')
  })

  it('allows activating graphic banner mode without text overlays', () => {
    render(<PromotionalCarouselEditor />)

    abrirNuevaDiapositiva()

    const switchBtn = screen.getByRole('switch', { name: 'Modo banner gráfico sin textos' })
    expect(switchBtn).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(switchBtn)
    expect(switchBtn).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/Banner en modo gráfico activo/i)).toBeInTheDocument()
  })

  it('lets a barbershop load a ready-made pack of sample banners with images', () => {
    render(
      <PromotionalCarouselEditor
        capabilities={{
          businessVertical: 'barbershop',
          hasCatalog: true,
          hasServices: true,
          hasRepairs: false,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Cargar pack de ejemplo \(Barbería\)/i }))

    expect(screen.getByText('4 de 6 configuradas')).toBeInTheDocument()
    expect(screen.getByText('Tu corte y estilo, en manos expertas')).toBeInTheDocument()
    expect(screen.getByText('Combo Corte de Autor + Barba')).toBeInTheDocument()
  })

  it('updates live preview in real time matching all edited fields, storefront style, layout mode and mobile view', () => {
    render(
      <PromotionalCarouselEditor
        storefrontStyle="especial-para-barbero"
        capabilities={{
          businessVertical: 'barbershop',
          hasCatalog: true,
          hasServices: true,
          hasRepairs: false,
        }}
      />
    )

    abrirNuevaDiapositiva()

    const preview = screen.getByTestId('slide-live-preview')
    expect(preview).toHaveAttribute('data-preview-mode', 'desktop')
    expect(preview).toHaveAttribute('data-color-scheme', 'amber')

    // Editar título, insignia, mensaje, color y fuente
    fireEvent.change(screen.getByLabelText(/Insignia o etiqueta superior/i), {
      target: { value: 'CLUB BARBERO' },
    })
    fireEvent.change(screen.getByLabelText('Título del banner'), {
      target: { value: 'Combo Fade + Barba' },
    })
    fireEvent.change(screen.getByLabelText('Mensaje descriptivo'), {
      target: { value: 'Toalla caliente, navaja y styling profesional.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Oro / Amarillo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Elegante (Serif)' }))

    expect(within(preview).getByText('CLUB BARBERO')).toBeInTheDocument()
    const previewTitle = within(preview).getByText('Combo Fade + Barba')
    expect(previewTitle).toHaveStyle({ color: 'rgb(250, 204, 21)' })
    expect(previewTitle).toHaveClass('font-serif')
    expect(within(preview).getByText('Toalla caliente, navaja y styling profesional.')).toBeInTheDocument()

    // Editar botón y diseño
    fireEvent.click(screen.getByRole('tab', { name: 'Botón' }))
    fireEvent.change(screen.getByLabelText('Texto del botón'), {
      target: { value: 'Reservar ahora' },
    })
    fireEvent.change(screen.getByLabelText('Enlace o destino'), {
      target: { value: '/turnos' },
    })
    expect(within(preview).getByText('Reservar ahora')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))
    fireEvent.click(screen.getByRole('button', { name: 'Centro' }))
    expect(screen.getByText(/Alineación:/)).toHaveTextContent('Alineación: Centro')

    // Cambiar estado de publicación y pasar a vista previa celular (mantiene contenido dentro del banner)
    fireEvent.click(screen.getByRole('switch', { name: 'Publicar diapositiva' }))
    expect(within(preview).getByText('Oculta')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Vista previa en celular' }))
    expect(preview).toHaveAttribute('data-preview-mode', 'mobile')
    expect(within(preview).getByText('Combo Fade + Barba')).toBeInTheDocument()
    expect(within(preview).getByText('Reservar ahora')).toBeInTheDocument()
  })
})
