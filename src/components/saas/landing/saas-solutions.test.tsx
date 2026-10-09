import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SaaSSolutionsPageContent } from './saas-solutions-page-content'
import { SaaSBusinessSection } from './saas-business-section'

describe('Soluciones públicas por tarea y rubro', () => {
  it('orienta al registro y a los planes sin prometer una prueba universal', () => {
    render(<SaaSSolutionsPageContent />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Encontrá la solución para tu día a día')
    expect(screen.getByRole('link', { name: 'Crear mi negocio' })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: 'Comparar planes y precios' })).toHaveAttribute('href', '/saas/planes')
    expect(screen.queryByText(/Empezar Prueba Gratis/)).not.toBeInTheDocument()
  })

  it('ofrece accesos a seis soluciones con destinos existentes', () => {
    render(<SaaSSolutionsPageContent />)
    const navigation = screen.getByRole('navigation', { name: 'Buscar soluciones por tarea' })
    const links = within(navigation).getAllByRole('link')
    expect(links).toHaveLength(6)
    for (const link of links) {
      const target = document.querySelector(link.getAttribute('href')!)
      expect(target).not.toBeNull()
      expect(target).toHaveTextContent('Qué necesitás:')
      expect(target).toHaveTextContent('Cómo se usa')
    }
  })

  it('incluye mercados, ropa, barberías y reservas con enlaces por tarea', () => {
    render(<SaaSBusinessSection />)
    for (const name of ['Mercados y despensas', 'Tiendas de ropa', 'Barberías y peluquerías', 'Negocios con reservas']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: `Ver herramientas para ${name}` })).toHaveAttribute('href', expect.stringContaining('/saas/soluciones#'))
    }
    expect(screen.queryByText(/Sucursales Ilimitadas|Cero discrepancias/)).not.toBeInTheDocument()
  })

  it('aclara la configuración necesaria para reservas y la dependencia del plan', () => {
    render(<SaaSSolutionsPageContent />)
    const reservations = document.getElementById('reservas')!
    expect(reservations).toHaveTextContent('Requiere el módulo Servicios')
    expect(reservations).toHaveTextContent('reservas online habilitadas')
    expect(screen.getByText(/La disponibilidad depende del plan/)).toBeInTheDocument()
    const faq = screen.getByText('¿Las reservas online se activan automáticamente?').closest('details')!
    expect(faq).toHaveTextContent('No. Primero configurá servicios')
  })
})
