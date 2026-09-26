/**
 * Pruebas completas para MarketplaceBrandsSection:
 * - Regresión rules-of-hooks
 * - Movimiento continuo tipo marquee (estilo Empresas Asociadas)
 * - Botón de Play/Pausa
 * - Renderizado de estadísticas (productos y tiendas)
 * - Filtro de búsqueda y borrado en cuadrícula
 * - Ordenamiento en modo cuadrícula (popular, A-Z, tiendas)
 */

import { render, screen, fireEvent } from '@testing-library/react'
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
  { name: 'Apple', product_count: 7, organization_count: 5 },
  { name: 'Xiaomi', product_count: 20, organization_count: 1 },
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
    expect(screen.getAllByText('Samsung')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Apple')[0]).toBeInTheDocument()
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
    expect(screen.getAllByText('Samsung')[0]).toBeInTheDocument()

    expect(() => rerender(<MarketplaceBrandsSection brands={[]} />)).not.toThrow()
    expect(screen.queryByText('Samsung')).not.toBeInTheDocument()
  })
})

describe('MarketplaceBrandsSection - Marquee continuo estilo Empresas Asociadas', () => {
  it('muestra el enlace a todas las marcas y botón de control de animación', () => {
    render(
      <MarketplaceBrandsSection
        brands={brands}
        variant="carousel"
        showViewAll={true}
        viewAllHref="/marketplace/categorias#marcas"
      />
    )

    expect(screen.getByText('Ver todas las marcas')).toBeInTheDocument()
    expect(screen.getByLabelText('Pausar movimiento automático')).toBeInTheDocument()
  })

  it('muestra conteo de productos y tiendas en las tarjetas', () => {
    render(<MarketplaceBrandsSection brands={brands} variant="carousel" />)

    expect(screen.getAllByText('12 prods.')[0]).toBeInTheDocument()
    expect(screen.getAllByText('3 tiendas')[0]).toBeInTheDocument()
  })

  it('permite alternar entre pausa y reproducción con el botón de control', () => {
    render(<MarketplaceBrandsSection brands={brands} variant="carousel" />)

    const pauseBtn = screen.getByLabelText('Pausar movimiento automático')
    expect(pauseBtn).toBeInTheDocument()

    // Pausar animación
    fireEvent.click(pauseBtn)
    expect(screen.getByLabelText('Reanudar movimiento automático')).toBeInTheDocument()

    // Reanudar animación
    const playBtn = screen.getByLabelText('Reanudar movimiento automático')
    fireEvent.click(playBtn)
    expect(screen.getByLabelText('Pausar movimiento automático')).toBeInTheDocument()
  })
})

describe('MarketplaceBrandsSection - Funcionalidad de Cuadrícula y Ordenamiento', () => {
  it('filtra marcas por el buscador de texto y muestra estado vacío al no coincidir', () => {
    render(<MarketplaceBrandsSection brands={brands} variant="grid" />)

    const searchInput = screen.getByPlaceholderText('Buscar marca...')
    fireEvent.change(searchInput, { target: { value: 'Sam' } })

    expect(screen.getByText('Samsung')).toBeInTheDocument()
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()

    // Búsqueda sin coincidencias
    fireEvent.change(searchInput, { target: { value: 'Inexistente' } })
    expect(screen.getByText('No se encontraron marcas')).toBeInTheDocument()

    // Limpiar con botón
    const clearBtn = screen.getByLabelText('Limpiar búsqueda')
    fireEvent.click(clearBtn)
    expect(screen.getByText('Samsung')).toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
  })

  it('permite alternar el ordenamiento (popular, A-Z, tiendas)', () => {
    render(<MarketplaceBrandsSection brands={brands} variant="grid" />)

    const btnAlpha = screen.getByText('A - Z')
    const btnStores = screen.getByText('Más tiendas')
    const btnPopular = screen.getByText('Más populares')

    expect(() => {
      fireEvent.click(btnAlpha)
      fireEvent.click(btnStores)
      fireEvent.click(btnPopular)
    }).not.toThrow()
  })
})
