import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SaaSBusinessPageContent } from './saas-business-page-content'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

const org = (id: string, name: string, rubro: string, city: string, products: number, extra: Partial<MarketplaceOrganization> = {}) => ({
  id, name, slug: id, plan: 'PRO', logo_url: null, rubro, city, products_count: products, featured_products: [], created_at: '2024-01-01', ...extra,
}) as MarketplaceOrganization

const mockOrgs = [
  org('org-1', 'Celulares Centro', 'tecnologia', 'Asunción', 50, { slogan: 'Tecnología y servicio técnico' }),
  org('org-2', 'Ferretería Central', 'ferreteria', 'San Lorenzo', 120),
  org('org-3', 'Taller del Este', 'tecnologia', 'Ciudad del Este', 0),
  // La misma ciudad escrita distinto cuenta una sola vez.
  org('org-4', 'Boutique Aura', 'indumentaria', 'ASUNCION', 80),
]

describe('SaaSBusinessPageContent', () => {
  it('muestra la portada con cifras reales de los negocios publicados', () => {
    render(<SaaSBusinessPageContent initialOrganizations={mockOrgs} />)
    expect(screen.getByRole('heading', { name: /Negocios que crecen con nuestra plataforma/i })).toBeInTheDocument()
    // 4 negocios, 3 ciudades distintas, 250 productos publicados.
    expect(screen.getByText('negocios publicados').nextSibling).toHaveTextContent('4')
    expect(screen.getByText('ciudades').nextSibling).toHaveTextContent('3')
    expect(screen.getByText('productos publicados').nextSibling).toHaveTextContent('250')
  })

  it('muestra cada tienda, primero las que tienen más productos', () => {
    render(<SaaSBusinessPageContent initialOrganizations={mockOrgs} />)
    const nombres = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(nombres).toEqual(['Ferretería Central', 'Boutique Aura', 'Celulares Centro', 'Taller del Este'])
  })

  it('los filtros son los rubros que hay, con cuántos negocios tiene cada uno', () => {
    render(<SaaSBusinessPageContent initialOrganizations={mockOrgs} />)
    const filtros = within(screen.getByRole('group', { name: 'Filtrar por rubro' }))
    expect(filtros.getByRole('button', { name: /Tecnología\s*2/ })).toBeInTheDocument()
    expect(filtros.queryByRole('button', { name: /Automotor/ })).not.toBeInTheDocument()

    fireEvent.click(filtros.getByRole('button', { name: /Ferretería\s*1/ }))
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Ferretería Central'])
  })

  it('busca por nombre, ciudad o rubro', () => {
    render(<SaaSBusinessPageContent initialOrganizations={mockOrgs} />)
    fireEvent.change(screen.getByPlaceholderText(/Buscar tienda o ciudad/i), { target: { value: 'moda' } })
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Boutique Aura'])
  })

  it('no inventa texto para una tienda que no escribió nada', () => {
    render(<SaaSBusinessPageContent initialOrganizations={mockOrgs} />)
    expect(screen.queryByText(/Tienda verificada/i)).not.toBeInTheDocument()
    expect(screen.getByText('Tecnología y servicio técnico')).toBeInTheDocument()
  })

  it('sin negocios lo dice, sin cifras ni filtros vacíos', () => {
    render(<SaaSBusinessPageContent initialOrganizations={[]} />)
    expect(screen.getByText('Todavía no hay negocios publicados')).toBeInTheDocument()
    expect(screen.queryByText('negocios publicados')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filtrar por rubro' })).not.toBeInTheDocument()
  })
})
