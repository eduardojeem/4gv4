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

  it('optimiza por defecto una URL real de Supabase Storage', () => {
    render(<AppImage src="https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images/item.jpg" alt="Producto" />)
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-unoptimized', 'false')
  })

  it('evita el optimizador para un WebP normalizado de Supabase Storage', () => {
    render(<AppImage src="https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images/products/item.webp" alt="WebP" />)
    expect(screen.getByRole('img', { name: 'WebP' })).toHaveAttribute('data-unoptimized', 'true')
  })

  it('sigue evitando el optimizador para SVG y data URIs', () => {
    const { rerender } = render(<AppImage src="/placeholder-product.svg" alt="Producto" />)
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-unoptimized', 'true')

    rerender(<AppImage src="data:image/webp;base64,AAAA" alt="Producto" />)
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-unoptimized', 'true')
  })

  it('respeta un unoptimized explícito por encima del default', () => {
    render(<AppImage src="https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images/item.jpg" alt="Producto" unoptimized />)
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-unoptimized', 'true')
  })
})
