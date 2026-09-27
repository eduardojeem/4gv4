import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppImage } from './app-image'

vi.mock('next/image', () => ({
  default: ({ alt, height, src, width }: { alt: string; height: number; src: string; width: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- The next/image test double must render a native image.
    <img alt={alt} data-height={height} data-width={width} src={src} />
  ),
}))

describe('AppImage', () => {
  it('keeps source and alt text while supplying safe intrinsic dimensions', () => {
    render(<AppImage src="/producto.png" alt="Producto" className="h-full w-full" />)

    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('src', '/producto.png')
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-width', '1')
    expect(screen.getByRole('img', { name: 'Producto' })).toHaveAttribute('data-height', '1')
  })
})
