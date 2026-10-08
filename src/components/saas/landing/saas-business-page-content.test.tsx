import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SaaSBusinessPageContent } from './saas-business-page-content'
import { pageDirectory } from '@/lib/public/business-directory'
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

const many = Array.from({ length: 12 }, (_, i) => org(`m-${i}`, `Comercio ${String(i + 1).padStart(2, '0')}`, 'comercio', 'Luque', 30 - i))

const names = () => screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)

/** El endpoint de verdad, contestado con la misma función que usa el servidor. */
function mockDirectoryApi(stores: MarketplaceOrganization[]) {
  return vi.fn(async (url: string) => {
    const params = new URL(url, 'http://localhost').searchParams
    const data = pageDirectory(stores, { page: Number(params.get('page')), rubro: params.get('rubro'), q: params.get('q') })
    return { ok: true, json: async () => ({ success: true, data }) }
  })
}

describe('SaaSBusinessPageContent', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('muestra la portada con cifras reales de todos los negocios publicados', () => {
    render(<SaaSBusinessPageContent initialPage={pageDirectory(mockOrgs, { page: 1 })} />)
    expect(screen.getByRole('heading', { name: /Negocios que crecen con nuestra plataforma/i })).toBeInTheDocument()
    expect(screen.getByText('negocios publicados').nextSibling).toHaveTextContent('4')
    expect(screen.getByText('ciudades').nextSibling).toHaveTextContent('3')
    expect(screen.getByText('productos publicados').nextSibling).toHaveTextContent('250')
  })

  it('muestra cada tienda, primero las que tienen más productos', () => {
    render(<SaaSBusinessPageContent initialPage={pageDirectory(mockOrgs, { page: 1 })} />)
    expect(names()).toEqual(['Ferretería Central', 'Boutique Aura', 'Celulares Centro', 'Taller del Este'])
  })

  it('pagina de a 9 y pide la página siguiente al servidor', async () => {
    const fetchMock = mockDirectoryApi(many)
    vi.stubGlobal('fetch', fetchMock)
    render(<SaaSBusinessPageContent initialPage={pageDirectory(many, { page: 1 })} />)
    expect(names()).toHaveLength(9)
    expect(screen.getByText('Mostrando 1–9 de 12 negocios')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(names()).toEqual(['Comercio 10', 'Comercio 11', 'Comercio 12']))
    expect(fetchMock).toHaveBeenCalledWith('/api/public/business-directory?page=2')
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled()
  })

  it('sin más de una página no muestra la paginación', () => {
    render(<SaaSBusinessPageContent initialPage={pageDirectory(mockOrgs, { page: 1 })} />)
    expect(screen.queryByRole('navigation', { name: 'Páginas de negocios' })).not.toBeInTheDocument()
  })

  it('los filtros son los rubros que hay, con cuántos negocios tiene cada uno', async () => {
    vi.stubGlobal('fetch', mockDirectoryApi(mockOrgs))
    render(<SaaSBusinessPageContent initialPage={pageDirectory(mockOrgs, { page: 1 })} />)
    const filtros = within(screen.getByRole('group', { name: 'Filtrar por rubro' }))
    expect(filtros.getByRole('button', { name: /Tecnología\s*2/ })).toBeInTheDocument()
    expect(filtros.queryByRole('button', { name: /Automotor/ })).not.toBeInTheDocument()

    fireEvent.click(filtros.getByRole('button', { name: /Ferretería\s*1/ }))
    await waitFor(() => expect(names()).toEqual(['Ferretería Central']))
  })

  it('busca por nombre, ciudad o rubro', async () => {
    vi.stubGlobal('fetch', mockDirectoryApi(mockOrgs))
    render(<SaaSBusinessPageContent initialPage={pageDirectory(mockOrgs, { page: 1 })} />)
    fireEvent.change(screen.getByPlaceholderText(/Buscar tienda o ciudad/i), { target: { value: 'moda' } })
    await waitFor(() => expect(names()).toEqual(['Boutique Aura']))
  })

  it('si falla la carga lo dice y deja la página que había', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ success: false }) })))
    render(<SaaSBusinessPageContent initialPage={pageDirectory(many, { page: 1 })} />)
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los negocios')
    expect(names()).toHaveLength(9)
  })

  it('no inventa texto para una tienda que no escribió nada', () => {
    render(<SaaSBusinessPageContent initialPage={pageDirectory(mockOrgs, { page: 1 })} />)
    expect(screen.queryByText(/Tienda verificada/i)).not.toBeInTheDocument()
    expect(screen.getByText('Tecnología y servicio técnico')).toBeInTheDocument()
  })

  it('sin negocios lo dice, sin cifras ni filtros vacíos', () => {
    render(<SaaSBusinessPageContent initialPage={pageDirectory([], { page: 1 })} />)
    expect(screen.getByText('Todavía no hay negocios publicados')).toBeInTheDocument()
    expect(screen.queryByText('negocios publicados')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filtrar por rubro' })).not.toBeInTheDocument()
  })
})
