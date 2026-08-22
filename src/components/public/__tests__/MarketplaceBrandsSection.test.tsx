/**
 * Regresión rules-of-hooks para MarketplaceBrandsSection.
 *
 * El bug: `if (brands.length === 0) return null` estaba declarado ANTES de
 * useEffect/useMemo. El primer render con la lista vacía sólo ejecutaba los dos
 * useState; cuando llegaban las marcas el componente pasaba el guard y llamaba
 * 3 hooks más, y React tiraba "Rendered more hooks than during the previous render".
 *
 * El rerender vacío -> con datos es lo que reproduce el crash.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MarketplaceBrandsSection } from '../MarketplaceBrandsSection'
import type { MarketplaceBrand } from '@/lib/public/marketplace'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

const brands: MarketplaceBrand[] = [
  { name: 'Samsung', product_count: 12, organization_count: 3 },
  { name: 'Apple', product_count: 7, organization_count: 2 },
]

describe('MarketplaceBrandsSection - rules of hooks', () => {
  it('no rompe al pasar de lista vacía a lista con marcas (carousel)', () => {
    const { rerender } = render(<MarketplaceBrandsSection brands={[]} />)

    // Con lista vacía el guard devuelve null: no hay nada renderizado.
    expect(screen.queryByText('Explorar por marca')).not.toBeInTheDocument()

    // Este rerender es el que disparaba el error de hooks.
    expect(() =>
      rerender(<MarketplaceBrandsSection brands={brands} />)
    ).not.toThrow()

    expect(screen.getByText('Explorar por marca')).toBeInTheDocument()
    expect(screen.getByText('Samsung')).toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
  })

  it('no rompe al pasar de lista vacía a lista con marcas (grid)', () => {
    const { rerender } = render(
      <MarketplaceBrandsSection brands={[]} variant="grid" />
    )

    expect(screen.queryByPlaceholderText('Buscar marca...')).not.toBeInTheDocument()

    expect(() =>
      rerender(<MarketplaceBrandsSection brands={brands} variant="grid" />)
    ).not.toThrow()

    expect(screen.getByPlaceholderText('Buscar marca...')).toBeInTheDocument()
    expect(screen.getByText('Samsung')).toBeInTheDocument()
  })

  it('vuelve a null si las marcas desaparecen, sin romper', () => {
    const { rerender } = render(<MarketplaceBrandsSection brands={brands} />)
    expect(screen.getByText('Samsung')).toBeInTheDocument()

    expect(() => rerender(<MarketplaceBrandsSection brands={[]} />)).not.toThrow()
    expect(screen.queryByText('Samsung')).not.toBeInTheDocument()
  })
})
