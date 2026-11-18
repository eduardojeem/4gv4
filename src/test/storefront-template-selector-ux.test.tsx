import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StorefrontTemplateSelector } from '@/components/admin/website/StorefrontTemplateSelector'

describe('StorefrontTemplateSelector UX improvements', () => {
  it('renders hero de plantilla activa with live thumbnail and details', () => {
    const onPreview = vi.fn()
    render(
      <StorefrontTemplateSelector
        value="especial-cosmeticos"
        onChange={vi.fn()}
        onPreview={onPreview}
        businessVertical="cosmetics"
        servicesAvailable={false}
      />
    )

    expect(screen.getByText('Plantilla activa')).toBeInTheDocument()
    const labels = screen.getAllByText('Especial Cosméticos Premium')
    expect(labels.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('En uso')).toBeInTheDocument()

    // Botón de vista previa rápida en el Hero
    const heroPreviewBtn = screen.getByRole('button', { name: /Ver vista previa/i })
    expect(heroPreviewBtn).toBeInTheDocument()
    fireEvent.click(heroPreviewBtn)
    expect(onPreview).toHaveBeenCalledWith('especial-cosmeticos')
  })

  it('filters templates in real time via search input', () => {
    render(
      <StorefrontTemplateSelector
        value="classic"
        onChange={vi.fn()}
        businessVertical="general"
      />
    )

    const searchInput = screen.getByPlaceholderText(/Buscar plantilla por nombre/i)
    fireEvent.change(searchInput, { target: { value: 'barbero' } })

    // "Especial para barbero" debe coincidir
    expect(screen.getByRole('button', { name: /^Especial para barbero/ })).toBeInTheDocument()
    // "Supermercado & Almacén" no debe aparecer
    expect(screen.queryByRole('button', { name: /^Supermercado & Almacén/ })).not.toBeInTheDocument()

    // Limpiar búsqueda
    const clearBtn = screen.getByLabelText('Limpiar búsqueda')
    fireEvent.click(clearBtn)
    expect(screen.getByRole('button', { name: /^Supermercado & Almacén/ })).toBeInTheDocument()
  })

  it('triggers quick preview on card without calling onChange', () => {
    const onChange = vi.fn()
    const onPreview = vi.fn()
    render(
      <StorefrontTemplateSelector
        value="classic"
        onChange={onChange}
        onPreview={onPreview}
        businessVertical="general"
      />
    )

    const previewBtn = screen.getByLabelText('Vista previa rápida de Especial Cosméticos Premium')
    expect(previewBtn).toBeInTheDocument()
    fireEvent.click(previewBtn)

    expect(onPreview).toHaveBeenCalledWith('especial-cosmeticos')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('displays empty state when search finds no matches and allows resetting', () => {
    render(
      <StorefrontTemplateSelector
        value="classic"
        onChange={vi.fn()}
        businessVertical="general"
      />
    )

    const searchInput = screen.getByPlaceholderText(/Buscar plantilla por nombre/i)
    fireEvent.change(searchInput, { target: { value: 'palabrainexistentexyz123' } })

    expect(screen.getByText('No se encontraron plantillas')).toBeInTheDocument()
    const resetBtn = screen.getByRole('button', { name: /Restablecer filtros/i })
    fireEvent.click(resetBtn)

    expect(screen.getByRole('button', { name: /^Tienda Clásica/ })).toBeInTheDocument()
  })
})
