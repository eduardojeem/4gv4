import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SaaSSolutionsPageContent } from './saas-solutions-page-content'

describe('SaaSSolutionsPageContent', () => {
  it('muestra el hero con la propuesta de valor central y llamadas a la acción', () => {
    render(<SaaSSolutionsPageContent />)

    expect(
      screen.getByRole('heading', {
        name: /Eliminamos el desorden en tu taller, tienda y mostrador/i,
      })
    ).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Empezar Prueba Gratis/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver Planes y Precios/i })).toBeInTheDocument()
  })

  it('muestra la sección de rubros y tipos de negocios admitidos', () => {
    render(<SaaSSolutionsPageContent />)

    expect(screen.getByText(/Versatilidad Multirubro/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /^Talleres de Reparación$/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/Tecnología y Electrónica/i)).toBeInTheDocument()
    expect(screen.getByText(/Ferreterías y Repuesteras/i)).toBeInTheDocument()
    expect(screen.getByText(/Tiendas Minoristas y Bazares/i)).toBeInTheDocument()
    expect(screen.getByText(/Negocios con Venta Online/i)).toBeInTheDocument()
    expect(screen.getByText(/Cadenas y Multirubro/i)).toBeInTheDocument()
  })

  it('presenta la matriz de transformación operativa (problemas habituales vs soluciones del sistema)', () => {
    render(<SaaSSolutionsPageContent />)

    expect(
      screen.getByText(/¿Qué cambia al implementar nuestro sistema\?/i)
    ).toBeInTheDocument()

    // Categorías y soluciones clave
    expect(screen.getByText(/Taller Técnico y Órdenes de Servicio/i)).toBeInTheDocument()
    expect(screen.getByText(/Punto de Venta y Fugas de Caja/i)).toBeInTheDocument()
    expect(screen.getByText(/Inventario y Repuestos Fantasma/i)).toBeInTheDocument()
    expect(screen.getByText(/Clientes Duplicados y Desconectados/i)).toBeInTheDocument()
    expect(screen.getByText(/Márgenes de Ganancia Inciertos/i)).toBeInTheDocument()
    expect(screen.getByText(/Tienda Online Desincronizada/i)).toBeInTheDocument()
  })

  it('detalla los 5 pilares modulares del SaaS', () => {
    render(<SaaSSolutionsPageContent />)

    expect(screen.getAllByText(/1\. Sistema Integral para Taller Técnico/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/2\. Punto de Venta \(POS\) y Caja Blindada/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/3\. Inventario Inteligente y Multirubro/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/4\. Fidelización de Clientes, Puntos y Sorteos/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/5\. Finanzas Claras y Márgenes en Tiempo Real/i).length).toBeGreaterThanOrEqual(1)
  })

  it('permite abrir y consultar las preguntas frecuentes de soluciones', () => {
    render(<SaaSSolutionsPageContent />)

    const faqButton = screen.getByRole('button', {
      name: /¿Qué soluciona principalmente este sistema frente a un Excel o cuadernos\?/i,
    })
    expect(faqButton).toBeInTheDocument()

    // Click para expandir la respuesta
    fireEvent.click(faqButton)

    expect(
      screen.getByText(/Elimina las órdenes extraviadas, el stock que no coincide/i)
    ).toBeInTheDocument()
  })
})
