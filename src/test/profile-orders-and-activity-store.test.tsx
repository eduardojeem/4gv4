import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfileOrders, type ProfileOrder } from '@/components/profile/profile-orders'
import { ProfileActivity } from '@/components/profile/profile-activity'

describe('ProfileOrders store attribution', () => {
  it('displays store badge and store link when order has organization info', () => {
    const mockOrders: ProfileOrder[] = [
      {
        id: 'ord-1',
        order_number: 'ORD-2026-001',
        status: 'PENDING',
        payment_status: 'PAID',
        fulfillment_type: 'DELIVERY',
        customer_address: 'Av. España 1234',
        estimated_delivery_date: '2026-09-10',
        total: 150000,
        created_at: '2026-09-01T10:00:00Z',
        organization: {
          id: 'org-1',
          name: 'TechStore Central',
          slug: 'techstore-central',
          logo_url: null,
        },
      },
    ]

    render(<ProfileOrders orders={mockOrders} />)

    expect(screen.getByText(/ORD-2026-001/i)).toBeInTheDocument()
    expect(screen.getByText(/TechStore Central/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Tienda$/i })).toHaveAttribute(
      'href',
      '/techstore-central/inicio'
    )
  })
})

describe('ProfileActivity workshop attribution', () => {
  it('identifica la seccion como reparaciones y puede ocultarla si no hay actividad', () => {
    const { container } = render(<ProfileActivity repairs={[]} hideWhenEmpty />)

    expect(container).toBeEmptyDOMElement()
  })

  it('displays workshop badge and workshop link when repair has organization info', () => {
    const mockRepairs = [
      {
        id: 'rep-1',
        ticket_number: 'TCK-9901',
        brand: 'Apple',
        model: 'iPhone 13',
        status: 'reparacion',
        created_at: '2026-09-02T14:30:00Z',
        final_cost: 350000,
        paid_amount: 0,
        payment_status: 'pending',
        organization: {
          id: 'org-2',
          name: 'ElectroReparaciones Express',
          slug: 'electro-express',
          logo_url: null,
        },
      },
    ]

    render(<ProfileActivity repairs={mockRepairs} />)

    expect(screen.getByRole('heading', { name: /reparaciones recientes/i })).toBeInTheDocument()
    expect(screen.getByText(/Apple iPhone 13/i)).toBeInTheDocument()
    expect(screen.getByText(/TCK-9901/i)).toBeInTheDocument()
    expect(screen.getByText(/ElectroReparaciones Express/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Taller$/i })).toHaveAttribute(
      'href',
      '/electro-express/inicio'
    )
  })
})
