import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebsiteMediaLibraryDialog } from '@/components/admin/website/WebsiteMediaLibraryDialog'

describe('WebsiteMediaLibraryDialog UX enhancements', () => {
  const mockItems = [
    {
      id: 'img-1',
      name: 'logo-brand.png',
      url: 'https://cdn.example.com/logo-brand.png',
      path: 'org/logo-brand.png',
      section: 'logo',
      size: 50000,
      createdAt: '2026-01-01T10:00:00Z',
    },
    {
      id: 'img-2',
      name: 'banner-hero.webp',
      url: 'https://cdn.example.com/banner-hero.webp',
      path: 'org/banner-hero.webp',
      section: 'promotions',
      size: 250000,
      createdAt: '2026-02-01T10:00:00Z',
    },
    {
      id: 'img-3',
      name: 'producto-almacen.jpg',
      url: 'https://cdn.example.com/producto-almacen.jpg',
      path: 'org/producto-almacen.jpg',
      section: 'general',
      size: 15000,
      createdAt: '2025-12-01T10:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, items: mockItems, count: 3 }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders format badges for images (PNG, WEBP, JPG)', async () => {
    render(<WebsiteMediaLibraryDialog open onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('logo-brand.png')).toBeInTheDocument()
    })

    expect(screen.getByText('PNG')).toBeInTheDocument()
    expect(screen.getByText('WEBP')).toBeInTheDocument()
    expect(screen.getByText('JPG')).toBeInTheDocument()
  })

  it('marks active image with "En uso" badge when currentActiveUrl matches', async () => {
    render(
      <WebsiteMediaLibraryDialog
        open
        onOpenChange={vi.fn()}
        currentActiveUrl="https://cdn.example.com/logo-brand.png"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('logo-brand.png')).toBeInTheDocument()
    })

    expect(screen.getByText('En uso')).toBeInTheDocument()
  })

  it('sorts images by size (largest first)', async () => {
    render(<WebsiteMediaLibraryDialog open onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('logo-brand.png')).toBeInTheDocument()
    })

    const sortSelect = screen.getByTitle('Ordenar imágenes')
    fireEvent.change(sortSelect, { target: { value: 'largest' } })

    const titles = screen.getAllByTitle(/Hacer clic para ampliar imagen/i)
    expect(titles.length).toBe(3)
  })

  it('resets search and category filter via reset button when no results', async () => {
    render(<WebsiteMediaLibraryDialog open onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('logo-brand.png')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Buscar...')
    fireEvent.change(searchInput, { target: { value: 'inexistente' } })

    expect(screen.getByText('No hay imágenes que coincidan')).toBeInTheDocument()
    const resetBtn = screen.getByRole('button', { name: 'Restablecer filtros' })
    fireEvent.click(resetBtn)

    expect(screen.getByText('logo-brand.png')).toBeInTheDocument()
  })
})
