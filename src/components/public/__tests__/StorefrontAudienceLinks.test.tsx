import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { StorefrontStyleProvider } from '../storefront-style-context'
import { StorefrontAudienceLinks } from '../inicio/StorefrontAudienceLinks'
import { getFeaturedProductLimit } from '../inicio/FeaturedProducts'
import { buildBrandTickerItems } from '../inicio/StoreBrandTicker'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dabasica/inicio',
}))

describe('StorefrontAudienceLinks', () => {
  it('offers direct shopping paths for a clothing store', () => {
    render(
      <StorefrontStyleProvider style="fashion">
        <StorefrontAudienceLinks />
      </StorefrontStyleProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Comprá como te resulte más fácil' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /mujer/i })).toHaveAttribute('href', '/dabasica/productos?audience=mujer')
    expect(screen.getByRole('link', { name: /hombre/i })).toHaveAttribute('href', '/dabasica/productos?audience=hombre')
    expect(screen.getByRole('link', { name: /niños/i })).toHaveAttribute('href', '/dabasica/productos?audience=ninos')
    expect(screen.getByRole('link', { name: /ofertas/i })).toHaveAttribute('href', '/dabasica/productos?ofertas=true')
  })

  it('does not add fashion navigation to classic storefronts', () => {
    const { container } = render(
      <StorefrontStyleProvider style="classic">
        <StorefrontAudienceLinks />
      </StorefrontStyleProvider>,
    )

    expect(container).toBeEmptyDOMElement()
  })
})

describe('getFeaturedProductLimit', () => {
  it('keeps fashion and sport homepages lighter than classic stores', () => {
    expect(getFeaturedProductLimit('fashion')).toBe(8)
    expect(getFeaturedProductLimit('sport')).toBe(8)
    expect(getFeaturedProductLimit('classic')).toBe(16)
  })
})

describe('buildBrandTickerItems', () => {
  it('duplicates brands only once for the desktop marquee', () => {
    const brands = [{ id: 'nike' }, { id: 'adidas' }, { id: 'puma' }]
    expect(buildBrandTickerItems(brands)).toEqual([...brands, ...brands])
  })
})
