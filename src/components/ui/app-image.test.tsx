import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppImage } from './app-image'

vi.mock('next/image', () => ({
  default: ({ alt, height, src, unoptimized, width }: { alt: string; height: number; src: string; unoptimized?: boolean; width: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- The next/image test double must render a native image.
    <img alt={alt} data-height={height} data-width={width} data-unoptimized={String(!!unoptimized)} src={src} />
  ),
}))

describe('AppImage', () => {
  it('keeps source and alt text while supplying safe intrinsic dimensions', () => {
    render(<AppImage src="/producto.png" alt="Producto" className="h-full w-full" />)

    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('src', '/producto.png')
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-width', '1')
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-height', '1')
  })

  // AppImage forzaba unoptimized=true siempre: ninguna imagen de producto o
  // logo pasaba por el optimizador de Next salvo que el call site lo pisara a
  // mano. Ahora el default sigue la misma politica que ya usan ProductCard y
  // el resto (shouldBypassImageOptimization).
  it('optimiza por defecto una URL real de Supabase Storage', () => {
    render(<AppImage src="https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images/item.jpg" alt="Producto" />)
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-unoptimized', 'false')
  })

  it('sigue evitando el optimizador para SVG, data URIs y hosts ya optimizados', () => {
    const { rerender } = render(<AppImage src="/placeholder-product.svg" alt="Producto" />)
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-unoptimized', 'true')

    rerender(<AppImage src="data:image/webp;base64,AAAA" alt="Producto" />)
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-unoptimized', 'true')
  })

  it('respeta un `unoptimized` explicito por encima del default', () => {
    render(<AppImage src="https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images/item.jpg" alt="Producto" unoptimized />)
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-unoptimized', 'true')
  })
})
