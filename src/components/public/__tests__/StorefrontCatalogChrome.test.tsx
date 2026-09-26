import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StorefrontStyleProvider } from '../storefront-style-context'
import { StorefrontCatalogHero, StorefrontCollections } from '../StorefrontCatalogChrome'

const categories = [
  { id: 'tops', name: 'Remeras' },
  { id: 'shoes', name: 'Calzados' },
]

function renderCatalog(style: 'classic' | 'fashion' | 'sport') {
  return render(
    <StorefrontStyleProvider style={style}>
      <StorefrontCatalogHero
        homeHref="/dabasica/inicio"
        productsHref="/dabasica/productos"
        storeName="Dabasica"
        total={18}
        query=""
      >
        <button>Buscar catálogo</button>
      </StorefrontCatalogHero>
      <StorefrontCollections categories={categories} productsHref="/dabasica/productos" />
    </StorefrontStyleProvider>,
  )
}

describe('StorefrontCatalogChrome', () => {
  it('keeps the clothing catalog header compact and focused on shopping', () => {
    renderCatalog('fashion')
    expect(screen.queryByText('La colección')).not.toBeInTheDocument()
    expect(screen.queryByText('Dabasica')).not.toBeInTheDocument()
    expect(screen.getByText('18 productos disponibles')).toBeInTheDocument()
    expect(screen.getByText('Ver ofertas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar catálogo' })).toBeInTheDocument()
    expect(screen.getByText('Remeras')).toBeInTheDocument()
    expect(screen.getByText('Explorar por colección')).toBeInTheDocument()
  })

  it('uses a performance-oriented voice for sport stores', () => {
    renderCatalog('sport')
    expect(screen.getByText('Equipate para rendir')).toBeInTheDocument()
    expect(screen.getByText('Explorar disciplinas')).toBeInTheDocument()
  })

  it('keeps the established generic catalog for classic stores', () => {
    renderCatalog('classic')
    expect(screen.getByText('Catálogo de Productos')).toBeInTheDocument()
    expect(screen.queryByText('Explorar por colección')).not.toBeInTheDocument()
  })
})
