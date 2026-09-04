import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FavoritesPage } from '@/components/public/FavoritesPage'
import { PublicFavorites } from '@/components/public/Favorites'
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/public/favorites-store', () => ({
  useFavorites: () => ({ items: [
    { productId: '1', slug: 'ropa', name: 'Remera algodón', store: 'Tienda Ropa' },
    { productId: '2', slug: 'belleza', name: 'Perfume', store: 'Belleza' },
  ], busy: false, error: '', account: false }),
  initializeFavorites: vi.fn(), toggleFavorite: vi.fn(), refreshGuestFavorites: vi.fn(),
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      metadata: {
        '1': { image: '/remera.jpg', price: 85000, hasOffer: false, offerPrice: null, inStock: true },
        '2': { image: '/perfume.jpg', price: 150000, hasOffer: true, offerPrice: 120000, inStock: true },
      },
    }),
  }))
})
describe('página de favoritos', () => {
  it('ofrece acceso a la lista completa desde el modal', () => {
    render(<PublicFavorites />)
    fireEvent.click(screen.getByRole('button', { name: 'Mis favoritos (2)' }))
    expect(screen.getByRole('link', { name: 'Ver todos los favoritos' })).toHaveAttribute('href', '/marketplace/favoritos')
  })
  it('busca sin distinguir acentos y filtra por tienda conservando los enlaces', () => {
    render(<FavoritesPage />)
    expect(screen.getByRole('link', { name: /Remera algodón/ })).toHaveAttribute('href', '/ropa/productos/1')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar favoritos' }), { target: { value: 'algodon' } })
    expect(screen.queryByRole('link', { name: /Perfume/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por tienda' }), { target: { value: 'belleza' } })
    expect(screen.getByText('No hay favoritos que coincidan con estos filtros.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByRole('link', { name: /Perfume/ })).toHaveAttribute('href', '/belleza/productos/2')
    expect(screen.getByRole('button', { name: 'Quitar de favoritos: Perfume' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('permite ordenar por organización y alternar a vista agrupada por tienda', () => {
    render(<FavoritesPage />)
    const sortSelect = screen.getByRole('combobox', { name: 'Ordenar por' })
    expect(sortSelect).toBeInTheDocument()

    // Cambiar orden a organización
    fireEvent.change(sortSelect, { target: { value: 'store_asc' } })
    expect(screen.getByRole('option', { name: 'Organización: A → Z' })).toBeInTheDocument()

    // Alternar a vista agrupada por organización
    const groupedButton = screen.getByRole('button', { name: 'Agrupar por organización' })
    expect(groupedButton).toBeInTheDocument()
    fireEvent.click(groupedButton)

    // Debe mostrar la sección con el nombre de la tienda y su enlace
    expect(screen.getByRole('link', { name: /Belleza/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Tienda Ropa/i })).toBeInTheDocument()
  })
})
