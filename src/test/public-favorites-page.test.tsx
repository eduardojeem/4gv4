import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
})
