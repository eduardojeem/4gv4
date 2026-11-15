// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CategoriesClient } from '@/components/public/CategoriesClient'
import type { MarketplaceCategory } from '@/lib/public/marketplace'

const cat = (id: string, name: string, product_count: number, parent_id: string | null = null) =>
  ({ id, name, parent_id, product_count, organization_count: 1 }) as MarketplaceCategory

const categories = [
  cat('e1', 'Electrónica', 105),
  cat('e2', 'Electronica', 1),
  cat('e3', 'Celulares', 5),
  cat('l1', 'Lavarropa', 5),
  cat('r1', 'Remeras Básicas', 1),
  cat('r2', 'Reloj', 1),
]

describe('Ver todo en /marketplace/categorias', () => {
  it('cada rubro junta todas sus categorías, muestra la cantidad y lleva a todas', () => {
    render(<CategoriesClient categories={categories} />)
    const electronica = screen.getByRole('link', { name: /Electrónica.*111 productos/ })
    expect(electronica).toHaveAttribute('href', '/marketplace/productos?categoria=e1,e2,e3')
    // «Moda» ya no termina en Lavarropas: lleva a remeras y relojes.
    const moda = screen.getByRole('link', { name: /Moda & Relojería.*2 productos/ })
    expect(moda).toHaveAttribute('href', '/marketplace/productos?categoria=r1,r2')
    expect(screen.getByRole('link', { name: /Electrodomésticos.*5 productos/ })).toHaveAttribute('href', '/marketplace/productos?categoria=l1')
  })

  it('no muestra rubros sin productos ni el carrusel con fotos de stock', () => {
    render(<CategoriesClient categories={categories} />)
    expect(screen.queryByRole('link', { name: /^Servicios/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Alimentos y bebidas/ })).toBeNull()
    expect(screen.queryByText('SHOWCASE')).toBeNull()
    expect(screen.getByLabelText('Buscar categorías')).toBeInTheDocument()
  })
})
