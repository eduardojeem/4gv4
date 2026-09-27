import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SmartSearch } from '@/components/dashboard/smart-search'

afterEach(() => localStorage.removeItem('product-search-recent'))

describe('búsquedas recientes de productos', () => {
  it('muestra las búsquedas guardadas al enfocar el buscador', () => {
    localStorage.setItem('product-search-recent', JSON.stringify(['camisa']))

    render(<SmartSearch products={[]} />)
    fireEvent.focus(screen.getByPlaceholderText('Buscar productos, SKU, categorías...'))

    expect(screen.getByText('camisa')).toBeInTheDocument()
  })

  it('ignora datos guardados que no sean una lista de búsquedas', () => {
    localStorage.setItem('product-search-recent', JSON.stringify({ text: 'camisa' }))

    render(<SmartSearch products={[]} />)
    fireEvent.focus(screen.getByPlaceholderText('Buscar productos, SKU, categorías...'))

    expect(screen.getByText('Comienza a escribir para buscar productos')).toBeInTheDocument()
  })
})
