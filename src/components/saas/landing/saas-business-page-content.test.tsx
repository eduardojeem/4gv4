import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SaaSBusinessPageContent } from './saas-business-page-content'

const mockOrgs = [
  {
    id: 'org-1',
    name: 'MegaTech Store & Lab',
    slug: 'megatech',
    plan: 'PRO',
    logo_url: null,
    rubro: 'tecnologia',
    city: 'Asunción',
    slogan: 'Tecnología y Servicio Técnico',
    products_count: 50,
    featured_products: [],
    created_at: '2024-01-01',
  },
  {
    id: 'org-2',
    name: 'Ferretería & Repuestos Central',
    slug: 'ferreteriacentral',
    plan: 'ENTERPRISE',
    logo_url: null,
    rubro: 'ferreteria',
    city: 'San Lorenzo',
    slogan: 'Herramientas y repuestos',
    products_count: 120,
    featured_products: [],
    created_at: '2024-01-01',
  },
  {
    id: 'org-3',
    name: 'Doctor Phone Taller Oficial',
    slug: 'doctorphone',
    plan: 'PRO',
    logo_url: null,
    rubro: 'tecnologia',
    city: 'Ciudad del Este',
    slogan: 'Reparación express',
    products_count: 30,
    featured_products: [],
    created_at: '2024-01-01',
  },
  {
    id: 'org-4',
    name: 'Boutique & Accesorios Aura',
    slug: 'auraboutique',
    plan: 'PRO',
    logo_url: null,
    rubro: 'indumentaria',
    city: 'Encarnación',
    slogan: 'Moda y accesorios',
    products_count: 80,
    featured_products: [],
    created_at: '2024-01-01',
  },
]

describe('SaaSBusinessPageContent', () => {
  it('renderiza el hero publicitario con llamada a la acción y marquee de comercios', () => {
    render(<SaaSBusinessPageContent initialOrganizations={mockOrgs} />)

    expect(
      screen.getByRole('heading', {
        name: /Negocios que crecen con nuestra plataforma/i,
      })
    ).toBeInTheDocument()

    expect(screen.getByText(/Comercios & Talleres Adheridos/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Publicar y Digitalizar Mi Negocio/i).length).toBeGreaterThanOrEqual(1)
  })

  it('muestra las tiendas destacadas con su información comercial relevante', () => {
    render(<SaaSBusinessPageContent initialOrganizations={mockOrgs} />)

    expect(screen.getAllByText(/MegaTech Store & Lab/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Ferretería & Repuestos Central/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Doctor Phone Taller Oficial/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Boutique & Accesorios Aura/i).length).toBeGreaterThanOrEqual(1)
  })

  it('permite filtrar tiendas por rubro comercial mediante las píldoras de filtro', () => {
    render(<SaaSBusinessPageContent initialOrganizations={mockOrgs} />)

    const ferreteriaBtn = screen.getByRole('button', { name: /Ferreterías & Repuestos/i })
    expect(ferreteriaBtn).toBeInTheDocument()

    fireEvent.click(ferreteriaBtn)

    // Ferretería Central debe seguir mostrándose en el listado
    expect(screen.getAllByText(/Ferretería & Repuestos Central/i).length).toBeGreaterThanOrEqual(1)
  })

  it('filtra en tiempo real según el texto de búsqueda por nombre o ciudad', () => {
    render(<SaaSBusinessPageContent initialOrganizations={mockOrgs} />)

    const searchInput = screen.getByPlaceholderText(/Buscar tienda o ciudad/i)
    expect(searchInput).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'Doctor Phone' } })

    expect(screen.getAllByText(/Doctor Phone Taller Oficial/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renderiza los beneficios clave de adherirse a la plataforma', () => {
    render(<SaaSBusinessPageContent initialOrganizations={mockOrgs} />)

    expect(screen.getByText(/Catálogo Web Automático/i)).toBeInTheDocument()
    expect(screen.getByText(/Operación 100% Blindada/i)).toBeInTheDocument()
    expect(screen.getByText(/Visibilidad en el Marketplace/i)).toBeInTheDocument()
  })
})
