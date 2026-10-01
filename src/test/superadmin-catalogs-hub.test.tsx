import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CatalogsHub, type CatalogsHubData } from '@/components/superadmin/CatalogsHub'

const data: CatalogsHubData = {
  categories: { active: 28, roots: 13, tenantTotal: 123, tenantLinked: 53 },
  brands: { active: 43, withoutLogo: 39, tenantTotal: 115, tenantLinked: 79 },
  products: { active: 15, withoutCategory: 4, withoutImage: 0 },
  deviceModels: { active: 0 },
}

describe('resumen de catálogos globales', () => {
  it('ordena de la base a lo que se apoya en ella', () => {
    render(<CatalogsHub data={data} />)
    const titles = screen.getAllByRole('link').map((link) => link.textContent ?? '')
    const order = ['Categorías', 'Marcas', 'Productos por código', 'Modelos de equipos']
      .map((title) => titles.findIndex((text) => text.startsWith(title)))
    expect(order.every((index, position) => index >= 0 && (position === 0 || index > order[position - 1]))).toBe(true)
  })

  it('junta lo pendiente de los cuatro con enlace a cada sección', () => {
    render(<CatalogsHub data={data} />)
    const pending = within(screen.getByRole('region', { name: /para revisar/i }))
    expect(pending.getByRole('link', { name: /Categorías: 70 categorías de tiendas sin vincular/ })).toHaveAttribute('href', '/superadmin/categories')
    expect(pending.getByRole('link', { name: /Marcas: 39 marcas sin logo/ })).toHaveAttribute('href', '/superadmin/brands')
    expect(pending.getByRole('link', { name: /Modelos de equipos: Vacío/ })).toHaveAttribute('href', '/superadmin/device-models')
  })

  it('aclara que la marca del equipo no es la del producto', () => {
    render(<CatalogsHub data={data} />)
    expect(screen.getByText(/No es la marca del producto/)).toBeInTheDocument()
  })

  it('una tabla sin crear se ve como pendiente, no como cero', () => {
    render(<CatalogsHub data={{ ...data, products: { active: null, withoutCategory: null, withoutImage: null } }} />)
    expect(screen.getByRole('link', { name: /Productos por código: Falta correr su SQL/ })).toBeInTheDocument()
  })
})
