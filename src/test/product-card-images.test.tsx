import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProductCard } from '@/components/public/ProductCard'
import type { PublicProduct } from '@/types/public'

/* eslint-disable @next/next/no-img-element -- El doble de next/image renderiza una imagen nativa. */
vi.mock('next/image', () => ({
  default: ({ src, alt, onError, unoptimized }: { src: string; alt: string; onError?: () => void; unoptimized?: boolean }) => (
    <img src={src} alt={alt} data-unoptimized={String(Boolean(unoptimized))} onError={onError} />
  ),
}))
/* eslint-enable @next/next/no-img-element */

vi.mock('next/navigation', () => ({ usePathname: () => '/4g-celulares/productos' }))
vi.mock('@/hooks/use-public-cart', () => ({ usePublicCart: () => ({ addProduct: vi.fn(() => ({ limited: false })) }) }))
vi.mock('@/hooks/useWebsiteSettings', () => ({ useWebsiteSettings: () => ({ settings: { checkout: { commerceMode: 'cart' }, company_info: {} }, isLoading: false }) }))

const STORAGE = '/fotos'
const product = {
  id: 'p1', name: 'Pantalla iPhone 12', sale_price: 450000, in_stock: true, stock_quantity: 3,
  image: `${STORAGE}/frente.webp`, images: [`${STORAGE}/dorso.jpg`, `${STORAGE}/rota.jpg`],
} as unknown as PublicProduct

describe('imágenes de la tarjeta y su detalle', () => {
  it('una foto rota de la galería no le saca la foto a la tarjeta', () => {
    render(<ProductCard product={product} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vista rápida de Pantalla iPhone 12' }))
    const modal = within(screen.getByRole('dialog'))
    fireEvent.click(modal.getByRole('button', { name: 'Ver imagen 3' }))
    fireEvent.error(modal.getByRole('img', { name: 'Pantalla iPhone 12', exact: true }))
    // Con el detalle abierto el resto de la página queda oculto para lectores: se busca igual.
    const card = screen.getByRole('button', { name: 'Vista rápida de Pantalla iPhone 12', hidden: true })
    expect(within(card).getByRole('img', { name: 'Pantalla iPhone 12', hidden: true })).toHaveAttribute('src', `${STORAGE}/frente.webp`)
  })

  it('las miniaturas no pasan por el optimizador de imágenes', () => {
    render(<ProductCard product={product} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vista rápida de Pantalla iPhone 12' }))
    const modal = within(screen.getByRole('dialog'))
    const thumbs = modal.getAllByRole('button', { name: /Ver imagen \d/ }).map((button) => button.querySelector('img'))
    expect(thumbs).toHaveLength(3)
    for (const thumb of thumbs) expect(thumb).toHaveAttribute('data-unoptimized', 'true')
  })
})
