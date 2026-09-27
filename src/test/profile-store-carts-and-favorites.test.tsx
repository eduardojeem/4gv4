import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach } from 'vitest'
import { ProfileStoreCarts } from '@/components/profile/profile-store-carts'
import { ProfileFavoritesWidget } from '@/components/profile/profile-favorites-widget'
import { initializeFavorites } from '@/lib/public/favorites-store'

describe('ProfileStoreCarts', () => {
  let storage: Map<string, string>

  beforeEach(() => {
    storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      get length() {
        return storage.size
      },
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin conexión')))
  })

  it('sincroniza nombre de tienda, precio y stock con el catálogo público', async () => {
    localStorage.setItem('mipos-public-cart:moda-sur', JSON.stringify([{
      cartItemId: 'remera-1', productId: 'remera', name: 'Nombre anterior', unitPrice: 90000,
      quantity: 2, variantId: null, variantName: null, sku: null, image: null, availableStock: 8,
    }]))
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ carts: [] }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organization: { name: 'Moda del Sur', slug: 'moda-sur', logo_url: '/logo.webp' },
          items: [{ productId: 'remera', variantId: null, quantity: 1, unitPrice: 100000, name: 'Remera nueva', image: '/remera.webp', availableStock: 1 }],
          conflicts: [{ reason: 'quantity_adjusted' }],
          lastVerifiedAt: '2026-09-06T20:00:00.000Z',
        }),
      } as Response)

    render(<ProfileStoreCarts />)

    expect(await screen.findByText('Moda del Sur')).toBeInTheDocument()
    expect(screen.getByText('Remera nueva')).toBeInTheDocument()
    expect(screen.getByText(/Ajustamos 1 ítem/i)).toBeInTheDocument()
    expect(screen.getByText(/Gs.\s*100.000/i)).toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay carritos activos en tiendas', () => {
    render(<ProfileStoreCarts />)

    expect(screen.getByText(/Carritos pendientes en tiendas/i)).toBeInTheDocument()
    expect(screen.getByText(/No tenés carritos pendientes/i)).toBeInTheDocument()
  })

  it('detecta y lista productos en carritos de diferentes tiendas', async () => {
    const mockCart = [
      {
        cartItemId: 'item-1',
        productId: 'prod-1',
        name: 'Pantalla iPhone 13 OLED',
        unitPrice: 450000,
        quantity: 1,
        variantId: null,
        variantName: null,
        sku: 'IPH-13-SCR',
        image: null,
        availableStock: 5,
      },
    ]
    localStorage.setItem('mipos-public-cart:megatech', JSON.stringify(mockCart))

    render(<ProfileStoreCarts />)

    expect(await screen.findByText(/Megatech/i)).toBeInTheDocument()
    expect(screen.getByText(/Pantalla iPhone 13 OLED/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Continuar compra/i })).toHaveAttribute(
      'href',
      '/megatech/carrito'
    )
  })

  it('muestra la imagen y confirma antes de vaciar el carrito', async () => {
    const user = userEvent.setup()
    localStorage.setItem('mipos-public-cart:moda-sur', JSON.stringify([{
      cartItemId: 'remera-1', productId: 'remera', name: 'Remera clásica', unitPrice: 90000,
      quantity: 1, variantId: null, variantName: null, sku: null,
      image: '/productos/remera.webp', availableStock: 3,
    }]))

    render(<ProfileStoreCarts />)

    expect(await screen.findByRole('img', { name: 'Remera clásica' })).toHaveAttribute('src', '/productos/remera.webp')
    await user.click(screen.getByRole('button', { name: /Vaciar carrito de Moda Sur/i }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('¿Vaciar este carrito?')
    expect(localStorage.getItem('mipos-public-cart:moda-sur')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: /^Vaciar carrito$/i }))
    expect(localStorage.getItem('mipos-public-cart:moda-sur')).toBeNull()
  })
})

describe('ProfileFavoritesWidget', () => {
  it('muestra el widget de productos favoritos', () => {
    render(<ProfileFavoritesWidget />)

    expect(screen.getByText(/Mis Productos Favoritos/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver todos/i })).toHaveAttribute(
      'href',
      '/marketplace/favoritos'
    )
  })

  it('recupera y muestra la imagen actual del producto si el favorito no la guardo', async () => {
    localStorage.setItem('mitiendapy:guest-favorites:v1', JSON.stringify([
      { productId: 'prod-1', slug: 'tienda-demo', name: 'Remera deportiva', store: 'Tienda Demo', price: 120000 },
    ]))
    await initializeFavorites(null)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ metadata: { 'prod-1': { image: '/productos/remera.webp' } } }),
    }))

    render(<ProfileFavoritesWidget />)

    expect(await screen.findByRole('img', { name: 'Remera deportiva' })).toHaveAttribute(
      'src',
      expect.stringContaining('remera.webp')
    )
  })
})
